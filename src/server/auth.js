import crypto from 'node:crypto';
import db from './db.js';

const TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7;

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice(7).trim();
};

export const createSalt = () => crypto.randomBytes(16).toString('hex');

export const hashPassphrase = (passphrase, salt) =>
  crypto.scryptSync(passphrase, salt, 64).toString('hex');

export const verifyPassphrase = (passphrase, salt, hash) =>
  hashPassphrase(passphrase, salt) === hash;

export const createSessionToken = (userId) => {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
};

export const parseJsonArray = (value) => {
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

export const normalizeArrayInput = (value) => {
  if (!value) {
    return [];
  }
  const array = Array.isArray(value) ? value : [value];
  return array
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);
};

export const getUserFromToken = (token) => {
  if (!token) {
    return null;
  }
  const row = db
    .prepare(
      'SELECT u.id, u.username, u.role, u.identity_genders, u.identity_orientations, u.identity_roles, u.contacts, u.wishmail_enabled FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?'
    )
    .get(token, new Date().toISOString());
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    identity_genders: parseJsonArray(row.identity_genders),
    identity_orientations: parseJsonArray(row.identity_orientations),
    identity_roles: parseJsonArray(row.identity_roles),
    contacts: parseJsonArray(row.contacts),
    wishmail_enabled: Boolean(row.wishmail_enabled)
  };
};

export const getUserFromRequest = (req) => getUserFromToken(getTokenFromRequest(req));

export const requireAuth = (req, res, next) => {
  const user = getUserFromRequest(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  req.user = user;
  next();
};

export const requireAdmin = (req, res, next) => {
  const user = getUserFromRequest(req);
  if (user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  req.user = user;
  next();
};

export const getTokenFromRequestHeader = getTokenFromRequest;
