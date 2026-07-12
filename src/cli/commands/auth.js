import crypto from 'node:crypto';
import readline from 'node:readline';
import db, { closeDb } from '../../server/db.js';

const TOKEN_EXPIRY_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

/**
 * Prompts the user for a passphrase securely.
 * @param {string} query
 * @returns {Promise<string>}
 */
function promptPassphrase(query) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      // Fallback to standard readline in non-TTY (e.g. testing or redirected input)
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer);
      });
      return;
    }

    process.stdout.write(query);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    let passphrase = '';
    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '\u000d') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(passphrase);
        return;
      }
      if (char === '\u0003') {
        // Ctrl+C
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.exit(130);
      }
      if (char === '\u0008' || char === '\u007f') {
        // Backspace / Delete
        if (passphrase.length > 0) {
          passphrase = passphrase.slice(0, -1);
        }
        return;
      }
      passphrase += char;
    };

    process.stdin.on('data', onData);
  });
}

/**
 * Performs remote login API token retrieval.
 * @param {string} username
 * @param {string} cleanUrl
 * @param {boolean} dryRun
 * @param {object} options
 */
async function generateAuthTokenRemote(username, cleanUrl, dryRun, options) {
  if (dryRun) {
    console.log(
      `[DRY RUN] Would generate remote session token for user: ${username} at ${cleanUrl}`
    );
    return;
  }

  let passphrase = options.passphrase;
  if (!passphrase) {
    passphrase = await promptPassphrase(`Enter passphrase for user ${username}: `);
  }

  const response = await fetch(`${cleanUrl}/api/users/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, passphrase }),
  });

  if (!response.ok) {
    let errMsg = 'Authentication failed';
    try {
      const body = await response.json();
      if (body.error) {
        errMsg = body.error;
      }
    } catch {
      errMsg = `${response.status} ${response.statusText}`;
    }
    throw new Error(`Remote auth failed: ${errMsg}`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error('Remote server response did not include a session token.');
  }

  const roleStr = typeof data.role === 'string' ? data.role : '';
  console.log(`Successfully generated session token for ${username} (${roleStr} - remote):`);
  console.log(data.token);
}

/**
 * Performs local DB session token insertion.
 * @param {string} username
 * @param {boolean} dryRun
 */
async function generateAuthTokenLocal(username, dryRun) {
  if (dryRun) {
    console.log(`[DRY RUN] Would generate session token for user: ${username}`);
    return;
  }

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
}

/**
 * Generates a session token for the specified user and writes it to the database,
 * or retrieves it via HTTP API if a remote URL is specified.
 * @param {string} username
 * @param {object} options
 */
export async function generateAuthToken(username, options = {}) {
  const dryRun = !!options.dryRun;
  const isRemote = !!options.url;

  try {
    if (isRemote) {
      let cleanUrl = options.url.trim();
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }
      while (cleanUrl.endsWith('/')) {
        cleanUrl = cleanUrl.slice(0, -1);
      }

      await generateAuthTokenRemote(username, cleanUrl, dryRun, options);
    } else {
      await generateAuthTokenLocal(username, dryRun);
    }
  } finally {
    // Cleanly close the DB connection in production to allow process exit
    if (process.env.NODE_ENV !== 'test' && typeof closeDb === 'function') {
      closeDb();
    }
  }
}
