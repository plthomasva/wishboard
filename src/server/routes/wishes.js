import express from 'express';

import { customAlphabet } from 'nanoid';
import db from '../db.js';
import { getUserFromToken, getTokenFromRequestHeader, hashPassphrase, verifyPassphrase, parseJsonArray, normalizeArrayInput, createSalt } from '../auth.js';
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


const normalizeToken = (value) => String(value || '').trim().toLowerCase();

const parseGenderDescriptor = (value) => {
  const token = normalizeToken(value);
  const isTrans = token.includes('trans');
  const isCis = token.includes('cis');
  let base = token;
  if (token.includes('woman') || token.includes('female')) {
    base = 'woman';
  } else if (token.includes('man') || token.includes('male')) {
    base = 'man';
  } else if ((token.includes('non') && token.includes('binary')) || token.includes('enby')) {
    base = 'nonbinary';
  }
  return { token, base, isTrans, isCis };
};

const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
};

const hasToken = (str, token) => {
  const escapedToken = escapeRegExp(token);
  return new RegExp(String.raw`\b${escapedToken}\b`, 'i').test(normalizeToken(str));
};

const evaluateRuleConditions = (rule, userAttributes) => {
  const triggerVals = userAttributes[rule.trigger_attribute] || [];
  const triggerMatch = triggerVals.some(v => hasToken(v, rule.trigger_value));
  
  let contextMatch = true;
  if (rule.context_attribute && rule.context_value) {
    const ctxVals = userAttributes[rule.context_attribute] || [];
    contextMatch = ctxVals.some(v => {
      if (rule.context_attribute === 'gender') {
        return parseGenderDescriptor(v).base === rule.context_value;
      }
      return hasToken(v, rule.context_value);
    });
  }
  
  return triggerMatch && contextMatch;
};

const enrichAttributes = (userAttributes, targetCategory, rules) => {
  const enriched = new Set((userAttributes[targetCategory] || []).map(normalizeToken));
  const enrichmentRules = rules.filter(r => r.rule_type === 'enrichment' && r.target_attribute === targetCategory);
  
  for (const rule of enrichmentRules) {
    if (evaluateRuleConditions(rule, userAttributes)) {
      enriched.add(rule.target_value);
    }
  }
  return Array.from(enriched);
};

const buildAcceptedSet = (userAttributes, targetCategory, rules) => {
  const accepted = new Set();
  const acceptanceRules = rules.filter(r => r.rule_type === 'acceptance' && r.target_attribute === targetCategory);
  
  for (const rule of acceptanceRules) {
    if (evaluateRuleConditions(rule, userAttributes)) {
      const targets = rule.target_value.split(',').map(t => t.trim().toLowerCase());
      targets.forEach(t => accepted.add(t));
    }
  }
  return accepted;
};

const getExpandedDesired = (desiredVals, category, rules) => {
  const result = new Set(desiredVals.map(normalizeToken));
  const expandRules = rules.filter(r => r.rule_type === 'expansion' && r.trigger_attribute === category && r.target_attribute === category);
  
  for (const val of desiredVals) {
    for (const rule of expandRules) {
      if (hasToken(val, rule.trigger_value)) {
        const targets = rule.target_value.split(',').map(t => t.trim().toLowerCase());
        targets.forEach(t => result.add(t));
      }
    }
  }
  return Array.from(result);
};

const getCrossMatchedDesired = (desiredVals, category, rules) => {
  const result = new Set();
  const crossRules = rules.filter(r => r.rule_type === 'cross_match' && r.trigger_attribute === category && r.target_attribute === category);
  
  for (const val of desiredVals) {
    for (const rule of crossRules) {
      if (hasToken(val, rule.trigger_value)) {
        const targets = rule.target_value.split(',').map(t => t.trim().toLowerCase());
        targets.forEach(t => result.add(t));
      }
      if (rule.target_value.split(',').some(t => hasToken(val, t.trim().toLowerCase()))) {
        result.add(rule.trigger_value.toLowerCase());
      }
    }
  }
  return Array.from(result);
};

const matchesAttribute = (searcherVals, desiredVals, category, rules) => {
  if (!desiredVals || desiredVals.length === 0) return true;
  if (!searcherVals || searcherVals.length === 0) return false;

  const normalizedSearcher = new Set(searcherVals.map(normalizeToken));
  const expandedDesired = getExpandedDesired(desiredVals, category, rules);
  const crossMatchedDesired = getCrossMatchedDesired(desiredVals, category, rules);
  const expandedCrossMatched = getExpandedDesired(Array.from(crossMatchedDesired), category, rules);

  const allAcceptable = new Set([...expandedDesired, ...crossMatchedDesired, ...expandedCrossMatched]);

  return Array.from(allAcceptable).some(desired => normalizedSearcher.has(desired));
};

const matchesGenderPreferenceImplicit = (searcherAttributes, desiredGenders, rules) => {
  if (!desiredGenders || desiredGenders.length === 0) return true;
  const searcherOrientations = searcherAttributes.orientation || [];
  if (!searcherOrientations || searcherOrientations.length === 0) return true;

  const accepted = buildAcceptedSet(searcherAttributes, 'gender', rules);
  if (accepted.size === 0) return false;

  return desiredGenders.some((item) => {
    const descriptor = parseGenderDescriptor(item);
    return [descriptor.token, descriptor.base, `trans-${descriptor.base}`, `cis-${descriptor.base}`, item.trim().toLowerCase()].some((label) => accepted.has(label));
  });
};

export const isCompatible = (wish, searcher, rules = []) => {
  const desiredGenders = parseJsonArray(wish.desired_genders);
  const desiredOrientations = parseJsonArray(wish.desired_orientations);
  const desiredRoles = parseJsonArray(wish.desired_roles);
  
  const creatorGendersRaw = parseJsonArray(wish.creator_genders);
  const creatorOrientationsRaw = parseJsonArray(wish.creator_orientations);
  const creatorRolesRaw = parseJsonArray(wish.creator_roles);
  
  const searcherGendersRaw = searcher.identity_genders || [];
  const searcherOrientationsRaw = searcher.identity_orientations || [];
  const searcherRolesRaw = searcher.identity_roles || [];

  const creatorProfileRaw = { gender: creatorGendersRaw, orientation: creatorOrientationsRaw, role: creatorRolesRaw };
  const searcherProfileRaw = { gender: searcherGendersRaw, orientation: searcherOrientationsRaw, role: searcherRolesRaw };

  const creatorProfile = {
    gender: enrichAttributes(creatorProfileRaw, 'gender', rules),
    orientation: enrichAttributes(creatorProfileRaw, 'orientation', rules),
    role: creatorProfileRaw.role
  };
  
  const searcherProfile = {
    gender: enrichAttributes(searcherProfileRaw, 'gender', rules),
    orientation: enrichAttributes(searcherProfileRaw, 'orientation', rules),
    role: searcherProfileRaw.role
  };

  // 1. Does the searcher want the wish creator?
  const searcherWantsCreatorGender = matchesGenderPreferenceImplicit(searcherProfile, creatorProfile.gender, rules);

  // 2. Does the wish creator want the searcher?
  let creatorWantsSearcherGender = false;
  if (desiredGenders.length > 0) {
    const searcherExtendedGenders = [];
    for (const g of searcherProfile.gender) {
      const descriptor = parseGenderDescriptor(g);
      searcherExtendedGenders.push(descriptor.token, descriptor.base, `trans-${descriptor.base}`, `cis-${descriptor.base}`, g.trim().toLowerCase());
    }
    creatorWantsSearcherGender = matchesAttribute(searcherExtendedGenders, desiredGenders, 'gender', rules);
  } else {
    creatorWantsSearcherGender = matchesGenderPreferenceImplicit(creatorProfile, searcherProfile.gender, rules);
  }

  return (
    searcherWantsCreatorGender &&
    creatorWantsSearcherGender &&
    matchesAttribute(searcherProfile.orientation, desiredOrientations, 'orientation', rules) &&
    matchesAttribute(searcherProfile.role, desiredRoles, 'role', rules)
  );
};

router.post('/', async (req, res) => {
  const { content, passphrase, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles, contacts, wishmail_enabled } = req.body;
  if (!content?.trim()) {
    return res.status(400).json({ error: 'Wish content is required.' });
  }

  const user = await getRequestUser(req);
  const userId = user?.id || null;
  const id = idGenerator();
  let secret = null;
  let secretHash = null;

  if (!userId) {
    secret = passphrase?.trim() || generatePassphrase();
    const salt = createSalt();
    const hash = hashPassphrase(secret, salt);
    secretHash = `${salt}:${hash}`;
  }

  const creatorGenders = user?.identity_genders ?? normalizeArrayInput(creator_genders);
  const creatorOrientations = user?.identity_orientations ?? normalizeArrayInput(creator_orientations);
  const creatorRoles = user?.identity_roles ?? normalizeArrayInput(creator_roles);
  const desiredGenders = normalizeArrayInput(desired_genders);
  const desiredOrientations = normalizeArrayInput(desired_orientations);
  const desiredRoles = normalizeArrayInput(desired_roles);

  const parsedContacts = Array.isArray(contacts) ? contacts : [];
  const wme = wishmail_enabled ? 1 : 0;

  const now = new Date().toISOString();
  await db.prepare(
    'INSERT INTO wishes (id, user_id, content, secret_hash, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles, contacts, wishmail_enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    userId,
    content.trim(),
    secretHash,
    JSON.stringify(creatorGenders),
    JSON.stringify(creatorOrientations),
    JSON.stringify(creatorRoles),
    JSON.stringify(desiredGenders),
    JSON.stringify(desiredOrientations),
    JSON.stringify(desiredRoles),
    JSON.stringify(parsedContacts),
    wme,
    now,
    now
  );

  logger.info('Wish created', { user_id: userId, wish_id: id });
  const newWish = {
    id,
    content: content.trim(),
    created_at: now,
    creator_genders: creatorGenders,
    creator_orientations: creatorOrientations,
    creator_roles: creatorRoles,
    desired_genders: desiredGenders,
    desired_orientations: desiredOrientations,
    desired_roles: desiredRoles,
    contacts: parsedContacts,
    wishmail_enabled: Boolean(wme),
    is_active: true
  };
  emitNewWish(newWish);

  res.status(201).json({ id, secret });
});

router.get('/random', async (req, res) => {
  const limit = Number(req.query.limit || 12);
  const rows = await db.prepare('SELECT w.id, w.content, w.creator_genders, w.creator_orientations, w.contacts, w.wishmail_enabled FROM wishes w LEFT JOIN users u ON w.user_id = u.id WHERE w.is_active = 1 AND (u.id IS NULL OR u.is_active = 1) ORDER BY RANDOM() LIMIT ?').all(limit);
  res.json(
    rows.map((wish) => ({
      id: wish.id,
      content: wish.content,
      creator_genders: parseJsonArray(wish.creator_genders),
      creator_orientations: parseJsonArray(wish.creator_orientations),
      contacts: parseJsonArray(wish.contacts),
      wishmail_enabled: Boolean(wish.wishmail_enabled)
    }))
  );
});

router.get('/', async (req, res) => {
  const searcher = await getRequestUser(req);
  const query = (req.query.q || '').trim();
  const searcherGenders = searcher?.identity_genders ?? normalizeArrayInput(req.query.sg);
  const searcherOrientations = searcher?.identity_orientations ?? normalizeArrayInput(req.query.so);
  const searcherRoles = searcher?.identity_roles ?? normalizeArrayInput(req.query.sr);
  const ignoreAttributes =
    req.query.ignore_attributes === '1' ||
    req.query.ignore_attributes === 'true' ||
    (!searcher && !searcherGenders.length && !searcherOrientations.length && !searcherRoles.length);

  const searcherProfile = {
    identity_genders: searcherGenders,
    identity_orientations: searcherOrientations,
    identity_roles: searcherRoles
  };

  const rows = query
    ? await db
        .prepare('SELECT w.id, w.content, w.creator_genders, w.creator_orientations, w.creator_roles, w.desired_genders, w.desired_orientations, w.desired_roles, w.contacts, w.wishmail_enabled FROM wishes w LEFT JOIN users u ON w.user_id = u.id WHERE w.content LIKE ? AND w.is_active = 1 AND (u.id IS NULL OR u.is_active = 1) ORDER BY w.created_at DESC LIMIT 50')
        .all(`%${query}%`)
    : await db
        .prepare('SELECT w.id, w.content, w.creator_genders, w.creator_orientations, w.creator_roles, w.desired_genders, w.desired_orientations, w.desired_roles, w.contacts, w.wishmail_enabled FROM wishes w LEFT JOIN users u ON w.user_id = u.id WHERE w.is_active = 1 AND (u.id IS NULL OR u.is_active = 1) ORDER BY w.created_at DESC LIMIT 50')
        .all();

  const rules = getRules();
  const filtered = ignoreAttributes ? rows : rows.filter((wish) => isCompatible(wish, searcherProfile, rules));
  res.json(
    filtered.map((wish) => ({
      id: wish.id,
      content: wish.content,
      creator_genders: parseJsonArray(wish.creator_genders),
      creator_orientations: parseJsonArray(wish.creator_orientations),
      creator_roles: parseJsonArray(wish.creator_roles),
      desired_genders: parseJsonArray(wish.desired_genders),
      desired_orientations: parseJsonArray(wish.desired_orientations),
      desired_roles: parseJsonArray(wish.desired_roles),
      contacts: parseJsonArray(wish.contacts),
      wishmail_enabled: Boolean(wish.wishmail_enabled)
    }))
  );
});

router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const row = await db
    .prepare('SELECT id, content, flagged, contacts, wishmail_enabled, created_at, updated_at, is_active FROM wishes WHERE id = ?')
    .get(id);
  if (!row) {
    return res.status(404).json({ error: 'Wish not found.' });
  }
  row.contacts = parseJsonArray(row.contacts);
  row.wishmail_enabled = Boolean(row.wishmail_enabled);
  row.is_active = Boolean(row.is_active);
  res.json(row);
});

router.post('/:id/manage', async (req, res) => {
  const { id } = req.params;
  const { secret, content, action } = req.body;
  const user = await getRequestUser(req);

  const row = await db.prepare('SELECT secret_hash, user_id FROM wishes WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Wish not found.' });
  }

  const isOwner = user?.id === row.user_id;
  const isAuthorized = isOwner || (secret && row.secret_hash && verifyPassphrase(secret.trim(), ...row.secret_hash.split(':')));

  if (!isAuthorized) {
    if (!secret && !isOwner && row.secret_hash) {
      return res.status(401).json({ error: 'Secret token required for wish management.' });
    }
    return res.status(403).json({ error: 'Invalid secret token or unauthorized.' });
  }

  if (action === 'delete') {
    await db.prepare('DELETE FROM wishmails WHERE wish_id = ?').run(id);
    await db.prepare('DELETE FROM wishes WHERE id = ?').run(id);
    logger.info('Wish deleted by owner', { user_id: user?.id, wish_id: id });
    emitWishDeleted(id);
    return res.json({ success: true });
  }

  if (content?.trim()) {
    const { contacts, wishmail_enabled } = req.body;
    const parsedContacts = Array.isArray(contacts) ? contacts : [];
    const wme = wishmail_enabled ? 1 : 0;
    const now = new Date().toISOString();
    await db.prepare('UPDATE wishes SET content = ?, contacts = ?, wishmail_enabled = ?, updated_at = ? WHERE id = ?').run(content.trim(), JSON.stringify(parsedContacts), wme, now, id);
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid update payload.' });
});

router.post('/:id/deactivate', async (req, res) => {
  const { id } = req.params;
  const secret = req.body?.secret;
  const user = await getRequestUser(req);

  const row = await db.prepare('SELECT secret_hash, user_id FROM wishes WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Wish not found.' });

  const isOwner = user?.id === row.user_id;
  const isAuthorized = isOwner || (secret && row.secret_hash && verifyPassphrase(secret.trim(), ...row.secret_hash.split(':')));

  if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized.' });

  await db.prepare('UPDATE wishes SET is_active = 0, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  emitWishDeleted(id); // Immediately remove from UI
  res.json({ success: true });
});

router.post('/:id/reactivate', async (req, res) => {
  const { id } = req.params;
  const secret = req.body?.secret;
  const user = await getRequestUser(req);

  const row = await db.prepare('SELECT secret_hash, user_id FROM wishes WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Wish not found.' });

  const isOwner = user?.id === row.user_id;
  const isAuthorized = isOwner || (secret && row.secret_hash && verifyPassphrase(secret.trim(), ...row.secret_hash.split(':')));

  if (!isAuthorized) return res.status(403).json({ error: 'Unauthorized.' });

  await db.prepare('UPDATE wishes SET is_active = 1, updated_at = ? WHERE id = ?').run(new Date().toISOString(), id);
  
  const wish = await db.prepare('SELECT id, content, creator_genders, creator_orientations, contacts, wishmail_enabled FROM wishes WHERE id = ?').get(id);
  const { emitWishReactivated } = await import('../socket.js');
  emitWishReactivated({
    ...wish,
    creator_genders: parseJsonArray(wish.creator_genders),
    creator_orientations: parseJsonArray(wish.creator_orientations),
    contacts: parseJsonArray(wish.contacts),
    wishmail_enabled: Boolean(wish.wishmail_enabled)
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
  if (!verifyPassphrase(secret.trim(), salt, hash)) {
    return res.status(403).json({ error: 'Invalid passphrase.' });
  }

  const now = new Date().toISOString();
  // Assign to user and clear the secret_hash since it's now managed via user authentication
  await db.prepare('UPDATE wishes SET user_id = ?, secret_hash = NULL, updated_at = ? WHERE id = ?').run(user.id, now, id);

  logger.info('Wish claimed by user', { user_id: user.id, wish_id: id });
  res.json({ success: true });
});

router.post('/:id/flag', async (req, res) => {
  const { id } = req.params;
  const result = await db.prepare('UPDATE wishes SET flagged = 1 WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Wish not found.' });
  }
  
  const flaggedWish = await db.prepare('SELECT id, content, flagged, user_id FROM wishes WHERE id = ?').get(id);
  emitWishFlagged(flaggedWish);

  logger.warn('Wish flagged for moderation', { wish_id: id });
  res.json({ success: true });
});

export default router;
