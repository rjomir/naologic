# Production Schedule Reflow – Backend

A TypeScript scheduling algorithm that reschedules manufacturing work orders when disruptions occur, respecting dependency chains, shift schedules, and maintenance windows. Exposed as an Express 5 REST API backed by Prisma + PostgreSQL.

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm start        # start Express REST API on :3000
pnpm cli          # run 3 reflow scenarios and print report to console
```

## Test

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
```

49 tests across 3 files covering: shift boundary spanning, maintenance window avoidance, dependency cascades, circular dependency detection, work center conflict resolution, setup time handling, delay metrics, utilization metrics, work order CRUD service logic.

## Algorithm Approach

1. **Topological sort (Kahn's algorithm)** – orders work orders by the dependency graph so every parent is always scheduled before its children. Independent nodes are sorted by original start date to preserve intent.

2. **Per-work-center occupancy tracking** – a `wcLastEnd` map records the latest scheduled end time for each work center. Each order's earliest start is `max(all parent end dates, wcLastEnd[workCenter])`.

3. **Shift-aware end date calculation** – `calculateEndDate(start, durationMinutes, shifts, maintenanceWindows)` consumes working minutes only during valid shift hours, skipping nights, weekends, and maintenance windows.

4. **Maintenance work orders are fixed** – orders with `isMaintenance: true` are skipped during reflow. Their time slots block other work orders from using those windows.

## Constraint Checking Order

```
Circular dependency detection → Topological sort → Dependency end dates
  → Work center occupancy → Shift boundaries → Maintenance windows
```

## Demo Seed Data

`prisma/seed.ts` builds a full manufacturing pipeline across 5 work centers:

```
Extrusion Line A  → wo-001 (complete), wo-002 (in-progress)
CNC Machine 1     → wo-003 (complete, depends on wo-001)
                    wo-004 (open,     depends on wo-002)
Assembly Station  → wo-005 (in-progress, depends on wo-003) ← intentionally stale
                    wo-006 (blocked,     depends on wo-004)
Quality Control   → wo-007 (open, depends on wo-005)
                    wo-008 (open, depends on wo-006 + wo-007)
Packaging Line    → wo-009 (open, depends on wo-008)
```

`wo-005` starts before `wo-003` finishes and overlaps the Assembly Station maintenance window — making the **Delay Cascade** and **Maintenance Avoidance** scenarios immediately demonstrable via "Run Reflow".

## Stack

- **TypeScript** with strict mode (`^6.0`, ESM modules)
- **Express 5** — REST API server on :3000
- **Prisma 6 + PostgreSQL 16** — persistence layer
- **Luxon** — all date manipulation (UTC throughout)
- **Zod + @asteasolutions/zod-to-openapi** — type-safe schema + OpenAPI 3.1 spec generation
- **helmet** — hardened HTTP response headers
- **express-rate-limit** — 100 req/min general, 10 req/min on the reflow endpoint
- **Vitest** — unit test runner
- **tsx** — runs TypeScript directly without a build step

## API

| Method | Path                      | Description                 |
| ------ | ------------------------- | --------------------------- |
| GET    | `/api/work-centers`       | List all work centers       |
| GET    | `/api/work-orders`        | List all work orders        |
| POST   | `/api/work-orders`        | Create work order           |
| PUT    | `/api/work-orders/:docId` | Update work order           |
| DELETE | `/api/work-orders/:docId` | Delete work order           |
| POST   | `/api/reflow`             | Run reflow algorithm        |
| GET    | `/api/events`             | SSE stream (real-time sync) |
| GET    | `/api/health`             | Health check                |
| GET    | `/api/docs`               | Swagger UI                  |
| GET    | `/api/docs.json`          | Raw OpenAPI 3.1 spec        |

## Key Design Decisions

- All dates stored and processed in **UTC** to avoid daylight-saving issues.
- `durationMinutes` is the authoritative duration source — `endDate` in input data may be stale; reflow always recalculates it from duration.
- The algorithm is **greedy** (schedule each order as early as valid). For minimising total delay this is near-optimal when processing in dependency order.
- SSE is used for real-time sync instead of WebSockets because it requires no extra protocol negotiation and is natively supported by all modern browsers.
- OpenAPI spec is built from Zod schemas at startup so the API contract and runtime validation are always in sync.
