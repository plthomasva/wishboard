import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  createSalt,
  hashPassphrase,
  verifyPassphrase,
  createSessionToken,
  parseJsonArray,
  normalizeArrayInput,
  getUserFromToken,
  requireAuth,
  requireAdmin,
  getTokenFromRequestHeader
} from './auth.js';
import db from './db.js';

describe('Server Auth Helper Functions', () => {
  beforeEach(() => {
    // Clear databases or wrap in transactions if necessary, but we can just use the db
  });

  describe('salt and hashing', () => {
    it('generates a valid salt and verifies hash correctly', () => {
      const salt = createSalt();
      expect(salt).toBeDefined();
      expect(typeof salt).toBe('string');
      expect(salt.length).toBe(32);

      const passphrase = 'my-super-secret-passphrase';
      const hash = hashPassphrase(passphrase, salt);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');

      expect(verifyPassphrase(passphrase, salt, hash)).toBe(true);
      expect(verifyPassphrase('wrong-passphrase', salt, hash)).toBe(false);
    });
  });

  describe('parseJsonArray', () => {
    it('returns empty array if no value', () => {
      expect(parseJsonArray(null)).toEqual([]);
      expect(parseJsonArray(undefined)).toEqual([]);
    });

    it('returns empty array if parsed value is not an array', () => {
      expect(parseJsonArray('{"a": 1}')).toEqual([]);
      expect(parseJsonArray('123')).toEqual([]);
      expect(parseJsonArray('"string"')).toEqual([]);
    });

    it('returns array if valid json array', () => {
      expect(parseJsonArray('["man", "woman"]')).toEqual(['man', 'woman']);
    });

    it('returns empty array if invalid JSON (triggers catch block)', () => {
      expect(parseJsonArray('[invalid-json')).toEqual([]);
    });
  });

  describe('normalizeArrayInput', () => {
    it('returns empty array if no value', () => {
      expect(normalizeArrayInput(null)).toEqual([]);
      expect(normalizeArrayInput(undefined)).toEqual([]);
    });

    it('normalizes various array and string inputs', () => {
      expect(normalizeArrayInput('single')).toEqual(['single']);
      expect(normalizeArrayInput(['one', 'two'])).toEqual(['one', 'two']);
      expect(normalizeArrayInput('one,two,three')).toEqual(['one', 'two', 'three']);
      expect(normalizeArrayInput(['one,two', 'three'])).toEqual(['one', 'two', 'three']);
      expect(normalizeArrayInput('  one , two  ')).toEqual(['one', 'two']);
    });
  });

  describe('getUserFromToken and session management', () => {
    it('returns null if no token', () => {
      expect(getUserFromToken(null)).toBeNull();
      expect(getUserFromToken(undefined)).toBeNull();
    });

    it('returns null if token does not exist', () => {
      expect(getUserFromToken('non-existent-token')).toBeNull();
    });

    it('creates a session and fetches user details successfully', () => {
      // Create a test user in DB
      const userId = 'user-' + Math.random().toString(36).substring(2, 9);
      db.prepare(
        'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, identity_genders, identity_orientations, identity_roles, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        userId,
        `test-user-${userId}`,
        'hash',
        'salt',
        'user',
        JSON.stringify(['woman']),
        JSON.stringify(['queer']),
        JSON.stringify(['top']),
        new Date().toISOString()
      );

      const token = createSessionToken(userId);
      expect(token).toBeDefined();

      const user = getUserFromToken(token);
      expect(user).not.toBeNull();
      expect(user.id).toBe(userId);
      expect(user.identity_genders).toEqual(['woman']);
      expect(user.identity_orientations).toEqual(['queer']);
      expect(user.identity_roles).toEqual(['top']);
    });
  });

  describe('getTokenFromRequestHeader', () => {
    it('returns null if auth header is missing or incorrect format', () => {
      expect(getTokenFromRequestHeader({ headers: {} })).toBeNull();
      expect(getTokenFromRequestHeader({ headers: { authorization: 'Basic 123' } })).toBeNull();
    });

    it('extracts token from Bearer header', () => {
      expect(getTokenFromRequestHeader({ headers: { authorization: 'Bearer mytoken' } })).toBe('mytoken');
    });
  });

  describe('requireAuth and requireAdmin middleware', () => {
    it('requireAuth returns 401 if user is not authenticated', () => {
      const req = { headers: {} };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('requireAuth sets req.user and calls next if authenticated', () => {
      // Create a test user in DB
      const userId = 'user-' + Math.random().toString(36).substring(2, 9);
      db.prepare(
        'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, identity_genders, identity_orientations, identity_roles, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        userId,
        `auth-user-${userId}`,
        'hash',
        'salt',
        'user',
        '[]',
        '[]',
        '[]',
        new Date().toISOString()
      );

      const token = createSessionToken(userId);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      requireAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(userId);
    });

    it('requireAdmin returns 403 if user is not an admin', () => {
      // Create a normal test user in DB
      const userId = 'user-' + Math.random().toString(36).substring(2, 9);
      db.prepare(
        'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, identity_genders, identity_orientations, identity_roles, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        userId,
        `normal-user-${userId}`,
        'hash',
        'salt',
        'user',
        '[]',
        '[]',
        '[]',
        new Date().toISOString()
      );

      const token = createSessionToken(userId);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      requireAdmin(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('requireAdmin sets req.user and calls next if user is an admin', () => {
      // Create an admin test user in DB
      const userId = 'user-' + Math.random().toString(36).substring(2, 9);
      db.prepare(
        'INSERT INTO users (id, username, passphrase_hash, passphrase_salt, role, identity_genders, identity_orientations, identity_roles, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        userId,
        `admin-user-${userId}`,
        'hash',
        'salt',
        'admin',
        '[]',
        '[]',
        '[]',
        new Date().toISOString()
      );

      const token = createSessionToken(userId);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      const next = vi.fn();

      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(userId);
    });
  });
});
