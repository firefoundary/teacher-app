# GuruSikshan — Backend API

Node.js + Express backend for the GuruSikshan platform. Handles authentication, admin workflows, teacher and issue management, training modules, Supabase access, and proxying AI traffic to the Python AI Personalization service.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Runtime | Node.js |
| Framework | Express |
| Language | TypeScript |
| Database | Supabase / Postgres |
| Auth | JWT + bcrypt |
| File Uploads | Multer |
| AI Proxy | RAGFlow client + Python AI service |
| Containerization | Docker |

---

## What It Does

- Provides admin login and JWT-based auth.
- Manages teachers, admins, issues, and training modules.
- Stores and reads data through Supabase.
- Handles module uploads and RAGFlow-related operations.
- Enforces role-based access for admin and super admin routes.

---

## Project Structure

```text
Backend/
└── backend-api/
    ├── dist/
    ├── src/
    │   ├── admin-routes.ts
    │   ├── dashboard-routes.ts
    │   ├── db.ts
    │   ├── index.ts
    │   ├── ragflowclient.ts
    │   └── supabaseClient.ts
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    └── README.md
```

---

## How It Fits

```text
Frontend → Backend API → AI Personalization → Supabase / RAGFlow
```

This service is the main server layer for the platform. It uses the root `.env` file and is designed to run from the repository root using the shared `docker-compose.yml` setup.

---

## Environment Setup

The `.env` file lives at the **repository root**, not inside `Backend/backend-api`. That is intentional, because the full stack is meant to be started from the root with Docker Compose.

Example root `.env`:

```env
PORT=3000
JWT_SECRET=your_jwt_secret

SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

DB_URL=your_postgres_connection_string
AI_SERVICE_URL=http://ai-personalization:5001
RAGFLOW_API_KEY=your_ragflow_api_key
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Docker

---

## Run with Docker

This service is meant to run from the repository root with the shared compose file.

```bash
docker compose up --build
```

The backend should read the root `.env` automatically. Inside Docker, it should call the AI service using the Compose service name, not `localhost`.

---

## Run Locally

### Install dependencies

```bash
cd Backend/backend-api
npm install
```

### Run in development

```bash
npm run dev
```

### Build for production

```bash
npm run build
npm start
```

## API Areas

### Auth
- Admin login.
- JWT verification.
- Password change handling.

### Admin Management
- Create, update, delete admins.
- Role checks for super admin actions.

### Teachers
- List teachers.
- Create, update, and delete teachers.
- Prevent deleting teachers with unresolved issues.

### Issues
- List issues.
- Update issue status.
- Delete resolved issues only.
- Fetch issue stats.

### Modules
- List training modules.
- Create, update, and delete modules.
- Manage RAGFlow-linked module records.

### Logs
- Fetch admin activity logs.

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | Yes | Express server port, usually `3000` |
| `JWT_SECRET` | Yes | JWT signing and verification secret |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Server-side Supabase access key |
| `DB_URL` | If used | Postgres connection string |
| `AI_SERVICE_URL` | Yes | AI service base URL, usually `http://ai-personalization:5001` in Docker |
| `RAGFLOW_API_KEY` | If used | RAGFlow API key |

---

## Development Notes

- `src/index.ts` is the main entry point.
- `dist/` contains compiled output for production.
- Auth is role-based, with `admin` and `super_admin` access patterns.
- The backend is expected to proxy AI requests instead of exposing the Python service directly to browsers.
- Keep the root `.env` in sync with both backend and AI service requirements.

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Backend cannot reach AI service | Use `http://ai-personalization:5001` inside Docker, not `localhost` |
| JWT errors | Check `JWT_SECRET` in the root `.env` |
| Supabase errors | Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` |
| Compose startup issues | Make sure the root `.env` exists and the compose file is run from repo root |

---

## Quick Start

```bash
# from repo root
docker compose up --build

# or run backend only
cd Backend/backend-api
npm install
npm run dev
```