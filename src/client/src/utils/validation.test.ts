import { describe, it, expect } from 'vitest';
import { isValidId, isValidSecret } from './validation';

describe('Validation Utilities', () => {
  describe('isValidId', () => {
    it('allows alphanumeric characters and hyphens', () => {
      expect(isValidId('valid-id-123')).toBe(true);
      expect(isValidId('12345')).toBe(true);
      expect(isValidId('abcd')).toBe(true);
      expect(isValidId('A-B-C-1-2-3')).toBe(true);
    });

    it('rejects underscores, spaces, and special characters', () => {
      expect(isValidId('invalid_id')).toBe(false);
      expect(isValidId('invalid id')).toBe(false);
      expect(isValidId('id@123')).toBe(false);
      expect(isValidId('../id')).toBe(false);
      expect(isValidId('')).toBe(false);
    });
  });

  describe('isValidSecret', () => {
    it('allows alphanumeric characters, hyphens, and underscores', () => {
      expect(isValidSecret('valid_secret-123')).toBe(true);
      expect(isValidSecret('12345')).toBe(true);
      expect(isValidSecret('abcd')).toBe(true);
      expect(isValidSecret('A-B_C-1_2-3')).toBe(true);
    });

    it('rejects spaces and other special characters', () => {
      expect(isValidSecret('invalid secret')).toBe(false);
      expect(isValidSecret('secret!123')).toBe(false);
      expect(isValidSecret('../secret')).toBe(false);
      expect(isValidSecret('')).toBe(false);
    });
  });
});
