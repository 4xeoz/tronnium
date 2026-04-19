import type { ParsedAsset, CpeProduct } from "../../../types/cpe.types";
import { parseAsset } from "./asset-parser";
import { queryNvdApi, type ProgressCallback } from "./nvd-client";

export async function progressiveSearch(
  parsedAsset: ParsedAsset,
  onProgress?: ProgressCallback
): Promise<CpeProduct[]> {
  const vendor = parsedAsset.vendor || "";
  const product = parsedAsset.product || "";
  const version = parsedAsset.version;

  const baseQuery =
    vendor === product ? vendor : `${vendor} ${product}`.trim();

  if (!baseQuery) {
    console.log(`[Progressive Search] No vendor/product extracted, using raw input`);
    onProgress?.("searching", `No vendor/product extracted, searching NVD with raw input...`);
    return (await queryNvdApi("", parsedAsset.raw, onProgress)).products || [];
  }

  console.log(`[Progressive Search] Starting with base query: "${baseQuery}"`);
  onProgress?.("searching", `Searching NVD for "${baseQuery}"...`);
  const search1Data = await queryNvdApi("", baseQuery, onProgress);
  const search1Results: CpeProduct[] = search1Data.products || [];
  const search1Total = search1Data.totalResults || 0;
  console.log(`[Progressive Search] Initial search found ${search1Total} results`);

  if (search1Total <= 10) {
    console.log(`[Progressive Search] <= 10 results, returning initial results`);
    onProgress?.(
      "searching",
      `Found ${search1Total} result${search1Total !== 1 ? "s" : ""} — good match`
    );
    return search1Total >= 1 ? search1Results : [];
  }

  if (version) {
    const versionQuery = `${baseQuery} ${version}`;
    console.log(`[Progressive Search] Trying with version: "${versionQuery}"`);
    onProgress?.(
      "narrowing",
      `Too many results (${search1Total}). Narrowing with version "${version}"...`
    );
    const versionData = await queryNvdApi("", versionQuery, onProgress);
    const versionResults: CpeProduct[] = versionData.products || [];
    const versionTotal = versionData.totalResults || 0;
    console.log(`[Progressive Search] Version query returned ${versionTotal} results`);

    if (versionTotal >= 1 && versionTotal <= 10) {
      console.log(`[Progressive Search] Good match with version!`);
      onProgress?.(
        "searching",
        `Found ${versionTotal} result${versionTotal !== 1 ? "s" : ""} with version — good match`
      );
      return versionResults;
    }

    if (versionTotal === 0) {
      console.log(`[Progressive Search] Version too specific, returning base results`);
      onProgress?.("searching", `Version too specific, using broader results (${search1Total})`);
      return search1Results;
    }
  }

  if (parsedAsset.versionCandidates.length === 0) {
    console.log(`[Progressive Search] No version candidates, returning initial results`);
    return search1Results;
  }

  console.log(
    `[Progressive Search] Too many results (${search1Total}), narrowing with candidates: ${parsedAsset.versionCandidates.join(", ")}`
  );
  onProgress?.("narrowing", `Still too many results. Progressive narrowing with version candidates...`);
  let currentResults: CpeProduct[] = search1Results;
  const queryParts: string[] = [baseQuery];

  for (const candidate of parsedAsset.versionCandidates) {
    queryParts.push(candidate);
    const query = queryParts.join(" ");
    console.log(`[Progressive Search] Trying query: "${query}"`);
    onProgress?.("narrowing", `Trying narrower query: "${query}"...`);
    const searchNData = await queryNvdApi("", query, onProgress);
    const searchNResults: CpeProduct[] = searchNData.products || [];
    const searchNTotal = searchNData.totalResults || 0;
    console.log(`[Progressive Search] Query "${query}" returned ${searchNTotal} results`);

    if (searchNTotal === 0) {
      console.log(`[Progressive Search] No results, returning previous set`);
      return currentResults;
    }

    currentResults = searchNResults;
    if (searchNTotal <= 10) {
      console.log(`[Progressive Search] Found <= 10 results, done!`);
      return currentResults;
    }
  }

  console.log(`[Progressive Search] Exhausted candidates, returning best results`);
  return currentResults;
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
