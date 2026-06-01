import express from 'express';
import db from '../db.js';
import { requireAdmin } from '../auth.js';

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

export default router;
