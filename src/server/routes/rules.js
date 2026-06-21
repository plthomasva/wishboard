import express from 'express';
import { customAlphabet } from 'nanoid';
import { requireAdmin } from '../auth.js';
import logger from '../logger.js';
import { getRules, addRule, updateRule, deleteRule } from '../rulesManager.js';

const router = express.Router();
const idGenerator = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8);

// All routes require admin
router.use(await requireAdmin);

router.get('/', async (req, res) => {
  res.json(getRules());
});

router.post('/', async (req, res) => {
  const { rule_type, trigger_attribute, trigger_value, context_attribute, context_value, target_attribute, target_value } = req.body;
  if (!rule_type || !trigger_attribute || !trigger_value || !target_attribute || !target_value) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const id = `rule_${idGenerator()}`;
  const rule = {
    id,
    rule_type,
    trigger_attribute,
    trigger_value,
    context_attribute: context_attribute || null,
    context_value: context_value || null,
    target_attribute,
    target_value
  };

  addRule(rule);

  logger.info('Admin created match rule', { admin_user_id: req.user.id, rule_id: id });
  res.json({ success: true, id });
});

router.put('/:id', async (req, res) => {
  const { rule_type, trigger_attribute, trigger_value, context_attribute, context_value, target_attribute, target_value } = req.body;
  if (!rule_type || !trigger_attribute || !trigger_value || !target_attribute || !target_value) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const updated = updateRule(req.params.id, {
    rule_type,
    trigger_attribute,
    trigger_value,
    context_attribute: context_attribute || null,
    context_value: context_value || null,
    target_attribute,
    target_value
  });

  if (!updated) {
    return res.status(404).json({ error: 'Rule not found' });
  }

  logger.info('Admin updated match rule', { admin_user_id: req.user.id, rule_id: req.params.id });
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  const success = deleteRule(req.params.id);
  if (!success) {
    return res.status(404).json({ error: 'Rule not found' });
  }
  logger.info('Admin deleted match rule', { admin_user_id: req.user.id, rule_id: req.params.id });
  res.json({ success: true });
});

export default router;
