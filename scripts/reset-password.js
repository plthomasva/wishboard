import db from '../src/server/db.js';
import { createSalt, hashPassphrase } from '../src/server/auth.js';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node reset-password.js <username> [new_passphrase]');
  console.error('If new_passphrase is omitted, one will be generated for you.');
  process.exit(1);
}

const username = args[0];
let passphrase = args[1];

if (!passphrase) {
  // Generate a random passphrase if none provided
  const { generatePassphrase } = await import('../src/client/src/passphrase.js');
  passphrase = generatePassphrase();
}

const user = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (!user) {
  console.error(`Error: User '${username}' not found in the database.`);
  process.exit(1);
}

const salt = createSalt();
const hash = hashPassphrase(passphrase, salt);

db.prepare('UPDATE users SET passphrase_hash = ?, passphrase_salt = ? WHERE id = ?').run(hash, salt, user.id);
// Also clear any active sessions so they have to log in again
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);

console.log(`\nSuccess! Passphrase for '${username}' has been reset.`);
console.log(`New Passphrase: ${passphrase}\n`);
