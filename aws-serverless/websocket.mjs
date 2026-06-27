import db from '../src/server/db.js';
import logger from '../src/server/logger.js';

export const handler = async (event) => {
  const connectionId = event.requestContext?.connectionId;
  const routeKey = event.requestContext?.routeKey;

  if (!connectionId) {
    return { statusCode: 400, body: 'Bad Request' };
  }

  logger.info(`WebSocket request: ${routeKey} (connection ID: ${connectionId})`);

  try {
    if (routeKey === '$connect') {
      const now = new Date().toISOString();
      await db.prepare('INSERT INTO websocket_connections (connection_id, created_at) VALUES (?, ?)')
        .run(connectionId, now);
      logger.info(`WebSocket connection registered: ${connectionId}`);
    } else if (routeKey === '$disconnect') {
      await db.prepare('DELETE FROM websocket_connections WHERE connection_id = ?')
        .run(connectionId);
      logger.info(`WebSocket connection unregistered: ${connectionId}`);
    }
    
    return {
      statusCode: 200,
      body: 'OK'
    };
  } catch (err) {
    logger.error(`WebSocket error during ${routeKey}:`, err.message);
    return {
      statusCode: 500,
      body: 'Internal Server Error'
    };
  }
};
