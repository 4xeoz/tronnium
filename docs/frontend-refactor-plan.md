# Frontend Refactor Plan

## Goals
1. **No file over 200 lines** — decompose everything into small, focused components
2. **No frontend data processing** — push filtering, sorting, counting to backend where possible; keep frontend dumb
3. **No tightly-coupled deep nesting** — extract inline components, flatten prop drilling
4. **DRY** — shared slide-overs, shared data hooks, shared filter bars, shared empty states
5. **Clear naming** — no typos, no ambiguous names, consistent conventions
6. **Simple backend response handling** — `apiFetch` already throws on errors; stop double-checking `success` flags in pages
7. **Scalable structure** — every new feature should have an obvious place to live

---

## Phase 1: API Layer Cleanup (Foundation)

### Task 1.1: Fix `apiFetch` contract and remove redundant success checks
**Files:** `frontend/lib/api/client.ts`, all page files
**What:** `apiFetch` already throws when `json.success === false`. Pages should NOT also destructure and check `success`. This creates confusion and duplicate error handling.
- In `client.ts`: add a helper `apiFetchData<T>()` that returns `T` directly (unwraps `.data`)
- In all pages: replace `const { success, data, message } = await getX()` with `const data = await getX()` using the new helper, OR just `const response = await getX(); setData(response.data)` and let the try/catch handle errors
**After:** Every API call looks the same: `try { const res = await getThings(); setThings(res.data); } catch (err) { setError(...) }`

### Task 1.2: Extract UI helpers out of API modules
**Files:** `frontend/lib/api/scans.ts`, `frontend/lib/api/vulnerabilityWorkflow.ts`, `frontend/lib/api/dev.ts`
**What:** These files mix API calls with UI formatting (`getRiskLevel`, `getSeverityColor`, `getStatusColor`, `getStatusLabel`, `getMockSeverityColor`, `formatCveId`).
- Move all color/label/format helpers to `frontend/lib/formatters.ts` or `frontend/lib/ui-helpers.ts`
- Keep API modules pure: only types + fetch functions
**After:** `lib/api/*.ts` files only import from `client.ts` and export types + async functions.

### Task 1.3: Fix typos and dead imports in API layer
**Files:** `frontend/lib/api/assets.ts`
**What:**
- Remove unused `import { env } from "process"`
- Rename `updateAseetPosition` → `updateAssetPosition` (fix typo)
- Fix inconsistent base URL in `listenForCpeFindProgress` (uses `NEXT_PUBLIC_API_URL` instead of `NEXT_PUBLIC_BACKEND_URL`)
**After:** Clean, consistent API module with no typos.

### Task 1.4: Consolidate backend URL logic
**Files:** `frontend/lib/api/client.ts`, `frontend/lib/api/assets.ts`, `frontend/lib/api/scans.ts`
**What:** SSE functions (`listenForCpeFindProgress`, `startScan`) build their own URLs with different env var names. Consolidate into a single `getSseUrl(path)` helper in `client.ts`.
**After:** One source of truth for backend URL construction.

---

## Phase 2: Shared Primitives & Hooks (Infrastructure)

### Task 2.1: Create a shared `SlideOver` primitive component
**Files:** New `frontend/components/ui/SlideOver.tsx`
**What:** Currently every slide-over re-implements:
- Fixed positioned aside with backdrop overlay
- Header with title, subtitle, close button
- `translate-x` transition logic
- Backdrop click-to-close

**Extract:** A reusable `SlideOver` that accepts `isOpen`, `onClose`, `title`, `subtitle`, `children`, `footer` (optional).
**Replace in:** `AddAssetSlideOver`, `VulnDetailSlideOver`, `AIChatPanel` (security page inline), `ScanSettingsModal`, `AssetDetailsSlideOver`, `CreateEnvironmentSlideOver`, `MapSidebar`, `RelationshipSidebar`
**After:** No duplicated slide-over shell code anywhere.

### Task 2.2: Create a simple `useFetch` hook
**Files:** New `frontend/lib/hooks/useFetch.ts`
**What:** Most pages repeat the exact same pattern:
```ts
const [data, setData] = useState<T | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const load = useCallback(async () => { ... }, [deps]);
useEffect(() => { load(); }, [load]);
```

**Create:** A simple hook:
```ts
function useFetch<T>(fetchFn: () => Promise<ApiResponse<T>>, deps: unknown[]) => { data, isLoading, error, refetch }
```
**No TanStack Query complexity** — just DRYs up the manual pattern.

### Task 2.3: Create a shared `FilterBar` primitive
**Files:** New `frontend/components/ui/FilterBar.tsx`, `frontend/components/ui/SearchInput.tsx`
**What:** Search inputs with the `<FiSearch className="absolute left-3..." />` pattern appear in:
- Environments list page
- Dashboard asset list
- Security findings page

**Extract:** `SearchInput` component with built-in icon. Optionally a `FilterBar` wrapper for filter pills + search + clear.
**After:** No duplicated search input markup.

### Task 2.4: Create shared `ErrorState` and `LoadingState` primitives
**Files:** New `frontend/components/ui/LoadingState.tsx`, `frontend/components/ui/ErrorState.tsx`
**What:** Every page has its own spinner and error message styling. Extract consistent ones.
**After:** All pages use the same loading and error UI.

---

## Phase 3: Decompose Oversized Pages

### Task 3.1: Break up `app/environments/page.tsx` (314 lines)
**Current:** Inline `StatsRow`, `DropdownMenu`, `EnvironmentRow` components + main page logic.
**New structure:**
```
app/environments/
├── page.tsx              (~80 lines — orchestration only)
├── EnvironmentList.tsx   (~60 lines — list container)
├── EnvironmentCard.tsx   (~50 lines — was EnvironmentRow)
├── EnvironmentStats.tsx  (~30 lines — was StatsRow)
└── EnvironmentActions.tsx (~40 lines — was DropdownMenu)
```
**Rule:** Page file only handles: data loading, top-level state, layout wrapper.

### Task 3.2: Break up `app/environments/[envId]/dashboard/page.tsx` (499 lines)
**Current:** Inline metric cards, attention banner, auto-scan panel, security status panel, asset types panel, scan breakdown panel, recent scans panel, asset grid — ALL in one file.
**New structure:**
```
app/environments/[envId]/dashboard/
├── page.tsx                      (~80 lines)
├── DashboardHeader.tsx           (~40 lines — env name, description, actions)
├── AttentionBanner.tsx           (~50 lines — needs attention items)
├── MetricCards.tsx               (~60 lines — 4 metric cards)
├── AssetGrid.tsx                 (~60 lines — asset list with search)
├── AutoScanPanel.tsx             (~60 lines — toggle + frequency)
├── SecurityStatusPanel.tsx       (~70 lines — scan status + risk sentence + chart)
├── AssetTypeDistribution.tsx     (already exists, keep)
├── ScanBreakdownPanel.tsx        (~50 lines — open/in-progress/resolved bars)
├── RecentScansPanel.tsx          (~50 lines — scan history list)
└── SecureEnvironmentBanner.tsx   (~30 lines — "all clear" banner)
```
**Key change:** Dashboard page should fetch `DashboardOverview` and pass pre-computed data down. Stop computing `totalActiveThreats`, `assetsWithCPEs`, `activeAssets`, `attentionItems` in the page. Let child components receive simple props.

### Task 3.3: Break up `app/environments/[envId]/security/page.tsx` (474 lines)
**Current:** Massive data transformation inline (`severityCounts`, `previousScanVulnIds`, `enrichedVulns`, `filteredVulns`, `slaBreaches`, `newThisScan`, `scanOverviewStats`), plus filter bar, tab switching, inline AI panel, inline vuln detail.
**New structure:**
```
app/environments/[envId]/security/
├── page.tsx                      (~80 lines — load data, pass to children)
├── SecurityHeader.tsx            (~50 lines — title, scan history dropdown, action buttons)
├── SecurityTabs.tsx              (~40 lines — overview/findings tabs)
├── FilterBar.tsx                 (~60 lines — severity pills, status pills, search, "new only")
├── FindingsTable.tsx             (move from components/security, break down further)
│   ├── FindingsTable.tsx         (~80 lines — table shell + pagination)
│   ├── FindingsTableRow.tsx      (~60 lines — single row render)
│   ├── FindingsTableHeader.tsx   (~40 lines — sort headers + select all)
│   └── BulkActionsBar.tsx        (~30 lines — selected count + bulk buttons)
├── OverviewPanel.tsx             (move from components/security, keep but split)
│   ├── RiskSentence.tsx          (already exists)
│   ├── VulnBarChart.tsx          (already exists)
│   ├── TrendAnalysisPanel.tsx    (extract from OverviewPanel)
│   ├── TopExposureList.tsx       (extract from OverviewPanel)
│   └── OverviewStatCards.tsx     (~40 lines — 3 big stat cards)
├── AIAnalystPanel.tsx            (~50 lines — extracted from inline aside)
└── VulnDetailWrapper.tsx         (~30 lines — manages slide-over open/close)
```
**Key change:** Push as much filtering as possible to the backend. The `getWorkflows` endpoint already supports `status`, `severity`, `assetId` filters. Use them instead of loading everything and filtering client-side.

### Task 3.4: Break up `app/environments/[envId]/dev/page.tsx` (465 lines)
**Current:** `AIVulnGenerator` is a massive inline component with 5 step-based render blocks (`STEPS.START`, `SELECT`, `PROMPT`, `GENERATING`, `RESULTS`).
**New structure:**
```
app/environments/[envId]/dev/
├── page.tsx                      (~30 lines — page wrapper + ComingSoon cards)
├── MockGenerator/
│   ├── MockGenerator.tsx         (~60 lines — step router + state)
│   ├── AssetSelector.tsx         (~70 lines — STEP.START: asset + CPE checkboxes)
│   ├── SelectionSummary.tsx      (~40 lines — STEP.SELECT: show selected)
│   ├── PromptEditor.tsx          (~50 lines — STEP.PROMPT: textarea + buttons)
│   ├── GeneratingState.tsx       (~20 lines — STEP.GENERATING: spinner)
│   └── ResultsList.tsx           (~40 lines — STEP.RESULTS: vuln cards + nav buttons)
│   └── useMockGenerator.ts       (~60 lines — all state logic extracted to a hook)
```
**Key change:** Extract ALL state logic into a `useMockGenerator` custom hook. Components become pure renderers.

### Task 3.5: Break up `app/environments/[envId]/map/page.tsx` (425 lines)
**Current:** Mix of React Flow setup, data transforms, mutation handlers, inline relationship creation modal.
**New structure:**
```
app/environments/[envId]/map/
├── page.tsx                      (~60 lines — ReactFlow shell + sidebars)
├── useMapData.ts                 (~80 lines — all useQuery calls + memo transforms)
├── useMapMutations.ts            (~60 lines — all mutation handlers)
├── RelationshipModal.tsx         (~60 lines — extracted inline modal)
└── MapErrorToast.tsx             (~20 lines — error notification)
```
**Key change:** Move all data fetching and transformation into custom hooks. Page only renders.

---

## Phase 4: Remove Frontend Data Processing

### Task 4.1: Offload security dashboard stats to backend
**Files:** `frontend/app/environments/[envId]/security/page.tsx`, `frontend/lib/api/dashboard.ts`
**What:** The security page recomputes `severityCounts`, `scanOverviewStats`, `slaBreaches`, `newThisScan` from raw scan + workflow data. The backend's `/dashboard/:envId/overview` endpoint ALREADY returns `severityCounts`, `overdue`, `unassignedCriticalHigh`, `resolvedThisWeek`, `assetVulnMap`.
- Use `getDashboardOverview()` in the security page to get pre-computed stats
- Remove `severityCounts`, `scanOverviewStats` computations from the security page
- Keep only the `filteredVulns` search filter (client-side search is acceptable for UX responsiveness)
**After:** Security page stops counting things the backend already counted.

### Task 4.2: Simplify `enrichedVulns` computation
**Files:** `frontend/app/environments/[envId]/security/page.tsx`
**What:** The `enrichedVulns` array adds deterministic dummy fields:
```ts
const isKev = sevVal >= 3 && (seed % 20) < 2; // ~10% of Critical/High
const patchAvailable = (seed % 10) < 3;        // ~30%
const epssScore = sevVal >= 2 ? Math.min(0.95, (seed % 100) / 100) : null;
```
This is fake data generation happening in the frontend. Options:
- **Option A:** Move this enrichment to the backend (cleanest)
- **Option B:** If backend doesn't support it yet, wrap this in a simple utility `enrichVulnerability(vuln)` in `lib/vuln-helpers.ts` so the page stays clean
- **Option C:** Remove fake enrichment entirely until real data is available
**Recommendation:** Option B for now — extract to a utility, don't delete features.

### Task 4.3: Use backend workflow filtering
**Files:** `frontend/app/environments/[envId]/security/page.tsx`, `frontend/lib/api/vulnerabilityWorkflow.ts`
**What:** The page loads ALL workflows then filters them client-side by status. The backend `getWorkflows` endpoint accepts `status`, `severity`, `assetId` query params.
- When user clicks a status filter, call `getWorkflows(envId, { status })` instead of filtering the existing map
- When user clicks a severity filter, call `getWorkflows(envId, { severity })`
- Keep only the text search (`searchQuery`) client-side
**After:** Filter changes trigger API calls with query params, not client-side array filtering.

### Task 4.4: Simplify dashboard attention logic
**Files:** `frontend/app/environments/[envId]/dashboard/page.tsx`
**What:** `attentionItems` is built manually by checking 4 conditions inline. Extract to a simple helper:
```ts
function getAttentionItems(overview: DashboardOverview | null, assets: Asset[]): AttentionItem[]
```
Move to `lib/dashboard-helpers.ts`.
**After:** Dashboard page doesn't contain attention logic inline.

### Task 4.5: Simplify asset sorting on dashboard
**Files:** `frontend/app/environments/[envId]/dashboard/page.tsx`
**What:** `sortedAssets` sorts by `overview.assetVulnMap` severity then count. This could be done by the backend, but for now just extract to `lib/sorting.ts`:
```ts
function sortAssetsByRisk(assets: Asset[], vulnMap: Record<string, { count, highestSeverity }>): Asset[]
```
**After:** One-line call in the page, logic lives in a testable utility.

---

## Phase 5: Component Naming & DRY

### Task 5.1: Rename ambiguous / typo components
**Files:** Multiple
**What:**
- `updateAseetPosition` → `updateAssetPosition` (Task 1.3 already covers)
- `EmptyStateSec` → `SecurityEmptyState` (or use shared `EmptyState`)
- `ScanningProgress` → `ScanProgressBanner` ( clearer purpose)
- `SecurityUI.tsx` → Delete or rename. It re-exports `Card`, `SectionHeader`, `StatCard` with different APIs than `components/ui/`. Consolidate.
- `CpeSearchProgress` / `CpeFinderProgress` — determine which is used, delete the dead one

### Task 5.2: Consolidate duplicated `StatCard` implementations
**Files:** `frontend/components/ui/StatCard.tsx`, `frontend/components/security/SecurityUI.tsx`
**What:** There are TWO `StatCard` components with different APIs. Pick one (the `ui/` version), update all callers, delete the other.
**After:** One `StatCard` in `components/ui/`.

### Task 5.3: Consolidate severity/status constants
**Files:** `frontend/lib/securityConstants.ts`, `frontend/lib/api/scans.ts`, `frontend/lib/api/vulnerabilityWorkflow.ts`
**What:** Severity ordering, color maps, and status colors are scattered across files. Move ALL UI color/formatting maps to `lib/ui-constants.ts`.
**After:** One file with: `SEVERITY_CONFIG`, `STATUS_COLORS`, `SEVERITY_ORDER`, `INACTIVE_STATUSES`, `typeIcons`.

### Task 5.4: Extract inline SVGs to icon components
**Files:** `frontend/app/environments/[envId]/security/page.tsx` (settings gear icon)
**What:** Massive inline SVG for the settings button. Use `FiSettings` from `react-icons/fi` or extract to a component.
**After:** No inline SVGs longer than 2 lines.

---

## Phase 6: AppLayout & Navigation Cleanup

### Task 6.1: Extract inline components from `AppLayout`
**Files:** `frontend/components/layout/AppLayout.tsx`
**What:** Inline `NavItem`, `PulsingDot`, `Badge` (different from ui/Badge).
**New structure:**
```
components/layout/
├── AppLayout.tsx         (~100 lines — layout shell only)
├── Sidebar.tsx           (~60 lines — sidebar structure)
├── NavItem.tsx           (~40 lines — extracted)
├── NavBadge.tsx          (~20 lines — extracted from inline Badge)
└── PulsingDot.tsx        (~15 lines — extracted)
```

### Task 6.2: Simplify environment-aware routing in sidebar
**Files:** `frontend/components/layout/AppLayout.tsx`
**What:** `envMatch`, `isInDashboard`, `isInMap`, `isInSecurity`, etc. are computed manually with regex and string checks. Use `useParams` to get `envId` directly and simplify.
**After:** Cleaner, more obvious routing logic.

---

## Phase 7: FindingsTable Decomposition

### Task 7.1: Split `FindingsTable` into focused sub-components
**Files:** `frontend/components/security/FindingsTable.tsx` (367 lines)
**New structure:**
```
components/security/findings/
├── FindingsTable.tsx          (~80 lines — table shell, pagination, bulk actions)
├── FindingsTableHeader.tsx    (~40 lines — sortable column headers)
├── FindingsTableRow.tsx       (~80 lines — single vulnerability row)
├── ThreatIntelBadges.tsx      (~30 lines — KEV, Patch, EPSS badges)
├── VulnActionsCell.tsx        (~30 lines — NVD link, view, AI explain)
└── PaginationBar.tsx          (~40 lines — page size + prev/next)
```

### Task 7.2: Extract `parseCvssVector` to a utility
**Files:** `frontend/components/security/FindingsTable.tsx`
**What:** Move `parseCvssVector` to `lib/cvss-helpers.ts`.

---

## Execution Order (Recommended)

Do these **one at a time**, in this order. Each task should be a single PR or commit.

1. **Task 1.1** — Fix API response handling (unblocks everything else)
2. **Task 1.2** — Extract UI helpers from API modules
3. **Task 1.3 + 1.4** — Fix typos and URL consistency
4. **Task 2.1** — Create shared `SlideOver` primitive
5. **Task 2.2** — Create `useFetch` hook
6. **Task 2.3 + 2.4** — Shared `SearchInput`, `FilterBar`, `ErrorState`, `LoadingState`
7. **Task 3.1** — Break up environments list page
8. **Task 5.3** — Consolidate constants (makes next tasks easier)
9. **Task 3.2** — Break up dashboard page
10. **Task 4.4 + 4.5** — Extract dashboard helpers
11. **Task 3.4** — Break up dev page
12. **Task 6.1 + 6.2** — Break up AppLayout
13. **Task 4.1 + 4.2 + 4.3** — Offload security data processing
14. **Task 3.3** — Break up security page (biggest remaining piece)
15. **Task 7.1 + 7.2** — Break up FindingsTable
16. **Task 3.5** — Break up map page
17. **Task 5.1 + 5.2 + 5.4** — Final naming cleanup

---

## File Size Targets

| File | Current | Target |
|------|---------|--------|
| `app/environments/page.tsx` | 314 | < 80 |
| `app/environments/[envId]/dashboard/page.tsx` | 499 | < 80 |
| `app/environments/[envId]/security/page.tsx` | 474 | < 80 |
| `app/environments/[envId]/dev/page.tsx` | 465 | < 50 |
| `app/environments/[envId]/map/page.tsx` | 425 | < 60 |
| `components/assets/AddAssetSlideOver.tsx` | 474 | < 80 |
| `components/security/FindingsTable.tsx` | 367 | < 80 |
| `components/layout/AppLayout.tsx` | 231 | < 100 |
| `components/security/OverviewPanel.tsx` | 233 | < 60 |

---

## Principles to Follow in Every Task

1. **One component = one file = one responsibility**
2. **Pages are thin** — they load data and delegate to components
3. **No inline component definitions** inside other components
4. **No frontend counting/filtering** if the backend already computed it
5. **Keep it simple** — no custom hooks more complex than `useState + useEffect`
6. **Consistent error handling** — always try/catch, always show user-friendly message
7. **Props over context** — pass data down, don't reach for context unless truly global
