/** @vitest-environment node */
import { describe, expect, it, vi } from 'vitest';

vi.mock('./logger.js', () => ({ default: { warn: vi.fn(), error: vi.fn() } }));

const { jsonErrorHandler } = await import('./errorHandler.js');

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('jsonErrorHandler', () => {
  it('returns a retryable 503 JSON for SQLITE_BUSY (by error code)', () => {
    const res = mockRes();
    jsonErrorHandler(
      { code: 'SQLITE_BUSY', message: 'busy' },
      { path: '/api/wishes' },
      res,
      () => {}
    );
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringMatching(/busy/i) })
    );
  });

  it('detects a locked database by message text', () => {
    const res = mockRes();
    jsonErrorHandler({ message: 'database is locked' }, { path: '/x' }, res, () => {});
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('returns a generic 500 JSON for other errors', () => {
    const res = mockRes();
    jsonErrorHandler(new Error('boom'), { path: '/x' }, res, () => {});
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
  });

  it('honours an explicit err.status', () => {
    const res = mockRes();
    jsonErrorHandler({ message: 'bad request', status: 400 }, { path: '/x' }, res, () => {});
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('exposes the message only when the error is marked safe (err.expose)', () => {
    const res = mockRes();
    jsonErrorHandler(
      { message: 'Invalid file type.', status: 400, expose: true },
      { path: '/x' },
      res,
      () => {}
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid file type.' });
  });

  it('does not leak the raw error message to the client', () => {
    const res = mockRes();
    jsonErrorHandler(new Error('secret internal detail'), { path: '/x' }, res, () => {});
    const body = res.json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toMatch(/secret internal detail/);
  });
});
