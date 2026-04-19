# system-health

Simple HTTP health check endpoint.

## Purpose

Allows monitoring tools, load balancers, and clients to verify that the Node.js/Express server is up and running.

## Files

| File | Role |
|------|------|
| `health.routes.ts` | Express router with a single `GET /` health check route handler. |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Returns uptime and OK status |

## How it links together

```
routes/index.ts
  → mounts healthRouter at /health
```

## Key concepts

- **Liveness probe**: Only confirms the Node.js process is alive. Does not check external dependencies (database, Redis, etc.).
- **No authentication**: Intentionally public so monitoring systems can reach it without credentials.
- **Response shape**:
  ```json
  { "success": true, "data": { "isOk": "ok", "uptime": 12345.67 }, "message": "Health check successful" }
  ```
