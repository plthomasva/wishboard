import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, '../../data');
const defaultRulesPath = path.join(dataDir, 'rules.yaml');
const rulesPath = process.env.RULES_PATH || (process.env.NODE_ENV === 'test' 
  ? path.join(dataDir, 'rules.test.yaml') 
  : defaultRulesPath);

if (process.env.RULES_PATH && !fs.existsSync(rulesPath) && fs.existsSync(defaultRulesPath)) {
  try {
    fs.mkdirSync(path.dirname(rulesPath), { recursive: true });
    fs.copyFileSync(defaultRulesPath, rulesPath);
    logger.info(`Initialized EFS rules file by copying default rules from ${defaultRulesPath} to ${rulesPath}`);
  } catch (err) {
    logger.error('Failed to copy default rules to EFS:', err.message);
  }
}

let rulesCache = [];
let yamlDoc = null;

const loadRules = () => {
  try {
    if (!fs.existsSync(rulesPath)) {
      logger.warn(`Rules file not found at ${rulesPath}. Starting with empty rules.`);
      rulesCache = [];
      yamlDoc = new YAML.Document({ rules: [] });
      return;
    }
    const content = fs.readFileSync(rulesPath, 'utf8');
    const newYamlDoc = YAML.parseDocument(content);
    if (newYamlDoc.errors && newYamlDoc.errors.length > 0) {
      throw new Error(`YAML syntax errors: ${newYamlDoc.errors.map(e => e.message).join(', ')}`);
    }
    const parsed = newYamlDoc.toJSON();
    if (Array.isArray(parsed?.rules)) {
      rulesCache = parsed.rules;
      yamlDoc = newYamlDoc;
      logger.info(`Loaded ${rulesCache.length} rules from ${rulesPath}`);
    } else {
      logger.warn('Rules file parsed but "rules" array is missing or invalid. Keeping previous state.');
    }
  } catch (error) {
    logger.error('Failed to load or parse rules.yaml. Retaining previous valid rules state.', { error: error.message });
  }
};

const saveRules = () => {
  try {
    fs.writeFileSync(rulesPath, String(yamlDoc), 'utf8');
    logger.info('Saved rules.yaml via rulesManager');
  } catch (error) {
    logger.error('Failed to save rules.yaml', { error: error.message });
    throw error;
  }
};

// Initial load
loadRules();

// Watch for changes. Use debounce to prevent multiple triggers on save.
let watchTimeout = null;
if (fs.existsSync(rulesPath) && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  fs.watch(rulesPath, (eventType) => {
    if (eventType === 'change') {
      if (watchTimeout) clearTimeout(watchTimeout);
      watchTimeout = setTimeout(() => {
        logger.info('Detected external change in rules.yaml, reloading...');
        loadRules();
      }, 500);
    }
  });
}

export const getRules = () => rulesCache;
export const reloadRules = loadRules;

export const addRule = (rule) => {
  rulesCache.push(rule);
  
  if (!yamlDoc.has('rules')) {
    yamlDoc.set('rules', []);
  }
  yamlDoc.get('rules').add(rule);
  
  saveRules();
  return rule;
};

export const updateRule = (id, updatedRule) => {
  const index = rulesCache.findIndex(r => r.id === id);
  if (index === -1) return false;
  
  rulesCache[index] = { ...rulesCache[index], ...updatedRule };
  
  const rulesSeq = yamlDoc.get('rules');
  if (rulesSeq?.items) {
    const itemIndex = rulesSeq.items.findIndex(item => (item.get ? item.get('id') : item.id) === id);
    if (itemIndex !== -1) {
      const newMap = new YAML.YAMLMap();
      for (const [k, v] of Object.entries(rulesCache[index])) {
        // Omit null values to keep YAML clean
        if (v !== null) {
          newMap.set(k, v);
        }
      }
      rulesSeq.items[itemIndex] = newMap;
    }
  }
  
  saveRules();
  return true;
};

export const deleteRule = (id) => {
  const index = rulesCache.findIndex(r => r.id === id);
  if (index === -1) return false;
  
  rulesCache.splice(index, 1);
  
  const rulesSeq = yamlDoc.get('rules');
  if (rulesSeq?.items) {
    const itemIndex = rulesSeq.items.findIndex(item => (item.get ? item.get('id') : item.id) === id);
    if (itemIndex !== -1) {
      rulesSeq.items.splice(itemIndex, 1);
    }
  }
  
  saveRules();
  return true;
};
