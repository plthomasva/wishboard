import logger from './logger.js';

/**
 * Express JSON error handler. Register it LAST (after all routes).
 *
 * Two guarantees:
 *   1. Every failure returns a JSON body ({ error }) the client can surface,
 *      instead of Express's default HTML 500 (which the client can't parse).
 *   2. SQLite write-lock contention (SQLITE_BUSY / "database is locked") becomes
 *      a friendly, retryable 503 rather than an opaque error — relevant to the
 *      serverless target where Lambdas share one SQLite file over EFS.
 *
 * `next` is unused but required: Express identifies error handlers by arity (4).
 */
export function jsonErrorHandler(err, req, res, _next) {
  const message = err?.message ?? '';
  const isBusy = err?.code === 'SQLITE_BUSY' || /SQLITE_BUSY|database is locked/i.test(message);

  if (isBusy) {
    logger.warn('Database busy (write-lock contention); asked client to retry', {
      path: req?.path,
    });
    return res
      .status(503)
      .json({ error: 'The wishboard is busy right now. Please wait a moment and try again.' });
  }

  const status = Number(err?.status) || 500;
  // Only errors explicitly marked safe (err.expose, the http-errors convention)
  // reveal their message — e.g. input-validation errors. Everything else gets a
  // generic message so internal details never leak to the client.
  const clientMessage =
    err?.expose === true && message ? message : 'Something went wrong. Please try again.';

  if (status >= 500) {
    logger.error('Unhandled request error', { path: req?.path, error: message });
  } else {
    logger.warn('Request error', { path: req?.path, status, error: message });
  }
  return res.status(status).json({ error: clientMessage });
}
