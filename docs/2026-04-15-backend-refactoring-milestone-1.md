# Backend Type & Module Refactoring
## Project Documentation - April 15, 2026

**Author:** Software Engineering Team  
**Date:** April 15, 2026  
**Status:** Completed  

---

## 1. Executive Summary

Today we completed the **first milestone of a backend-wide refactoring initiative** for the Tronnium platform. The backend had accumulated structural debt: types were scattered inside service files, naming conventions were inconsistent, and the folder structure mixed controllers, services, and routes without clear domain boundaries. This milestone centralized all shared types, renamed files to consistent conventions, and reorganized the codebase into a **feature-based module architecture**.

**Key Deliverables:**
- ✅ Centralized `backend/src/types/` with 6 domain-specific type files
- ✅ Renamed all files to consistent kebab-case conventions
- ✅ Reorganized backend into 11 feature modules (`modules/auth`, `modules/scan`, `modules/vulnerability`, etc.)
- ✅ Updated all imports across the entire codebase
- ✅ Verified no regressions with TypeScript compiler

---

## 2. Problem Statement

Over the past months of rapid feature delivery, the backend accumulated several structural problems that were slowing down development and increasing the risk of bugs:

### 2.1 Scattered Types
Only the CPE pipeline had a dedicated `types/cpe.types.ts` file. Every other domain defined its types inline inside service files (`scan.service.ts`, `environment.service.ts`, `user.service.ts`, etc.). This meant:
- No single place to look for a type definition
- Local one-off shapes that could have been shared
- Circular dependencies were hard to detect

### 2.2 Inconsistent Naming
There was no project-wide convention. We had `WorkflowUpdateInput` (noun-first) next to `CreateEnvironmentInput` (verb-first). Some outputs used a `Public` prefix (`PublicUser`), others used bare nouns (`CveExplanation`). Function names had typos like `fetchCvesFroCpe`. This inconsistency made APIs harder to learn and increased cognitive load when switching between files.

### 2.3 Flat Folder Structure
The old structure split code by technical role (`controllers/`, `services/`, `routes/`, `auth/`) rather than by domain. As the feature set grew, this became unwieldy:
- Adding a new feature required touching 4–5 disconnected folders
- Related code (e.g., scan controller + scan service + scan routes) was physically separated
- It was difficult to know which files belonged to which feature

### 2.4 Repeated Logic & Micro-Optimizations
Because types and shapes were not shared, developers copy-pasted Prisma `select` blocks and manually remapped results into slightly different objects. The same `SecurityScan` entity had 3–4 different API shapes depending on which endpoint you called. This created:
- Type explosion (dozens of near-identical types)
- Inconsistent payloads for the frontend
- Weakened type safety (`any` casts proliferated)

---

## 3. Design Approach

We chose a **feature-based modular architecture** with centralized types:

```
┌─────────────────────────────────────────┐
│       Centralized Types                 │
│  types/scan, types/workflow, etc.       │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Feature Modules                   │
│  modules/scan, modules/asset, etc.      │
│  Each module: controller + routes + svc │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│       Shared Infrastructure             │
│  lib/prisma, lib/gemini, middleware     │
└─────────────────────────────────────────┘
```

### 3.1 Why This Architecture?

**1. Centralized Types**
- One source of truth per domain
- Eliminates inline duplication
- Makes imports predictable

**2. Feature Modules**
- All code for a feature lives together
- Easier onboarding: a new developer can understand "scanning" by opening `modules/scan/`
- Simplifies deletion or extraction of a feature later

**3. Consistent Naming (kebab-case + verb-first)**
- `update-workflow-input` instead of `workflow-update-input`
- `nvd-cve.service.ts` instead of `nvdCve.ts`
- Reduces confusion and aligns with modern TypeScript conventions

---

## 4. What We Did

### 4.1 Centralized Types
Created 6 new type files under `backend/src/types/`:

| File | Types moved here |
|------|------------------|
| `scan.types.ts` | `ScanResult`, `ScanOptions`, `ScanProgress`, `LatestScanSummary`, `RecentScanSummary` |
| `environment.types.ts` | `CreateEnvironmentInput`, `UpdateEnvironmentInput`, `PublicEnvironment` |
| `user.types.ts` | `PublicUser` |
| `workflow.types.ts` | `UpdateWorkflowInput` (renamed), `WorkflowPublic` |
| `vulnerability.types.ts` | `GeneratedVulnerability`, `MockVulnGenerationResult`, `SelectedTarget`, `VulnerabilityPublic`, `CveExplanation`, `SocAnalysis`, `SocAnalysisInput`, `CriticalFinding`, `EnvironmentBriefing`, `AssetScanEntry` |
| `asset.types.ts` | `CpeInput` |

### 4.2 Renamed Files to Kebab-Case
Examples:
- `services/nvdCve.ts` → `modules/scan/nvd-cve.service.ts`
- `services/vulnerabilityWorkflow.service.ts` → `modules/vulnerability/vulnerability-workflow.service.ts`
- `lib/verifyEnvironment.ts` → `lib/verify-environment.ts`

### 4.3 Reorganized into Feature Modules
The old `controllers/`, `services/`, `routes/`, and `auth/` directories were replaced by 11 domain modules:

- `modules/ai`
- `modules/asset`
- `modules/auth`
- `modules/dashboard`
- `modules/dev`
- `modules/environment`
- `modules/health`
- `modules/relationship`
- `modules/scan`
- `modules/user`
- `modules/vulnerability`

Each module contains its controllers, services, and routes colocated.

### 4.4 Updated All Imports
Every import path in the backend was rewritten to match the new structure. No stale references remain.

---

## 5. How This Solves Past Problems

### 5.1 Findability
**Before:** `PublicUser` lived in `services/user.service.ts`. `ScanOptions` lived in `services/scan.service.ts`. `CpeInput` lived in `controllers/asset.controller.ts`.  
**After:** All types live in `backend/src/types/`. You know exactly where to look.

### 5.2 Naming Consistency
**Before:** `WorkflowUpdateInput` (noun-first) vs `CreateEnvironmentInput` (verb-first), `fetchCvesFroCpe` typo.  
**After:** Standardized verb-first DTO names (`UpdateWorkflowInput`), fixed the typo, and aligned `CpeInput.breakdown` fields with the existing `ScoreBreakdown` type.

### 5.3 Feature Onboarding
**Before:** To understand the scan feature, you had to open `controllers/scan.controller.ts`, `services/scan.service.ts`, `services/nvdCve.ts`, and `routes/scan.routes.ts` across four different directories.  
**After:** Everything is in `modules/scan/`. Open one folder and you see the full picture.

### 5.4 Foundation for Deeper Refactors
This milestone does not yet fix the partial-select micro-optimizations or duplicated logic, but it **enables** those fixes. With centralized types and module boundaries, we can now:
- Define one `VulnerabilityPublic` type and share it across modules
- Create shared helpers (e.g., `lib/severity.ts`) without circular-import headaches
- Delete manual reshaping code because there is finally a single source of truth for each shape

---

## 6. Verification

- Ran `npx tsc --noEmit` in the `backend/` directory.
- **Result:** No new TypeScript errors. The only existing warning is a pre-existing `tsconfig.json` issue (`prisma.config.ts` outside `rootDir`), unrelated to this refactor.

---

## 7. Next Steps

With the structural foundation in place, the next milestones will tackle the deeper code-quality issues:

1. **Remove partial-select micro-optimizations** — return full Prisma models and delete redundant manual mapping.
2. **Consolidate repeated logic** — unify severity maps, fix the `RISK_ACCEPTED` visibility inconsistency, and introduce shared helpers like `isResolvedStatus()`.
3. **Standardize API response wrappers** — ensure every controller uses the same `{ success, data, error }` envelope.

See `docs/backend-refactoring-tasks.md` for the full detailed task list.
