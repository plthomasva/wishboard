import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('db initialization', () => {
  let db;

  beforeEach(async () => {
    // We must reset modules to force re-evaluation of db.js
    vi.resetModules();
    db = (await import('./db.js')).default;
  });

  it('creates tables', async () => {
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    const tableNames = tables.map(t => t.name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('sessions');
    expect(tableNames).toContain('wishes');
    expect(tableNames).toContain('wishmails');
  });

  it('ensures all expected columns are added to users table', async () => {
    const columns = await db.prepare("PRAGMA table_info(users)").all();
    const columnNames = columns.map(c => c.name);
    
    // Base columns
    expect(columnNames).toContain('id');
    expect(columnNames).toContain('username');
    expect(columnNames).toContain('passphrase_hash');
    expect(columnNames).toContain('passphrase_salt');
    expect(columnNames).toContain('role');
    expect(columnNames).toContain('created_at');
    
    // Ensured columns
    expect(columnNames).toContain('identity_genders');
    expect(columnNames).toContain('identity_orientations');
    expect(columnNames).toContain('identity_roles');
    expect(columnNames).toContain('contacts');
    expect(columnNames).toContain('wishmail_enabled');
    expect(columnNames).toContain('is_active');
  });

  it('ensures all expected columns are added to wishes table', async () => {
    const columns = await db.prepare("PRAGMA table_info(wishes)").all();
    const columnNames = columns.map(c => c.name);
    
    // Ensured columns
    expect(columnNames).toContain('creator_genders');
    expect(columnNames).toContain('creator_orientations');
    expect(columnNames).toContain('creator_roles');
    expect(columnNames).toContain('desired_genders');
    expect(columnNames).toContain('desired_orientations');
    expect(columnNames).toContain('desired_roles');
    expect(columnNames).toContain('contacts');
    expect(columnNames).toContain('wishmail_enabled');
    expect(columnNames).toContain('is_active');
  });

  it('ensures default admin account exists', async () => {
    const admin = await db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
    expect(admin).toBeDefined();
    expect(admin.username).toBe('admin');
  });

  it('does not duplicate admin account if it already exists', async () => {
    // Import normally
    const existingDb = (await import('./db.js')).default;
    
    // There should only be one admin account
    const admins = await existingDb.prepare("SELECT * FROM users WHERE role = 'admin'").all();
    expect(admins.length).toBe(1);
    
    // If we call ensureDefaultAdmin again by re-importing, it should still be 1
    vi.resetModules();
    const nextDb = (await import('./db.js')).default;
    const nextAdmins = await nextDb.prepare("SELECT * FROM users WHERE role = 'admin'").all();
    expect(nextAdmins.length).toBe(1);
  });
});
