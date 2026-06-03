# Naologic – AI Agent Context

## Project overview

Full-stack monorepo: Angular 21 work-order schedule timeline (frontend) and a TypeScript production-schedule reflow algorithm with a REST API (backend).

```
frontend/   → Angular 21 SPA served on :4200
backend/    → Express 5 REST API on :3000, PostgreSQL via Prisma
```

## Setup

```bash
pnpm install                  # install all workspaces (uses pnpm, not npm)
pnpm dev                      # frontend dev server (ng serve)
pnpm be                       # backend server (tsx src/server.ts)
pnpm be:test                  # run backend test suite
docker compose up --build     # full stack with PostgreSQL
```

## Monorepo workspaces

| Workspace name      | Directory   | Filter flag                       |
| ------------------- | ----------- | --------------------------------- |
| `timeline-frontend` | `frontend/` | `pnpm --filter timeline-frontend` |
| `production-reflow` | `backend/`  | `pnpm --filter production-reflow` |

## Commit format

Conventional Commits — **subject line only**, no body, no trailers.

```
feat(timeline): add month zoom level
fix(reflow): handle circular dependency detection
chore: update lockfile
```

Types: `feat` `fix` `docs` `style` `refactor` `test` `chore` `ci` `perf`

## Code quality

Pre-commit hook (Husky) runs automatically on `git commit`:

1. Prettier on staged files (auto-fixes formatting)
2. `ng lint` — Angular ESLint across all frontend source
3. `eslint src` — TypeScript ESLint across all backend source
4. `tsc --noEmit` — TypeScript type check on frontend (blocks on error)
5. `tsc --noEmit` — TypeScript type check on backend (blocks on error)
6. `knip` — unused files, exports, and dependencies (blocks on error)

All six must pass. Run manually:

```bash
pnpm lint           # both workspaces
pnpm format:check   # check formatting
```

## Frontend key facts

- **Framework:** Angular 21, standalone components, OnPush change detection
- **State:** Angular signals — `signal()`, `computed()` — no NgRx
- **Forms:** Reactive Forms (`FormGroup`, `FormControl`, `Validators`)
- **UI libs:** `@ng-select/ng-select`, `@ng-bootstrap/ng-bootstrap` (datepicker)
- **Font:** Circular Std (loaded via `<link>` in `index.html`)
- **API:** Angular `HttpClient` via `WorkOrderApiService`; API base URL via `API_URL` injection token
- **Real-time:** `SseService` wraps `EventSource` for live work-order updates (create/update/delete/reflow events)
- **Error handling:** `ApiErrorInterceptor` normalises HTTP errors centrally
- **Validation:** `ScheduleValidatorService` — pure overlap-check logic, no HTTP
- **No Angular Router** — single-page app, one component tree
- **Styling:** SCSS with CSS custom properties for status colors

## Backend key facts

- **Runtime:** Node.js 20+, ESM (`"type": "module"`), `tsx` for execution
- **Framework:** Express 5
- **ORM:** Prisma 6 + PostgreSQL 16
- **Date handling:** Luxon (UTC throughout)
- **Security:** `helmet` (hardened HTTP headers) + `express-rate-limit` (100 req/min general, 10 req/min reflow)
- **Tests:** Vitest
- **Docs:** Swagger UI at `GET /api/docs`, OpenAPI JSON at `GET /api/docs.json`

## API endpoints

| Method | Path                      | Description                            |
| ------ | ------------------------- | -------------------------------------- |
| GET    | `/api/work-centers`       | List all work centers                  |
| GET    | `/api/work-orders`        | List all work orders                   |
| POST   | `/api/work-orders`        | Create work order                      |
| PUT    | `/api/work-orders/:docId` | Update work order                      |
| DELETE | `/api/work-orders/:docId` | Delete work order                      |
| POST   | `/api/reflow`             | Run reflow algorithm                   |
| GET    | `/api/health`             | Health check                           |
| GET    | `/api/events`             | SSE stream (real-time multi-user sync) |

## Important notes

- Use **pnpm** exclusively — not npm or yarn
- ESLint configs live inside `frontend/` and `backend/` — run via `pnpm --filter`, not directly from root
- Do not commit the spec files (`BE-technical-test.md`, `FE-technical-test*.md`)
