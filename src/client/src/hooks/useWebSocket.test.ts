import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns a socket and initial disconnected state', async () => {
    const { useWebSocket } = await import('./useWebSocket');
    const { result } = renderHook(() => useWebSocket());

    expect(result.current.socket).toBeDefined();
    // The mock socket starts with connected: false
    expect(result.current.isConnected).toBe(false);
  });

  it('updates isConnected to true on connect event', async () => {
    const { useWebSocket } = await import('./useWebSocket');
    const { result } = renderHook(() => useWebSocket());

    const socket = result.current.socket!;
    // Find the 'connect' handler registered on the mock
    const connectCall = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([e]) => e === 'connect'
    );
    expect(connectCall).toBeDefined();

    act(() => {
      connectCall![1](); // trigger connect
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('updates isConnected to false on disconnect event', async () => {
    const { useWebSocket } = await import('./useWebSocket');
    const { result } = renderHook(() => useWebSocket());

    const socket = result.current.socket!;
    const connectCall = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([e]) => e === 'connect'
    );
    const disconnectCall = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(
      ([e]) => e === 'disconnect'
    );

    act(() => {
      connectCall![1]();
    });
    expect(result.current.isConnected).toBe(true);

    act(() => {
      disconnectCall![1]();
    });
    expect(result.current.isConnected).toBe(false);
  });

  it('cleans up event listeners on unmount', async () => {
    const { useWebSocket } = await import('./useWebSocket');
    const { result, unmount } = renderHook(() => useWebSocket());

    const socket = result.current.socket!;
    unmount();

    expect(socket.off).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(socket.off).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('getSocket returns the same singleton instance across calls', async () => {
    const { getSocket } = await import('./useWebSocket');
    const s1 = getSocket();
    const s2 = getSocket();
    expect(s1).toBe(s2);
  });

  describe('RawWebSocketWrapper (isRawMode === true)', () => {
    let mockWebSocketInstance;

    class MockWebSocket {
      public onopen;
      public onclose;
      public onmessage;
      public onerror;

      constructor(public url) {
        // eslint-disable-next-line @typescript-eslint/no-this-alias -- capture mock instance for assertions
        mockWebSocketInstance = this;
      }

      close() {
        if (this.onclose) this.onclose();
      }
    }

    beforeEach(() => {
      vi.stubGlobal('location', {
        protocol: 'http:',
        host: 'localhost:3000',
        origin: 'http://localhost:3000',
      });
      vi.stubGlobal('WebSocket', MockWebSocket);
      import.meta.env.VITE_USE_RAW_WEBSOCKETS = 'true';
      import.meta.env.VITE_WS_URL = 'ws://localhost:3000/raw';
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.unstubAllGlobals();
      import.meta.env.VITE_USE_RAW_WEBSOCKETS = undefined;
      import.meta.env.VITE_WS_URL = undefined;
      vi.useRealTimers();
    });

    it('creates a raw WebSocket connection and triggers events', async () => {
      const { useWebSocket } = await import('./useWebSocket');
      const { result } = renderHook(() => useWebSocket());

      expect(mockWebSocketInstance).toBeDefined();
      expect(mockWebSocketInstance.url).toBe('ws://localhost:3000/raw');
      expect(result.current.isConnected).toBe(false);

      // Trigger connect
      act(() => {
        mockWebSocketInstance.onopen();
      });
      expect(result.current.isConnected).toBe(true);

      // Trigger message
      const wishCreatedSpy = vi.fn();
      result.current.socket.on('wish:created', wishCreatedSpy);

      act(() => {
        mockWebSocketInstance.onmessage({
          data: JSON.stringify({ event: 'wish:created', data: { id: 'w1' } }),
        });
      });
      expect(wishCreatedSpy).toHaveBeenCalledWith({ id: 'w1' });

      // Trigger invalid message to test catch block
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      act(() => {
        mockWebSocketInstance.onmessage({ data: 'invalid json' });
      });
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();

      // Trigger error
      const consoleErrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      act(() => {
        mockWebSocketInstance.onerror(new Error('err'));
      });
      expect(consoleErrSpy).toHaveBeenCalled();
      consoleErrSpy.mockRestore();

      // Trigger close (disconnect & reconnect timer)
      act(() => {
        mockWebSocketInstance.onclose();
      });
      expect(result.current.isConnected).toBe(false);

      // Advance timers to trigger reconnect
      act(() => {
        vi.advanceTimersByTime(3000);
      });
      expect(mockWebSocketInstance).toBeDefined();

      // Test off method
      result.current.socket.off('wish:created', wishCreatedSpy);

      // Test off edge case
      result.current.socket.off('nonexistent-event', () => {});
    });

    it('handles connection error and reconnects', async () => {
      // Mock error during constructor
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.stubGlobal(
        'WebSocket',
        class FailingMockWebSocket {
          constructor() {
            throw new Error('Connect error');
          }
        }
      );

      const { useWebSocket } = await import('./useWebSocket');
      renderHook(() => useWebSocket());

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to initialize raw WebSocket connection:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});
