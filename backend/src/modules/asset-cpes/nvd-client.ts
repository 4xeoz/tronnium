import axios from "axios";
import type { NvdCpeResponse } from "./cpe.types";

export type ProgressCallback = (step: string, message: string) => void;

const CACHE_TTL_MS = 5 * 60 * 1000;
const MIN_REQUEST_INTERVAL_MS = 6000;
const REQUEST_TIMEOUT_MS = 15000;

const cache = new Map<string, { data: NvdCpeResponse; timestamp: number }>();
let lastRequestTime = 0;

function evictExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now - entry.timestamp >= CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

export async function queryNvdApi(
  cpe: string,
  keyword: string,
  onProgress?: ProgressCallback,
  resultsPerPage = 10
): Promise<NvdCpeResponse> {
  evictExpiredCache();

  const cacheKey = `cpe:${cpe}|kw:${keyword}|n:${resultsPerPage}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    onProgress?.("searching", `Cache hit for "${keyword || cpe}"`);
    return cached.data;
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    onProgress?.(
      "waiting",
      `Rate limit: waiting ${Math.ceil(waitTime / 1000)}s before next NVD query...`
    );
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();

  let url: string;
  if (cpe) {
    url = `https://services.nvd.nist.gov/rest/json/cpes/2.0?cpeMatchString=${encodeURIComponent(cpe)}&resultsPerPage=${resultsPerPage}`;
  } else if (keyword) {
    url = `https://services.nvd.nist.gov/rest/json/cpes/2.0?keywordSearch=${encodeURIComponent(keyword)}&resultsPerPage=${resultsPerPage}`;
  } else {
    throw new Error("Either cpe or keyword must be provided to query NVD API.");
  }

  onProgress?.("searching", `Querying NVD for "${keyword || cpe}"...`);
  const response = await axios.get<NvdCpeResponse>(url, { timeout: REQUEST_TIMEOUT_MS });

  cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  return response.data;
}
