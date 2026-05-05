# reporting

Generates a unified Dashboard Overview for a given environment.

## Purpose

Aggregates and summarizes security data from vulnerability scans and vulnerability workflows to give users a high-level operational picture: severity breakdowns, SLA compliance, assignment gaps, recent scan history, and asset-level risk mapping.

## Files

| File | Role |
|------|------|
| `dashboard.controller.ts` | HTTP handler for the dashboard endpoint. Validates ownership, calls service layer. |
| `dashboard.routes.ts` | Express router. Mounts `GET /:environmentId/overview`. Applies `jwtAuthGuard`. |
| `dashboard.service.ts` | Core business logic / data aggregation. Fetches latest scan, workflows, and recent scan history in parallel. Computes severity counts, SLA status, assignment gaps, and per-asset risk. |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/:environmentId/overview` | Full dashboard data for an environment |

## How it links together

```
dashboard.routes.ts
  → jwtAuthGuard() → dashboard.controller.ts
      → dashboard.service.ts
          → prisma (securityScan, vulnerabilityWorkflow, environment)
```

## Key concepts

### SLA tracking

```ts
const SLA_DAYS = { CRITICAL: 7, HIGH: 14, MEDIUM: 30, LOW: 90 };
```

- `overdue`: days open > SLA limit
- `at-risk`: days open > 80% of SLA limit
- `on-track`: otherwise

### Workflow-driven status

The module uses `VulnerabilityWorkflow` records (not just scan data) to determine current status:

```ts
const key = `${vulnerabilityId}-${assetId}-${cpeName}`;
const wf = workflowMap.get(key);
const status = wf?.status ?? VulnStatus.OPEN;
```

### Inactive statuses

Resolved/closed states (`RESOLVED`, `FALSE_POSITIVE`, `RISK_ACCEPTED`) are excluded from open counts, severity totals, and overdue calculations.

### `whereNotMock` filtering

All scan queries exclude mock/demo data (`isMock: false`).

### Asset vulnerability map

For each asset in the latest scan, tracks:
- `count`: number of **active** vulnerabilities
- `highestSeverity`: the most severe active vulnerability on that asset

### Resolved this week

Counts any workflow with `resolvedAt >= (now - 7 days)`, regardless of previous status.
