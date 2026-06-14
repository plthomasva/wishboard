import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import wishesRouter from './routes/wishes.js';
import adminRouter from './routes/admin.js';
import usersRouter from './routes/users.js';
import wishmailRouter from './routes/wishmail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(cors());
app.use(express.json());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 100000 : 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});
app.use('/api', limiter);

const frontendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 100000 : 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

app.use('/api/users', usersRouter);
app.use('/api/wishes', wishesRouter);
app.use('/api/wishes/:id/mail', wishmailRouter);
app.use('/api/admin', adminRouter);

const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

app.get('*path', frontendLimiter, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`Wishboard server listening on http://localhost:${PORT}`);
  });
}

export default app;
