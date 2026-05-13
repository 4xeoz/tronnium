

**`README.md`**
```markdown
# Tronnium

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

---

## Setup

### Step 1 — Get the files

You need two things:
- This repository (zip or git clone)
- The vector database image: `tronnium-vectors.tar` (shared separately via Google Drive)

Place `tronnium-vectors.tar` in the same folder as `docker-compose.yml`.

---

### Step 2 — Load the vector database image

```bash
docker load -i tronnium-vectors.tar
```

This only needs to be done once. It will take a few minutes.

---

### Step 3 — Configure environment variables

```bash
cp backend/.env.example .env
```

Open `.env` and fill in your values:

| Variable | Description |
|---|---|
| `JWT_SECRET` | Any long random string |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `DATABASE_URL` | Your Supabase PostgreSQL connection string |
| `DIRECT_URL` | Same as DATABASE_URL |
| `NVD_API_KEY` | Optional — NVD API key for vulnerability data |
| `GEMINI_API_KEY` | Optional — Gemini API key |

---

### Step 4 — Start the app

```bash
docker compose up --build
```

> First startup takes a few minutes while Docker builds the backend and frontend images.

---

### Step 5 — Open the app

Go to [http://localhost:3000](http://localhost:3000)

---

## Stopping the app

```bash
docker compose down
```

## Starting again (after first run)

```bash
docker compose up
```

No need for `--build` after the first run.
```