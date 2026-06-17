import '@testing-library/jest-dom';
import ResizeObserver from 'resize-observer-polyfill';
import { vi } from 'vitest';

// Mock socket.io-client so component tests don't try to open a real WebSocket
vi.mock('socket.io-client', () => {
  const socket = {
    connected: false,
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
  return {
    default: { io: vi.fn(() => socket) },
    io: vi.fn(() => socket),
  };
});

globalThis.ResizeObserver = ResizeObserver;
if (globalThis.window !== undefined) {
  Object.defineProperty(globalThis.window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
