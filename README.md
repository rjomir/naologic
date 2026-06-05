# Naologic – Full Stack Technical Test

A full-stack monorepo: an interactive Angular 21 manufacturing timeline on the frontend, backed by an Express 5 REST API with a real PostgreSQL database and a shift-aware reflow scheduling algorithm.

| Project                   | Description                              | Stack                                     |
| ------------------------- | ---------------------------------------- | ----------------------------------------- |
| [`frontend/`](./frontend) | Interactive Work Order Schedule Timeline | Angular 21, TypeScript, SCSS, Playwright  |
| [`backend/`](./backend)   | Production Schedule Reflow Algorithm     | Express 5, Prisma 6, PostgreSQL 16, Luxon |

---

## Quick Start

### Option 1 – Docker (recommended, one command)

```bash
docker compose up --build
```

- **Frontend** → [http://localhost:4200](http://localhost:4200)
- **Backend API** → [http://localhost:3000/api](http://localhost:3000/api)
- **Swagger UI** → [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

The database is seeded automatically on first run. Source files in `frontend/src/` are volume-mounted for live reload without rebuilding the image.

### Option 2 – Local

**Prerequisites:** Node.js 20+, pnpm 10+, PostgreSQL 16

```bash
# 1. Install all workspace dependencies
pnpm install

# 2. Set your DATABASE_URL in backend/.env (copy from backend/.env.example)

# 3. Push schema and seed the database
pnpm --filter production-reflow exec prisma migrate deploy
pnpm --filter production-reflow exec prisma db seed

# 4. Start the frontend dev server  (http://localhost:4200)
pnpm dev

# 5. In a second terminal – start the backend  (http://localhost:3000)
pnpm be
```

---

## Project Structure

```
naologic/
├── frontend/                        # Angular 21 timeline SPA
│   ├── src/app/
│   │   ├── models/types.ts          # Shared interfaces + SSE event types
│   │   ├── tokens/api-url.token.ts  # API_URL injection token
│   │   ├── interceptors/            # Centralised HTTP error normalisation
│   │   ├── services/                # Signal-based state facade, HTTP layer, SSE
│   │   └── timeline/
│   │       ├── timeline.component.* # Main container, date↔pixel math, zoom, scroll
│   │       ├── utils/               # compute-notches, viewport, activity-size
│   │       ├── work-order-bar/      # Bar + three-dot dropdown menu
│   │       └── work-order-panel/
│   │           ├── work-order-panel.component.*  # Create/Edit slide-out panel
│   │           └── datetime-picker.component.*   # ControlValueAccessor date+time picker
│   ├── e2e/                         # Playwright E2E test suite
│   └── Dockerfile
│
├── backend/                         # TypeScript reflow algorithm + REST API
│   ├── src/
│   │   ├── reflow/                  # Scheduling algorithm + Vitest tests (12)
│   │   ├── utils/date-utils.ts      # Shift-aware date helpers (Luxon)
│   │   ├── sse/                     # SSE client registry + broadcast
│   │   ├── middleware/              # helmet, express-rate-limit
│   │   └── openapi/                 # Zod-to-OpenAPI spec builder
│   ├── prisma/
│   │   ├── schema.prisma            # DB schema
│   │   └── seed.ts                  # Demo data with full dependency chains
│   └── Dockerfile
│
├── .husky/                          # Git hooks (pre-commit, commit-msg)
├── .commitlintrc.json               # Conventional Commits config
├── .prettierrc.json                 # Shared Prettier config
├── docker-compose.yml               # Orchestrates FE + BE + PostgreSQL
└── pnpm-workspace.yaml              # pnpm monorepo config
```

---

## Scripts

All root scripts delegate to the relevant workspace.

| Command             | Description                                       |
| ------------------- | ------------------------------------------------- |
| `pnpm dev`          | Start Angular frontend dev server on :4200        |
| `pnpm be`           | Start Express REST API on :3000                   |
| `pnpm be:test`      | Run backend Vitest suite (12 tests)               |
| `pnpm test:e2e`     | Run Playwright E2E tests (auto-starts dev server) |
| `pnpm lint`         | ESLint across both projects                       |
| `pnpm lint:fix`     | ESLint with auto-fix                              |
| `pnpm format`       | Prettier format all files                         |
| `pnpm format:check` | Check formatting without writing                  |

Or via `make`:

```bash
make dev          # frontend only
make be           # backend only
make lint         # both
make docker       # docker compose up --build
make docker-down  # stop containers
```

---

## Frontend Features

- **Timeline grid** – Day / Week / Month zoom with a sticky left column and horizontally scrollable date grid; infinite scroll expands past/future on demand
- **Work order bars** – positioned by date, colour-coded by status (Open / In Progress / Complete / Blocked); graceful size degradation at narrow widths
- **Three-dot actions menu** – Edit and Delete per work order bar
- **Create panel** – click any empty timeline area; start date pre-filled from the click position
- **Edit panel** – same slide-out panel reused in edit mode; form pre-populated with existing data
- **Date + time picker** – a single readonly input that opens an `ngb-datepicker` + hour/minute selects inside an `NgbPopover` (`DatetimePickerComponent`)
- **Overlap detection** – client-side guard blocks save if dates conflict on the same work center
- **Today indicator** – vertical blue line; "Today" button re-centres the viewport
- **Real-time sync** – Server-Sent Events stream; timeline updates live across browser tabs
- **Run Reflow** – one-click button triggers the backend algorithm; result shown in a dismissible banner

---

## Backend Features

- **REST API** – Express 5 + Prisma 6 + PostgreSQL 16; full CRUD for work centers and work orders
- **Reflow algorithm** – Kahn's topological sort → shift-aware scheduling → dependency + constraint validation
- **Shift schedules** – Mon–Fri 08:00–17:00; algorithm skips nights/weekends
- **Maintenance windows** – fixed blocks that reflow works around
- **SSE broadcast** – every mutation emits an event; connected frontends stay in sync
- **Swagger UI** – live interactive API docs at `/api/docs`
- **Rate limiting** – 100 req/min general; 10 req/min on the reflow endpoint

---

## API Overview

| Method | Path                      | Description           |
| ------ | ------------------------- | --------------------- |
| GET    | `/api/work-centers`       | List all work centers |
| GET    | `/api/work-orders`        | List all work orders  |
| POST   | `/api/work-orders`        | Create work order     |
| PUT    | `/api/work-orders/:docId` | Update work order     |
| DELETE | `/api/work-orders/:docId` | Delete work order     |
| POST   | `/api/reflow`             | Run reflow algorithm  |
| GET    | `/api/events`             | SSE stream            |
| GET    | `/api/health`             | Health check          |
| GET    | `/api/docs`               | Swagger UI            |

---

## Code Quality

### Linting

- **Frontend** – Angular ESLint + TypeScript ESLint. Run: `pnpm --filter timeline-frontend lint`
- **Backend** – TypeScript ESLint (flat config). Run: `pnpm --filter production-reflow lint`

### Formatting

Prettier with shared config (`.prettierrc.json`). Angular HTML files use the `angular` parser.

### Testing

- **Backend unit tests** – Vitest: `pnpm be:test`
- **Frontend E2E** – Playwright (auto-starts `ng serve`): `pnpm test:e2e`

### Git Hooks

| Hook         | Action                                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | 1. `lint-staged` (Prettier) · 2. `ng lint` · 3. `eslint src` (BE) · 4–5. `tsc --noEmit` on both workspaces · 6. `knip` (dead-code audit) |
| `commit-msg` | `commitlint` – enforces Conventional Commits format                                                                                      |

### Commit Convention

```
<type>(<scope>): <subject>

Types: feat | fix | docs | style | refactor | test | chore | ci | perf | revert | build
```

---

## Further Reading

- [Frontend README](./frontend/README.md) – component architecture, date positioning math, E2E tests
- [Backend README](./backend/README.md) – algorithm design, constraint order, scenario descriptions, full API table
