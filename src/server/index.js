import http from 'node:http';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import { rateLimit } from 'express-rate-limit';
import wishesRouter from './routes/wishes.js';
import adminRouter from './routes/admin.js';
import usersRouter from './routes/users.js';
import wishmailRouter from './routes/wishmail.js';
import rulesRouter from './routes/rules.js';
import statusMonitor from 'express-status-monitor';
import morgan from 'morgan';
import logger from './logger.js';
import { requireAdmin, consumeMetricsTicket } from './auth.js';
import { initSocket } from './socket.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.set('trust proxy', 1); // Trust first proxy (e.g. nginx) so req.ip uses X-Forwarded-For
app.disable('x-powered-by');

const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS
  ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173']);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    try {
      const originUrl = new URL(origin);
      if (originUrl.hostname.endsWith('.local')) {
        return callback(null, true);
      }
    } catch (err) {
      console.error(err);
    }
    return callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Setup status monitor, restricted to admin only (we mount it later, but init here)
const monitor = statusMonitor({ path: '' });
app.use(monitor);
app.get('/api/admin/metrics', async (req, res, next) => {
  if (req.query.ticket && consumeMetricsTicket(req.query.ticket)) {
    req.user = { role: 'admin' };
    return next();
  }
  await requireAdmin(req, res, next);
}, monitor.pageRoute);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 100000 : 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn('Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(options.statusCode).send(options.message);
  }
});
app.use('/api', limiter);

const frontendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'test' ? 100000 : 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    logger.warn('Frontend Rate limit exceeded', { ip: req.ip, path: req.path });
    res.status(options.statusCode).send(options.message);
  }
});

app.use('/api/users', usersRouter);
app.use('/api/wishes', wishesRouter);
app.use('/api/wishes/:id/mail', wishmailRouter);
app.use('/api/admin', adminRouter);
app.use('/api/rules', rulesRouter);

const distPath = path.resolve(__dirname, '../../dist');
app.use(express.static(distPath));

app.get('*path', frontendLimiter, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server, corsOptions);

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    logger.info(`Wishboard server started on port ${PORT}`);
    console.log(`Wishboard server listening on http://localhost:${PORT}`);
  });
}

// Export both app and server for testing
export { app, server };
export default app;
