# Scaling Problems and Approaches (April 19, 2026)

## Purpose
This document captures the current scaling-related problems in the Tronnium codebase and the different approaches under consideration to keep feature development fast while reducing regression risk.

## Current Scaling Problems

### 1. Change Ripple Across Layers
A single data model change (for example, moving `Asset.cpes` from JSON to a relational model) impacts:
- Prisma schema
- Backend service logic
- Backend controllers
- Frontend API types
- Frontend UI assumptions

Impact:
- High coordination cost
- Frequent breakages during refactors
- Slow feature delivery

### 2. Weak Contract Boundaries
Frontend and backend use similar concepts but do not consistently share strict request/response contracts.

Impact:
- API drift over time
- Runtime errors from shape mismatch
- Repeated manual fixes in multiple files

### 3. Large Orchestration Components
Some pages and modules are handling too many concerns at once:
- data fetch orchestration
- filtering and view-state management
- rendering logic
- modal/slide-over control

Impact:
- High cognitive load
- Harder debugging and testing
- Higher merge conflict probability

### 4. Inconsistent Type Strictness
There are still hotspots using broad typing (`any`, loosely typed update maps, or inferred shapes that are not enforced).

Impact:
- Errors caught late
- Low confidence during refactors
- Hidden coupling between modules

### 5. Migration Safety Gaps
Structural schema changes can be applied before all dependent code paths are migrated.

Impact:
- Temporary broken runtime behavior
- Need for emergency patching
- Unclear migration readiness criteria

---

## Scaling Approaches Being Considered

## Approach A: Strengthen Contracts First
Use schema validation and shared types for API boundaries.

What this means:
- Define strict request/response schemas per module (for example with Zod)
- Validate at controller boundaries
- Generate or share typed contracts for frontend API clients

Pros:
- Reduces API drift
- Safer refactors
- Better developer confidence

Cons:
- Upfront effort to retrofit existing endpoints

Best use:
- Core modules with high churn (Assets, Scans, Vulnerability Workflows)

## Approach B: Module-Level Data Access Layer
Introduce repository/data-access boundaries so Prisma details stay in one place.

What this means:
- Controllers call services
- Services call repositories
- Repositories isolate Prisma-specific shapes and queries

Pros:
- Smaller blast radius for schema changes
- Easier testability and mocking
- Cleaner separation of concerns

Cons:
- Initial refactor cost

Best use:
- Areas with complex queries or repeated data mapping

## Approach C: Frontend Feature-Slice Refactor
Split large pages into smaller feature-oriented components and hooks.

What this means:
- Keep route pages focused on composition
- Move data orchestration into dedicated hooks
- Move UI responsibilities into focused components

Pros:
- Better maintainability
- Improved readability
- Easier unit/component testing

Cons:
- Requires careful incremental migration

Best use:
- Security page, scan detail flows, environment sub-pages

## Approach D: Controlled Migration Pattern
Apply schema/model migrations using a formal phased rollout.

What this means:
- Phase 1: Introduce new model and dual-read/dual-write where needed
- Phase 2: Backfill data and verify integrity
- Phase 3: Switch reads to new model
- Phase 4: Remove legacy path

Pros:
- Lower downtime risk
- Fewer big-bang regressions
- Clear rollback points

Cons:
- More temporary code during transition

Best use:
- High-impact model changes (like CPE storage)

## Approach E: Change-Protection Test Layer
Add a targeted integration test suite around critical business flows.

What this means:
- Test create asset with CPEs
- Test run scan and aggregate vulnerabilities
- Test workflow status transitions
- Test key frontend API contract assumptions

Pros:
- Fast detection of regression
- Safer release cycle

Cons:
- Ongoing maintenance required

Best use:
- High-value paths that frequently change

---

## Recommendation (Incremental Path)

### Step 1 (Immediate)
- Stabilize API contracts for Assets and Scans
- Remove high-risk `any` usage in those flows

### Step 2 (Short-Term)
- Introduce repository boundaries for Assets and Scans modules
- Break the largest frontend orchestration pages into hook + UI slices

### Step 3 (Mid-Term)
- Add integration tests for critical flows and migration safety checks
- Enforce stricter type/lint gates in CI

### Step 4 (Long-Term)
- Continue module-by-module migration to strict contracts + isolated data layers
- Document all major schema transitions using phased rollout templates

---

## Decision Log (To Be Updated)
- [ ] Finalize contract strategy tooling
- [ ] Choose migration strategy for CPE relational model rollout
- [ ] Define first integration-test scope
- [ ] Set CI gates for type safety and contract checks
