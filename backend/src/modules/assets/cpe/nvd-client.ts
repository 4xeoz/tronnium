import axios from "axios";

export type ProgressCallback = (step: string, message: string) => void;

const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 6000;

export async function queryNvdApi(
  cpe: string,
  keyword: string,
  onProgress?: ProgressCallback
): Promise<any> {
  const cacheKey = `cpe:${cpe}|kw:${keyword}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[NVD API] Cache hit for: "${keyword || cpe}"`);
    onProgress?.("searching", `Cache hit for "${keyword || cpe}"`);
    return cached.data;
  }

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    const waitTime = MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
    console.log(`[NVD API] Rate limiting, waiting ${waitTime}ms...`);
    onProgress?.(
      "waiting",
      `Rate limit: waiting ${Math.ceil(waitTime / 1000)}s before next NVD query...`
    );
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }
  lastRequestTime = Date.now();

  let url: string;
  if (cpe) {
    url = `https://services.nvd.nist.gov/rest/json/cpes/2.0?cpeMatchString=${encodeURIComponent(cpe)}&resultsPerPage=10`;
  } else if (keyword) {
    url = `https://services.nvd.nist.gov/rest/json/cpes/2.0?keywordSearch=${encodeURIComponent(keyword)}&resultsPerPage=10`;
  } else {
    throw new Error("Either cpe or keyword must be provided to query NVD API.");
  }

  console.log(`[NVD API] Fetching: "${keyword || cpe}"`);
  onProgress?.("searching", `Querying NVD for "${keyword || cpe}"...`);
  const response = await axios.get(url);

  cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
  return response.data;
}
