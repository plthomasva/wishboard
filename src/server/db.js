import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../data');
fs.mkdirSync(dataDir, { recursive: true });

let url = process.env.DATABASE_URL;

// Prevent tests from corrupting the local development database
if (process.env.NODE_ENV === 'test' && !process.env.WISHBOARD_DB_PATH && !url) {
  process.env.WISHBOARD_DB_PATH = ':memory:';
}

if (!url) {
  const dbPath = process.env.WISHBOARD_DB_PATH || path.join(dataDir, 'wishboard.db');
  url = dbPath === ':memory:' ? 'file::memory:' : `file:${dbPath}`;
}

const db = createClient({ url });

await db.executeMultiple(`
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

const ensureColumn = async (table, column, type) => {
  const rs = await db.execute(`PRAGMA table_info(${table})`);
  const row = rs.rows.find((info) => info.name === column);
  if (!row) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
  }
};

await ensureColumn('users', 'identity_genders', 'TEXT');
await ensureColumn('users', 'identity_orientations', 'TEXT');
await ensureColumn('users', 'identity_roles', 'TEXT');
await ensureColumn('users', 'contacts', 'TEXT');
await ensureColumn('users', 'wishmail_enabled', 'INTEGER DEFAULT 0');
await ensureColumn('users', 'is_active', 'INTEGER DEFAULT 1');
await ensureColumn('wishes', 'creator_genders', 'TEXT');
await ensureColumn('wishes', 'creator_orientations', 'TEXT');
await ensureColumn('wishes', 'creator_roles', 'TEXT');
await ensureColumn('wishes', 'desired_genders', 'TEXT');
await ensureColumn('wishes', 'desired_orientations', 'TEXT');
await ensureColumn('wishes', 'desired_roles', 'TEXT');
await ensureColumn('wishes', 'contacts', 'TEXT');
await ensureColumn('wishes', 'wishmail_enabled', 'INTEGER DEFAULT 0');
await ensureColumn('wishes', 'is_active', 'INTEGER DEFAULT 1');

const defaultAdminUsername = process.env.WISHBOARD_ADMIN_USERNAME || 'admin';
const defaultAdminSecret = process.env.WISHBOARD_ADMIN_SECRET || 'admin-board';

const ensureDefaultAdmin = async () => {
  const rs = await db.execute({
    sql: 'SELECT id FROM users WHERE role = ? LIMIT 1',
    args: ['admin']
  });
  if (rs.rows.length > 0) {
    return;
  }

  const scryptOptions = process.env.NODE_ENV === 'test' 
    ? { N: 16, r: 1, p: 1 } 
    : undefined;

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(defaultAdminSecret, salt, 64, scryptOptions).toString('hex');
  const adminId = `admin-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  await db.execute({
    sql: 'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    args: [adminId, defaultAdminUsername, hash, salt, 'admin', now]
  });

  console.log(`Created default admin account: ${defaultAdminUsername}`);
  console.log('Set WISHBOARD_ADMIN_SECRET to change the default password.');
};

await ensureDefaultAdmin();

const mapArg = (a) => {
  if (a === undefined) return null;
  if (typeof a === 'boolean') return a ? 1 : 0;
  return a;
};

const dbWrapper = {
  prepare: (sql) => ({
    get: async (...args) => {
      const rs = await db.execute({ sql, args: args.map(mapArg) });
      return rs.rows[0];
    },
    all: async (...args) => {
      const rs = await db.execute({ sql, args: args.map(mapArg) });
      return rs.rows;
    },
    run: async (...args) => {
      const rs = await db.execute({ sql, args: args.map(mapArg) });
      return { changes: rs.rowsAffected, lastInsertRowid: rs.lastInsertRowid };
    }
  }),
  exec: async (sql) => {
    return await db.executeMultiple(sql);
  },
  execute: db.execute.bind(db),
  executeMultiple: db.executeMultiple.bind(db)
};

export default dbWrapper;
