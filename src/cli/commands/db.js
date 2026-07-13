import db from '../../server/db.js';
import { createSalt, hashPassphrase } from '../../server/auth.js';
import { promptPassphrase } from './auth.js';

export async function resetPassword(
  username,
  newPassphrase,
  opts = {},
  consoleLog = console.log,
  consoleError = console.error
) {
  if (opts.dryRun) {
    consoleLog(
      `Would have reset password for '${username}' ${opts.url ? `remotely at ${opts.url}` : 'locally'}.`
    );
    return true;
  }

  if (opts.url) {
    const adminUser = opts.admin || 'admin';
    const adminPass = await promptPassphrase(`Enter passphrase for ${adminUser}: `);

    const loginRes = await fetch(`${opts.url}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: adminUser, passphrase: adminPass }),
    });

    if (!loginRes.ok) {
      consoleError(`Error logging in as admin: ${loginRes.statusText}`);
      return false;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;

    const resetRes = await fetch(`${opts.url}/api/admin/users/${username}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(newPassphrase ? { passphrase: newPassphrase } : {}),
    });

    if (!resetRes.ok) {
      consoleError(`Error resetting password remotely: ${resetRes.statusText}`);
      return false;
    }

    const resetData = await resetRes.json();
    consoleLog(`\nSuccess! Passphrase for '${username}' has been reset remotely.`);
    consoleLog(`New Passphrase: ${resetData.new_passphrase}\n`);
    return true;
  }

  let passphrase = newPassphrase;
  if (!passphrase) {
    const { generatePassphrase } = await import('../../client/src/passphrase.js');
    passphrase = generatePassphrase();
  }

  const user = await db.prepare('SELECT id FROM users WHERE username = ?').get(username);

  if (!user) {
    consoleError(`Error: User '${username}' not found in the database.`);
    return false;
  }

  const salt = createSalt();
  const hash = hashPassphrase(passphrase, salt);

  await db
    .prepare('UPDATE users SET passphrase_hash = ?, passphrase_salt = ? WHERE id = ?')
    .run(hash, salt, user.id);
  await db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

  consoleLog(`\nSuccess! Passphrase for '${username}' has been reset locally.`);
  consoleLog(`New Passphrase: ${passphrase}\n`);
  return true;
}
