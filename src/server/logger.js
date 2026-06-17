import winston from 'winston';
import 'winston-daily-rotate-file';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const META_KEYS = new Set(['timestamp', 'level', 'message']);

// Custom Transport for WebSockets — no constructor needed, inherits parent
class SocketTransport extends winston.Transport {
  log(info, callback) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // Dynamically import to avoid circular dependency at module load time
    import('./socket.js').then((socketModule) => {
      const metaEntries = Object.entries(info).filter(([k]) => !META_KEYS.has(k));
      const formattedLog = `[${info.timestamp}] ${info.level}: ${info.message} ${
        metaEntries.some(() => true) ? JSON.stringify(Object.fromEntries(metaEntries)) : ''
      }`;
      socketModule.emitSystemLog(formattedLog);
    }).catch(() => { /* Ignore if socket module isn't ready */ });

    callback();
  }
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

const productionTransports = process.env.NODE_ENV !== 'test'
  ? [
      new winston.transports.DailyRotateFile({
        filename: path.join(__dirname, '../../data/logs/wishboard-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        zippedArchive: false,
        maxSize: '20m',
        maxFiles: '14d'
      }),
      new SocketTransport(),
    ]
  : [];

const transports = [
  ...productionTransports,
  new winston.transports.Console({
    silent: process.env.NODE_ENV === 'test',
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        return `[${timestamp}] ${level}: ${message} ${
          Object.keys(meta).length ? JSON.stringify(meta) : ''
        }`;
      })
    )
  }),
];

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports
});

export default logger;
