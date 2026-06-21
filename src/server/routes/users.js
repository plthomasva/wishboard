import express from 'express';
import { customAlphabet } from 'nanoid';
import db from '../db.js';
import { createSalt, hashPassphrase, createSessionToken, getUserFromRequest, getTokenFromRequestHeader, verifyPassphrase, normalizeArrayInput, parseJsonArray } from '../auth.js';
import { generatePassphrase } from '../../client/src/passphrase.js';
import logger from '../logger.js';

const router = express.Router();
const idGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);


router.get('/exists', async (req, res) => {
  const { username } = req.query;
  if (!username || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const existingUser = await db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim());
  res.json({ exists: Boolean(existingUser) });
});

router.post('/register', async (req, res) => {
  const { username, passphrase, identity_genders, identity_orientations, identity_roles, contacts, wishmail_enabled } = req.body;
  if (!username?.trim()) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  const existingUser = await db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
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

  await db.prepare(
    'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, identity_genders, identity_orientations, identity_roles, contacts, wishmail_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(userId, username.trim(), hash, salt, 'user', JSON.stringify(genders), JSON.stringify(orientations), JSON.stringify(roles), JSON.stringify(contacts || []), wishmailEnabledInt, now);

  logger.info('New user registered', { user_id: userId, username: username.trim() });
  const token = await createSessionToken(userId);
  res.json({ id: userId, username: username.trim(), role: 'user', is_active: true, token, secret, identity_genders: genders, identity_orientations: orientations, identity_roles: roles, contacts: contacts || [], wishmail_enabled: Boolean(wishmailEnabledInt) });
});

router.use('/me', async (req, res, next) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  req.user = user;
  next();
});

router.put('/me', async (req, res) => {
  const user = req.user;

  const { identity_genders, identity_orientations, identity_roles, contacts, wishmail_enabled } = req.body;
  const genders = normalizeArrayInput(identity_genders);
  const orientations = normalizeArrayInput(identity_orientations);
  const roles = normalizeArrayInput(identity_roles);
  const wishmailEnabledInt = wishmail_enabled ? 1 : 0;

  await db.prepare(
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

router.post('/login', async (req, res) => {
  const { username, passphrase } = req.body;
  if (!username || !passphrase) {
    return res.status(400).json({ error: 'Username and passphrase are required.' });
  }

  const user = await db
    .prepare('SELECT id, username, role, is_active, passphrase_hash, passphrase_salt, identity_genders, identity_orientations, identity_roles, contacts, wishmail_enabled FROM users WHERE username = ?')
    .get(username.trim());
  if (!user || !verifyPassphrase(passphrase.trim(), user.passphrase_salt, user.passphrase_hash)) {
    logger.warn('Failed login attempt', { username: username.trim(), ip: req.ip });
    return res.status(401).json({ error: 'Invalid username or passphrase.' });
  }

  logger.info('Successful login', { username: user.username, ip: req.ip });
  const token = await createSessionToken(user.id);
  res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    is_active: Boolean(user.is_active),
    token,
    identity_genders: parseJsonArray(user.identity_genders),
    identity_orientations: parseJsonArray(user.identity_orientations),
    identity_roles: parseJsonArray(user.identity_roles),
    contacts: parseJsonArray(user.contacts),
    wishmail_enabled: Boolean(user.wishmail_enabled)
  });
});

router.post('/logout', async (req, res) => {
  const token = getTokenFromRequestHeader(req);
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }
  res.json({ success: true });
});

router.get('/me/delete-preview', async (req, res) => {
  const user = req.user;

  const wishesCount = (await db.prepare('SELECT COUNT(*) as count FROM wishes WHERE user_id = ?').get(user.id)).count;
  const wishmailsCount = (await db.prepare('SELECT COUNT(*) as count FROM wishmails WHERE wish_id IN (SELECT id FROM wishes WHERE user_id = ?)').get(user.id)).count;

  res.json({ wishesCount, wishmailsCount });
});

router.post('/me/delete', async (req, res) => {
  const user = req.user;
  
  if (user.role === 'admin') {
    const adminCount = (await db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get()).count;
    if (adminCount <= 1) {
      return res.status(403).json({ error: 'Cannot delete the last admin user.' });
    }
  }
  
  await db.prepare('DELETE FROM wishmails WHERE wish_id IN (SELECT id FROM wishes WHERE user_id = ?)').run(user.id);
  await db.prepare('DELETE FROM wishes WHERE user_id = ?').run(user.id);
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  await db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

  logger.info('User self-deleted', { user_id: user.id });
  res.json({ success: true });
});

router.post('/me/deactivate', async (req, res) => {
  const user = req.user;

  await db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(user.id);
  
  const wishes = await db.prepare('SELECT id FROM wishes WHERE user_id = ?').all(user.id);
  const { emitWishDeleted } = await import('../socket.js');
  wishes.forEach(w => emitWishDeleted(w.id));
  
  logger.info('User deactivated', { user_id: user.id });
  res.json({ success: true });
});

router.post('/me/reactivate', async (req, res) => {
  const user = req.user;

  await db.prepare('UPDATE users SET is_active = 1 WHERE id = ?').run(user.id);
  
  const wishes = await db.prepare('SELECT id, content, creator_genders, creator_orientations, contacts, wishmail_enabled FROM wishes WHERE user_id = ? AND is_active = 1').all(user.id);
  const { emitWishReactivated } = await import('../socket.js');
  wishes.forEach(w => {
    emitWishReactivated({
      ...w,
      creator_genders: parseJsonArray(w.creator_genders),
      creator_orientations: parseJsonArray(w.creator_orientations),
      contacts: parseJsonArray(w.contacts),
      wishmail_enabled: Boolean(w.wishmail_enabled)
    });
  });

  logger.info('User reactivated', { user_id: user.id });
  res.json({ success: true });
});

router.get('/me', async (req, res) => {
  const user = req.user;
  res.json(user);
});

router.get('/me/wishes', async (req, res) => {
  const user = req.user;

  const rows = await db
    .prepare('SELECT id, content, contacts, wishmail_enabled, creator_genders, creator_orientations, flagged, created_at, updated_at, is_active FROM wishes WHERE user_id = ? ORDER BY created_at DESC')
    .all(user.id);
    
  const formattedRows = rows.map(row => ({
    ...row,
    creator_genders: parseJsonArray(row.creator_genders),
    creator_orientations: parseJsonArray(row.creator_orientations),
    contacts: parseJsonArray(row.contacts),
    wishmail_enabled: Boolean(row.wishmail_enabled),
    is_active: Boolean(row.is_active)
  }));
    
  res.json(formattedRows);
});

export default router;
