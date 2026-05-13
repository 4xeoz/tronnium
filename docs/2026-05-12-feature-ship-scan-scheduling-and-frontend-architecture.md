# Feature Ship: Scan Scheduling, Real-Time Progress, AI Chat & Frontend Architecture Refactor

**Date:** May 12, 2026  
**Branch:** `claude/review-new-features-7nPGD`  
**Scope:** Backend + Frontend  
**Status:** Ready for review / merge

---

## 1. What We Built

This is a large feature-and-refactor commit that touches almost every part of the stack. The four main pillars are:

### 1.1 Automated Scan Scheduling (Backend)
- A cron-based scan scheduler (`node-cron`) that runs inside the backend process
- Per-environment schedule configuration: minutely, hourly, daily, weekly, monthly
- Optional `fromDate` lookback on scheduled scans
- A `scan-progress.bus.ts` event emitter system so the scheduler (and manual scans) can broadcast real-time progress
- New Prisma schema: `ScanSchedule` table with `frequency`, `hour`, `minute`, `dayOfWeek`, `dayOfMonth`, `nextRunAt`, `lastRunAt`

### 1.2 Real-Time Scan Progress Streaming
- SSE endpoint (`GET /scans/:scanId/progress`) streams stage-by-stage updates to the client
- Event bus keyed by `scanId` decouples the long-running scan worker from the HTTP response
- Client reconnects gracefully: if the emitter is already gone, we immediately return `completed`
- Scan worker reports stages: "NVD fetch", "asset matching", "severity scoring", "completed"

### 1.3 AI Security Chat with Environment Context
- New `chat.service.ts` uses Gemini with a system prompt tailored to SOC analyst tone
- Injects a live "context matrix" (environment assets, CVEs, risk scores) into every conversation
- Caps message history to the last 6 exchanges to stay within token limits
- Returns a friendly stub message if `GEMINI_API_KEY` is missing (no hard crashes)

### 1.4 Frontend Three-Layer Architecture
We tore down the old "component does everything" model and replaced it with strict boundaries:

```
API Layer     (lib/api/*)       → raw HTTP, returns ApiResponse<T>, throws on network errors only
Service Layer (lib/services/*)  → orchestrates multiple API calls, checks .success, returns { data, error }
Hook Layer    (lib/hooks/*)     → wraps services in useQuery, exposes clean typed results
Components    (app/*, components/*) → render only; never import from lib/api directly
```

New files:
- `lib/api/client.ts` — `apiFetch`, `getSseUrl`, `ApiResponse<T>` type
- `lib/services/environmentService.ts`, `scanService.ts`, `workflowService.ts`
- `lib/hooks/useEnvironment.ts`, `useSecurityBoard.ts`, `useVulnDerived.ts`, `useVulnFilters.ts`, `useSchedule.ts`, `useDisplayedScan.ts`

### 1.5 Dashboard & Security Page Overhaul
- Dashboard split from one 500-line monster into focused cards: `SecurityStatusCard`, `AutoScanCard`, `RecentScansCard`, `ScanBreakdownCard`, `AllClearBanner`, `AttentionBanner`
- Security page rebuilt with `AISidePanel`, `FindingsFilterBar`, `SecurityPageHeader`, `WorkflowMutationFeedback`
- `ScanSettingsModal` rewritten with clearer date-picker UX and "last scan" quick-select

---

## 2. Why We Did It

### The Problems Before

**Components were doing everything.** Every page mixed rendering, data fetching, error handling, caching logic, and state management. A single environment page imported 8 different API helpers, managed 6 loading states, and had 4 different error-handling patterns. This made the frontend brittle: change one API shape and you touched 12 files.

**No visibility into long-running scans.** When a user hit "Start Scan", the request could hang for 30–90 seconds while the backend talked to NVD, matched CPEs, and scored vulnerabilities. The UI showed a spinner and prayed. Users refreshed the page, triggered duplicate scans, or assumed the app was broken.

**No automation.** Scans were 100% manual. For teams with daily or weekly compliance requirements, this was unsustainable.

**Error handling was inconsistent.** Some API wrappers threw on `success === false`. Others returned the raw response and let the component decide. Partial failures (e.g., scan history loaded but workflows failed) were impossible to express cleanly.

**AI chat was generic.** The old AI panel had no memory of the environment it was sitting in. It gave generic security advice like "keep your systems updated" instead of "your Apache 2.4.41 instance has CVE-2021-41773 — patch to 2.4.51".

---

## 3. Problems Faced & How We Solved Them

### 3.1 The "API Throw vs. Return" Debate
**Problem:** Our first instinct was to make `apiFetch` throw whenever `json.success === false`. This felt clean — one `try/catch` and you're done. But in practice it was a nightmare. A dashboard needs to show *partial* data: if the latest scan loads but the workflow history fails, we still want to render the scan results with a small error banner. Throwing aborts the entire promise chain.

**Solution:** `apiFetch` now **only throws on network/HTTP errors**. It always returns the full `ApiResponse<T>` shape. The service layer checks `.success` explicitly and returns `{ data, error }` per field. Hooks then expose those fields cleanly:

```ts
const { environment_data, environment_error, isLoading } = useEnvironment(envId);
```

This lets components render success and failure side-by-side without nested try/catches.

### 3.2 SSE Memory Leaks & Orphaned Emitters
**Problem:** The first draft of the event bus stored emitters forever. If a scan completed and the client never connected to the SSE endpoint, the emitter sat in the Map indefinitely. After a few thousand scans, that's a memory leak.

**Solution:** The scan worker itself calls `removeScanEmitter(scan.id)` after emitting `completed` or `error`. The SSE handler only subscribes if the emitter still exists; if it doesn't, it returns an immediate `completed` event and closes the connection. This means:
- Fast clients get live streaming
- Late/reconnecting clients get told "already done"
- The server doesn't leak memory

### 3.3 Concurrent Scan Prevention vs. Progress Reconnection
**Problem:** We needed to prevent users from starting two scans on the same environment simultaneously. But if a scan was already running, the user should be able to see its progress instead of getting a vague "already running" error.

**Solution:** The `startScan` endpoint checks for `IN_PROGRESS` scans first. If one exists, it returns `{ scanId, alreadyRunning: true }` with HTTP 200. The frontend `ScanContext` detects `alreadyRunning` and immediately connects to the SSE stream for that `scanId`. The user sees the active scan's live progress as if they started it themselves.

### 3.4 Cron Expression Edge Cases
**Problem:** Building cron expressions from user-friendly inputs ("every Monday at 9 AM") sounds simple until you deal with time zones, daylight saving, and Prisma storing UTC while users think in local time.

**Solution:** We decided to keep it simple: all schedule times are stored and executed in **server local time**. The `buildCronExpression` helper maps our `ScheduleFrequency` enum to standard 5-field cron strings. `computeNextRun` calculates the next execution time for display purposes using the same logic. We explicitly documented that the server timezone is the source of truth — if we need per-user timezone support later, it'll be a v2 feature.

### 3.5 Frontend Hook Sprawl
**Problem:** After extracting hooks, we briefly ended up with hooks that were too granular (`useLatestScan`, `useScanHistory`, `useScanSettings`) and hooks that were too broad (`useEnvironmentPageData` fetching 12 fields). Both extremes were hard to reuse.

**Solution:** We settled on **page-level hooks** that compose lower-level concerns:
- `useEnvironment` → fetches env details, assets, and overview in parallel
- `useSecurityBoard` → fetches scan + vulnerability + workflow data for the security page
- `useDisplayedScan` → handles the "which scan am I looking at?" derived state (latest vs. historical)

Each hook uses `Promise.all` with `.catch(toErrorResult)` so partial failures don't crash the whole page.

### 3.6 AI Chat Context Window Limits
**Problem:** The environment context matrix for large environments can be 2,000+ tokens. Combine that with a 6-message history and a verbose system prompt, and we were hitting Gemini's input limits.

**Solution:** The context matrix is now **summarized** before injection: instead of listing every asset's every CVE, we group by risk level (critical/high/medium/low) and include only the top 10 most critical CVEs with their affected assets. The system prompt was also tightened — we removed redundant formatting instructions and told the model to "never fabricate data" rather than repeating the context twice.

---

## 4. Files Added / Modified (High-Level)

| Area | Files |
|------|-------|
| **Backend — Scheduler** | `src/lib/scan-scheduler.ts`, `src/lib/scan-progress.bus.ts`, `src/modules/scan-schedule/*` |
| **Backend — AI** | `src/modules/ai-security/chat.service.ts`, `ai.controller.ts`, `ai.routes.ts` |
| **Backend — Scan Core** | `src/modules/scan-core/scan-core.controller.ts`, `scan-core.service.ts`, `scan.types.ts` |
| **Backend — NVD/Mock** | `src/modules/scan-nvd/scan-nvd.service.ts`, `src/modules/scan-mock/scan-mock.service.ts` |
| **Backend — Prisma** | `prisma/schema.prisma` (added `ScanSchedule`) |
| **Frontend — API** | `lib/api/client.ts`, `lib/api/scans.ts`, `lib/api/dashboard.ts`, `lib/api/assets.ts`, `lib/api/ai.ts`, `lib/api/schedule.ts` |
| **Frontend — Services** | `lib/services/environmentService.ts`, `scanService.ts`, `workflowService.ts` |
| **Frontend — Hooks** | `lib/hooks/useEnvironment.ts`, `useSecurityBoard.ts`, `useVulnDerived.ts`, `useSchedule.ts`, `useDisplayedScan.ts` |
| **Frontend — Pages** | `app/environments/[envId]/dashboard/page.tsx`, `security/page.tsx`, `dev/page.tsx`, `page.tsx` |
| **Frontend — Components** | `dashboard/*`, `security/*`, `scan/ScanSettingsModal.tsx`, `security/AIChatPanel.tsx`, `assets/AddAssetSlideOver.tsx` |
| **Docs** | `docs/2026-05-06-frontend-architecture-service-layer.md`, `Semantic_CPE_Matching_with_Vector_Embeddings.md` |

---

## 5. Testing Notes

- `scan-core.test.ts` updated to assert progress callback invocation
- Jest config adjusted for new module paths
- Manual testing performed on:
  - Schedule creation / update / deletion
  - Manual scan with SSE progress stream
  - AI chat with large environment context (50+ assets)
  - Dashboard partial-load scenarios (simulate workflow API failure)

---

## 6. What's Next

1. **Timezone-aware scheduling** — currently server-local time only
2. **Scan queue / worker** — if the scheduler triggers 50 scans at once, they all run concurrently. A BullMQ or similar queue would be safer at scale.
3. **Hook caching strategy** — `staleTime: 5 * 60 * 1000` is a global default. We may want per-resource tuning.
4. **AI chat message persistence** — currently in-memory only; refresh loses history.

---

*Written by the dev team on May 12, 2026.*
