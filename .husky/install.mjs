// Install git hooks for local development.
//
// Runs on `npm install`/`npm ci` via the "prepare" script. It is a no-op when
// husky isn't installed (e.g. `npm ci --omit=dev`, or the isolated `npm ci`
// that `sam build` runs) or when there is no git repo. Invoking husky through
// `node` this way avoids shell-builtin differences — notably that Windows
// cmd.exe has no `true` command, which made `husky || true` fail there.
try {
  const husky = (await import('husky')).default;
  husky();
} catch {
  // husky not available in this install — nothing to set up.
}
