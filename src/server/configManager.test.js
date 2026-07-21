import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getEventProfile, getDomainConfig, clearConfigCache } from './configManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('configManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EVENT_PROFILE_PATH;
    delete process.env.DOMAIN_CONFIG_PATH;
    delete process.env.EVENT_PROFILE;
    clearConfigCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearConfigCache();
    vi.restoreAllMocks();
  });

  it('loads default profile config when no environment variables are set', () => {
    const config = getEventProfile();
    expect(config).toBeDefined();
    expect(config.profile).toBeDefined();
    expect(Array.isArray(config.contact_methods)).toBe(true);
  });

  it('returns cached config on subsequent calls until clearConfigCache is invoked', () => {
    const config1 = getEventProfile();
    const config2 = getEventProfile();
    expect(config1).toBe(config2);

    clearConfigCache();
    const config3 = getEventProfile();
    expect(config3).not.toBe(config1); // Fresh reference after clear
  });

  it('supports getDomainConfig alias', () => {
    expect(getDomainConfig).toBe(getEventProfile);
  });

  it('uses EVENT_PROFILE_PATH when provided', () => {
    process.env.EVENT_PROFILE_PATH = 'profiles/professional/profile.yaml';
    const config = getEventProfile();
    expect(config.profile).toBe('professional');
  });

  it('uses DOMAIN_CONFIG_PATH when provided', () => {
    process.env.DOMAIN_CONFIG_PATH = 'profiles/professional/profile.yaml';
    const config = getEventProfile();
    expect(config.profile).toBe('professional');
  });

  it('uses EVENT_PROFILE env variable when set', () => {
    process.env.EVENT_PROFILE = 'professional';
    const config = getEventProfile();
    expect(config.profile).toBe('professional');
  });

  it('falls back to bundledPath when repoPath does not exist', () => {
    const repoPath = path.resolve(process.cwd(), 'profiles', 'lifestyle', 'profile.yaml');
    const bundledPath = path.resolve(__dirname, 'profile.yaml');

    const originalExistsSync = fs.existsSync;
    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (p === repoPath) return false;
      if (p === bundledPath) return true;
      return originalExistsSync(p);
    });

    const readSpy = vi.spyOn(fs, 'readFileSync').mockImplementation((p, enc) => {
      if (p === bundledPath) {
        return 'profile: bundled\ncontact_methods:\n  - Email\n';
      }
      return originalExistsSync(p, enc);
    });

    const config = getEventProfile();
    expect(config.profile).toBe('bundled');
    expect(existsSpy).toHaveBeenCalled();
    expect(readSpy).toHaveBeenCalledWith(bundledPath, 'utf8');
  });

  it('populates default rules and contact_methods if missing in YAML', () => {
    vi.spyOn(fs, 'readFileSync').mockReturnValue('profile: minimal\n');

    const config = getEventProfile();
    expect(config.profile).toBe('minimal');
    expect(Array.isArray(config.rules)).toBe(true);
    expect(config.rules.length).toBeGreaterThan(0);
    expect(config.contact_methods).toEqual(['Phone', 'Email']);
  });

  it('logs error and re-throws when fs.readFileSync fails', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.EVENT_PROFILE_PATH = 'nonexistent/path/profile.yaml';

    expect(() => getEventProfile()).toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read event profile config at'),
      expect.any(String)
    );
  });
});
