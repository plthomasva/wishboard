import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRun = vi.fn();
vi.mock('../src/server/db.js', () => {
  return {
    default: {
      prepare: vi.fn(() => ({
        run: mockRun,
      })),
    },
  };
});

vi.mock('../src/server/logger.js', () => {
  return {
    default: {
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

describe('websocket.mjs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 if connectionId is missing', async () => {
    const ws = await import('./websocket.mjs');
    const res = await ws.handler({ requestContext: {} });
    expect(res.statusCode).toBe(400);
  });

  it('handles $connect route', async () => {
    const ws = await import('./websocket.mjs');
    const res = await ws.handler({
      requestContext: { connectionId: 'conn-1', routeKey: '$connect' },
    });
    expect(mockRun).toHaveBeenCalledWith('conn-1', expect.any(String));
    expect(res.statusCode).toBe(200);
  });

  it('handles $disconnect route', async () => {
    const ws = await import('./websocket.mjs');
    const res = await ws.handler({
      requestContext: { connectionId: 'conn-1', routeKey: '$disconnect' },
    });
    expect(mockRun).toHaveBeenCalledWith('conn-1');
    expect(res.statusCode).toBe(200);
  });

  it('handles unknown routes gracefully', async () => {
    const ws = await import('./websocket.mjs');
    const res = await ws.handler({
      requestContext: { connectionId: 'conn-1', routeKey: '$default' },
    });
    expect(mockRun).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it('catches and logs errors', async () => {
    mockRun.mockImplementationOnce(() => {
      throw new Error('DB Error');
    });
    const ws = await import('./websocket.mjs');
    const res = await ws.handler({
      requestContext: { connectionId: 'conn-1', routeKey: '$connect' },
    });
    expect(res.statusCode).toBe(500);
  });
});
