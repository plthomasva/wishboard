import express from 'express';
import crypto from 'crypto';
import { customAlphabet } from 'nanoid';
import db from '../db.js';
import { getUserFromToken, getTokenFromRequestHeader, hashPassphrase, verifyPassphrase } from '../auth.js';

const router = express.Router();
const idGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

const generateSalt = () => crypto.randomBytes(16).toString('hex');
const generatePassphrase = () => {
  const adjectives = ['solar', 'bright', 'gentle', 'lucky', 'quiet', 'merry', 'wild', 'cosmic', 'velvet', 'golden'];
  const nouns = ['spark', 'wish', 'cloud', 'echo', 'lantern', 'maple', 'beam', 'ripple', 'pixel', 'trail'];
  const colors = ['blue', 'amber', 'jade', 'pearl', 'ruby', 'sapphire', 'copper', 'opal', 'sage', 'ivory'];
  const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const color = colors[Math.floor(Math.random() * colors.length)];
  return `${adjective}-${noun}-${color}`;
};

const normalizeArrayField = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map(String).map((item) => item.trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseJsonArray = (value) => {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const getRequestUser = (req) => {
  const token = getTokenFromRequestHeader(req);
  return getUserFromToken(token);
};

const normalizeQueryArray = (value) => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => String(item).split(',')).map((item) => item.trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

  const addGenderVariants = ({ token, base, isTrans, isCis }) => {
    addGender(token);
    addGender(base);
    if (isTrans) {
      addGender(`trans-${base}`);
    }
    if (isCis) {
      addGender(`cis-${base}`);
    }
  };

  genders.forEach(addGenderVariants);

  const add = (items) => items.forEach((item) => addGender(item));

  if (orientations.some((o) => /pan|queer/.test(o))) {
    add(['man', 'woman', 'nonbinary', 'cis-man', 'cis-woman', 'trans-man', 'trans-woman', 'men', 'women']);
  }

  if (orientations.some((o) => /bi|bisexual/.test(o))) {
    add(['man', 'woman', 'cis-man', 'cis-woman', 'men', 'women']);
  }

  if (orientations.some((o) => /lesb|lesbian/.test(o))) {
    add(['woman', 'cis-woman', 'women']);
  }

  if (orientations.some((o) => /gay|homosexual/.test(o))) {
    add(['man', 'cis-man', 'men']);
  }

  if (orientations.some((o) => /straight/.test(o))) {
    const hasMan = genders.some((g) => g.base === 'man');
    const hasWoman = genders.some((g) => g.base === 'woman');
    if (hasMan) add(['woman', 'cis-woman', 'women']);
    if (hasWoman) add(['man', 'cis-man', 'men']);
  }

  return accepted;
};

const matchesGenderPreference = (searcherGenders, searcherOrientations, desired) => {
  if (!desired || desired.length === 0) {
    return true;
  }
  if (!searcherGenders || searcherGenders.length === 0) {
    return false;
  }

  const accepted = buildAcceptedGenderSet(searcherGenders, searcherOrientations);
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
    if (normalizedSearcher.includes(desiredRole)) {
      return true;
    }
    return normalizedSearcher.some((searcherRole) => {
      return (
        roleCompatibility[searcherRole]?.includes(desiredRole) ||
        roleCompatibility[desiredRole]?.includes(searcherRole)
      );
    });
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

const isCompatible = (wish, searcher) => {
  const desiredGenders = parseJsonArray(wish.desired_genders);
  const desiredOrientations = parseJsonArray(wish.desired_orientations);
  const desiredRoles = parseJsonArray(wish.desired_roles);

  return (
    matchesGenderPreference(searcher.identity_genders, searcher.identity_orientations, desiredGenders) &&
    matchesPreference(searcher.identity_orientations, desiredOrientations) &&
    matchesRolePreference(searcher.identity_roles, desiredRoles)
  );
};

router.post('/', (req, res) => {
  const { content, passphrase, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles } = req.body;
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
    const salt = generateSalt();
    const hash = hashPassphrase(secret, salt);
    secretHash = `${salt}:${hash}`;
  }

  const creatorGenders = user?.identity_genders ?? normalizeArrayField(creator_genders);
  const creatorOrientations = user?.identity_orientations ?? normalizeArrayField(creator_orientations);
  const creatorRoles = user?.identity_roles ?? normalizeArrayField(creator_roles);
  const desiredGenders = normalizeArrayField(desired_genders);
  const desiredOrientations = normalizeArrayField(desired_orientations);
  const desiredRoles = normalizeArrayField(desired_roles);

  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO wishes (id, user_id, content, secret_hash, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
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
    now,
    now
  );

  res.json({ id, secret });
});

router.get('/random', (req, res) => {
  const limit = Number(req.query.limit || 12);
  const rows = db.prepare('SELECT id, content FROM wishes WHERE flagged = 0 ORDER BY RANDOM() LIMIT ?').all(limit);
  res.json(rows);
});

router.get('/', (req, res) => {
  const searcher = getRequestUser(req);
  const query = (req.query.q || '').trim();
  const searcherGenders = searcher?.identity_genders ?? normalizeQueryArray(req.query.searcher_genders);
  const searcherOrientations = searcher?.identity_orientations ?? normalizeQueryArray(req.query.searcher_orientations);
  const searcherRoles = searcher?.identity_roles ?? normalizeQueryArray(req.query.searcher_roles);
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
        .prepare('SELECT id, content, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles FROM wishes WHERE flagged = 0 AND content LIKE ? ORDER BY created_at DESC LIMIT 50')
        .all(`%${query}%`)
    : db
        .prepare('SELECT id, content, creator_genders, creator_orientations, creator_roles, desired_genders, desired_orientations, desired_roles FROM wishes WHERE flagged = 0 ORDER BY created_at DESC LIMIT 50')
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
      desired_roles: parseJsonArray(wish.desired_roles)
    }))
  );
});

router.get('/:id', (req, res) => {
  const { id } = req.params;
  const row = db
    .prepare('SELECT id, content, flagged, created_at, updated_at FROM wishes WHERE id = ?')
    .get(id);
  if (!row) {
    return res.status(404).json({ error: 'Wish not found.' });
  }
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
    const now = new Date().toISOString();
    db.prepare('UPDATE wishes SET content = ?, updated_at = ? WHERE id = ?').run(content.trim(), now, id);
    return res.json({ success: true });
  }

  res.status(400).json({ error: 'Invalid update payload.' });
});

router.post('/:id/flag', (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE wishes SET flagged = flagged + 1 WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Wish not found.' });
  }
  res.json({ success: true });
});

export default router;
