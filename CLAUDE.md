# Naologic – Claude Code Context

## What this is

Full-stack monorepo: Angular 21 work-order timeline (FE) + TypeScript reflow scheduling algorithm (BE).

```
frontend/   → Angular 21 SPA (ng serve :4200)
backend/    → Express REST API + Prisma + PostgreSQL (:3000)
```

## Running the project

```bash
pnpm install          # install all workspaces
pnpm dev              # frontend dev server
pnpm be               # backend (tsx src/server.ts)
pnpm be:test          # vitest suite (12 tests)
docker compose up --build   # full stack via Docker
```

## Package manager

Always use **pnpm**. Never npm or yarn.

```bash
pnpm --filter timeline-frontend <cmd>     # frontend workspace
pnpm --filter production-reflow <cmd>     # backend workspace
pnpm -r run lint                          # both
```

## Commit rules

- Conventional Commits format: `type(scope): subject`
- **Subject line only** — no body, no trailers, no attribution
- commitlint enforces this on every commit via Husky

```bash
git commit -m "feat(timeline): add month zoom level"
git commit -m "fix(reflow): handle circular dependency"
```

## Pre-commit hook

`.husky/pre-commit` runs three things in order:

1. `lint-staged` — Prettier auto-formats staged files
2. `ng lint` — Angular ESLint on all frontend files (blocks on error)
3. `eslint src` — TypeScript ESLint on all backend files (blocks on error)

Code must pass lint before a commit lands.

## Frontend architecture

- **Angular 21** standalone components, `ChangeDetectionStrategy.OnPush`
- State via Angular **signals** (`signal()`, `computed()`)
- `WorkOrderService` — fetches from backend API, exposes `workCenters`, `workOrders`, `loading`, `apiError` signals
- API base URL hardcoded to `http://localhost:3000/api` in `work-order.service.ts`
- Timeline utilities in `frontend/src/app/timeline/utils/`:
  - `compute-notches.ts` — adaptive ruler notch selection
  - `viewport.utils.ts` — anchor zoom + clamped px↔ms conversion
  - `activity-size.model.ts` — bar size classification (hidden/xs/sm/md)
- Design prompts saved in `frontend/prompts/`

## Backend architecture

- **Express 5** + **Prisma** + **PostgreSQL**
- Reflow algorithm: topological sort → shift-aware scheduling → constraint validation
- `ReflowService.reflow()` takes `{workOrders, workCenters, manufacturingOrders}`, returns `{changes, explanation, updatedCount}`
- Swagger UI at `/api/docs`, raw spec at `/api/docs.json`
- Tests: `backend/src/reflow/reflow.service.test.ts` (Vitest)

## Key files

| File                                              | Purpose                          |
| ------------------------------------------------- | -------------------------------- |
| `frontend/src/app/services/work-order.service.ts` | API integration, all signals     |
| `frontend/src/app/timeline/timeline.component.ts` | Main timeline orchestration      |
| `frontend/src/app/timeline/utils/*.ts`            | Pure math utilities              |
| `backend/src/reflow/reflow.service.ts`            | Scheduling algorithm             |
| `backend/src/utils/date-utils.ts`                 | Shift-aware date helpers (Luxon) |
| `backend/src/swagger.ts`                          | Full OpenAPI spec                |
| `backend/prisma/schema.prisma`                    | DB schema                        |

## ESLint configs

- Frontend: `frontend/eslint.config.js` (CJS, Angular ESLint + TS ESLint)
- Backend: `backend/eslint.config.js` (ESM, TS ESLint)
- Run from root via `pnpm --filter <name> run lint` — do NOT invoke `eslint` directly from root

## TypeScript

- Frontend: `~5.9`, strict mode via Angular defaults
- Backend: `^6.0`, `"type": "module"` (ESM), `tsx` for runtime

## What to avoid

- Never use `npm` or `yarn` — pnpm only
- Never add `Co-Authored-By` or any attribution trailers to commits
- Never write long commit bodies — subject line only
- Do not run `eslint` from the repo root; run via `pnpm --filter`
- Do not commit the spec `.md` files (`BE-technical-test.md`, `FE-technical-test*.md`)
