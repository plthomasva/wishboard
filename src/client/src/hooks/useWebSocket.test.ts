import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { io } from 'socket.io-client';

// setupTests.ts mocks socket.io-client; retrieve the mock socket it returns
const getMockSocket = () => (io as ReturnType<typeof vi.fn>).mock.results[0]?.value ?? (io as ReturnType<typeof vi.fn>)();

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
    const connectCall = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(([e]) => e === 'connect');
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
    const connectCall = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(([e]) => e === 'connect');
    const disconnectCall = (socket.on as ReturnType<typeof vi.fn>).mock.calls.find(([e]) => e === 'disconnect');

    act(() => { connectCall![1](); });
    expect(result.current.isConnected).toBe(true);

    act(() => { disconnectCall![1](); });
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
});
