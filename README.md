# Tronnium (minimal monorepo)

This workspace contains a minimal frontend and backend.

- frontend: Next.js + TypeScript
- backend: Express + TypeScript

Setup

1. From the repo root, install both packages:

```bash
cd backend
npm install

cd ../frontend
npm install
```

Run

- Backend (dev):

```bash
cd backend
npm run dev
```

- Frontend (dev):

```bash
cd frontend
npm run dev
```

API

- GET /health -> { status: 'ok', uptime: number }

