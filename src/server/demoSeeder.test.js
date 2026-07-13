/** @vitest-environment node */
process.env.WISHBOARD_DB_PATH = ':memory:';

import { describe, expect, it } from 'vitest';
const db = (await import('./db.js')).default;
/** @type {typeof import('./demoSeeder.js').generateDemoData} */
const generateDemoData = (await import('./demoSeeder.js')).generateDemoData;

describe('generateDemoData', () => {
  it('creates 50 demo users and 100 demo wishes while preserving admin, and clears old data on consecutive runs', async () => {
    // Run first time
    const stats1 = await generateDemoData();
    expect(stats1).toEqual({ usersCreated: 50, wishesCreated: 100 });

    // Verify users
    const users = await db.prepare("SELECT * FROM users WHERE role != 'admin'").all();
    expect(users.length).toBe(50);

    let hasWishmailEnabled = false;
    let hasWishmailDisabled = false;
    let hasContacts = false;
    let hasNoContacts = false;

    for (const user of users) {
      expect(user.username).toMatch(/^demo_user_\d+$/);
      expect(user.passphrase_hash).toMatch(/^[0-9a-f]{128}$/); // 64 bytes = 128 hex chars
      expect(user.passphrase_salt).toMatch(/^[0-9a-f]{32}$/); // 16 bytes = 32 hex chars
      expect(user.role).toBe('user');

      // Verify JSON arrays
      const genders = JSON.parse(user.identity_genders);
      const orientations = JSON.parse(user.identity_orientations);
      const roles = JSON.parse(user.identity_roles);
      const contacts = JSON.parse(user.contacts);

      expect(Array.isArray(genders)).toBe(true);
      expect(Array.isArray(orientations)).toBe(true);
      expect(Array.isArray(roles)).toBe(true);
      expect(Array.isArray(contacts)).toBe(true);

      if (user.wishmail_enabled === 1) hasWishmailEnabled = true;
      if (user.wishmail_enabled === 0) hasWishmailDisabled = true;

      if (contacts.length > 0) {
        hasContacts = true;
        for (const contact of contacts) {
          expect(['FetLife', 'Phone', 'Email']).toContain(contact.type);
          if (contact.type === 'Phone') {
            expect(contact.value).toMatch(/^555-010\d+$/);
          } else {
            expect(contact.value).toMatch(/^demo_(fetlife|email)_\d+$/);
          }
        }
      } else {
        hasNoContacts = true;
      }
    }

    // Verify there is a mix of randomized values
    expect(hasWishmailEnabled).toBe(true);
    expect(hasWishmailDisabled).toBe(true);
    expect(hasContacts).toBe(true);
    expect(hasNoContacts).toBe(true);

    // Verify wishes
    const wishes = await db.prepare('SELECT * FROM wishes').all();
    expect(wishes.length).toBe(100);

    let hasWishmailWishEnabled = false;
    let hasWishmailWishDisabled = false;

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

    for (const wish of wishes) {
      expect(wish.content.length).toBeGreaterThan(0);
      expect(wish.creator_genders).toBeDefined();
      expect(wish.creator_orientations).toBeDefined();
      expect(wish.creator_roles).toBeDefined();
      expect(wish.flagged).toBe(0);

      // Verify desired fields are valid JSON
      expect(Array.isArray(JSON.parse(wish.desired_genders))).toBe(true);
      expect(Array.isArray(JSON.parse(wish.desired_orientations))).toBe(true);
      expect(Array.isArray(JSON.parse(wish.desired_roles))).toBe(true);

      const contacts = JSON.parse(wish.contacts);
      expect(Array.isArray(contacts)).toBe(true);

      if (wish.wishmail_enabled === 1) hasWishmailWishEnabled = true;
      if (wish.wishmail_enabled === 0) hasWishmailWishDisabled = true;

      const createdTime = new Date(wish.created_at).getTime();
      expect(createdTime).toBeGreaterThanOrEqual(thirtyDaysAgo);
      expect(createdTime).toBeLessThanOrEqual(now);
    }

    expect(hasWishmailWishEnabled).toBe(true);
    expect(hasWishmailWishDisabled).toBe(true);

    // Verify admin exists and was preserved
    const adminCount = (
      await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get()
    ).count;
    expect(adminCount).toBe(1);

    // Run a second time to test the clearDemoData functionality
    const stats2 = await generateDemoData();
    expect(stats2).toEqual({ usersCreated: 50, wishesCreated: 100 });

    // Assert counts did not double (correctly cleared)
    expect(
      (await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role != 'admin'").get()).count
    ).toBe(50);
    expect((await db.prepare('SELECT COUNT(*) AS count FROM wishes').get()).count).toBe(100);
    expect(
      (await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'").get()).count
    ).toBe(1);
  }, 15000);
});
