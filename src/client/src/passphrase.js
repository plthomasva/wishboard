let cryptoProvider;

if (typeof globalThis !== 'undefined' && typeof globalThis.crypto?.getRandomValues === 'function') {
  cryptoProvider = globalThis.crypto;
} else if (typeof process !== 'undefined' && process.versions?.node) {
  const nodeCrypto = await import(/* @vite-ignore */ 'crypto');
  cryptoProvider = nodeCrypto.webcrypto;
} else {
  throw new Error('No secure crypto available in this environment.');
}

const randomIndex = (max) => {
  if (max <= 0) {
    return 0;
  }
  const randomUint32 = cryptoProvider.getRandomValues(new Uint32Array(1))[0];
  return Math.floor((randomUint32 / 0x100000000) * max);
};

const choose = (items) => items[randomIndex(items.length)];

export const generatePassphrase = () => {
  const adjectives = ['solar', 'bright', 'gentle', 'lucky', 'quiet', 'merry', 'wild', 'cosmic', 'velvet', 'golden'];
  const nouns = ['spark', 'wish', 'cloud', 'echo', 'lantern', 'maple', 'beam', 'ripple', 'pixel', 'trail'];
  const colors = ['blue', 'amber', 'jade', 'pearl', 'ruby', 'sapphire', 'copper', 'opal', 'sage', 'ivory'];

  return `${choose(adjectives)}-${choose(nouns)}-${choose(colors)}`;
};
