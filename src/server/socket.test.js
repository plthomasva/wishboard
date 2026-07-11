/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./logger.js', () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('socket.js', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('initSocket creates and returns io instance, handles connect/disconnect events', async () => {
    const mockSocket = { on: vi.fn(), id: 'test-socket-id' };
    const mockIo = {
      on: vi.fn(function (event, cb) {
        if (event === 'connection') cb(mockSocket);
      }),
      emit: vi.fn(),
    };

    vi.doMock('socket.io', () => ({
      Server: function MockServer() {
        return mockIo;
      },
    }));

    const { initSocket, getIO } = await import('./socket.js');

    const mockHttpServer = {};
    const corsOptions = { origin: '*' };

    const result = initSocket(mockHttpServer, corsOptions);
    expect(result).toBe(mockIo);

    // getIO should now return the initialized instance
    expect(getIO()).toBe(mockIo);

    // connection handler registered a disconnect listener on the socket
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));

    // Simulate disconnect by calling the registered callback
    const disconnectCb = mockSocket.on.mock.calls.find(([e]) => e === 'disconnect')?.[1];
    expect(disconnectCb).toBeDefined();
    disconnectCb();
  });

  it('getIO throws if not initialized', async () => {
    vi.doMock('socket.io', () => ({ Server: vi.fn(() => null) }));

    const { getIO } = await import('./socket.js');
    expect(() => getIO()).toThrow('Socket.io not initialized!');
  });

  it('emit helpers silently no-op when io is not initialized', async () => {
    vi.doMock('socket.io', () => ({ Server: vi.fn(() => null) }));

    const { emitNewWish, emitWishFlagged, emitWishDeleted, emitSystemLog } =
      await import('./socket.js');

    // None of these should throw
    expect(() => emitNewWish({ id: '1', content: 'test' })).not.toThrow();
    expect(() => emitWishFlagged({ id: '1' })).not.toThrow();
    expect(() => emitWishDeleted('1')).not.toThrow();
    expect(() => emitSystemLog('log line')).not.toThrow();
  });

  it('emit helpers broadcast to all clients when io is initialized', async () => {
    const roomEmit = vi.fn();
    const mockIo = {
      on: vi.fn(),
      emit: vi.fn(),
      to: vi.fn(() => ({ emit: roomEmit })),
    };
    vi.doMock('socket.io', () => ({
      Server: function MockServer() {
        return mockIo;
      },
    }));

    const { initSocket, emitNewWish, emitWishFlagged, emitWishDeleted, emitSystemLog } =
      await import('./socket.js');

    initSocket({}, {});

    const wish = { id: 'w1', content: 'test' };
    emitNewWish(wish);
    expect(mockIo.emit).toHaveBeenCalledWith('wish:created', wish);

    emitWishFlagged(wish);
    expect(mockIo.emit).toHaveBeenCalledWith('wish:flagged', wish);

    emitWishDeleted('w1');
    expect(mockIo.emit).toHaveBeenCalledWith('wish:deleted', 'w1');

    // sys:log is scoped to the admin-only 'syslog' room, not a global broadcast.
    emitSystemLog('a log line');
    expect(mockIo.to).toHaveBeenCalledWith('syslog');
    expect(roomEmit).toHaveBeenCalledWith('sys:log', 'a log line');
    expect(mockIo.emit).not.toHaveBeenCalledWith('sys:log', 'a log line');
  });

  it('socket.io subscribe joins the syslog room only for an admin token', async () => {
    let connectionCb;
    const mockIo = {
      on: vi.fn((event, cb) => {
        if (event === 'connection') connectionCb = cb;
      }),
      emit: vi.fn(),
      to: vi.fn(() => ({ emit: vi.fn() })),
    };
    vi.doMock('socket.io', () => ({
      Server: function MockServer() {
        return mockIo;
      },
    }));
    vi.doMock('./auth.js', () => ({
      getUserFromToken: vi.fn(async (token) =>
        token === 'admin-token' ? { id: 'a1', role: 'admin' } : { id: 'u1', role: 'user' }
      ),
    }));

    const { initSocket } = await import('./socket.js');
    const socket = { on: vi.fn(), join: vi.fn(), leave: vi.fn(), id: 's1' };
    initSocket({}, {});
    connectionCb(socket);

    const handlerFor = (event) => socket.on.mock.calls.find(([e]) => e === event)?.[1];

    // Non-admin token: no room join.
    await handlerFor('subscribe')({ channel: 'sys:log', token: 'user-token' });
    expect(socket.join).not.toHaveBeenCalled();

    // Admin token: joins the syslog room.
    await handlerFor('subscribe')({ channel: 'sys:log', token: 'admin-token' });
    expect(socket.join).toHaveBeenCalledWith('syslog');

    // Unsubscribe leaves the room.
    handlerFor('unsubscribe')({ channel: 'sys:log' });
    expect(socket.leave).toHaveBeenCalledWith('syslog');
  });

  describe('API Gateway WebSocket mode', () => {
    const originalProvider = process.env.REALTIME_PROVIDER;
    const originalEndpoint = process.env.WEBSOCKET_API_ENDPOINT;

    beforeEach(() => {
      process.env.REALTIME_PROVIDER = 'apigateway';
      process.env.WEBSOCKET_API_ENDPOINT =
        'https://my-api.execute-api.us-east-1.amazonaws.com/production';
    });

    afterEach(() => {
      process.env.REALTIME_PROVIDER = originalProvider;
      process.env.WEBSOCKET_API_ENDPOINT = originalEndpoint;
      vi.restoreAllMocks();
    });

    it('initSocket and getIO in API Gateway mode', async () => {
      const { initSocket, getIO } = await import('./socket.js');
      const res = initSocket({}, {});
      expect(res).toBeNull();
      expect(getIO()).toEqual({});
    });

    it('broadcastToApiGateway handles empty connections', async () => {
      const mockAll = vi.fn().mockResolvedValue([]);
      vi.doMock('./db.js', () => ({
        default: {
          prepare: () => ({
            all: mockAll,
            run: vi.fn(),
          }),
        },
      }));

      const { emitNewWish } = await import('./socket.js');
      emitNewWish({ id: 'w1' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockAll).toHaveBeenCalled();
    });

    it('broadcastToApiGateway sends messages and handles GoneException (410)', async () => {
      const mockSend = vi.fn().mockImplementation((command) => {
        if (command.ConnectionId === 'conn-gone') {
          const goneErr = new Error('Gone');
          goneErr.name = 'GoneException';
          throw goneErr;
        }
        if (command.ConnectionId === 'conn-err') {
          throw new Error('Other error');
        }
        return Promise.resolve({});
      });

      vi.doMock('@aws-sdk/client-apigatewaymanagementapi', () => {
        return {
          ApiGatewayManagementApiClient: function () {
            return { send: mockSend };
          },
          PostToConnectionCommand: function (args) {
            this.ConnectionId = args.ConnectionId;
            this.Data = args.Data;
          },
        };
      });

      const mockRun = vi.fn().mockResolvedValue({ changes: 1 });
      vi.doMock('./db.js', () => ({
        default: {
          prepare: () => ({
            all: () => [
              { connection_id: 'conn-active' },
              { connection_id: 'conn-gone' },
              { connection_id: 'conn-err' },
            ],
            run: mockRun,
          }),
        },
      }));

      const { emitNewWish, emitWishFlagged, emitWishDeleted, emitWishReactivated, emitSystemLog } =
        await import('./socket.js');

      emitNewWish({ id: 'w1' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockSend).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalledWith('conn-gone');

      emitWishFlagged({ id: 'w1' });
      emitWishDeleted('w1');
      emitWishReactivated({ id: 'w1' });
      emitSystemLog('test log');
      // A second synchronous call must hit the re-entrancy guard (this is what
      // prevents the log -> broadcast -> log feedback storm).
      emitSystemLog('while a sys:log broadcast is in flight');
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it('broadcastToApiGateway handles db error gracefully', async () => {
      vi.doMock('./db.js', () => ({
        default: {
          prepare: () => ({
            all: () => {
              throw new Error('DB Error');
            },
          }),
        },
      }));

      const { emitNewWish } = await import('./socket.js');
      expect(() => {
        emitNewWish({ id: 'w1' });
      }).not.toThrow();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    it('sys:log broadcast queries only subscribed connections; wish:* queries all', async () => {
      const prepareSpy = vi.fn(() => ({ all: vi.fn().mockResolvedValue([]), run: vi.fn() }));
      vi.doMock('./db.js', () => ({ default: { prepare: prepareSpy } }));

      const { emitSystemLog, emitNewWish } = await import('./socket.js');

      emitSystemLog('log line');
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(prepareSpy).toHaveBeenCalledWith(
        'SELECT connection_id FROM websocket_connections WHERE sub_syslog = 1'
      );

      emitNewWish({ id: 'w1' });
      await new Promise((resolve) => setTimeout(resolve, 50));
      // Public board events broadcast to every connection (no sub_syslog filter).
      expect(prepareSpy).toHaveBeenCalledWith('SELECT connection_id FROM websocket_connections');
    });
  });
});
