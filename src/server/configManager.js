import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import defaultRules from './defaultRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedConfig = null;

export const getEventProfile = () => {
  if (cachedConfig) {
    return cachedConfig;
  }

  let configPath = process.env.EVENT_PROFILE_PATH || process.env.DOMAIN_CONFIG_PATH;

  if (!configPath) {
    const profileName = process.env.EVENT_PROFILE || 'lifestyle';
    // Check root /profiles/<name>/profile.yaml first, then bundled /var/task/profile.yaml
    const repoPath = path.resolve(process.cwd(), 'profiles', profileName, 'profile.yaml');
    const bundledPath = path.resolve(__dirname, 'profile.yaml');
    if (fs.existsSync(repoPath)) {
      configPath = repoPath;
    } else if (fs.existsSync(bundledPath)) {
      configPath = bundledPath;
    } else {
      configPath = repoPath; // fallback for error reporting
    }
  } else {
    configPath = path.resolve(process.cwd(), configPath);
  }

  let fileContents = '';
  try {
    fileContents = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    console.error(`Failed to read event profile config at ${configPath}:`, err.message);
    throw err;
  }

  const config = yaml.parse(fileContents);

  if (!config.rules) {
    config.rules = defaultRules;
  }

  if (!config.contact_methods) {
    config.contact_methods = ['Phone', 'Email'];
  }

  cachedConfig = config;
  return config;
};

export const getDomainConfig = getEventProfile;

export const clearConfigCache = () => {
  cachedConfig = null;
};
