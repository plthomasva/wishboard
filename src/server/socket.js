import { Server } from 'socket.io';
import db from './db.js';
import logger from './logger.js';

let io = null;
let apigwClient = null;

const getProvider = () => process.env.REALTIME_PROVIDER || 'socketio';

export const initSocket = (httpServer, corsOptions) => {
  if (getProvider() === 'apigateway') {
    logger.info('API Gateway WebSocket mode enabled. Skipping Socket.io initialization.');
    return null;
  }

  io = new Server(httpServer, {
    cors: corsOptions
  });

  io.on('connection', (socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    socket.on('disconnect', () => {
      logger.info(`WebSocket client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (getProvider() === 'apigateway') {
    // Return a mock or minimal object for compatibility with test suites if needed
    return {};
  }
  if (!io) {
    throw new Error('Socket.io not initialized!');
  }
  return io;
};

export const closeSocket = () => {
  if (io) {
    io.close();
    io = null;
  }
};
// AWS API Gateway WebSocket broadcasting helper
const getApigwClient = async () => {
  if (!apigwClient) {
    const { ApiGatewayManagementApiClient } = await import('@aws-sdk/client-apigatewaymanagementapi');
    const endpoint = process.env.WEBSOCKET_API_ENDPOINT;
    if (!endpoint) {
      throw new Error('WEBSOCKET_API_ENDPOINT environment variable is missing!');
    }
    apigwClient = new ApiGatewayManagementApiClient({ endpoint });
  }
  return apigwClient;
};

const broadcastToApiGateway = async (event, data) => {
  const endpoint = process.env.WEBSOCKET_API_ENDPOINT;
  if (!endpoint) {
    logger.warn('WEBSOCKET_API_ENDPOINT not configured, skipping broadcast.');
    return;
  }

  let rows = [];
  try {
    rows = await db.prepare('SELECT connection_id FROM websocket_connections').all();
  } catch (err) {
    logger.error('Failed to fetch websocket connections from DB:', err.message);
    return;
  }

  if (rows.length === 0) return;

  let client;
  try {
    client = await getApigwClient();
  } catch (err) {
    logger.error('Failed to initialize API Gateway Management Client:', err.message);
    return;
  }

  const { PostToConnectionCommand } = await import('@aws-sdk/client-apigatewaymanagementapi');
  const payload = JSON.stringify({ event, data });
  logger.debug(`Broadcasting ${event} to ${rows.length} connections...`);

  const promises = rows.map(async (row) => {
    const connectionId = typeof row.connection_id === 'string' ? row.connection_id : '';
    try {
      await client.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: payload
      }));
    } catch (err) {
      if (err.name === 'GoneException' || err.$metadata?.httpStatusCode === 410) {
        logger.info(`Connection ${connectionId} is gone, removing from DB.`);
        try {
          await db.prepare('DELETE FROM websocket_connections WHERE connection_id = ?').run(connectionId);
        } catch (deleteErr) {
          logger.error(`Failed to delete gone connection ${connectionId} from DB:`, deleteErr.message);
        }
      } else {
        logger.error(`Failed to post to connection ${connectionId}:`, err.message);
      }
    }
  });

  await Promise.all(promises);
};

// Generic emit wrapper methods
export const emitNewWish = (wish) => {
  if (getProvider() === 'apigateway') {
    broadcastToApiGateway('wish:created', wish);
  } else if (io) {
    io.emit('wish:created', wish);
  }
};

export const emitWishFlagged = (wish) => {
  if (getProvider() === 'apigateway') {
    broadcastToApiGateway('wish:flagged', wish);
  } else if (io) {
    io.emit('wish:flagged', wish);
  }
};

export const emitWishDeleted = (wishId) => {
  if (getProvider() === 'apigateway') {
    broadcastToApiGateway('wish:deleted', wishId);
  } else if (io) {
    io.emit('wish:deleted', wishId);
  }
};

export const emitWishReactivated = (wish) => {
  if (getProvider() === 'apigateway') {
    broadcastToApiGateway('wish:reactivated', wish);
  } else if (io) {
    io.emit('wish:reactivated', wish);
  }
};

export const emitSystemLog = (logEntry) => {
  if (getProvider() === 'apigateway') {
    broadcastToApiGateway('sys:log', logEntry);
  } else if (io) {
    io.emit('sys:log', logEntry);
  }
};

globalThis.__wishboardSocketLoaded = true;
