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
});
