# developer-tools

Developer-only utilities for generating and managing mock vulnerability data.

## Purpose

Gated behind a `devMode` flag on the user's account. Uses Google Gemini to synthesize realistic CVEs, persists them as mock records (`isMock: true`), links them to assets via mock scans, and provides endpoints to list and clear synthetic data.

## Files

| File | Role |
|------|------|
| `dev.routes.ts` | Express router. Defines 4 endpoints under `/dev`. Applies `jwtAuthGuard`. |
| `dev.controller.ts` | 4 route handlers (generate, get, clear, stats). Validates input, enforces `devMode` gate, delegates to `mock-vulnerability.service`. |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/dev/generate-vulnerabilities` | Generate mock CVEs via Gemini |
| `GET` | `/dev/mock-vulnerabilities/:environmentId` | List mock vulnerabilities |
| `DELETE` | `/dev/mock-vulnerabilities/:environmentId` | Clear all mock data |
| `GET` | `/dev/mock-vulnerabilities/:environmentId/stats` | Mock severity stats |

## How it links together

```
dev.routes.ts
  → jwtAuthGuard() → dev.controller.ts
      → verifyEnvironment() (from ../environments)
      → generateMockVulnerabilities() (from ../vulnerability-scans/mock-vulnerability.service)
      → clearMockVulnerabilities() (from ../vulnerability-scans/mock-vulnerability.service)
      → getMockVulnerabilities() (from ../vulnerability-scans/mock-vulnerability.service)
      → prisma.vulnerability.groupBy() / count() (for stats)
```

## Key concepts

### Dev-mode gate

Every mutating handler checks `prisma.userAccount.findUnique({ where: { id: user.id } })` and rejects with `403 DEV_MODE_REQUIRED` if `devMode` is falsy. `GET` handlers only enforce environment ownership.

### Mock vulnerability lifecycle

1. **Generation**: Accepts `environmentId`, `prompt`, `count` (1–10), optional `targets`. Calls Gemini with a structured prompt. Each generated vulnerability gets a synthetic `CVE-DEV-<timestamp>-<random>` ID. Upserts to `prisma.vulnerability` with `isMock: true`. Creates a `SecurityScan` row marked `isMock: true`.
2. **Retrieval**: Returns all mock vulnerabilities linked to the environment.
3. **Clearing**: Deletes mock scans → cascading delete of `AssetVulnerability` → `AssetScan` → `SecurityScan`. Then deletes all `Vulnerability` rows with `isMock: true` globally.
4. **Stats**: Aggregates by severity using `prisma.vulnerability.groupBy`.
