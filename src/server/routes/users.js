import express from 'express';
import { customAlphabet } from 'nanoid';
import db from '../db.js';
import { createSalt, hashPassphrase, createSessionToken, getUserFromRequest, getTokenFromRequestHeader, verifyPassphrase, normalizeArrayInput, parseJsonArray } from '../auth.js';
import { generatePassphrase } from '../../client/src/passphrase.js';

const router = express.Router();
const idGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);


router.get('/exists', (req, res) => {
  const { username } = req.query;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const existingUser = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim());
  res.json({ exists: Boolean(existingUser) });
});

router.post('/register', (req, res) => {
  const { username, passphrase, identity_genders, identity_orientations, identity_roles, contacts, wishmail_enabled } = req.body;
  if (!username?.trim()) {
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

  const genders = normalizeArrayInput(identity_genders);
  const orientations = normalizeArrayInput(identity_orientations);
  const roles = normalizeArrayInput(identity_roles);

  const wishmailEnabledInt = wishmail_enabled ? 1 : 0;

  db.prepare(
    'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, identity_genders, identity_orientations, identity_roles, contacts, wishmail_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, username.trim(), hash, salt, 'user', JSON.stringify(genders), JSON.stringify(orientations), JSON.stringify(roles), JSON.stringify(contacts || []), wishmailEnabledInt, now);

  const token = createSessionToken(userId);
  res.json({ id: userId, username: username.trim(), role: 'user', token, secret, identity_genders: genders, identity_orientations: orientations, identity_roles: roles, contacts: contacts || [], wishmail_enabled: Boolean(wishmailEnabledInt) });
});

router.put('/me', (req, res) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  const { identity_genders, identity_orientations, identity_roles, contacts, wishmail_enabled } = req.body;
  const genders = normalizeArrayInput(identity_genders);
  const orientations = normalizeArrayInput(identity_orientations);
  const roles = normalizeArrayInput(identity_roles);
  const wishmailEnabledInt = wishmail_enabled ? 1 : 0;

  db.prepare(
    'UPDATE users SET identity_genders = ?, identity_orientations = ?, identity_roles = ?, contacts = ?, wishmail_enabled = ? WHERE id = ?'
  ).run(JSON.stringify(genders), JSON.stringify(orientations), JSON.stringify(roles), JSON.stringify(contacts || []), wishmailEnabledInt, user.id);

  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    identity_genders: genders,
    identity_orientations: orientations,
    identity_roles: roles,
    contacts: contacts || [],
    wishmail_enabled: Boolean(wishmailEnabledInt)
  });
});

router.post('/login', (req, res) => {
  const { username, passphrase } = req.body;
  if (!username || !passphrase) {
    return res.status(400).json({ error: 'Username and passphrase are required.' });
  }

  const user = db
    .prepare('SELECT id, username, role, passphrase_hash, passphrase_salt, identity_genders, identity_orientations, identity_roles, contacts, wishmail_enabled FROM users WHERE username = ?')
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
    identity_genders: parseJsonArray(user.identity_genders),
    identity_orientations: parseJsonArray(user.identity_orientations),
    identity_roles: parseJsonArray(user.identity_roles),
    contacts: parseJsonArray(user.contacts),
    wishmail_enabled: Boolean(user.wishmail_enabled)
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
    .prepare('SELECT id, content, contacts, wishmail_enabled, creator_genders, creator_orientations, flagged, created_at, updated_at FROM wishes WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id);
    
  const formattedRows = rows.map(row => ({
    ...row,
    creator_genders: parseJsonArray(row.creator_genders),
    creator_orientations: parseJsonArray(row.creator_orientations),
    contacts: parseJsonArray(row.contacts),
    wishmail_enabled: Boolean(row.wishmail_enabled)
  }));
    
  res.json(formattedRows);
});

export default router;
