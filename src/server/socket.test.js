/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('socket.js', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  it('initSocket creates and returns io instance, handles connect/disconnect events', async () => {
    const mockSocket = { on: vi.fn(), id: 'test-socket-id' };
    const mockIo = {
      on: vi.fn(function(event, cb) {
        if (event === 'connection') cb(mockSocket);
      }),
      emit: vi.fn(),
    };

    vi.doMock('socket.io', () => ({ Server: function MockServer() { return mockIo; } }));
    vi.doMock('./logger.js', () => ({ default: { info: vi.fn(), debug: vi.fn() } }));

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
    vi.doMock('./logger.js', () => ({ default: { info: vi.fn() } }));

    const { getIO } = await import('./socket.js');
    expect(() => getIO()).toThrow('Socket.io not initialized!');
  });

  it('emit helpers silently no-op when io is not initialized', async () => {
    vi.doMock('socket.io', () => ({ Server: vi.fn(() => null) }));
    vi.doMock('./logger.js', () => ({ default: { info: vi.fn() } }));

    const { emitNewWish, emitWishFlagged, emitWishDeleted, emitSystemLog } = await import('./socket.js');

    // None of these should throw
    expect(() => emitNewWish({ id: '1', content: 'test' })).not.toThrow();
    expect(() => emitWishFlagged({ id: '1' })).not.toThrow();
    expect(() => emitWishDeleted('1')).not.toThrow();
    expect(() => emitSystemLog('log line')).not.toThrow();
  });

  it('emit helpers broadcast to all clients when io is initialized', async () => {
    const mockIo = {
      on: vi.fn(),
      emit: vi.fn(),
    };
    vi.doMock('socket.io', () => ({ Server: function MockServer() { return mockIo; } }));
    vi.doMock('./logger.js', () => ({ default: { info: vi.fn() } }));

    const { initSocket, emitNewWish, emitWishFlagged, emitWishDeleted, emitSystemLog } = await import('./socket.js');

    initSocket({}, {});

    const wish = { id: 'w1', content: 'test' };
    emitNewWish(wish);
    expect(mockIo.emit).toHaveBeenCalledWith('wish:created', wish);

    emitWishFlagged(wish);
    expect(mockIo.emit).toHaveBeenCalledWith('wish:flagged', wish);

    emitWishDeleted('w1');
    expect(mockIo.emit).toHaveBeenCalledWith('wish:deleted', 'w1');

    emitSystemLog('a log line');
    expect(mockIo.emit).toHaveBeenCalledWith('sys:log', 'a log line');
  });
});
