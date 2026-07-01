import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies before importing the module under test
const mockSend = vi.fn();
const mockPostToConnectionCommand = vi.fn();

vi.mock('@aws-sdk/client-apigatewaymanagementapi', () => {
  return {
    ApiGatewayManagementApiClient: class {
      constructor() {
        this.send = mockSend;
      }
    },
    PostToConnectionCommand: mockPostToConnectionCommand,
  };
});

vi.mock('./db.js', () => {
  return {
    default: {
      prepare: vi.fn(() => ({
        all: vi.fn().mockResolvedValue([{ connection_id: 'conn1' }, { connection_id: 'conn2' }]),
        run: vi.fn(),
      })),
    },
  };
});

import db from './db.js';
import * as socketModule from './socket.js';

describe('Server socket.js - API Gateway Mode', () => {
  let originalProvider, originalEndpoint;

  beforeEach(() => {
    originalProvider = process.env.REALTIME_PROVIDER;
    originalEndpoint = process.env.WEBSOCKET_API_ENDPOINT;

    process.env.REALTIME_PROVIDER = 'apigateway';
    process.env.WEBSOCKET_API_ENDPOINT = 'https://fake-endpoint';

    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalProvider === undefined) delete process.env.REALTIME_PROVIDER;
    else process.env.REALTIME_PROVIDER = originalProvider;

    if (originalEndpoint === undefined) delete process.env.WEBSOCKET_API_ENDPOINT;
    else process.env.WEBSOCKET_API_ENDPOINT = originalEndpoint;
  });

  it('initSocket returns null and getIO returns mock when in apigateway mode', () => {
    expect(socketModule.initSocket(null, null)).toBeNull();
    expect(socketModule.getIO()).toEqual({});
  });

  it('broadcastToApiGateway sends messages to connections', async () => {
    mockSend.mockResolvedValueOnce({});
    mockSend.mockRejectedValueOnce(Object.assign(new Error('Gone'), { name: 'GoneException' }));

    socketModule.emitNewWish({ id: 1 });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockPostToConnectionCommand).toHaveBeenCalledTimes(2);
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(db.prepare).toHaveBeenCalledWith(
      'DELETE FROM websocket_connections WHERE connection_id = ?'
    );
  });

  it('handles missing WEBSOCKET_API_ENDPOINT gracefully', async () => {
    delete process.env.WEBSOCKET_API_ENDPOINT;

    socketModule.emitWishFlagged({ id: 1 });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockSend).not.toHaveBeenCalled();
  });

  it('emitWishDeleted, emitWishReactivated, emitSystemLog invoke the broadcast', async () => {
    mockSend.mockResolvedValue({});
    socketModule.emitWishDeleted(1);
    socketModule.emitWishReactivated({ id: 1 });
    socketModule.emitSystemLog({ message: 'test' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Each calls broadcastToApiGateway which sends to 2 connections, total 6 sends
    expect(mockSend).toHaveBeenCalledTimes(6);
  });

  it('covers closeSocket', () => {
    socketModule.closeSocket();
  });
});
