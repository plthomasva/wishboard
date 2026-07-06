# ADR 0002: Serverless database architecture (SQLite-on-EFS vs. managed libSQL)

- **Status:** Proposed (deciding)
- **Date:** 2026-07

## Context

Wishboard runs in two topologies from one codebase, unified behind the `@libsql/client` API:

- **Single-node kiosk** (Raspberry Pi / Docker): one Express process, an embedded SQLite file on local disk. This is correct and not in question.
- **AWS serverless**: `ApiFunction` and `WebSocketFunction` Lambdas both mount the **same SQLite file over EFS** (`DATABASE_URL=file:/mnt/efs/wishboard.db`), with **no reserved concurrency**.

The serverless path relies on a single on-disk file shared by multiple, independently-scaling Lambda instances (separate hosts). Investigation found:

- Journal mode is **`delete` (rollback journal)**, not WAL — so this avoids the catastrophic case (WAL requires single-host shared memory and **corrupts** across hosts on a network filesystem). **WAL must never be enabled on the EFS deployment.**
- `busy_timeout` was **0** — overlapping writes failed immediately with `SQLITE_BUSY` rather than waiting.

**Net risk:** not data corruption, but **`SQLITE_BUSY` errors and EFS latency under write concurrency**. Current low traffic masks it — writes rarely overlap. This is a reliability-under-load gap, and it will surface as intermittent failures as volume grows.

An interim mitigation (`PRAGMA busy_timeout = 5000` + a WAL guard comment) ships alongside this ADR, but does not change the topology.

## Decision drivers

- **Cost is the primary constraint.** An always-on database server (RDS/Aurora provisioned) runs 24/7 and bills 24/7 — unacceptable for a low-traffic hobby/convention app. The target is **free-tier or scale-to-zero**.
- Low, bursty write volume; relational schema already on SQLite/libSQL.
- Minimal code change (the client already speaks both file and remote libSQL).
- Correctness under concurrent writers from multiple Lambdas.

## Options

### 1. Keep SQLite-on-EFS + hardening (status quo, hardened)

Add `busy_timeout`, optionally cap writers with `ReservedConcurrentExecutions: 1`.

- **Cost:** ~free — EFS has a free tier (a SQLite file is well under it), and there's **no DB compute to pay for**.
- **Pros:** no new vendor/service, no data leaves AWS, minimal change (mostly this PR).
- **Cons:** reserved concurrency serializes writers (latency/queueing) and caps throughput; EFS adds network-`fsync` latency to every op; SQLite-over-NFS is discouraged for concurrent access even in rollback mode; doesn't truly scale.

### 2. Managed libSQL (Turso) — remote singleton

Point serverless `DATABASE_URL` at a `libsql://…` Turso database; drop the EFS mount.

- **Cost:** Turso's free tier is generous and **usage-based / scale-to-zero** — no always-on charge at low volume.
- **Pros:** a real singleton that serializes writes correctly (no NFS locking, no `SQLITE_BUSY`-from-file-locks), removes EFS entirely, ~one-line change (already using the libSQL client), keeps the same SQL/schema.
- **Cons:** external vendor + network hop (Lambda ↔ Turso latency), data lives outside AWS, subject to free-tier limits/policy changes.

### 3. Always-on relational server (RDS / provisioned Aurora) — rejected

Correct concurrency, but **always-on cost** and operational overhead violate the primary driver. Aurora Serverless v2 scales but bills a non-zero minimum (ACUs) — not truly free at idle. Rejected.

_(Also considered and set aside: Cloudflare D1 — wrong ecosystem, we're on AWS/CloudFront; Neon/DynamoDB — a data-layer rewrite.)_

## Leaning (not yet final)

- **Interim:** Option 1 hardening (shipped with this ADR) makes the current EFS setup safe at today's volume.
- **Target:** **Option 2 (Turso free tier)** is the architecturally correct answer for multiple Lambdas and stays cost-free at low volume — pending validation that the free tier fits our usage and that Lambda↔Turso latency is acceptable.

## Open questions before accepting

- [ ] Confirm Turso free-tier limits (rows read/written, storage, DB count) comfortably exceed projected usage.
- [ ] Measure Lambda↔Turso latency vs. current EFS latency.
- [ ] Confirm `busy_timeout` actually persists on the libSQL file connection under load (interim mitigation validity).
- [ ] If staying on EFS for now, decide whether `ReservedConcurrentExecutions: 1` is worth the latency tradeoff at current volume.

## Consequences

- Until this is accepted and acted on, serverless remains SQLite-on-EFS with the `busy_timeout` mitigation — adequate at low volume, not at scale.
- Whatever is chosen, the **kiosk stays embedded file-SQLite**, and **WAL is never enabled on EFS**.
