import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from '../db.js';
import { requireAdmin } from '../auth.js';
import { generateDemoData } from '../demoSeeder.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const checkResult = (result, res, entityName) => {
  if (result.changes === 0) {
    return res.status(404).json({ error: `${entityName} not found.` });
  }
  res.json({ success: true });
};

router.get('/flags', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, content, flagged, created_at, user_id FROM wishes WHERE flagged > 0 ORDER BY flagged DESC').all();
  res.json(rows);
});

router.post('/wishes/:id/remove', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM wishes WHERE id = ?').run(req.params.id);
  checkResult(result, res, 'Wish');
});

router.post('/wishes/:id/clear-flag', requireAdmin, (req, res) => {
  const result = db.prepare('UPDATE wishes SET flagged = 0 WHERE id = ?').run(req.params.id);
  checkResult(result, res, 'Wish');
});

router.post('/wishes/clear-all-flags', requireAdmin, (req, res) => {
  db.prepare('UPDATE wishes SET flagged = 0').run();
  res.json({ success: true });
});

router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

router.post('/users/:id/role', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!role || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Role must be user or admin.' });
  }

  const result = db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
  checkResult(result, res, 'User');
});

router.post('/users/:id/delete', requireAdmin, (req, res) => {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  checkResult(result, res, 'User');
});

// POST /api/admin/users/:id/reset-password
router.post('/users/:id/reset-password', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    let passphrase = req.body?.passphrase;

    const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (!passphrase) {
      const { generatePassphrase } = await import('../../client/src/passphrase.js');
      passphrase = generatePassphrase();
    }

    const { createSalt, hashPassphrase } = await import('../auth.js');
    const salt = createSalt();
    const hash = hashPassphrase(passphrase, salt);

    db.prepare('UPDATE users SET passphrase_hash = ?, passphrase_salt = ? WHERE id = ?').run(hash, salt, id);
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);

    res.json({ success: true, newPassphrase: passphrase });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/reset-demo
// Protected by requireAdmin so only the 'admin' account can trigger it
router.post('/reset-demo', requireAdmin, (req, res) => {
  try {
    const stats = generateDemoData();
    res.status(200).json({ 
      message: 'Demo environment successfully seeded.',
      stats
    });
  } catch (error) {
    console.error('Failed to seed demo data:', error);
    res.status(500).json({ error: 'Internal Server Error during seeding' });
  }
});

// GET /api/admin/logs
router.get('/logs', requireAdmin, (req, res) => {
  const logsDir = path.join(__dirname, '../../../data/logs');
  try {
    if (!fs.existsSync(logsDir)) {
      return res.json({ logs: 'Logs directory not found.' });
    }
    const files = fs.readdirSync(logsDir).filter(f => f.endsWith('.log'));
    if (!files.length) {
      return res.json({ logs: 'No logs found.' });
    }
    
    files.sort((a, b) => fs.statSync(path.join(logsDir, b)).mtimeMs - fs.statSync(path.join(logsDir, a)).mtimeMs);
    const newestFile = files[0];
    
    const content = fs.readFileSync(path.join(logsDir, newestFile), 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const lastLines = lines.slice(-500).join('\n');
    res.json({ logs: lastLines });
  } catch (error) {
    console.error('Failed to read logs:', error);
    res.status(500).json({ error: 'Failed to read logs' });
  }
});

export default router;
