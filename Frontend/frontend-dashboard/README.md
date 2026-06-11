# GuruSikshan — Admin Dashboard

Admin dashboard for the GuruSikshan platform. Handles teacher management, training modules, feedback tracking, issue reporting, and admin operations.

Built with React, Vite, TypeScript, and Tailwind CSS. Talks exclusively to the `backend-api` service.

---

## Docker

```bash
docker compose up --build
```

---

## Tech Stack

| Layer | Library / Tool |
|---|---|
| Framework | React 18 + Vite |
| Language | TypeScript |
| Styling | Tailwind CSS + Shadcn UI |
| Routing | React Router DOM v6 |
| Data Fetching | TanStack Query v5 |
| Auth | Supabase + JWT (via backend) |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Tests | Vitest + Testing Library |

---

## Pages

- `/` — Login
- `/dashboard` — Stats overview
- `/teachers` — Teacher management
- `/upload-modules` — Upload and manage training modules
- `/issues` — Issue tracker
- `/feedback` — Feedback viewer
- `/admin` — Admin management

---

## Getting Started

### Prerequisites

- Node.js 20+
- `backend-api` running on port `3000`

---

## Run with Docker

This service is meant to run from the repository root with the shared compose file.

```bash
docker compose up --build
```

---

## Run Locally

### Install & run

```bash
npm install
npm run dev
```

App starts at `http://localhost:5173`.

---

## Environment Variables

Create a `.env` file in the root of this package:

```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> These are build-time variables. Prefix all with `VITE_`.

---

## Build

```bash
npm run build
```

Output goes to `dist/`. In production, the container serves this via Nginx.

---

## Project Structure
