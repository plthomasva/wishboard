import express from 'express';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isS3Mode = Boolean(process.env.AWS_S3_BUCKET);
const imagesDir = isS3Mode ? '/tmp' : path.resolve(__dirname, '../../../data/images');
if (!isS3Mode) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imagesDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    // A client-input validation error: mark it safe-to-expose with a 400 so the
    // JSON error handler returns the helpful message (not a generic 500).
    const err = new Error('Invalid file type. Only PNG, JPG, and WEBP are allowed.');
    err.status = 400;
    err.expose = true;
    cb(err, false);
  }
};
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

import { customAlphabet } from 'nanoid';
import db from '../db.js';
import {
  getUserFromToken,
  getTokenFromRequestHeader,
  hashPassphrase,
  verifyPassphrase,
  parseJsonArray,
  normalizeArrayInput,
  createSalt,
  requireAuth,
} from '../auth.js';
import { generatePassphrase } from '../../client/src/passphrase.js';
import logger from '../logger.js';
import { getRules } from '../rulesManager.js';
import { emitNewWish, emitWishFlagged, emitWishDeleted } from '../socket.js';

const router = express.Router();
const idGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

const getRequestUser = async (req) => {
  const token = getTokenFromRequestHeader(req);
  return await getUserFromToken(token);
};

export const normalizeToken = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

export const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
};

export const hasToken = (str, token) => {
  const escapedToken = escapeRegExp(token);
  return new RegExp(String.raw`\b${escapedToken}\b`, 'i').test(normalizeToken(str));
};

export const parseJsonSafe = (str) => {
  if (!str) return {};
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
};

export const parseAttributesInput = (rawAttrs) => {
  const result = {};
  if (!rawAttrs) return result;

  let parsed = rawAttrs;
  if (typeof rawAttrs === 'string') {
    parsed = parseJsonSafe(rawAttrs);
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    for (const key of Object.keys(parsed)) {
      result[key] = normalizeArrayInput(parsed[key]);
    }
  }
  return result;
};

const matchesContext = (rule, contextProfile, rules = []) => {
  if (!rule.context_attribute || !rule.context_value) return true;
  if (!contextProfile) return false;

  const ctxVals = contextProfile[rule.context_attribute] || [];
  const expandedCtxVals = getExpandedDesired(ctxVals, rule.context_attribute, rules, null);
  return expandedCtxVals.some((v) => hasToken(v, rule.context_value));
};

export const getExpandedDesired = (desiredVals, category, rules, contextProfile = undefined) => {
  const result = new Set(desiredVals.map(normalizeToken));
  const expandRules = rules.filter(
    (r) =>
      r.rule_type === 'expansion' &&
      r.trigger_attribute === category &&
      r.target_attribute === category
  );

  for (const val of desiredVals) {
    for (const rule of expandRules) {
      if (hasToken(val, rule.trigger_value)) {
        if (contextProfile !== undefined && !matchesContext(rule, contextProfile, rules)) {
          continue;
        }
        const targets = rule.target_value.split(',').map((t) => t.trim().toLowerCase());
        targets.forEach((t) => result.add(t));
      }
    }
  }
  return Array.from(result);
};

export const getExclusionConflicts = (attributes, rules) => {
  const conflicts = [];
  const expandedAttrs = {};
  for (const key of Object.keys(attributes)) {
    const vals = attributes[key] || [];
    expandedAttrs[key] = getExpandedDesired(vals, key, rules, attributes);
  }

  const exclusionRules = rules.filter((r) => r.rule_type === 'exclusion');

  for (const rule of exclusionRules) {
    const triggerTokens = rule.trigger_value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    const targetTokens = rule.target_value
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const hasTrigger = triggerTokens.some((token) =>
      expandedAttrs[rule.trigger_attribute]?.some((attrVal) => hasToken(attrVal, token))
    );

    let hasContext = true;
    if (rule.context_attribute && rule.context_value) {
      const contextTokens = rule.context_value
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      hasContext = contextTokens.some((token) =>
        expandedAttrs[rule.context_attribute]?.some((attrVal) => hasToken(attrVal, token))
      );
    }

    const hasTarget = targetTokens.some((token) =>
      expandedAttrs[rule.target_attribute]?.some((attrVal) => hasToken(attrVal, token))
    );

    if (hasTrigger && hasContext && hasTarget) {
      conflicts.push({
        rule_id: rule.id,
        trigger_attribute: rule.trigger_attribute,
        trigger_value: rule.trigger_value,
        context_attribute: rule.context_attribute || null,
        context_value: rule.context_value || null,
        target_attribute: rule.target_attribute,
        target_value: rule.target_value,
        message: `"${rule.trigger_value}" and "${rule.target_value}" are mutually exclusive.`,
      });
    }
  }

  return conflicts;
};

const evaluateRuleConditions = (rule, userAttributes, rules = []) => {
  const triggerVals = userAttributes[rule.trigger_attribute] || [];
  const triggerMatch = triggerVals.some((v) => hasToken(v, rule.trigger_value));

  let contextMatch = true;
  if (rule.context_attribute && rule.context_value) {
    const ctxVals = userAttributes[rule.context_attribute] || [];
    const expandedCtxVals = getExpandedDesired(ctxVals, rule.context_attribute, rules);
    contextMatch = expandedCtxVals.some((v) => hasToken(v, rule.context_value));
  }

  return triggerMatch && contextMatch;
};

const enrichAttributes = (userAttributes, targetCategory, rules) => {
  const enriched = new Set((userAttributes[targetCategory] || []).map(normalizeToken));
  const enrichmentRules = rules.filter(
    (r) => r.rule_type === 'enrichment' && r.target_attribute === targetCategory
  );

  for (const rule of enrichmentRules) {
    if (evaluateRuleConditions(rule, userAttributes, rules)) {
      enriched.add(rule.target_value);
    }
  }
  return Array.from(enriched);
};

const buildAcceptedSet = (userAttributes, targetCategory, rules) => {
  const accepted = new Set();
  const acceptanceRules = rules.filter(
    (r) => r.rule_type === 'acceptance' && r.target_attribute === targetCategory
  );

  for (const rule of acceptanceRules) {
    if (evaluateRuleConditions(rule, userAttributes, rules)) {
      const targets = rule.target_value.split(',').map((t) => t.trim().toLowerCase());
      targets.forEach((t) => accepted.add(t));
    }
  }
  return accepted;
};

const applyCrossRule = (val, rule, contextProfile, rules, result) => {
  if (contextProfile !== undefined && !matchesContext(rule, contextProfile, rules)) return;
  if (hasToken(val, rule.trigger_value)) {
    const targets = rule.target_value.split(',').map((t) => t.trim().toLowerCase());
    targets.forEach((t) => result.add(t));
  }
  if (rule.target_value.split(',').some((t) => hasToken(val, t.trim().toLowerCase()))) {
    result.add(rule.trigger_value.toLowerCase());
  }
};

const getCrossMatchedDesired = (desiredVals, category, rules, contextProfile = undefined) => {
  const result = new Set();
  const crossRules = rules.filter(
    (r) =>
      r.rule_type === 'cross_match' &&
      r.trigger_attribute === category &&
      r.target_attribute === category
  );

  for (const val of desiredVals) {
    for (const rule of crossRules) {
      applyCrossRule(val, rule, contextProfile, rules, result);
    }
  }
  return Array.from(result);
};

const matchesAttribute = (
  searcherVals,
  desiredVals,
  category,
  rules,
  contextProfile = undefined
) => {
  if (!desiredVals || desiredVals.length === 0) return true;
  if (!searcherVals || searcherVals.length === 0) return false;

  const normalizedSearcher = new Set(searcherVals.map(normalizeToken));
  const expandedDesired = getExpandedDesired(desiredVals, category, rules, contextProfile);
  const crossMatchedDesired = getCrossMatchedDesired(desiredVals, category, rules, contextProfile);
  const expandedCrossMatched = getExpandedDesired(
    Array.from(crossMatchedDesired),
    category,
    rules,
    contextProfile
  );

  const allAcceptable = new Set([
    ...expandedDesired,
    ...crossMatchedDesired,
    ...expandedCrossMatched,
  ]);

  return Array.from(allAcceptable).some((desired) => normalizedSearcher.has(desired));
};

const matchesGenderPreferenceImplicit = (searcherAttributes, desiredGenders, rules) => {
  if (!desiredGenders || desiredGenders.length === 0) return true;
  const searcherOrientations = searcherAttributes.orientation || [];
  // No orientation means we have NO basis to infer who this person wants. Treating
  // that as "wants everyone" is the #199 over-match (a woman's wish with no stated
  // orientation and no desired gender was shown to a straight man). With no explicit
  // desired gender and no orientation to derive one from, there is no established
  // preference, so it must not match — the user should set an orientation or an
  // explicit desired gender to be matched implicitly. See docs/MATCHING_RULES.md.
  if (!searcherOrientations || searcherOrientations.length === 0) return false;

  const accepted = buildAcceptedSet(searcherAttributes, 'gender', rules);
  if (accepted.size === 0) return false;

  return matchesAttribute(Array.from(accepted), desiredGenders, 'gender', rules);
};

export const isCompatible = (wish, searcher, rules = []) => {
  const creatorProfileRaw =
    typeof wish.creator_attributes === 'string'
      ? parseJsonSafe(wish.creator_attributes)
      : wish.creator_attributes || {};

  const desiredProfileRaw =
    typeof wish.desired_attributes === 'string'
      ? parseJsonSafe(wish.desired_attributes)
      : wish.desired_attributes || {};

  const searcherProfileRaw =
    typeof searcher.identity_attributes === 'string'
      ? parseJsonSafe(searcher.identity_attributes)
      : searcher.identity_attributes || {};

  const creatorProfile = {};
  for (const key of Object.keys(creatorProfileRaw)) {
    creatorProfile[key] = enrichAttributes(creatorProfileRaw, key, rules);
  }

  const searcherProfile = {};
  for (const key of Object.keys(searcherProfileRaw)) {
    searcherProfile[key] = enrichAttributes(searcherProfileRaw, key, rules);
  }

  // 1. Does the searcher want the wish creator?
  // We use creatorProfile as context when evaluating if searcher wants creator
  const searcherWantsCreatorGender = matchesGenderPreferenceImplicit(
    searcherProfile,
    creatorProfile.gender,
    rules
  );

  // 2. Does the wish creator want the searcher?
  // We use searcherProfile as context when evaluating if creator wants searcher
  let creatorWantsSearcherGender = false;
  const desiredGenders = desiredProfileRaw.gender || [];
  if (desiredGenders.length > 0) {
    creatorWantsSearcherGender = matchesAttribute(
      searcherProfile.gender,
      desiredGenders,
      'gender',
      rules,
      searcherProfile
    );
  } else {
    creatorWantsSearcherGender = matchesGenderPreferenceImplicit(
      creatorProfile,
      searcherProfile.gender,
      rules
    );
  }

  let creatorWantsSearcherAttributes = true;
  for (const [cat, desiredVals] of Object.entries(desiredProfileRaw)) {
    if (cat === 'gender') continue;
    if (!matchesAttribute(searcherProfile[cat] || [], desiredVals, cat, rules, searcherProfile)) {
      creatorWantsSearcherAttributes = false;
      break;
    }
  }

  return searcherWantsCreatorGender && creatorWantsSearcherGender && creatorWantsSearcherAttributes;
};

router.post('/', upload.single('image'), async (req, res) => {
  const {
    content,
    passphrase,
    creator_genders,
    creator_orientations,
    creator_roles,
    desired_genders,
    desired_orientations,
    desired_roles,
    contacts,
    wishmail_enabled,
  } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Wish content is required.' });
  }

  const imageId = req.file ? req.file.filename : null;

  if (req.file && isS3Mode) {
    const safePath = path.join(imagesDir, path.basename(req.file.filename));
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const s3 = new S3Client();
      const fileStream = fs.createReadStream(safePath);

      await s3.send(
        new PutObjectCommand({
          Bucket: process.env.AWS_S3_BUCKET,
          Key: `images/${req.file.filename}`,
          Body: fileStream,
          ContentType: req.file.mimetype,
        })
      );

      fs.unlinkSync(safePath);
      logger.info('Uploaded image to S3', {
        bucket: process.env.AWS_S3_BUCKET,
        key: `images/${req.file.filename}`,
      });
    } catch (err) {
      logger.error('Failed to upload image to S3:', { error: err.message });
      if (fs.existsSync(safePath)) {
        fs.unlinkSync(safePath);
      }
      return res.status(500).json({ error: 'Failed to process image upload.' });
    }
  }

  const user = await getRequestUser(req);
  const userId = user?.id || null;
  const id = idGenerator();
  let secret = null;
  let secretHash = null;

  if (!userId) {
    secret = passphrase?.trim() || generatePassphrase();
    const salt = createSalt();
    const hash = await hashPassphrase(secret, salt);
    secretHash = `${salt}:${hash}`;
  }

  let creatorAttrs = parseAttributesInput(req.body.creator_attributes);
  if (
    Object.keys(creatorAttrs).length === 0 &&
    (creator_genders !== undefined ||
      creator_orientations !== undefined ||
      creator_roles !== undefined)
  ) {
    creatorAttrs = {
      gender: normalizeArrayInput(creator_genders),
      orientation: normalizeArrayInput(creator_orientations),
      role: normalizeArrayInput(creator_roles),
    };
  }

  if (user && user.identity_attributes) {
    // Merge user identity attributes if logged in
    creatorAttrs = {
      ...user.identity_attributes,
      ...creatorAttrs,
    };
  }

  let desiredAttrs = parseAttributesInput(req.body.desired_attributes);
  if (
    Object.keys(desiredAttrs).length === 0 &&
    (desired_genders !== undefined ||
      desired_orientations !== undefined ||
      desired_roles !== undefined)
  ) {
    desiredAttrs = {
      gender: normalizeArrayInput(desired_genders),
      orientation: normalizeArrayInput(desired_orientations),
      role: normalizeArrayInput(desired_roles),
    };
  }

  const rules = getRules();
  const creatorConflicts = getExclusionConflicts(creatorAttrs, rules);
  if (creatorConflicts.length > 0) {
    return res.status(400).json({
      error: `Validation failed: Creator attributes conflict. ${creatorConflicts.map((c) => c.message).join(' ')}`,
    });
  }

  const desiredConflicts = getExclusionConflicts(desiredAttrs, rules);
  if (desiredConflicts.length > 0) {
    return res.status(400).json({
      error: `Validation failed: Desired criteria conflict. ${desiredConflicts.map((c) => c.message).join(' ')}`,
    });
  }

  const parsedContacts = Array.isArray(contacts) ? contacts : [];
  const wme = wishmail_enabled ? 1 : 0;

  const now = new Date().toISOString();
  await db
    .prepare(
      'INSERT INTO wishes (id, user_id, content, secret_hash, contacts, wishmail_enabled, created_at, updated_at, image_id, creator_attributes, desired_attributes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    .run(
      id,
      userId,
      content.trim(),
      secretHash,
      JSON.stringify(parsedContacts),
      wme,
      now,
      now,
      imageId,
      JSON.stringify(creatorAttrs),
      JSON.stringify(desiredAttrs)
    );

  logger.info('Wish created', { user_id: userId, wish_id: id });
  const newWish = {
    id,
    content: content.trim(),
    created_at: now,
    creator_attributes: creatorAttrs,
    desired_attributes: desiredAttrs,
    contacts: parsedContacts,
    wishmail_enabled: Boolean(wme),
    image_id: imageId,
    is_active: true,
  };
  emitNewWish(newWish);

  res.status(201).json({ id, secret });
});

router.get('/random', async (req, res) => {
  const limit = Number(req.query.limit || 12);
  const rows = await db
    .prepare(
      'SELECT w.id, w.content, w.creator_attributes, w.contacts, w.wishmail_enabled, w.image_id FROM wishes w LEFT JOIN users u ON w.user_id = u.id WHERE w.is_active = 1 AND (u.id IS NULL OR u.is_active = 1) ORDER BY RANDOM() LIMIT ?'
    )
    .all(limit);
  res.json(
    rows.map((wish) => ({
      id: wish.id,
      content: wish.content,
      creator_attributes: parseJsonSafe(wish.creator_attributes),
      contacts: parseJsonArray(wish.contacts),
      wishmail_enabled: Boolean(wish.wishmail_enabled),
      image_id: wish.image_id,
    }))
  );
});

/**
 * Parse a comma-separated list of IDs from a query parameter that may be a
 * string or an array of strings (express can produce either).
 * Trims, deduplicates, and caps at 200 entries.
 * @param {string | string[] | undefined} raw
 * @returns {string[]}
 */
function parseQueryIds(raw) {
  let str = '';
  if (typeof raw === 'string') {
    str = raw;
  } else if (Array.isArray(raw)) {
    str = raw.map(String).join(',');
  }
  return str
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 200);
}

/**
 * Append exclusion filter clauses to the SQL query.
 * @param {object} params
 * @param {string} params.sql
 * @param {any[]} params.args
 * @param {object|null} params.searcher
 * @param {string | string[] | undefined} params.excludeQuery
 * @returns {{ sql: string; args: any[] }}
 */
function applyExclusionFilter({ sql, args, searcher, excludeQuery }) {
  let updatedSql = sql;
  const updatedArgs = [...args];
  if (searcher) {
    updatedSql +=
      ' AND NOT EXISTS (SELECT 1 FROM wish_exclusions x WHERE x.wish_id = w.id AND x.user_id = ?)';
    updatedArgs.push(searcher.id);
  } else {
    const excludeIds = parseQueryIds(excludeQuery);
    if (excludeIds.length > 0) {
      const placeholders = excludeIds.map(() => '?').join(', ');
      updatedSql += ` AND w.id NOT IN (${placeholders})`;
      updatedArgs.push(...excludeIds);
    }
  }
  return { sql: updatedSql, args: updatedArgs };
}

router.get('/', async (req, res) => {
  const searcher = await getRequestUser(req);
  const query = (req.query.q || '').trim();
  const manualAttributes = req.query.attributes ? parseJsonSafe(req.query.attributes) : {};
  let searcherAttributes = {};
  if (searcher?.identity_attributes) {
    searcherAttributes =
      typeof searcher.identity_attributes === 'string'
        ? parseJsonSafe(searcher.identity_attributes)
        : searcher.identity_attributes;
  } else {
    searcherAttributes = {
      gender:
        searcher?.identity_genders ?? normalizeArrayInput(req.query.sg ?? manualAttributes.gender),
      orientation:
        searcher?.identity_orientations ??
        normalizeArrayInput(req.query.so ?? manualAttributes.orientation),
      role: searcher?.identity_roles ?? normalizeArrayInput(req.query.sr ?? manualAttributes.role),
    };
  }

  for (const [key, value] of Object.entries(manualAttributes)) {
    if (!searcherAttributes[key]) {
      searcherAttributes[key] = normalizeArrayInput(value);
    }
  }

  const ignoreAttributes =
    req.query.ignore_attributes === '1' ||
    req.query.ignore_attributes === 'true' ||
    (!searcher &&
      Object.keys(searcherAttributes).every(
        (k) => !searcherAttributes[k] || searcherAttributes[k].length === 0
      ));

  const searcherProfile = {
    identity_attributes: searcherAttributes,
  };

  let sql =
    'SELECT w.id, w.content, w.creator_attributes, w.desired_attributes, w.contacts, w.wishmail_enabled, w.image_id FROM wishes w LEFT JOIN users u ON w.user_id = u.id WHERE w.is_active = 1 AND (u.id IS NULL OR u.is_active = 1)';
  let args = [];

  if (query) {
    sql += ' AND w.content LIKE ?';
    args.push(`%${query}%`);
  }

  if (req.query.ids) {
    const filterIds = parseQueryIds(req.query.ids);
    if (filterIds.length > 0) {
      const placeholders = filterIds.map(() => '?').join(', ');
      sql += ` AND w.id IN (${placeholders})`;
      args.push(...filterIds);
    }
  }

  const includeExcluded =
    req.query.include_excluded === '1' || req.query.include_excluded === 'true';

  if (!includeExcluded) {
    ({ sql, args } = applyExclusionFilter({
      sql,
      args,
      searcher,
      excludeQuery: req.query.exclude,
    }));
  }

  sql += ' ORDER BY w.created_at DESC LIMIT 50';

  const rows = await db.prepare(sql).all(...args);

  const rules = getRules();
  const filtered = ignoreAttributes
    ? rows
    : rows.filter((wish) => isCompatible(wish, searcherProfile, rules));
  res.json(
    filtered.map((wish) => ({
      id: wish.id,
      content: wish.content,
      creator_attributes: parseJsonSafe(wish.creator_attributes),
      desired_attributes: parseJsonSafe(wish.desired_attributes),
      contacts: parseJsonArray(wish.contacts),
      wishmail_enabled: Boolean(wish.wishmail_enabled),
      image_id: wish.image_id,
    }))
  );
});

// List excluded wish IDs - must be before /:id to avoid param capture
router.get('/exclusions/list', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const rows = await db
    .prepare('SELECT wish_id FROM wish_exclusions WHERE user_id = ?')
    .all(userId);

  res.json(rows.map((row) => row.wish_id));
});

// List full excluded wishes - must be before /:id to avoid param capture
router.get('/exclusions', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const rows = await db
    .prepare(
      'SELECT w.id, w.content, w.creator_attributes, w.desired_attributes, w.contacts, w.wishmail_enabled, w.image_id FROM wish_exclusions x JOIN wishes w ON x.wish_id = w.id WHERE x.user_id = ?'
    )
    .all(userId);

  res.json(
    rows.map((wish) => ({
      id: wish.id,
      content: wish.content,
      creator_attributes: parseJsonSafe(wish.creator_attributes),
      desired_attributes: parseJsonSafe(wish.desired_attributes),
      contacts: parseJsonArray(wish.contacts),
      wishmail_enabled: Boolean(wish.wishmail_enabled),
      image_id: wish.image_id,
    }))
  );
});

// Bulk import exclusions (when migrating from anonymous localStorage to user database on login)
// Must be before /:id to avoid param capture
router.post('/exclusions/import', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { ids } = req.body;

  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'List of IDs to exclude must be an array.' });
  }

  // Cap at 200 items to prevent abuse
  const cleanIds = ids
    .map((id) => String(id).trim())
    .filter(Boolean)
    .slice(0, 200);

  const now = new Date().toISOString();
  for (const id of cleanIds) {
    try {
      // Check if wish exists
      const wishExists = await db.prepare('SELECT 1 FROM wishes WHERE id = ?').get(id);
      if (wishExists) {
        await db
          .prepare(
            'INSERT OR IGNORE INTO wish_exclusions (user_id, wish_id, created_at) VALUES (?, ?, ?)'
          )
          .run(userId, id, now);
      }
    } catch (err) {
      logger.warn('Failed to import exclusion', { user_id: userId, wish_id: id, err });
    }
  }

  res.json({ success: true });
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const row = await db
    .prepare(
      'SELECT id, content, flagged, contacts, wishmail_enabled, created_at, updated_at, is_active, image_id FROM wishes WHERE id = ?'
    )
    .get(id);
  if (!row) {
    return res.status(404).json({ error: 'Wish not found.' });
  }
  row.contacts = parseJsonArray(row.contacts);
  row.wishmail_enabled = Boolean(row.wishmail_enabled);
  row.is_active = Boolean(row.is_active);
  res.json(row);
});

const getAuthorizedWish = async (req, res) => {
  const { id } = req.params;
  const secret = req.body?.secret;
  const user = await getRequestUser(req);

  const row = await db.prepare('SELECT secret_hash, user_id FROM wishes WHERE id = ?').get(id);
  if (!row) {
    res.status(404).json({ error: 'Wish not found.' });
    return null;
  }

  const isOwner = user?.id === row.user_id;
  const isAuthorized =
    isOwner ||
    (secret &&
      row.secret_hash &&
      (await verifyPassphrase(secret.trim(), ...row.secret_hash.split(':'))));

  if (!isAuthorized) {
    if (!secret && !isOwner && row.secret_hash) {
      res.status(401).json({ error: 'Secret token required for wish management.' });
    } else {
      res.status(403).json({ error: 'Invalid secret token or unauthorized.' });
    }
    return null;
  }

  return { row, user, id };
};

router.post('/:id/manage', async (req, res) => {
  const auth = await getAuthorizedWish(req, res);
  if (!auth) return;
  const { user, id, row } = auth;
  const { content, action } = req.body;

  if (action === 'delete') {
    await db.prepare('DELETE FROM wishmails WHERE wish_id = ?').run(id);
    await db.prepare('DELETE FROM wish_exclusions WHERE wish_id = ?').run(id);
    await db.prepare('DELETE FROM wishes WHERE id = ?').run(id);
    logger.info('Wish deleted by owner', { user_id: user?.id, wish_id: id });
    emitWishDeleted(id);
    return res.json({ success: true });
  }

  if (content?.trim()) {
    const { contacts, wishmail_enabled, new_passphrase } = req.body;
    const parsedContacts = Array.isArray(contacts) ? contacts : [];
    const wme = wishmail_enabled ? 1 : 0;
    const now = new Date().toISOString();

    let secretHashToUpdate = row.secret_hash;
    let newSecret = null;
    if (row.secret_hash && new_passphrase?.trim()) {
      const salt = createSalt();
      const hash = await hashPassphrase(new_passphrase.trim(), salt);
      secretHashToUpdate = `${salt}:${hash}`;
      newSecret = new_passphrase.trim();
    }

    await db
      .prepare(
        'UPDATE wishes SET content = ?, contacts = ?, wishmail_enabled = ?, secret_hash = ?, updated_at = ? WHERE id = ?'
      )
      .run(content.trim(), JSON.stringify(parsedContacts), wme, secretHashToUpdate, now, id);

    return res.json({ success: true, newSecret });
  }

  res.status(400).json({ error: 'Invalid update payload.' });
});

router.post('/:id/deactivate', async (req, res) => {
  const auth = await getAuthorizedWish(req, res);
  if (!auth) return;

  await db
    .prepare('UPDATE wishes SET is_active = 0, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), auth.id);
  emitWishDeleted(auth.id); // Immediately remove from UI
  res.json({ success: true });
});

router.post('/:id/reactivate', async (req, res) => {
  const auth = await getAuthorizedWish(req, res);
  if (!auth) return;

  await db
    .prepare('UPDATE wishes SET is_active = 1, updated_at = ? WHERE id = ?')
    .run(new Date().toISOString(), auth.id);

  const wish = await db
    .prepare(
      'SELECT id, content, creator_attributes, contacts, wishmail_enabled, image_id FROM wishes WHERE id = ?'
    )
    .get(auth.id);

  if (!wish) {
    return res.status(404).json({ error: 'Wish not found' });
  }

  const { emitWishReactivated } = await import('../socket.js');
  emitWishReactivated({
    ...wish,
    creator_attributes: parseJsonSafe(wish.creator_attributes),
    contacts: parseJsonArray(wish.contacts),
    wishmail_enabled: Boolean(wish.wishmail_enabled),
    image_id: wish.image_id,
  });

  res.json({ success: true });
});

router.post('/:id/claim', async (req, res) => {
  const { id } = req.params;
  const { secret } = req.body;
  const user = await getRequestUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Must be logged in to claim a wish.' });
  }

  if (!secret) {
    return res.status(400).json({ error: 'Passphrase is required.' });
  }

  const row = await db.prepare('SELECT secret_hash, user_id FROM wishes WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Wish not found.' });
  }

  if (row.user_id) {
    return res.status(403).json({ error: 'This wish has already been claimed by a user.' });
  }

  if (!row.secret_hash) {
    return res.status(403).json({ error: 'This wish cannot be claimed.' });
  }

  const [salt, hash] = row.secret_hash.split(':');
  if (!(await verifyPassphrase(secret.trim(), salt, hash))) {
    return res.status(403).json({ error: 'Invalid passphrase.' });
  }

  const now = new Date().toISOString();
  // Assign to user and clear the secret_hash since it's now managed via user authentication
  await db
    .prepare('UPDATE wishes SET user_id = ?, secret_hash = NULL, updated_at = ? WHERE id = ?')
    .run(user.id, now, id);

  logger.info('Wish claimed by user', { user_id: user.id, wish_id: id });
  res.json({ success: true });
});

router.post('/:id/flag', async (req, res) => {
  const { id } = req.params;
  const result = await db.prepare('UPDATE wishes SET flagged = 1 WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Wish not found.' });
  }

  const flaggedWish = await db
    .prepare('SELECT id, content, flagged, user_id FROM wishes WHERE id = ?')
    .get(id);
  emitWishFlagged(flaggedWish);

  logger.warn('Wish flagged for moderation', { wish_id: id });
  res.json({ success: true });
});

// Exclude a wish (Hide / Not Interested)
router.post('/:id/exclude', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const now = new Date().toISOString();

  // Verify wish exists
  const wishExists = await db.prepare('SELECT 1 FROM wishes WHERE id = ?').get(id);
  if (!wishExists) {
    return res.status(404).json({ error: 'Wish not found.' });
  }

  await db
    .prepare(
      'INSERT OR IGNORE INTO wish_exclusions (user_id, wish_id, created_at) VALUES (?, ?, ?)'
    )
    .run(userId, id, now);

  logger.info('Wish excluded by user', { user_id: userId, wish_id: id });
  res.json({ success: true });
});

// Remove exclusion (Un-hide / Undo)
router.delete('/:id/exclude', requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  await db.prepare('DELETE FROM wish_exclusions WHERE user_id = ? AND wish_id = ?').run(userId, id);

  logger.info('Wish exclusion removed by user', { user_id: userId, wish_id: id });
  res.json({ success: true });
});

export default router;
