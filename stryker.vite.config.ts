import base from './vite.config.ts';

// Explicitly override the include array to only run the passphrase test
// (mergeConfig merges arrays, which would run the entire test suite)
base.test.include = ['src/client/src/passphrase.test.ts'];

export default base;
