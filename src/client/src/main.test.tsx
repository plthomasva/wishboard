/** @vitest-environment jsdom */
import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockRender = vi.fn();
const mockCreateRoot = vi.fn().mockReturnValue({ render: mockRender });

vi.mock('react-dom/client', () => ({
  default: { createRoot: mockCreateRoot },
  createRoot: mockCreateRoot,
}));

vi.mock('./App', () => ({
  default: () => null,
}));

describe('main.tsx', () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = vi.fn().mockImplementation((url) => {
      if (url.includes('/api/config')) {
        return Promise.resolve({ ok: true, json: async () => ({ realtimeProvider: 'socketio' }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  });

  it('renders without crashing', async () => {
    const root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    // Import main.tsx to trigger execution
    await import('./main');

    expect(mockCreateRoot).toHaveBeenCalledWith(root);
    expect(mockRender).toHaveBeenCalled();
  });
});
