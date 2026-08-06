import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseAttributesString, fetchConflicts, getConflictWarning, Conflict } from './conflicts';

describe('conflicts utils', () => {
  describe('parseAttributesString', () => {
    it('should split by comma and trim whitespace', () => {
      expect(parseAttributesString('a, b , c')).toEqual(['a', 'b', 'c']);
    });

    it('should filter out empty/falsy values', () => {
      expect(parseAttributesString('a,,b, ')).toEqual(['a', 'b']);
    });

    it('should return an empty array for an empty string', () => {
      expect(parseAttributesString('')).toEqual([]);
    });

    it('should handle strings with only spaces and commas', () => {
      expect(parseAttributesString(' , ,, ')).toEqual([]);
    });
  });

  describe('fetchConflicts', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(global, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return conflicts when the fetch response is ok', async () => {
      const mockConflicts: Conflict[] = [
        { message: 'conflict message', target_attribute: 'attr1' },
      ];

      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ conflicts: mockConflicts }),
      } as Response);

      const result = await fetchConflicts({ attr1: ['val1'] });

      expect(fetchSpy).toHaveBeenCalledWith('/api/rules/check-conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: { attr1: ['val1'] } }),
      });
      expect(result).toEqual(mockConflicts);
    });

    it('should return an empty array if the response is ok but missing conflicts array', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      const result = await fetchConflicts({ attr1: ['val1'] });
      expect(result).toEqual([]);
    });

    it('should return an empty array when the fetch response is not ok', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
      } as Response);

      const result = await fetchConflicts({ attr1: ['val1'] });
      expect(result).toEqual([]);
    });

    it('should return an empty array when fetch throws an error', async () => {
      fetchSpy.mockRejectedValue(new Error('Network Error'));

      const result = await fetchConflicts({ attr1: ['val1'] });
      expect(result).toEqual([]);
    });
  });

  describe('getConflictWarning', () => {
    const conflicts: Conflict[] = [
      { message: 'Warning A', target_attribute: 'attr1' },
      { message: 'Warning B', target_attribute: 'attr1' },
      { message: 'Warning C', target_attribute: 'attr2' },
    ];

    it('should return joined messages separated by a space for the matching attribute', () => {
      expect(getConflictWarning(conflicts, 'attr1')).toBe('Warning A Warning B');
    });

    it('should return single message if only one match is found', () => {
      expect(getConflictWarning(conflicts, 'attr2')).toBe('Warning C');
    });

    it('should return undefined if no conflicts match the attribute', () => {
      expect(getConflictWarning(conflicts, 'attr3')).toBeUndefined();
    });

    it('should return undefined if the conflicts array is empty', () => {
      expect(getConflictWarning([], 'attr1')).toBeUndefined();
    });
  });
});
