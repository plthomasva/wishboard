import { Server } from 'socket.io';
import logger from './logger.js';

let io;

export const initSocket = (httpServer, corsOptions) => {
  io = new Server(httpServer, {
    cors: corsOptions
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    // If we later want authenticated rooms:
    // socket.on('joinAdmin', (token) => { ... })

    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

// Expose helpful emit methods
export const emitNewWish = (wish) => {
  if (io) io.emit('wish:created', wish);
};

export const emitWishFlagged = (wish) => {
  if (io) io.emit('wish:flagged', wish);
};

export const emitWishDeleted = (wishId) => {
  if (io) io.emit('wish:deleted', wishId);
};

export const emitSystemLog = (logEntry) => {
  if (io) io.emit('sys:log', logEntry);
};
