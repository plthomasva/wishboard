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
  if (max <= 1) return 0;

  const typedArray = new Uint32Array(1);
  cryptoProvider.getRandomValues(typedArray);
  
  const secureRandomFloat = typedArray[0] / 0x100000000;
  return Math.floor(secureRandomFloat * max);
};
const choose = (items) => items[randomIndex(items.length)];

export const generatePassphrase = () => {
  const adjectives = ['solar', 'bright', 'gentle', 'lucky', 'quiet', 'merry', 'wild', 'cosmic', 'velvet', 'golden'];
  const nouns = ['spark', 'wish', 'cloud', 'echo', 'lantern', 'maple', 'beam', 'ripple', 'pixel', 'trail'];
  const colors = ['blue', 'amber', 'jade', 'pearl', 'ruby', 'sapphire', 'copper', 'opal', 'sage', 'ivory'];

  return `${choose(adjectives)}-${choose(nouns)}-${choose(colors)}`;
};
