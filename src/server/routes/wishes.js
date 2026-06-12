import express from 'express';
import crypto from 'crypto';
import { customAlphabet } from 'nanoid';
import db from '../db.js';
import { getUserFromToken, getTokenFromRequestHeader, hashPassphrase, verifyPassphrase, parseJsonArray, normalizeArrayInput, createSalt } from '../auth.js';
import { generatePassphrase } from '../../client/src/passphrase.js';

const router = express.Router();
const idGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);


const getRequestUser = (req) => {
  const token = getTokenFromRequestHeader(req);
  return getUserFromToken(token);
};


const normalizeToken = (value) => String(value || '').trim().toLowerCase();

const parseGenderDescriptor = (value) => {
  const token = normalizeToken(value);
  const isTrans = token.includes('trans');
  const isCis = token.includes('cis');
  const base = token.includes('woman') || token.includes('female')
    ? 'woman'
    : token.includes('man') || token.includes('male')
    ? 'man'
    : token.includes('non') && token.includes('binary')
    ? 'nonbinary'
    : token.includes('enby')
    ? 'nonbinary'
    : token;
  return { token, base, isTrans, isCis };
};

const buildAcceptedGenderSet = (searcherGenders, searcherOrientations) => {
  const accepted = new Set();
  const orientations = searcherOrientations.map(normalizeToken);
  const genders = searcherGenders.map(parseGenderDescriptor);

  const addGender = (label) => {
    accepted.add(label);
  };

  const add = (items) => items.forEach((item) => addGender(item));

  if (orientations.some((o) => /\b(pan|queer)\b/.test(o))) {
    add(['man', 'woman', 'nonbinary', 'cis-man', 'cis-woman', 'trans-man', 'trans-woman', 'men', 'women']);
  }

  if (orientations.some((o) => /\b(bi|bisexual)\b/.test(o))) {
    add(['man', 'woman', 'cis-man', 'cis-woman', 'men', 'women']);
  }

  if (orientations.some((o) => /\b(lesb|lesbian)\b/.test(o))) {
    add(['woman', 'cis-woman', 'women']);
  }

  if (orientations.some((o) => /\b(gay|homosexual)\b/.test(o))) {
    const hasWoman = genders.some((g) => g.base === 'woman');
    const hasMan = genders.some((g) => g.base === 'man');
    if (hasWoman && !hasMan) {
      add(['woman', 'cis-woman', 'women']);
    } else {
      add(['man', 'cis-man', 'men']);
    }
  }

  if (orientations.some((o) => /\b(straight)\b/.test(o))) {
    const hasMan = genders.some((g) => g.base === 'man');
    const hasWoman = genders.some((g) => g.base === 'woman');
    if (hasMan) add(['woman', 'cis-woman', 'women']);
    if (hasWoman) add(['man', 'cis-man', 'men']);
  }

  return accepted;
};

const enrichGenders = (genders, orientations) => {
  const enriched = new Set(genders.map(normalizeToken));
  const normO = orientations.map(normalizeToken);
  if (normO.some(o => /\b(lesb|lesbian)\b/.test(o))) {
    enriched.add('woman');
  }
  return Array.from(enriched);
};

const enrichOrientations = (genders, orientations) => {
  const enriched = new Set(orientations.map(normalizeToken));
  const normG = genders.map(parseGenderDescriptor);
  const hasWoman = normG.some((g) => g.base === 'woman');
  if (hasWoman && Array.from(enriched).some(o => /\b(gay|homosexual)\b/.test(o))) {
    enriched.add('lesbian');
  }
  return Array.from(enriched);
};



const matchesGenderPreference = (searcherGenders, searcherOrientations, desired) => {
  if (!desired || desired.length === 0) {
    return true;
  }
  if (!searcherOrientations || searcherOrientations.length === 0) {
    return true;
  }

  const accepted = buildAcceptedGenderSet(searcherGenders || [], searcherOrientations);
  if (accepted.size === 0) {
    return false;
  }
  return desired.some((item) => {
    const descriptor = parseGenderDescriptor(item);
    return [descriptor.token, descriptor.base, `trans-${descriptor.base}`, `cis-${descriptor.base}`, item.trim().toLowerCase()].some((label) => accepted.has(label));
  });
};

const roleCompatibility = {
  top: ['bottom'],
  bottom: ['top'],
  dom: ['sub'],
  sub: ['dom']
};

const matchesRolePreference = (searcherRoles, desired) => {
  if (!desired || desired.length === 0) {
    return true;
  }
  if (!searcherRoles || searcherRoles.length === 0) {
    return false;
  }

  const normalizedSearcher = searcherRoles.map(normalizeToken);
  const normalizedDesired = desired.map(normalizeToken);

  return normalizedDesired.some((desiredRole) => {
    return normalizedSearcher.includes(desiredRole);
  });
};

const matchesPreference = (searcher, desired) => {
  if (!desired || desired.length === 0) {
    return true;
  }
  if (!searcher || searcher.length === 0) {
    return false;
  }
  const normalizedSearcher = searcher.map(normalizeToken);
  return desired.some((item) => normalizedSearcher.includes(normalizeToken(item)));
};

export const isCompatible = (wish, searcher) => {
  const desiredGenders = parseJsonArray(wish.desired_genders);
  const desiredOrientations = parseJsonArray(wish.desired_orientations);
  const desiredRoles = parseJsonArray(wish.desired_roles);
  
  const creatorGendersRaw = parseJsonArray(wish.creator_genders);
  const creatorOrientationsRaw = parseJsonArray(wish.creator_orientations);
  
  const searcherGendersRaw = searcher.identity_genders;
  const searcherOrientationsRaw = searcher.identity_orientations;

  const creatorGenders = enrichGenders(creatorGendersRaw, creatorOrientationsRaw);
  const creatorOrientations = enrichOrientations(creatorGendersRaw, creatorOrientationsRaw);
  
  const searcherGenders = enrichGenders(searcherGendersRaw, searcherOrientationsRaw);
  const searcherOrientations = enrichOrientations(searcherGendersRaw, searcherOrientationsRaw);

  // 1. Does the searcher want the wish creator?
  const searcherWantsCreatorGender = matchesGenderPreference(searcherGenders, searcherOrientations, creatorGenders);

  // 2. Does the wish creator want the searcher?
  let creatorWantsSearcherGender = false;
  if (desiredGenders.length > 0) {
    creatorWantsSearcherGender = searcherGenders.some((item) => {
      const descriptor = parseGenderDescriptor(item);
      const searcherLabels = [descriptor.token, descriptor.base, `trans-${descriptor.base}`, `cis-${descriptor.base}`, item.trim().toLowerCase()];
      return desiredGenders.some(d => searcherLabels.includes(normalizeToken(d)));
    });
  } else {
    creatorWantsSearcherGender = matchesGenderPreference(creatorGenders, creatorOrientations, searcherGenders);
  }

  return (
    searcherWantsCreatorGender &&
    creatorWantsSearcherGender &&
    matchesPreference(searcherOrientations, desiredOrientations) &&
    matchesRolePreference(searcher.identity_roles, desiredRoles)
  );
};

router.post('/', (req, res) => {
  const { content, passphrase, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles, contacts, wishmail_enabled } = req.body;
  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Wish content is required.' });
  }

  const user = getRequestUser(req);
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
  db.prepare(
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

  res.json({ id, secret });
});

router.get('/random', (req, res) => {
  const limit = Number(req.query.limit || 12);
  const rows = db.prepare('SELECT id, content, creator_genders, creator_orientations, contacts, wishmail_enabled FROM wishes ORDER BY RANDOM() LIMIT ?').all(limit);
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

router.get('/', (req, res) => {
  const searcher = getRequestUser(req);
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
    ? db
        .prepare('SELECT id, content, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles, contacts, wishmail_enabled FROM wishes WHERE content LIKE ? ORDER BY created_at DESC LIMIT 50')
        .all(`%${query}%`)
    : db
        .prepare('SELECT id, content, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles, contacts, wishmail_enabled FROM wishes ORDER BY created_at DESC LIMIT 50')
        .all();

  const filtered = ignoreAttributes ? rows : rows.filter((wish) => isCompatible(wish, searcherProfile));
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

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const row = db
    .prepare('SELECT id, content, flagged, contacts, wishmail_enabled, created_at, updated_at FROM wishes WHERE id = ?')
    .get(id);
  if (!row) {
    return res.status(404).json({ error: 'Wish not found.' });
  }
  row.contacts = parseJsonArray(row.contacts);
  row.wishmail_enabled = Boolean(row.wishmail_enabled);
  res.json(row);
});

router.post('/:id/manage', (req, res) => {
  const { id } = req.params;
  const { secret, content, action } = req.body;
  const user = getRequestUser(req);

  const row = db.prepare('SELECT secret_hash, user_id FROM wishes WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'Wish not found.' });
  }

  let authorized = false;
  if (user && row.user_id === user.id) {
    authorized = true;
  }

  if (!authorized) {
    if (!secret) {
      return res.status(401).json({ error: 'Secret token required for wish management.' });
    }
    if (!row.secret_hash) {
      return res.status(403).json({ error: 'Invalid secret token.' });
    }
    const [salt, hash] = row.secret_hash.split(':');
    if (!verifyPassphrase(secret.trim(), salt, hash)) {
      return res.status(403).json({ error: 'Invalid secret token.' });
    }
    authorized = true;
  }

  if (!authorized) {
    return res.status(403).json({ error: 'Not authorized to manage this wish.' });
  }

  if (action === 'delete') {
    db.prepare('DELETE FROM wishes WHERE id = ?').run(id);
    return res.json({ success: true });
  }

  if (content && content.trim()) {
    const { contacts, wishmail_enabled } = req.body;
    const parsedContacts = Array.isArray(contacts) ? contacts : [];
    const wme = wishmail_enabled ? 1 : 0;
    const now = new Date().toISOString();
    db.prepare('UPDATE wishes SET content = ?, contacts = ?, wishmail_enabled = ?, updated_at = ? WHERE id = ?').run(content.trim(), JSON.stringify(parsedContacts), wme, now, id);
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid update payload.' });
});

router.post('/:id/claim', (req, res) => {
  const { id } = req.params;
  const { secret } = req.body;
  const user = getRequestUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Must be logged in to claim a wish.' });
  }

  if (!secret) {
    return res.status(400).json({ error: 'Passphrase is required.' });
  }

  const row = db.prepare('SELECT secret_hash, user_id FROM wishes WHERE id = ?').get(id);
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
  db.prepare('UPDATE wishes SET user_id = ?, secret_hash = NULL, updated_at = ? WHERE id = ?').run(user.id, now, id);

  res.json({ success: true });
});

router.post('/:id/flag', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE wishes SET flagged = 1 WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Wish not found.' });
  }
  res.json({ success: true });
});

export default router;
