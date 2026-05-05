import type { ParsedAsset, CpeProduct } from "../cpe.types";
import { parseAsset } from "./asset-parser";
import { queryNvdApi, type ProgressCallback } from "../nvd-client";

const GOOD_MATCH_THRESHOLD = 10;

async function search(keyword: string, onProgress?: ProgressCallback): Promise<{ results: CpeProduct[]; total: number }> {
  const data = await queryNvdApi("", keyword, onProgress);
  return {
    results: data.products || [],
    total: data.totalResults || 0,
  };
}

export async function progressiveSearch(
  parsedAsset: ParsedAsset,
  onProgress?: ProgressCallback
): Promise<CpeProduct[]> {
  const vendor = parsedAsset.vendor || "";
  const product = parsedAsset.product || "";
  const baseQuery = vendor === product ? vendor : `${vendor} ${product}`.trim();

  if (!baseQuery) {
    onProgress?.("searching", "No vendor/product extracted, searching NVD with raw input...");
    const { results } = await search(parsedAsset.raw, onProgress);
    return results;
  }

  onProgress?.("searching", `Searching NVD for "${baseQuery}"...`);
  const initial = await search(baseQuery, onProgress);

  if (initial.total <= GOOD_MATCH_THRESHOLD) {
    onProgress?.("searching", `Found ${initial.total} result${initial.total !== 1 ? "s" : ""} — good match`);
    return initial.results;
  }

  // Try narrowing with version first
  if (parsedAsset.version) {
    const versionQuery = `${baseQuery} ${parsedAsset.version}`;
    onProgress?.("narrowing", `Too many results (${initial.total}). Narrowing with version "${parsedAsset.version}"...`);
    const narrowed = await search(versionQuery, onProgress);

    if (narrowed.total === 0) {
      onProgress?.("searching", `Version too specific, using broader results (${initial.total})`);
      return initial.results;
    }

    if (narrowed.total <= GOOD_MATCH_THRESHOLD) {
      onProgress?.("searching", `Found ${narrowed.total} result${narrowed.total !== 1 ? "s" : ""} with version — good match`);
      return narrowed.results;
    }
  }

  if (parsedAsset.versionCandidates.length === 0) {
    return initial.results;
  }

  // Progressive narrowing with version candidates
  onProgress?.("narrowing", "Still too many results. Progressive narrowing with version candidates...");
  let current = initial.results;
  const queryParts = [baseQuery];

  for (const candidate of parsedAsset.versionCandidates) {
    queryParts.push(candidate);
    const query = queryParts.join(" ");
    onProgress?.("narrowing", `Trying narrower query: "${query}"...`);
    const narrowed = await search(query, onProgress);

    if (narrowed.total === 0) return current;

    current = narrowed.results;
    if (narrowed.total <= GOOD_MATCH_THRESHOLD) return current;
  }

  return current;
}

export async function findCpe(
  rawAssetName: string,
  onProgress?: ProgressCallback
): Promise<{ parsed: ParsedAsset; results: CpeProduct[] }> {
  onProgress?.("parsing", `Parsing "${rawAssetName}"...`);
  const parsed = await parseAsset(rawAssetName);
  onProgress?.(
    "parsing",
    `Parsed — vendor: "${parsed.vendor || "?"}", product: "${parsed.product || "?"}", version: "${parsed.version || "none"}"`
  );
  const results = await progressiveSearch(parsed, onProgress);
  return { parsed, results };
}
