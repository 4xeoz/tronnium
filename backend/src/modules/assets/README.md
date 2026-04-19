# assets

Manages IT/OT assets within security environments and provides CPE (Common Platform Enumeration) discovery.

## Purpose

Two main capabilities:
- **Asset CRUD & vulnerability lookup** — Create, read, update, delete assets. Retrieve vulnerability scan results for a specific asset.
- **CPE Discovery Pipeline** — Takes a raw asset name (e.g. `"OpenSSL 1.1.1"`), queries the NVD API, and returns the best-matching CPE entries using NLP-style parsing, progressive search, and fuzzy ranking.

## Files

### Root level

| File | Role |
|------|------|
| `asset.routes.ts` | Express router. Defines all HTTP endpoints (CPE find/validate + Asset CRUD + vulnerability lookup). |
| `asset.controller.ts` | Handlers for asset CRUD: `getAssetsHandler`, `createAssetHandler`, `deleteAssetHandler`, `updateAssetHandler`. |
| `asset-vulnerability.controller.ts` | Handler `getAssetVulnerabilitiesHandler`. Fetches the latest completed scan for an asset and returns sorted vulnerabilities. |
| `asset-helpers.ts` | Defines `CpeCandidate` interface and `toCpeCandidate()` mapper from Prisma `AssetCpe` rows to the frontend DTO. |

### `cpe/` subdirectory

| File | Role |
|------|------|
| `index.ts` | Barrel file. Re-exports the public CPE API. |
| `asset-parser.ts` | **Phase 1 — Asset Parsing**. Extracts `vendor`, `product`, `version`, `tokens`, `versionCandidates` from raw text. |
| `cpe-search.ts` | **Phase 2 — Progressive NVD Search**. Broad → narrow by version. Stops when results ≤ 10. |
| `nvd-client.ts` | Low-level NVD API client with 6s rate limiter, 5-min cache, `cpeMatchString` and `keywordSearch` modes. |
| `cpe-ranking.service.ts` | **Phases 3–5 — Scoring & Ranking**. Scores each CPE candidate using vendor (25%), product (35%), version (25%), token overlap (15%). |
| `cpe-ranking.service.test.ts` | Standalone manual test script (not Jest). Run via `npx ts-node`. |
| `cpe-validator.ts` | CPE string validation and builder. `parseCpe()`, `validateCpe()`, `buildCpe()`. |
| `cpe.controller.ts` | Handlers for CPE endpoints: `cpeFindHandler` (SSE streaming) and `cpeValidateHandler`. |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cpe/find` | SSE stream. Parse → Search NVD → Rank candidates |
| `POST` | `/cpe/validate` | Validate a CPE string (format + NVD existence) |
| `GET` | `/:environmentId` | List all assets in environment |
| `POST` | `/:environmentId` | Create asset with CPEs |
| `PUT` | `/:environmentId/:assetId` | Update asset |
| `DELETE` | `/:environmentId/:assetId` | Delete asset |
| `GET` | `/:environmentId/:assetId/vulnerabilities` | Get vulnerabilities for asset from latest scan |

## How it links together

### CPE Discovery Pipeline

```
cpe.controller.ts:cpeFindHandler
  → cpe.findCpe(rawAssetName, onProgress)     [cpe/index.ts]
      → cpe-search.ts:findCpe()
          → asset-parser.ts:parseAsset()        (Phase 1: NLP parse)
          → cpe-search.ts:progressiveSearch()
              → nvd-client.ts:queryNvdApi()     (Phase 2: NVD queries)
  → cpe-ranking.service.ts:rankCpeCandidates()  (Phases 3-5: Score & rank)
```

### Asset CRUD

```
asset.controller.ts
  → verifyEnvironment() (from ../environments)
  → toCpeCandidate() (from ./asset-helpers)
  → prisma.asset.* (relational CPE storage via AssetCpe model)
```

## Key concepts

### Asset model

An **Asset** represents infrastructure (server, PLC, router, software) inside an **Environment**. Assets have:
- Core fields: `name`, `description`, `type`, `domain`, `status`, `location`, `ipAddress`, `manufacturer`, `model`, `serialNumber`, `x`, `y`
- CPE links: stored relationally in `AssetCpe` table (migrated from JSON)

### CPE Discovery Pipeline (5 phases)

1. **Parse**: `asset-parser.ts` normalizes text, extracts vendor/product/version using regex and known-vendor whitelist.
2. **Search**: `cpe-search.ts` performs progressive NVD search — broad → narrow by version → narrow by version candidates.
3. **Deconstruct**: `cpe-ranking.service.ts` splits CPE 2.3 string into 13 colon-separated components.
4. **Score**: Four dimensions:
   - **Vendor**: exact (1.0), substring (0.7), Levenshtein≤2 (0.5), wildcard (0.3)
   - **Product**: max of Jaccard token similarity and Levenshtein ratio
   - **Version**: exact (1.0), major.minor.patch (0.95), major.minor (0.8), major only (0.5), year closeness (0.6), wildcard (0.3)
   - **Token Overlap**: Jaccard similarity
5. **Rank**: Weighted sum (25/35/25/15) → percentage → return top N (default 5, max 20)

### SSE Streaming (`cpeFindHandler`)

`GET /cpe/find` uses Server-Sent Events to stream progress (`parsing` → `searching` → `narrowing` → `ranking` → `completed`) because NVD API calls are slow and rate-limited.
