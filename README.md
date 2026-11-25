# apps-trn: Campaigns & Leads

Practice project: an internal tool for a global sales and marketing team to run campaigns, collect leads and track campaign performance. NestJS API + React client + PostgreSQL, deployed to Azure.

| Folder | What | Stack |
|---|---|---|
| `server/` | REST API | NestJS 12 (ESM), TypeORM, PostgreSQL, Vitest |
| `client/` | Web UI | React 19, Vite, TypeScript |

## Run locally

Requirements: Node 22+, Docker Desktop.

```bash
# 1. Database
cp .env.example .env              # change DB_PORT if 5432 is taken on your machine
docker compose up -d
docker compose ps                 # db should be "healthy"

# 2. API (http://localhost:3000/api/health)
cd server
cp .env.example .env              # keep the port in DATABASE_URL equal to DB_PORT
npm install
npm run start:dev

# 3. Client (http://localhost:5173), in another terminal
cd client
npm install
npm run dev                       # proxies /api to http://localhost:3000
```

If `GET /api/health` returns `{"status":"ok","db":"up"}`, everything is wired up.

### Port 5432 already in use?

A local Postgres (Homebrew, Postgres.app) or another container may hold 5432. Check with `lsof -nP -iTCP:5432 -sTCP:LISTEN`, then either stop it or set `DB_PORT=55432` in `.env` and use the same port in `server/.env`.

## Scripts

| Where | Command | What it does |
|---|---|---|
| server | `npm run start:dev` | API with watch mode |
| server | `npm test` | Unit tests (Vitest) |
| server | `npm run lint` | oxlint (type-aware) |
| server | `npm run format` / `format:check` | Prettier write / check |
| server | `npm run build` | Compile to `dist/` |
| client | `npm run dev` | Vite dev server |
| client | `npm run lint` | ESLint |
| client | `npm run build` | Type-check and production build |

## Workflow

- Every change starts from a Jira ticket (project key `CL`).
- Branch from `dev`: `feature/CL-12-short-name`, `fix/CL-34-...`, `chore/CL-56-...`.
- Commits and PR titles start with the Jira key: `CL-12: add lead import endpoint`.
- Open a PR into `dev` using the template. CI (lint, tests, build) must be green and the PR reviewed before merge.
- Squash merge, then delete the branch. Releases go `dev` → `main` by PR.
- Never commit `.env` files or secrets. If a secret leaks, rotate it immediately.
