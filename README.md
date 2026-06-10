# DIET Platform Monorepo

A three-part production system for admin operations, AI personalization, and authenticated teacher/admin workflows. The repo is organized as a monorepo with a Python AI service, a TypeScript backend API, and a React/Vite dashboard frontend.

## What lives here

| Package | Stack | Purpose |
|---|---|---|
| `packages/ai-personalization` | Python + Supabase + RAGFlow | Public auth, public chat, lesson planning, retrieval, token utilities, middleware, and AI service orchestration. |
| `packages/backend-api` | Node.js + Express + TypeScript | Main secure API, JWT auth, admin routes, dashboard routes, Supabase access, and proxying to the AI service at `/api/public`. |
| `packages/frontend-dashboard` | React + Vite + TypeScript | Admin dashboard UI, auth context, API client, pages, and shared components for teachers, issues, modules, feedback, and admin management. |

## Architecture

The frontend talks only to the backend API, and the backend API proxies AI traffic to `AI_SERVICE_URL`, which defaults to `http://localhost:5001` in the codebase. The backend enforces JWT auth for protected routes, while the AI service handles its own public auth and chat paths, which keeps responsibilities clean and avoids direct browser access to the Python service.

## Run the whole stack

The intended local startup flow is from the repository root:

```bash
docker compose up --build
```

That should bring up the frontend, backend API, and AI service together if your root `docker-compose.yml` wires the three packages correctly. Once the stack is healthy, open the URL exposed by your compose setup; the backend should keep routing to the AI service over the internal Docker network using the service name instead of `localhost`.

## Run package by package

### AI personalization service

```bash
cd packages/ai-personalization
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cd src
python app.py
```

This service should listen on port `5001` so the backend proxy configuration remains compatible with the current defaults.

### Backend API

```bash
cd packages/backend-api
npm install
npm run dev
```

For production builds:

```bash
npm run build
npm start
```

The backend is already set up to run from compiled `dist/index.js` in production and exposes health, dashboard, and admin routes, plus the `/api/public` proxy to the AI service.

### Frontend dashboard

```bash
cd packages/frontend-dashboard
npm install
npm run dev
```

The dashboard uses Vite, React Router, local UI primitives, and a secured API client that reads the backend JWT from local storage and never talks directly to Supabase for app data.

## Production deployment

A clean Docker deployment usually looks like this:

- `frontend-dashboard` builds to static assets and is served behind Nginx in its container.
- `backend-api` runs Node/Express from compiled TypeScript.
- `ai-personalization` runs Python on `5001` behind the backend proxy.

In Compose, the backend should point `AI_SERVICE_URL` to `http://ai-personalization:5001`, not `http://localhost:5001`, because containers do not share the host loopback address. Keep secrets out of images and inject them through `.env` files or your deployment platform’s secret store.

### Suggested root compose shape

```yaml
services:
  frontend-dashboard:
    build:
      context: ./packages/frontend-dashboard
    ports:
      - "80:80"

  backend-api:
    build:
      context: ./packages/backend-api
    environment:
      AI_SERVICE_URL: http://ai-personalization:5001
      PORT: 3000

  ai-personalization:
    build:
      context: ./packages/ai-personalization
    environment:
      PORT: 5001
      HOST: 0.0.0.0
```

## Environment variables

### Backend API

| Variable | Purpose |
|---|---|
| `PORT` | Express port, typically `3000`. |
| `AI_SERVICE_URL` | Base URL for the AI service proxy, defaulting to `http://localhost:5001` locally. |
| `DB_URL` | Postgres connection string if used by `db.ts`. |
| `SUPABASE_URL` | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key for server-side access. |
| `JWT_SECRET` | JWT signing and verification secret. |
| `RAGFLOW_API_KEY` | RAGFlow API key if applicable. |

### AI personalization

| Variable | Purpose |
|---|---|
| `PORT` | Service port, recommended `5001`. |
| `HOST` | Bind host, usually `0.0.0.0` in Docker. |
| `SUPABASE_URL` | Supabase URL for backend access. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase key. |
| `JWT_SECRET` | Shared signing or verification secret. |
| `RAGFLOW_BASE_URL` | Base URL for RAGFlow or Flask gateway. |
| `RAGFLOW_API_KEY` | RAGFlow key if required by your setup. |

### Frontend dashboard

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend API base URL. |
| `VITE_SUPABASE_URL` | Supabase URL used by the frontend client config. |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key for browser-safe client config. |

## Frontend auth flow

The dashboard no longer relies on the old Elevate localStorage flow; its `AuthContext` now expects the backend JWT-based login model and keeps the rest of the app wrapped in that auth context. Login is handled through a dedicated `LoginPage`, while the top bar and route guards use the new auth state rather than Elevate profile reads.

## Backend auth flow

The backend’s admin login path validates email and password, checks the `admins` table, issues a JWT, and protects the rest of the admin APIs with `requireAuth`. Role checks are enforced for admin and super-admin actions, and teacher/module mutations are guarded accordingly.

## AI service flow

The Python service owns AI-facing routes like public auth and public chat, plus helper modules for RAGFlow, resource lookup, and lesson planning. It is designed to be consumed by the backend API rather than by the browser directly, which is why the proxy boundary matters for deployment.

## Data model notes

The dashboard and backend are aligned with a Supabase schema that includes `admins`, `teachers`, `issues`, `training_modules`, `training_feedback`, `lesson_plans`, `resource_source_routing`, and the API-client/session tables you shared earlier. The admin table already supports active/inactive users, role-based permissions, and last-login tracking, which fits the JWT login flow cleanly.

## Docker checklist

- Keep `backend-api` and `ai-personalization` on internal Docker networking.
- Expose only the frontend and backend ports that must be reachable externally.
- Mount persistent volumes for `chroma_db` and uploaded assets in the AI service.
- Add a health endpoint to each service so Compose can check readiness.
- Use production builds in Docker, not dev servers, for release images.
- Set `AI_SERVICE_URL` to the Compose service name in container-to-container traffic.

## Dev workflow

1. Start the entire stack with `docker compose up --build` from the repo root.
2. For frontend-only UI work, run the Vite app in `packages/frontend-dashboard`.
3. For backend route changes, run the Express API in `packages/backend-api`.
4. For retrieval/chat or AI orchestration changes, run `python app.py` in `packages/ai-personalization/src`.

## Troubleshooting

- If the dashboard logs in but data requests fail, confirm the backend JWT header is being attached by the frontend API client.
- If the backend can’t reach the AI service in Docker, replace `localhost` with the AI container name in `AI_SERVICE_URL`.
- If the AI service boots locally but not in Docker, confirm it binds to `0.0.0.0` and that port `5001` is exposed.
- If Supabase calls fail, verify the service-role key is present in backend and AI service environment files.

## Repository hygiene

Recommended add-ons if they are not already present:

- `.env.example` files in each package.
- `.dockerignore` files per package.
- A root `docker-compose.yml`.
- A short `Makefile` or task runner for `up`, `down`, `logs`, and `build`.
- A `/health` endpoint in all three services.

## Quick start

```bash
# whole stack
cd <repo-root>
docker compose up --build

# backend
cd packages/backend-api
npm run dev

# frontend
cd packages/frontend-dashboard
npm run dev

# ai service
cd packages/ai-personalization
cd src
python app.py
```