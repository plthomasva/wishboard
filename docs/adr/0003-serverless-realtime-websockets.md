# ADR 0003: Serverless real-time via API Gateway WebSockets

- **Status:** Accepted — implemented across #185, #186, #187 (2026-07).
- **Date:** 2026-07

## Context

Wishboard pushes live updates (new wish, flag, delete, reactivate, and a `sys:log`
admin stream) to connected clients. The two topologies reach this differently from
one codebase:

- **Kiosk (Pi):** a long-lived Express process runs **socket.io** in-process.
- **Serverless (AWS):** Lambdas are ephemeral and can't hold socket.io connections,
  so real-time rides **API Gateway WebSockets**, fronted by the same CloudFront
  distribution as the HTTP API.

The provider is chosen at runtime: the client fetches `/api/config`, and if
`realtimeProvider === 'apigateway'` it opens a **raw WebSocket** (API Gateway speaks
raw frames, not socket.io's handshake/protocol) instead of a socket.io client.

Getting this working end-to-end surfaced three distinct failures, fixed in sequence.

## Architecture

```
browser ──wss──▶ CloudFront (/socket.io/*) ──▶ API Gateway WebSocket (/production)
                                                   │  $connect / $disconnect
                                                   ▼
                                        WebSocketFunction (Lambda)
                                                   │  INSERT/DELETE
                                                   ▼
                                   websocket_connections table (Turso)
                                                   ▲
                    ApiFunction ──SELECT ids──┘  then PostToConnection ──▶ each client
                    (on wish:created / sys:log / …)
```

- The `websocket_connections` table is the **only shared connection state** across
  independently-scaling Lambda instances — it must live in the shared DB (now Turso,
  see [ADR 0002](0002-serverless-database-architecture.md)), not in memory.
- Broadcasting reads all connection IDs and calls `PostToConnection` per client,
  pruning any that return `410 Gone`.

## Decisions & fixes

### 1. CloudFront → WebSocket routing (#185)

The `/socket.io/*` cache behavior targets the WebSocket API origin with the
`Managed-AllViewerExceptHostHeader` origin-request policy (so the `Upgrade` /
`Connection` / `Sec-WebSocket-*` handshake headers are forwarded — the previous
policy stripped them, yielding `426 Upgrade Required`). A **CloudFront Function**
rewrites the request URI to the bare stage path `/production`, because a WebSocket
API only accepts the upgrade at its named stage. Without the rewrite the origin saw
`/production/socket.io/` and returned `403`, which the SPA `CustomErrorResponses`
silently masked as a `200 index.html`.

### 2. The `sys:log` feedback loop (#186)

`emitSystemLog` broadcasts every log line to clients. But `broadcastToApiGateway`
_itself logs_ ("Broadcasting … to N connections") — which is another log line, which
triggers another broadcast, and so on: one line snowballed into **18,751 broadcasts
in 8 minutes**, each hanging on `PostToConnection` until the 30 s Lambda timeout.
Fixed with a **re-entrancy guard** (`sysLogBroadcastInFlight`) and a **3 s fail-fast**
cap (`Promise.race`) on each `PostToConnection`.

### 3. Fire-and-forget broadcasts vs. Lambda freeze (#187)

The route handlers call `emitNewWish(…)` etc. **without `await`**. On Lambda the
execution environment **freezes the instant the HTTP response resolves**, so the
un-awaited broadcast promise — paused at its first `await db…all()` — never ran.
(The #186 storm had been masking this by keeping the event loop hot; killing the
storm exposed it.) Fixed by **tracking in-flight broadcasts** in `socket.js` and
awaiting `flushBroadcasts()` in the Lambda handler after Express responds, so
broadcasts complete before the freeze. This depends on the VPC removal in ADR 0002:
an in-VPC Lambda had no egress to `execute-api`, so broadcasts couldn't be delivered
at all regardless of timing.

## Consequences

- Real-time works on the serverless target through a single CloudFront distribution;
  no separate WebSocket domain.
- Each mutating request carries a small **broadcast tail** (the handler awaits
  delivery before returning), bounded by the 3 s per-connection cap.
- `sys:log` broadcasts every server log line to every client, which is chatty and
  costs a DB read + `PostToConnection` per line. It is _safe_ (guarded) but a future
  optimization could filter by level or debounce.
- The kiosk path is unaffected — it keeps in-process socket.io.
