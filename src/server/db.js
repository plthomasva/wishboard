import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.WISHBOARD_DB_PATH || path.join(dataDir, 'wishboard.db');
const db = new Database(dbPath);

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    passphrase_hash TEXT NOT NULL,
    passphrase_salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    identity_genders TEXT,
    identity_orientations TEXT,
    identity_roles TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS wishes (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    content TEXT NOT NULL,
    secret_hash TEXT,
    creator_genders TEXT,
    creator_orientations TEXT,
    creator_roles TEXT,
    desired_genders TEXT,
    desired_orientations TEXT,
    desired_roles TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    flagged INTEGER DEFAULT 0,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS wishmails (
    id TEXT PRIMARY KEY,
    wish_id TEXT NOT NULL,
    content TEXT NOT NULL,
    return_contacts TEXT,
    sender_id TEXT,
    parent_mail_id TEXT,
    read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(wish_id) REFERENCES wishes(id) ON DELETE CASCADE,
    FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY(parent_mail_id) REFERENCES wishmails(id) ON DELETE SET NULL
  );
`);

const ensureColumn = (table, column, type) => {
  const row = db.prepare(`PRAGMA table_info(${table})`).all().find((info) => info.name === column);
  if (!row) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
};

ensureColumn('users', 'identity_genders', 'TEXT');
ensureColumn('users', 'identity_orientations', 'TEXT');
ensureColumn('users', 'identity_roles', 'TEXT');
ensureColumn('users', 'contacts', 'TEXT');
ensureColumn('users', 'wishmail_enabled', 'INTEGER DEFAULT 0');
ensureColumn('wishes', 'creator_genders', 'TEXT');
ensureColumn('wishes', 'creator_orientations', 'TEXT');
ensureColumn('wishes', 'creator_roles', 'TEXT');
ensureColumn('wishes', 'desired_genders', 'TEXT');
ensureColumn('wishes', 'desired_orientations', 'TEXT');
ensureColumn('wishes', 'desired_roles', 'TEXT');
ensureColumn('wishes', 'contacts', 'TEXT');
ensureColumn('wishes', 'wishmail_enabled', 'INTEGER DEFAULT 0');

const defaultAdminUsername = process.env.WISHBOARD_ADMIN_USERNAME || 'admin';
const defaultAdminSecret = process.env.WISHBOARD_ADMIN_SECRET || 'admin-board';

const ensureDefaultAdmin = () => {
  const existing = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
  if (existing) {
    return;
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(defaultAdminSecret, salt, 64).toString('hex');
  const adminId = `admin-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(adminId, defaultAdminUsername, hash, salt, 'admin', now);

  console.log(`Created default admin account: ${defaultAdminUsername}`);
  console.log('Set WISHBOARD_ADMIN_SECRET to change the default password.');
};

ensureDefaultAdmin();

export default db;
