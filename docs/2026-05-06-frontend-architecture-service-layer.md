# Frontend Architecture: Service & Hook Layer
## Project Documentation - May 6, 2026

**Author:** Frontend Team  
**Date:** May 6, 2026  
**Status:** In Progress (environmentService + useEnvironment pattern established)

---

## 1. Executive Summary

Today we restructured the frontend's data-fetching architecture from a **direct API-to-component** model to a **three-layer architecture** with strict boundaries between API, Service, and Hook layers.

**The goal:** Separate concerns so that components only render, services only orchestrate, and the API layer only makes HTTP calls. No layer crosses into another's responsibility.

**Key decisions made today:**
- `apiFetch` returns the full `ApiResponse<T>` and **does not throw** on `success === false`
- Services check `.success` explicitly and return `{ data, error }` shapes per field
- Hooks wrap services with `useQuery` and expose clean, typed results
- Components consume hooks and render — they never import from `lib/api/*`

---

## 2. The Problem (Before)

### 2.1 Components Did Everything

Every page mixed rendering, state management, data fetching, error handling, and caching logic:

```tsx
// BEFORE: app/environments/[envId]/dashboard/page.tsx
const [environment, setEnvironment] = useState<Environment | null>(null);
const [assets, setAssets] = useState<Asset[]>([]);
const [overview, setOverview] = useState<DashboardOverview | null>(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const loadEnvironment = useCallback(async () => {
  try {
    setError(null);
    const [envData, assetsData, overviewData] = await Promise.all([
      fetchEnvironmentById(envId),
      fetchAssets(envId),
      fetchDashboardOverview(envId).catch(() => null),
    ]);
    setEnvironment(envData.data);
    setAssets(assetsData.data);
    if (overviewData) setOverview(overviewData.data);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to load");
  } finally {
    setIsLoading(false);
  }
}, [envId]);

useEffect(() => { loadEnvironment(); }, [loadEnvironment]);
```

**Problems:**
- 25 lines of boilerplate on every page that fetches data
- No caching — every mount refetches
- No deduplication — two components on the same page both fetch
- Single generic error — can't distinguish "env not found" from "assets failed"
- `.catch(() => null)` silently swallows errors
- Components import raw API functions, breaking the boundary between UI and network

### 2.2 The apiFetch Naming Collision

During refactoring, `client.ts` briefly had two exported `apiFetch` functions — one returning `ApiResponse<T>` and one returning `T`. The second shadowed the first and caused infinite recursion. This was caught and fixed by removing the duplicate.

### 2.3 Typos and Dead Code

While working on the API layer we fixed:
- `updateAseetPosition` → `updateAssetPosition`
- `NEXT_PUBLIC_API_URL` → `NEXT_PUBLIC_BACKEND_URL`
- Dead `import { env } from "process"` in multiple files
- SSE URL duplication (consolidated into `getSseUrl(path)`)

---

## 3. The Solution (After)

### 3.1 Three-Layer Architecture

```
┌─────────────────────────────────────────┐
│  Component                              │  ← JSX only. No fetch logic.
│  const { data, error } = useX()         │
└─────────────┬───────────────────────────┘
              │ imports from lib/hooks
┌─────────────▼───────────────────────────┐
│  Hook (lib/hooks/*.ts)                  │  ← React + TanStack Query only.
│  useQuery({ queryFn: () => service() }) │  ← NEVER imports from lib/api
└─────────────┬───────────────────────────┘
              │ imports from lib/services
┌─────────────▼───────────────────────────┐
│  Service (lib/services/*.ts)            │  ← Business logic + data shaping.
│  Calls apiFetch, unwraps .data,         │  ← NEVER imports React.
│  checks .success, returns {data,error}  │
└─────────────┬───────────────────────────┘
              │ imports from lib/api
┌─────────────▼───────────────────────────┐
│  API (lib/api/*.ts)                     │  ← HTTP only. Zero logic.
│  apiFetch<T>() → ApiResponse<T>         │  ← NEVER imports services/hooks.
└─────────────────────────────────────────┘
```

**Enforcement rules:**
- `lib/hooks/*.ts` imports from `lib/services/*.ts` **only**
- `lib/services/*.ts` imports from `lib/api/*.ts` **only**
- `lib/api/*.ts` imports from `lib/api/client.ts` **only**
- Components import from `lib/hooks/*.ts` and `lib/formatters.ts` **only**

### 3.2 Layer 1: API (lib/api/*.ts)

`apiFetch` returns the full `ApiResponse<T>` without throwing on business errors:

```ts
// lib/api/client.ts
export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const response = await fetch(url, { credentials: "include", ...options, headers });

  if (!response.ok) {
    // Only throw on HTTP errors (500, network down, timeout)
    throw new Error(extractedMessage);
  }

  const json: ApiResponse<T> = await response.json();

  // Business errors (success: false) are returned as-is.
  // The service layer decides what to do with them.
  return json;
}
```

**Why:** Transport errors (offline, 500) are exceptional — they throw. Business errors (not found, unauthorized) are expected — they return.

### 3.3 Layer 2: Service (lib/services/*.ts)

The service orchestrates multiple API calls, checks `.success` per call, and returns a predictable shape:

```ts
// lib/services/environmentService.ts
export async function getEnvironmentDetail(envId: string) {
  const [envRes, assetsRes, overviewRes] = await Promise.all([
    fetchEnvironmentById(envId),
    fetchAssets(envId),
    fetchDashboardOverview(envId),
  ]);

  return {
    environment: envRes.success
      ? { data: envRes.data, error: null }
      : { data: null, error: envRes.message },

    assets: assetsRes.success
      ? { data: assetsRes.data, error: null }
      : { data: [], error: assetsRes.message },

    overview: overviewRes.success
      ? { data: overviewRes.data, error: null }
      : { data: null, error: overviewRes.message },
  };
}
```

**What the service does:**
- Unwraps `.data` from `ApiResponse<T>`
- Checks `.success` and preserves `.message` as `error`
- Handles partial failures (one API call fails, others succeed)
- Returns a flat, predictable shape — no nested `ApiResponse` wrappers

**What the service does NOT do:**
- Import React
- Call `useQuery` or any hook
- Format UI strings or colors
- Handle loading states

### 3.4 Layer 3: Hook (lib/hooks/*.ts)

The hook is a thin wrapper around `useQuery` that calls the service:

```ts
// lib/hooks/useEnvironment.ts
import { useQuery } from "@tanstack/react-query";
import { getEnvironmentDetail } from "@/lib/services/environmentService";

export function useEnvironment(envId: string) {
  const query = useQuery({
    queryKey: ["environment", envId],
    queryFn: () => getEnvironmentDetail(envId),
    staleTime: 5 * 60 * 1000,
  });

  return {
    environment_data: query.data?.environment?.data,
    environment_error: query.data?.environment?.error,
    asset_data: query.data?.assets?.data,
    asset_error: query.data?.assets?.error,
    overview_data: query.data?.overview?.data,
    overview_error: query.data?.overview?.error,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
```

**What the hook does:**
- Calls the service inside `useQuery`
- Provides caching via `queryKey`
- Exposes `isLoading` and `refetch`
- Returns a flat, component-friendly API

**What the hook does NOT do:**
- Import from `lib/api/*`
- Unwrap `.data` (service already did that)
- Format UI strings

### 3.5 Layer 4: Component

The component consumes the hook and renders:

```tsx
// AFTER: app/environments/[envId]/dashboard/page.tsx
import { useEnvironment } from "@/lib/hooks/useEnvironment";

export default function EnvironmentDashboardPage() {
  const { envId } = useParams();
  const {
    environment_data,
    environment_error,
    asset_data,
    asset_error,
    overview_data,
    overview_error,
    isLoading,
    refetch,
  } = useEnvironment(envId as string);

  if (isLoading) return <Skeleton />;

  if (environment_error) {
    return <ErrorBanner message={environment_error} onRetry={refetch} />;
  }

  const environment = environment_data!;
  const assets = asset_data ?? [];
  const overview = overview_data ?? null;

  return (
    <div>
      {asset_error && <Toast>Assets unavailable: {asset_error}</Toast>}
      {overview_error && <Toast>Stats unavailable: {overview_error}</Toast>}
      <h1>{environment.name}</h1>
      <p>{assets.length} assets</p>
    </div>
  );
}
```

**What changed:**
| Before | After |
|--------|-------|
| 4 `useState` + `useCallback` + `useEffect` (~25 lines) | 1 `useEnvironment` call (~8 lines) |
| Manual `try/catch` | Per-field `*_error` from hook |
| Single generic error | Partial failure support |
| No caching | `useQuery` caching + deduplication |
| `loadEnvironment()` function | `refetch()` from hook |
| Direct API imports | Only hook import |

---

## 4. Naming Conventions

| Layer | File Pattern | Function Pattern | Example |
|-------|-------------|------------------|---------|
| API | `lib/api/nouns.ts` | `fetchNoun`, `createNoun`, `deleteNoun` | `fetchAssets`, `createEnvironment` |
| Service | `lib/services/nounService.ts` | `getNounDetail`, `loadNounData` | `getEnvironmentDetail`, `getSecurityOverview` |
| Hook | `lib/hooks/useNoun.ts` | `useNoun`, `useNounAction` | `useEnvironment`, `useSecurityBoard` |
| Formatter | `lib/formatters.ts` | `getNounLabel`, `getNounColor` | `getRiskLevel`, `getStatusColor` |

---

## 5. Error Handling Strategy

### 5.1 Two Kinds of Errors

| Type | Example | Where it lives | How component sees it |
|------|---------|---------------|----------------------|
| **Transport** | Network offline, 500, timeout | `useQuery` catches → `query.error` | `query.error instanceof Error` |
| **Business** | "Environment not found", "Unauthorized" | Backend returns `success: false` | `*_error` field from service |

### 5.2 Why We Don't Throw on `success === false`

If `apiFetch` threw on `success: false`, a single failing API call in a `Promise.all` would crash the entire service. With the return-as-is approach:
- `fetchEnvironmentById` can fail with "Not found"
- `fetchAssets` can still succeed
- The page shows the environment error but still renders the asset list

This is **partial failure tolerance** — the page degrades gracefully instead of showing a full error screen.

---

## 6. Trials and Errors

### 6.1 The `apiFetch` Naming Collision

While refactoring, `client.ts` accidentally had two `export async function apiFetch<T>` declarations. The second (returning `T` instead of `ApiResponse<T>`) shadowed the first and caused:
- Infinite recursion when calling `apiFetch`
- TypeScript confusion about which signature was active

**Fix:** Removed the duplicate. Only one `apiFetch<T>()` returning `ApiResponse<T>` remains.

### 6.2 The `.data` Access Problem

When we first changed API functions to return `ApiResponse<T>`, every component that previously received unwrapped data broke:
```ts
// Before: setAssets(await fetchAssets(envId))  // Asset[]
// After:  setAssets(await fetchAssets(envId))  // ApiResponse<Asset[]> — breaks!
```

**Fix:** Updated all call sites to access `.data`. Later, the service layer absorbed this so components never see `ApiResponse` again.

### 6.3 `.catch(() => null)` Silently Swallows Errors

In early drafts of `scanService.ts`:
```ts
const latest = await fetchLatestScan(envId).catch(() => null);
```

If the backend returned `"Scan service temporarily unavailable"`, the service saw `null` and the user saw "Run First Scan" instead of the error.

**Fix:** Removed `.catch(() => null)` from non-optional calls. Let `ApiResponse` flow through so `.success` and `.message` can be checked.

### 6.4 Dead Imports Keep Reappearing

`import { env } from "process"` was removed once but kept reappearing in new files during copy-paste. It never caused runtime errors but cluttered imports.

**Fix:** ESLint or a pre-commit check should catch unused imports. For now, manual cleanup during code review.

---

## 7. What Still Needs to Change

### 7.1 Services to Create

| Service | Status | Needed For |
|---------|--------|-----------|
| `environmentService.ts` | ✅ Done | Dashboard page |
| `scanService.ts` | ⚠️ Broken | Security page — doesn't unwrap `.data`, uses `.catch(() => null)`, dead imports |
| `workflowService.ts` | ❌ Commented out | Security page mutations — `changeWorkflowStatus`, `bulkChangeWorkflowStatus` |
| `assetService.ts` | ❌ Missing | Asset detail slide-over, add asset form |
| `devService.ts` | ❌ Missing | Dev mode page (mock vulnerabilities) |
| `aiService.ts` | ❌ Missing | AI chat panel, CVE explanation modal |

### 7.2 Hooks to Create / Fix

| Hook | Status | Needed For |
|------|--------|-----------|
| `useEnvironment.ts` | ✅ Done | Dashboard page |
| `useSecurityBoard.ts` | ❌ Broken | Security page — missing `updateVulnerabilityWorkflow` import, spreads `...overviewQuery` |
| `useAssetDetail.ts` | ❌ Missing | Asset detail slide-over |
| `useDevMode.ts` | ❌ Missing | Dev mode page |
| `useMapData.ts` | ❌ Missing | Map page — currently uses raw `useQuery` with API calls inline |

### 7.3 Pages to Migrate

| Page | Current State | Target |
|------|--------------|--------|
| `dashboard/page.tsx` | Manual `useState` + `useEffect` | Use `useEnvironment` |
| `security/page.tsx` | Manual fetching + local workflow map | Use `useSecurityBoard` |
| `map/page.tsx` | Inline `useQuery` with API calls | Use `useMapData` hook |
| `dev/page.tsx` | Manual fetching | Use `useDevMode` hook |
| `scans/[scanId]/page.tsx` | Manual fetching | Needs `useScanDetail` hook |
| `environments/page.tsx` (list) | Manual fetching | Needs `useEnvironments` hook |

### 7.4 Components to Migrate

| Component | Current | Target |
|-----------|---------|--------|
| `AddAssetSlideOver.tsx` | Direct API calls | Use `useCreateAsset` mutation hook |
| `AssetDetailsSlideOver.tsx` | Direct API calls | Use `useAssetDetail` + `useAssetVulnerabilities` |
| `ScanSettingsModal.tsx` | Direct API calls | Use `useScanSettings` query hook |
| `AIExplainModal.tsx` | Direct API call | Use `useCveExplanation` hook |
| `VulnDetailSlideOver.tsx` | Direct API calls | Use `useWorkflow` hook |
| `BoardView.tsx` | Direct API call for workflow creation | Use `useCreateWorkflow` mutation hook |

### 7.5 `lib/api/index.ts` Barrel Export

Currently exports everything including context hooks:
```ts
export * from "./client";
export * from "./auth";
// ...
export { useScan } from "../ScanContext";
export { useUser } from "../UserContext";
```

**Decision needed:** Should `lib/api/index.ts` continue to be the catch-all import, or should components import hooks from `lib/hooks/*` and contexts from `lib/ScanContext` directly?

**Recommendation:** Keep the barrel for API functions (used by services), but move hook exports to `lib/hooks/index.ts`. Components should import:
```ts
import { useEnvironment } from "@/lib/hooks/useEnvironment";  // Not from @/lib/api
```

---

## 8. Open Questions

1. **Should `useSecurityBoard` return grouped objects or flat `*_data` / `*_error` fields?**
   - Grouped: `{ environment: { data, error }, assets: { data, error } }` — cleaner but more nesting
   - Flat: `environment_data`, `environment_error` — more fields but flat access

2. **Should transport errors (network, 500) be surfaced separately from business errors?**
   - Current: transport errors live in `query.error`, business errors in `*_error`
   - Alternative: wrap transport errors into the service result so components only check one place

3. **Should the service layer retry failed calls automatically?**
   - TanStack Query handles retries for queries. Should services retry mutations?

4. **How do we handle the `scanCache` ref in `security/page.tsx`?**
   - Currently a `useRef<Map<string, LatestScan>>` for historical scan caching
   - This is client-side cache separate from TanStack Query's cache
   - Should this move into the hook layer, or stay in the component?

---

## 9. Related Documentation

- `backend/AGENTS.md` — Backend naming conventions (`Verb+Noun+Input`, `Public` prefix)
- `docs/2026-04-15-backend-refactoring-milestone-1.md` — Backend type centralization
- `docs/2026-03-25-dev-mode-implementation.md` — Dev mode feature
- `docs/2026-02-24.md` — SSE security implementation

---

*Next step: Fix `scanService.ts` and `useSecurityBoard.ts`, then migrate the Security page as the second proof-of-concept.*
