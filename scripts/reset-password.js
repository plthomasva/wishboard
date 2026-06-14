import db from '../src/server/db.js';
import { createSalt, hashPassphrase } from '../src/server/auth.js';

export async function resetPassword(args, consoleLog = console.log, consoleError = console.error) {
  if (args.length < 1) {
    consoleError('Usage: node reset-password.js <username> [new_passphrase]');
    consoleError('If new_passphrase is omitted, one will be generated for you.');
    return false;
  }

  const username = args[0];
  let passphrase = args[1];

  if (!passphrase) {
    const { generatePassphrase } = await import('../src/client/src/passphrase.js');
    passphrase = generatePassphrase();
  }

  const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

  if (!user) {
    consoleError(`Error: User '${username}' not found in the database.`);
    return false;
  }

  const salt = createSalt();
  const hash = hashPassphrase(passphrase, salt);

  db.prepare('UPDATE users SET passphrase_hash = ?, passphrase_salt = ? WHERE id = ?').run(hash, salt, user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

  consoleLog(`\nSuccess! Passphrase for '${username}' has been reset.`);
  consoleLog(`New Passphrase: ${passphrase}\n`);
  return true;
}

import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  resetPassword(process.argv.slice(2)).then((success) => {
    if (!success) process.exit(1);
  });
}
