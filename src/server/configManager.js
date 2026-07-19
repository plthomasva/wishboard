import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';
import defaultRules from './defaultRules.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let cachedConfig = null;

export const getDomainConfig = () => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = process.env.DOMAIN_CONFIG_PATH
    ? path.resolve(process.cwd(), process.env.DOMAIN_CONFIG_PATH)
    : path.resolve(__dirname, 'defaultDomain.yaml');

  let fileContents = '';
  try {
    fileContents = fs.readFileSync(configPath, 'utf8');
  } catch (err) {
    console.error(`Failed to read domain config at ${configPath}:`, err.message);
    throw err;
  }

  const config = yaml.parse(fileContents);

  if (!config.rules) {
    config.rules = defaultRules;
  }

  cachedConfig = config;
  return config;
};

export const clearConfigCache = () => {
  cachedConfig = null;
};
