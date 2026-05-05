# Backend Refactoring Tasks

> **Scope:** `backend/src/services`, `backend/src/controllers`, `backend/src/types`  
> **Goal:** Eliminate type/naming inconsistency, remove harmful micro-optimizations (partial selects & manual reshaping), and consolidate repeated logic into a single source of truth.

---

## 1. Problem Analysis

### 1.1 Types are scattered, not centralized

Only the CPE module has a dedicated `types/cpe.types.ts` file. Everything else is defined inline inside services:

| Type | Current location |
|------|------------------|
| `ScanProgress`, `ScanResult`, `ScanOptions` | `scan.service.ts` |
| `CreateEnvironmentInput`, `UpdateEnvironmentInput`, `PublicEnvironment` | `environment.service.ts` |
| `PublicUser` | `user.service.ts` |
| `WorkflowUpdateInput` | `vulnerabilityWorkflow.service.ts` |
| `DashboardOverviewData` | `dashboard.service.ts` |
| `GeneratedVulnerability`, `SelectedTarget` | `mockVulnerability.service.ts` |
| `CpeInput` | `asset.controller.ts` (line 324) |

This makes it hard to know where a type lives, and creates local one-off shapes that could be shared.

---

### 1.2 Naming conventions are inconsistent

**Input/update type names don't follow a single pattern:**

| Name | Pattern | Issue |
|------|---------|-------|
| `CreateEnvironmentInput` / `UpdateEnvironmentInput` | Verb + Noun + `Input` | okay |
| `WorkflowUpdateInput` | Noun + Verb + `Input` | **inverted word order** |
| `ScanOptions` | just `Options`, no verb | inconsistent with others |
| `SocAnalysisInput` | acronym, no verb | inconsistent |

**Output/public type names:**

| Name | Pattern |
|------|---------|
| `PublicUser`, `PublicEnvironment` | `Public` prefix |
| `CveExplanation`, `SocAnalysis`, `EnvironmentBriefing` | bare noun, no `Public` prefix |

**Request/response types:**

- `CpeFindRequest` / `CpeFindResponse` vs. `CpeValidateRequest` / `CpeValidateResponse` are consistent, but only because they're in the centralized CPE types file.

---

### 1.3 `type` vs. `interface` usage is random

- **CPE types** use `interface` consistently.
- **Service types** mostly use `type` aliases (`export type CreateEnvironmentInput = { ... }`).
- **Scan service** mixes both: `interface ScanProgress`, `interface ScanResult`, `export interface ScanOptions`.

There is no project-wide rule; it just depends on who wrote the file.

---

### 1.4 Repetition of nearly identical objects / logic

**Severity count objects are recreated in multiple places with different casing:**

- `scan.service.ts`: `{ CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }` (uppercase — matches Prisma enum)
- `mockVulnerability.service.ts`: `{ critical: ..., high: ..., medium: ..., low: ... }` (lowercase)
- `dashboard.service.ts`: `severityCounts: { critical: number; high: number; medium: number; low: number }` (lowercase)

**Severity ordering maps are duplicated with different names and values:**

| File | Constant | Values |
|------|----------|--------|
| `dashboard.service.ts` | `SEVERITY_ORDER` | `{ CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 }` |
| `asset.controller.ts` | `severityOrder` | `{ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 }` |
| `environmentBriefing.service.ts` | `SEVERITY_RANK` | `{ CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 }` |

**"Is resolved / should hide" logic is duplicated with *different* conditions:**

- `vulnerabilityWorkflow.service.ts` → `shouldHideVulnerability()`: checks only `RESOLVED` and `FALSE_POSITIVE`.
- `vulnerabilityWorkflow.service.ts` → `updateWorkflow()`: checks `RESOLVED || FALSE_POSITIVE || RISK_ACCEPTED`.
- `vulnerabilityWorkflow.service.ts` → `bulkUpdateWorkflows()`: same check again.
- `dashboard.service.ts`: `INACTIVE_STATUSES = new Set([RESOLVED, FALSE_POSITIVE, RISK_ACCEPTED])`.

> **Bug:** `shouldHideVulnerability` excludes `RISK_ACCEPTED`, but the dashboard treats it as inactive. That's a real inconsistency in business logic.

**"Is mock scan" filtering (`isMock: false`) is hardcoded inline in at least 6 places** instead of a shared helper:

- `scan.service.ts` (multiple spots)
- `scan.controller.ts`
- `dashboard.service.ts`
- etc.

---

### 1.5 Inconsistent API response shapes across controllers

- **`scan.controller.ts`** is very consistent: always `{ success: boolean, data: ... }` or `{ success: false, error: ... }`.
- **`asset.controller.ts`** is mostly consistent with `{ success: true, data: ... }`.
- **`environment.controller.ts`** is **not** consistent:
  - `createEnvironmentHandler` returns `environmentService.toPublic(environment)` directly (no `success` / `data` wrapper).
  - `getEnvironmentsHandler` returns `{ success: true, data: environments, message: ... }`.
  - `getEnvironmentByIdHandler` returns `{ success: true, data: ..., message: ... }`.
  - `updateEnvironmentHandler` returns just `environmentService.toPublic(updated)` (no wrapper).
  - Also has typos like `sucess: false` in a couple of places.

---

### 1.6 Prisma select shapes are repeated with slight variations

The `vulnerability` field selection is copy-pasted across files with different subsets:

| File | Fields selected |
|------|-----------------|
| `scan.service.ts` | `id, cveId, description, cvssScore, cvssVector, severity, publishedDate, lastModifiedDate` |
| `dashboard.service.ts` | `id, cveId, description, cvssScore, severity` (missing `cvssVector` & dates) |
| `asset.controller.ts` | `id, cveId, description, cvssScore, cvssVector, severity, publishedDate, lastModifiedDate` |
| `vulnerabilityWorkflow.service.ts` | `cveId, description, severity, cvssScore` (missing `id`, `cvssVector`, dates) |

There's no shared `PublicVulnerability` or `VulnerabilitySummary` type, so every query invents its own shape.

---

### 1.7 `CpeInput` in `asset.controller.ts` duplicates a related type but changes the naming

In `cpe.types.ts`:
```ts
interface ScoreBreakdown {
    vendorScore: number;
    productScore: number;
    versionScore: number;
    tokenOverlapScore: number;
}
```

In `asset.controller.ts` the local `CpeInput` uses:
```ts
breakdown: {
    vendor: number;
    product: number;
    version: number;
    tokenOverlap: number;
}
```

Same concept, different field names. That forces manual mapping when passing data between the CPE pipeline and asset creation.

---

### 1.8 Inconsistent nullability / optional patterns

- `PublicUser.avatarUrl?: string | null` (optional **and** nullable)
- `PublicEnvironment.assetCount?: number` (optional)
- `CpeFindResponse.parsed?` / `.candidates?` (optional fields)
- Some inputs use `| undefined` implicitly via `?`, others require explicit `| null` — no single convention.

---

### 1.9 Minor but notable: one type name has a typo

`fetchCvesFroCpe` in `nvdCve.ts` is exported and used in `scan.service.ts` — missing the `m` in "For". Not a data-type interface, but it shows the overall naming discipline in the backend.

---

## 2. Micro-Optimization via Partial Select — Detailed Analysis

There is a pattern of **micro-optimization through partial `select`s and manual reshaping** that saves almost nothing in practice but creates a lot of accidental complexity and type sprawl.

### 2.1 Scan service — three different shapes for the same `SecurityScan` entity

- **`getLatestScan()`** includes full nested data with a deep `select` tree for `asset` and `vulnerability`.
- **`getScanById()`** does the *exact same thing* but with a slightly different `vulnerability` select (adds `cvssVector` and `lastModifiedDate`, which `getLatestScan` omits).

So the same service returns two **almost identical but not interchangeable** vulnerability objects depending on which function you call. The omitted fields (`cvssVector`, `lastModifiedDate`) are just small strings/dates — the savings are negligible, but now any consumer has to know which shape it received.

**`getScanHistory()`** goes even further: it lists out 11 scalar fields in a giant `select` block:
```ts
select: {
  id: true,
  status: true,
  startedAt: true,
  completedAt: true,
  totalAssets: true,
  scannedAssets: true,
  vulnerabilitiesFound: true,
  criticalCount: true,
  highCount: true,
  mediumCount: true,
  lowCount: true,
  riskScore: true,
}
```
That's basically *all* scalar fields on `SecurityScan` anyway. The `select` doesn't exclude much, yet it forces the return type to be a custom partial object rather than just `SecurityScan`. Then `mapScanToResult()` (line 464) copies those same fields into `ScanResult` with renamed fields (`scanId` instead of `id`). All of this could have been avoided by returning the Prisma model directly.

---

### 2.2 VulnerabilityWorkflow service — manual flattening of a natural nested structure

In `getWorkflowsForEnvironment`, the code does an `include` with nested `select`s for `assignee`, `vulnerability`, and `asset`, then manually maps ~20 fields into a flat, denormalized object:

```ts
return workflows.map((w) => ({
  id: w.id,
  environmentId: w.environmentId,
  assetId: w.assetId,
  assetName: w.asset.name,
  assetType: w.asset.type,
  vulnerabilityId: w.vulnerabilityId,
  cveId: w.vulnerability.cveId,
  // ... 12 more lines
}));
```

This "flattening" doesn't optimize anything — it actually **increases** payload size slightly by duplicating IDs. But the real cost is that there is now **no single type** for "a workflow in the API." The same manual mapping is partially repeated in `vulnerabilityWorkflow.controller.ts` (`getOrCreateWorkflowHandler`, lines 214–238), where the controller does the exact same flattening by hand because `getOrCreateWorkflow` returns the raw Prisma shape.

If the API just returned the natural nested Prisma shape (`{ ...workflow, asset: { ... }, vulnerability: { ... } }`), you would have one type, zero mapping code, and the frontend would receive a predictable structure everywhere.

---

### 2.3 Relationship controller — repeated `fromAsset`/`toAsset` select blocks

Every relationship endpoint (`get`, `create`, `update`) repeats this exact include/select pattern:

```ts
include: {
  fromAsset: { select: { id: true, name: true, type: true } },
  toAsset:   { select: { id: true, name: true, type: true } },
}
```

The `Asset` model doesn't have many heavy fields — excluding things like `description`, `ipAddress`, or `domain` saves maybe a few hundred bytes per row. At this scale, that's irrelevant, but the repetition means:
- If you ever want `asset.domain` in the response, you have to edit it in **three** places.
- The Prisma return type is a custom partial instead of `Relationship & { fromAsset: Asset; toAsset: Asset }`.

A single `include: { fromAsset: true, toAsset: true }` would eliminate all three select blocks and give you a consistent, full type.

---

### 2.4 Dashboard service — ad-hoc date-to-string conversions and stripping

`dashboard.service.ts` manually reshapes `latestScan` and `recentScans`:

```ts
latestScan: latestScan
  ? {
      id: latestScan.id,
      completedAt: latestScan.completedAt?.toISOString() ?? "",
      riskScore: latestScan.riskScore,
      activeBreakdown: { open: latestOpen, inProgress: latestInProgress, resolved: latestResolved },
    }
  : null,
recentScans: recentScans.map((s) => ({
  id: s.id,
  startedAt: s.startedAt.toISOString(),
  completedAt: s.completedAt?.toISOString() ?? null,
  status: s.status,
})),
```

Again, the Prisma `SecurityScan` model could have been returned as-is. Date serialization is something you typically handle once at the JSON-response layer (e.g., a serializer middleware or a helper), not inline inside every service function. Instead, `dashboard.service.ts` invents its own `DashboardOverviewData` type with hand-rolled sub-shapes that don't match any other scan type in the backend.

---

### 2.5 Environment service — `toPublic` and `_count` remapping for marginal gain

`toPublic(env)` strips `ownerId` from the `Environment` model. `ownerId` is a single UUID string. The "optimization" of hiding it is negligible, yet it requires:
- A `PublicEnvironment` type
- A manual mapping function
- Two different return types (`Environment` vs `PublicEnvironment`) for the same entity

Similarly, `findAllByOwnerWithAssetCount` uses Prisma's `_count` feature (which is fine) but then manually remaps it:

```ts
return environments.map((env) => ({
  id: env.id,
  name: env.name,
  // ... 5 more identical fields ...
  assetCount: env._count.assets,
}));
```

All fields except `assetCount` are 1-to-1 copies. If the function just returned the Prisma result with `_count` attached, you could derive `assetCount` on the frontend or in a thin serializer without inventing a whole parallel type.

---

### 2.6 The real cost: type explosion and maintenance friction

Because every endpoint partially selects and manually maps, you end up with **dozens of slightly different types for the same entities**:

| Entity | Partial shapes found |
|--------|---------------------|
| `SecurityScan` | `ScanResult`, `DashboardOverviewData['latestScan']`, `DashboardOverviewData['recentScans']`, raw `select` return from `getScanHistory` |
| `VulnerabilityWorkflow` | `getWorkflowsForEnvironment` flat map, `getOrCreateWorkflowHandler` flat map, `updateWorkflow` nested include return |
| `Asset` | Full `Asset`, `fromAsset: { select: {id,name,type} }`, `asset: { select: {id,name,type,domain} }` |
| `Vulnerability` | At least 4 different `select` subsets across scan/dashboard/workflow services |

This means:
- **No single source of truth.** If you add a field to `Vulnerability` in Prisma, you have to hunt through 4+ files to decide whether to expose it.
- **Frontend receives inconsistent payloads.** A vulnerability inside a scan has `lastModifiedDate`; inside a dashboard it doesn't; inside a workflow it doesn't even have an `id`.
- **Type safety is weakened.** The manual `any` casts (e.g. `const data: any = {}` in `updateWorkflow`) and `as` assertions proliferate because the shapes are too custom for Prisma's generated types to cover.

### Bottom line on the "optimization"

The data being omitted are tiny scalar fields (UUIDs, short strings, booleans, dates). For a typical API response in this app, we're talking about **bytes or low kilobytes** of difference. The database is already the bottleneck on complex joins, not the width of the select. By micro-optimizing payload size through partial selects and manual mapping, the codebase has traded negligible performance gains for significant complexity, duplication, and inconsistency.

A cleaner approach would be:
- Return full Prisma models (or simple `include: true`) by default.
- Use `select` only when there's a genuine performance concern (e.g., omitting a large `description` field in a list of 10,000 items).
- Handle "public" stripping and date serialization in one place (a serializer/response helper) rather than inline in every service.

---

## 3. Refactoring Tasks

### Phase A — Centralize types & establish naming rules

- [ ] **A.1** Create `backend/src/types/scan.types.ts`
  - Move `ScanResult`, `ScanOptions`, `ScanProgress` from `scan.service.ts`
  - Split `DashboardOverviewData` pieces into `scan.types.ts` and `workflow.types.ts`

- [ ] **A.2** Create `backend/src/types/environment.types.ts`
  - Move `CreateEnvironmentInput`, `UpdateEnvironmentInput`, `PublicEnvironment` from `environment.service.ts`
  - Standardize naming convention and document it (e.g., `CreateXInput` / `UpdateXInput`)

- [ ] **A.3** Create `backend/src/types/user.types.ts`
  - Move `PublicUser` from `user.service.ts`
  - Document the `Public` prefix convention for sanitized outputs

- [ ] **A.4** Create `backend/src/types/workflow.types.ts`
  - Move `WorkflowUpdateInput` from `vulnerabilityWorkflow.service.ts`
  - Rename to `UpdateWorkflowInput` (verb-first)
  - Define a single `WorkflowItem` / `WorkflowPublic` type for the API shape

- [ ] **A.5** Create `backend/src/types/vulnerability.types.ts`
  - Move `GeneratedVulnerability`, `SelectedTarget` from `mockVulnerability.service.ts`
  - Define a single `VulnerabilityPublic` type with the standard field set

- [ ] **A.6** Create `backend/src/types/asset.types.ts`
  - Move the local `CpeInput` from `asset.controller.ts`
  - Align `breakdown` field names with `ScoreBreakdown` from `cpe.types.ts`

- [ ] **A.7** Adopt `interface` as the default keyword for object shapes
  - Convert object-style `type` aliases to `interface`
  - Keep `type` only for unions, intersections, or primitive aliases

### Phase B — Remove harmful partial-select micro-optimizations

- [ ] **B.1** `scan.service.ts`
  - Return full Prisma models by default; delete `mapScanToResult()`
  - Unify the `vulnerability` include/select to a single shared shape
  - Remove the giant `select` block in `getScanHistory()`

- [ ] **B.2** `vulnerabilityWorkflow.service.ts`
  - Stop manual flattening in `getWorkflowsForEnvironment()`
  - Return nested Prisma shapes or use a single shared serializer

- [ ] **B.3** `relationship.controller.ts`
  - Replace repeated `fromAsset`/`toAsset` `select` blocks with `include: { fromAsset: true, toAsset: true }`

- [ ] **B.4** `dashboard.service.ts`
  - Remove inline `toISOString()` calls; return raw `Date` objects
  - Create a reusable date-serialization helper or middleware

- [ ] **B.5** `environment.service.ts`
  - Eliminate `toPublic()`; return full `Environment` models
  - Stop manual 1-to-1 remapping for `assetCount`

### Phase C — Consolidate repeated logic & fix inconsistencies

- [ ] **C.1** Create `backend/src/lib/constants.ts`
  - Single `SEVERITY_ORDER` and `SEVERITY_RANK` maps
  - Replace all local copies in `dashboard.service.ts`, `asset.controller.ts`, `environmentBriefing.service.ts`

- [ ] **C.2** Create `backend/src/lib/severity.ts`
  - Export `countSeverities(vulns[]): { critical, high, medium, low }`
  - Replace inline count blocks in `scan.service.ts` and `mockVulnerability.service.ts`

- [ ] **C.3** Fix the `RISK_ACCEPTED` visibility bug
  - Decide if `RISK_ACCEPTED` should be hidden everywhere
  - Create `isResolvedStatus(status)` helper
  - Replace inline `||` checks in `updateWorkflow()`, `bulkUpdateWorkflows()`, `dashboard.service.ts`

- [ ] **C.4** Create a shared `whereNotMock` helper or constant
  - Replace hardcoded `isMock: false` occurrences across services/controllers

- [ ] **C.5** Unify Prisma `Vulnerability` selects
  - Define `VULNERABILITY_PUBLIC_SELECT` or use `include: { vulnerability: true }`
  - Delete copy-pasted select blocks

### Phase D — Controller consistency & cleanup

- [ ] **D.1** Standardize `environment.controller.ts` responses
  - Wrap all responses in `{ success, data?, message?, error? }`
  - Fix `sucess` → `success` typos

- [ ] **D.2** Audit all controllers for wrapper consistency
  - Every success response uses the same wrapper shape
  - Every error response uses `{ success: false, error, message? }`

- [ ] **D.3** Rename `fetchCvesFroCpe` → `fetchCvesForCpe`
  - Update `nvdCve.ts` and all imports

### Phase E — Documentation & verification

- [ ] **E.1** Document conventions in `backend/AGENTS.md`
  - `interface` for objects, `type` for unions/aliases
  - `Verb + Noun + Input` for DTOs
  - `Public` prefix for sanitized outputs
  - Avoid partial `select` unless proven necessary
  - Prefer `include: { relation: true }`
  - Manual mapping only in shared serializers

- [ ] **E.2** Run `tsc --noEmit` and the test suite to verify no regressions
