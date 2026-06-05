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

  // Calculate the largest multiple of 'max' that fits in a 32-bit integer
  const limit = 0x100000000 - (0x100000000 % max);
  
  const typedArray = new Uint32Array(1);

  while (true) {
    cryptoProvider.getRandomValues(typedArray);
    const randomUint32 = typedArray[0];

    // If the number is within the uniform range, map it and return
    if (randomUint32 < limit) {
      return randomUint32 % max;
    }
    // Otherwise, loop and "re-roll" (highly rare, so minimal performance hit)
  }
};
const choose = (items) => items[randomIndex(items.length)];

export const generatePassphrase = () => {
  const adjectives = ['solar', 'bright', 'gentle', 'lucky', 'quiet', 'merry', 'wild', 'cosmic', 'velvet', 'golden'];
  const nouns = ['spark', 'wish', 'cloud', 'echo', 'lantern', 'maple', 'beam', 'ripple', 'pixel', 'trail'];
  const colors = ['blue', 'amber', 'jade', 'pearl', 'ruby', 'sapphire', 'copper', 'opal', 'sage', 'ivory'];

  return `${choose(adjectives)}-${choose(nouns)}-${choose(colors)}`;
};
