import { describe, expect, it } from 'vitest';
import { generatePassphrase } from './passphrase.js';

describe('generatePassphrase', () => {
  it('returns a passphrase with three non-empty segments', () => {
    const passphrase = generatePassphrase();
    expect(passphrase).toBeTypeOf('string');
    const parts = passphrase.split('-');
    expect(parts).toHaveLength(3);
    expect(parts.every((segment) => segment.trim().length > 0)).toBe(true);
  });

  it('always returns a string with two hyphens', () => {
    const passphrase = generatePassphrase();
    expect(passphrase.split('-').length).toBe(3);
    expect(passphrase).toMatch(/^[a-z]+-[a-z]+-[a-z]+$/);
  });

  it('uses node crypto if globalThis.crypto is undefined', async () => {
    const originalCrypto = globalThis.crypto;
    // @ts-ignore
    delete globalThis.crypto;
    
    vi.resetModules();
    const { generatePassphrase } = await import('./passphrase.js?node-fallback');
    expect(generatePassphrase()).toBeTypeOf('string');
    
    globalThis.crypto = originalCrypto;
  });

  it('throws an error if no crypto is available', async () => {
    const originalCrypto = globalThis.crypto;
    // @ts-ignore
    delete globalThis.crypto;
    
    const originalProcess = process;
    // @ts-ignore
    global.process = undefined;

    vi.resetModules();
    await expect(import('./passphrase.js?error-fallback')).rejects.toThrow('No secure crypto available in this environment.');
    
    globalThis.crypto = originalCrypto;
    global.process = originalProcess;
  });
});
