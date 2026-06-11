import express from 'express';
import db from '../db.js';
import { requireAdmin } from '../auth.js';
import { generateDemoData } from '../demoSeeder.js';

const router = express.Router();

router.get('/flags', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT id, content, flagged, created_at, user_id FROM wishes WHERE flagged > 0 ORDER BY flagged DESC').all();
  res.json(rows);
});

router.post('/wishes/:id/remove', requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM wishes WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Wish not found.' });
  }
  res.json({ success: true });
});

router.post('/wishes/:id/clear-flag', requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('UPDATE wishes SET flagged = 0 WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Wish not found.' });
  }
  res.json({ success: true });
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
  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ success: true });
});

router.post('/users/:id/delete', requireAdmin, (req, res) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }
  res.json({ success: true });
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

export default router;
