import express from 'express';
import { customAlphabet } from 'nanoid';
import db from '../db.js';
import { createSalt, hashPassphrase, createSessionToken, getUserFromRequest, getTokenFromRequestHeader, verifyPassphrase } from '../auth.js';

const router = express.Router();
const idGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

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

router.get('/exists', (req, res) => {
  const { username } = req.query;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const existingUser = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim());
  res.json({ exists: Boolean(existingUser) });
});

router.post('/register', (req, res) => {
  const { username, passphrase, identity_genders, identity_orientations, identity_roles } = req.body;
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existingUser) {
    return res.status(409).json({ error: 'Username already exists.' });
  }

  const providedPassphrase = typeof passphrase === 'string' ? passphrase.trim() : '';
  const secret = providedPassphrase || generatePassphrase();
  const salt = createSalt();
  const hash = hashPassphrase(secret, salt);
  const userId = idGenerator();
  const now = new Date().toISOString();

  const genders = normalizeArrayField(identity_genders);
  const orientations = normalizeArrayField(identity_orientations);
  const roles = normalizeArrayField(identity_roles);

  db.prepare(
    'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, identity_genders, identity_orientations, identity_roles, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, username.trim(), hash, salt, 'user', JSON.stringify(genders), JSON.stringify(orientations), JSON.stringify(roles), now);

  const token = createSessionToken(userId);
  res.json({ id: userId, username: username.trim(), role: 'user', token, secret, identity_genders: genders, identity_orientations: orientations, identity_roles: roles });
});

router.put('/me', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const { identity_genders, identity_orientations, identity_roles } = req.body;
  const genders = normalizeArrayField(identity_genders);
  const orientations = normalizeArrayField(identity_orientations);
  const roles = normalizeArrayField(identity_roles);

  db.prepare(
    'UPDATE users SET identity_genders = ?, identity_orientations = ?, identity_roles = ? WHERE id = ?'
  ).run(JSON.stringify(genders), JSON.stringify(orientations), JSON.stringify(roles), user.id);

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    identity_genders: genders,
    identity_orientations: orientations,
    identity_roles: roles
  });
});

router.post('/login', (req, res) => {
  const { username, passphrase } = req.body;
  if (!username || !passphrase) {
    return res.status(400).json({ error: 'Username and passphrase are required.' });
  }

  const user = db
    .prepare('SELECT id, username, role, passphrase_hash, passphrase_salt, identity_genders, identity_orientations, identity_roles FROM users WHERE username = ?')
    .get(username.trim());
  if (!user || !verifyPassphrase(passphrase.trim(), user.passphrase_salt, user.passphrase_hash)) {
    return res.status(401).json({ error: 'Invalid username or passphrase.' });
  }

  const token = createSessionToken(user.id);
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    token,
    identity_genders: user.identity_genders ? JSON.parse(user.identity_genders) : [],
    identity_orientations: user.identity_orientations ? JSON.parse(user.identity_orientations) : [],
    identity_roles: user.identity_roles ? JSON.parse(user.identity_roles) : []
  });
});

router.post('/logout', (req, res) => {
  const token = getTokenFromRequestHeader(req);
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  res.json(user);
});

router.get('/me/wishes', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const rows = db
    .prepare('SELECT id, content, flagged, created_at, updated_at FROM wishes WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id);
  res.json(rows);
});

export default router;
