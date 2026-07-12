import crypto from 'node:crypto';
import db, { closeDb } from '../../server/db.js';

const TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Generates a session token for the specified user and writes it to the database.
 * @param {string} username
 * @param {object} options
 */
export async function generateAuthToken(username, options = {}) {
  const dryRun = !!options.dryRun;

  if (dryRun) {
    console.log(`[DRY RUN] Would generate session token for user: ${username}`);
    return;
  }

  try {
    // 1. Check if the user exists
    const user = await db.prepare('SELECT id, role FROM users WHERE username = ?').get(username);
    if (!user) {
      throw new Error(`User "${username}" not found in database.`);
    }

    // 2. Generate token
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS).toISOString();

    // 3. Insert token into sessions table
    await db
      .prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, user.id, expiresAt);

    const roleStr = typeof user.role === 'string' ? user.role : '';
    console.log(`Successfully generated session token for ${username} (${roleStr}):`);
    console.log(token);
  } finally {
    // Cleanly close the DB connection in production to allow process exit
    if (process.env.NODE_ENV !== 'test' && typeof closeDb === 'function') {
      closeDb();
    }
  }
}
