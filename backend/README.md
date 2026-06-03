# Production Schedule Reflow – Backend

A TypeScript algorithm that reschedules manufacturing work orders when disruptions occur, respecting dependencies, shift schedules, and maintenance windows.

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

12 tests covering: shift boundary spanning, maintenance window avoidance, dependency cascades, circular dependency detection, work center conflict resolution.

## Algorithm Approach

1. **Topological sort (Kahn's algorithm)** – orders work orders by dependency graph so parents are always scheduled before children. Independent nodes are sorted by original start date.

2. **Per-work-center occupancy tracking** – a `wcLastEnd` map records the last scheduled end time per work center. Each order's earliest start = `max(all parent end dates, wcLastEnd)`.

3. **Shift-aware end date calculation** – `calculateEndDate(start, durationMinutes, shifts, maintenanceWindows)` consumes `durationMinutes` of working time, pausing at shift boundaries and maintenance windows and resuming at the next valid moment.

4. **Maintenance work orders are fixed** – `isMaintenance: true` orders are skipped during reflow. Maintenance windows in the work center's data block regular work orders from using those time slots.

## Constraint Checking Order

```
Dependencies → Work Center Conflicts → Shift Boundaries → Maintenance Windows
```

## Data

Three demonstration scenarios in `src/data/`:

| Scenario       | Description                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| `scenario1.ts` | **Delay cascade** – WO-001 starts late, cascades through WO-002/WO-003 across a shift boundary             |
| `scenario2.ts` | **Shift + maintenance** – maintenance order blocks work center; WO-B spans overnight                       |
| `scenario3.ts` | **Multi-constraint** – different shifts, unplanned breakdown, resource conflict between independent orders |

## Stack

- **TypeScript** with strict mode (`^6.0`, ESM)
- **Express 5** — REST API server on :3000
- **Prisma 6 + PostgreSQL 16** — persistence layer
- **Luxon** for all date manipulation (UTC throughout)
- **helmet** — hardened HTTP response headers
- **express-rate-limit** — 100 req/min general, 10 req/min reflow
- **Vitest** for tests
- **tsx** for running TypeScript directly

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
| GET    | `/api/docs.json`          | Raw OpenAPI spec            |

## Key Design Decisions

- All dates stored and processed in **UTC** to avoid daylight saving issues.
- `durationMinutes` is the authoritative duration source — `endDate` in input data may be stale; reflow always recalculates it.
- The algorithm is **greedy** (schedule each order as early as possible). For minimizing total delay this is near-optimal when processing in dependency order.
