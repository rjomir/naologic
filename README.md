# Naologic – Full Stack Technical Test

A full-stack monorepo containing two independent projects built for the Naologic technical assessment:

| Project                   | Description                              | Stack                        |
| ------------------------- | ---------------------------------------- | ---------------------------- |
| [`frontend/`](./frontend) | Interactive Work Order Schedule Timeline | Angular 21, TypeScript, SCSS |
| [`backend/`](./backend)   | Production Schedule Reflow Algorithm     | Node.js, TypeScript, Luxon   |

---

## Quick Start

### Option 1 – Docker (recommended, one command)

```bash
docker compose up --build
```

- **Frontend** → [http://localhost:4200](http://localhost:4200)
- **Backend API** → [http://localhost:3000](http://localhost:3000) (Express REST + PostgreSQL)

### Option 2 – Local

**Prerequisites:** Node.js 20+, pnpm 10+

```bash
# Install all dependencies (root + both projects)
pnpm install

# Run frontend dev server
pnpm dev

# Run backend scenarios
pnpm be

# Run backend tests
pnpm be:test
```

---

## Project Structure

```
naologic/
├── frontend/                   # Angular 21 timeline SPA
│   ├── src/app/
│   │   ├── models/types.ts     # Shared interfaces
│   │   ├── data/               # Sample work centers & work orders
│   │   ├── services/           # Signal-based data service + overlap detection
│   │   └── timeline/           # Timeline, bar, and panel components
│   └── Dockerfile
│
├── backend/                    # TypeScript reflow algorithm
│   ├── src/
│   │   ├── types.ts            # All TypeScript interfaces
│   │   ├── utils/date-utils.ts # Shift-aware date calculations (Luxon)
│   │   ├── reflow/             # Main algorithm, constraint checker, tests
│   │   └── data/               # 3 reflow scenarios
│   └── Dockerfile
│
├── .husky/                     # Git hooks (pre-commit, commit-msg)
├── .commitlintrc.json          # Conventional commits config
├── .prettierrc.json            # Shared Prettier config
├── docker-compose.yml          # Orchestrates both services
├── Makefile                    # Short-hand commands
└── pnpm-workspace.yaml         # pnpm monorepo config
```

---

## Scripts

All root scripts delegate to the relevant workspace project(s).

| Command             | Description                                |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | Start Angular frontend dev server on :4200 |
| `pnpm be`           | Start Express REST API server on :3000     |
| `pnpm be:test`      | Run backend test suite (12 tests)          |
| `pnpm lint`         | ESLint across both projects                |
| `pnpm lint:fix`     | ESLint with auto-fix                       |
| `pnpm format`       | Prettier format all files                  |
| `pnpm format:check` | Check formatting without writing           |

Or via `make`:

```bash
make dev          # frontend only
make be           # backend only
make lint         # both
make docker       # docker compose up --build
make docker-down  # stop containers
```

---

## Code Quality

### Linting

- **Frontend** – Angular ESLint (`@angular-eslint`) + TypeScript ESLint. Run: `pnpm --filter timeline-frontend lint`
- **Backend** – TypeScript ESLint (flat config). Run: `pnpm --filter production-reflow lint`

### Formatting

Prettier with shared config (`.prettierrc.json`). Angular HTML files use the `angular` parser.

### Git Hooks

| Hook         | Action                                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pre-commit` | 1. `lint-staged` — Prettier on staged files · 2. `ng lint` — Angular ESLint · 3. `eslint src` — backend ESLint · 4–5. `tsc --noEmit` on both workspaces · 6. `knip` — dead-code audit |
| `commit-msg` | Runs `commitlint` — enforces Conventional Commits format                                                                                                                              |

### Commit Convention

```
<type>(<optional scope>): <subject>

Types: feat | fix | docs | style | refactor | test | chore | ci | perf | revert | build
```

Examples:

```bash
git commit -m "feat(timeline): add month zoom level"
git commit -m "fix(reflow): handle circular dependency detection"
git commit -m "chore: update pnpm lockfile"
```

---

## Development Workflow

```bash
# 1. Install deps
pnpm install

# 2. Start frontend (opens http://localhost:4200)
pnpm dev

# 3. In a second terminal, run backend to see algorithm output
pnpm be

# 4. Run backend tests
pnpm be:test

# 5. Before committing, lint and format
pnpm lint
pnpm format
```

Git hooks will run automatically on `git commit` — Prettier formats staged files, and commitlint validates the message format.

---

## Docker Details

```yaml
# docker-compose.yml
services:
  frontend: # ng serve --host 0.0.0.0 --poll 500
    ports:
      - '4200:4200'
    volumes:
      - ./frontend/src:/app/src # live reload

  backend: # pnpm start (Express REST API, persistent)
    ports:
      - '3000:3000'
```

Source code is volume-mounted so changes to `frontend/src/` hot-reload inside the container without rebuilding the image.

---

## Further Reading

- [Frontend README](./frontend/README.md) — component architecture, date positioning math, Angular details
- [Backend README](./backend/README.md) — algorithm design, constraint order, scenario descriptions
