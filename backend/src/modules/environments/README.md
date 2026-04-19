# environments

Core domain module for managing security environments.

## Purpose

An "environment" is a top-level container that groups assets and their vulnerability scans. Provides:
- CRUD operations for environments
- Ownership-based access control
- AI-powered security briefing generation (holistic threat analysis via Gemini)

## Files

| File | Role |
|------|------|
| `environment.service.ts` | Data access layer. `EnvironmentService` class with Prisma CRUD for the `Environment` model. |
| `environment-helpers.ts` | Cross-module authorization utility: `verifyEnvironment(userId, environmentId)`. |
| `environment.controller.ts` | HTTP handlers for the five environment endpoints. |
| `environment.routes.ts` | Express router. Applies `jwtAuthGuard` to all routes. |
| `environment-briefing.service.ts` | AI/LLM service that generates a strategic security briefing for an entire environment. |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create environment |
| `GET` | `/` | List all environments (with asset counts) |
| `GET` | `/:id` | Get single environment |
| `PUT` | `/:id` | Update environment |
| `DELETE` | `/:id` | Delete environment |

## How it links together

```
environment.routes.ts
  → jwtAuthGuard() → environment.controller.ts
      → environment.service.ts
          → prisma (Environment model)
      → environment-briefing.service.ts (for AI briefing)
```

`environment-helpers.ts` is **not** used internally by the environment controller or service (those enforce ownership via `findByIdAndOwner`). The helper is exported for **external** modules.

## Key concepts

### Environment ownership model

Every environment has a mandatory `ownerId` (foreign key to `UserAccount`). All reads, updates, and deletes are scoped to the authenticated user. No shared environments or teams.

### `verifyEnvironment(userId, environmentId)`

Returns `true` if an environment with that ID exists and is owned by the user. Used as a guard by **6+ other modules** before performing environment-scoped operations:
- `ai-security`
- `asset-relationships`
- `assets`
- `developer-tools`
- `vulnerability-scans`
- `vulnerability-workflows`

### Labels

Environments carry a `labels: string[]` array for free-form tagging (e.g. `"production"`, `"OT-network"`). Defaults to `[]`.

### Asset count aggregation

`findAllByOwnerWithAssetCount` uses Prisma's `_count: { select: { assets: true } }` to compute asset counts in a single query.

### AI briefing: token budgeting

The briefing service avoids token explosion:
- CRITICAL descriptions: 150 chars
- HIGH descriptions: 80 chars
- MEDIUM/LOW: collapsed to count lines

### Systemic risk detection

A CVE appearing on ≥2 assets is flagged as a "systemic risk" in the briefing matrix. This cross-asset pattern detection is done locally before sending data to the LLM.
