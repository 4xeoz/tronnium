import axios from "axios";

const EPSS_API = "https://api.first.org/data/v1/epss ";
const BATCH_SIZE = 30;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — EPSS updates daily

export interface EpssResult {
  cveId:      string;
  epssScore:  number; // 0–1 probability of exploitation in 30 days
  percentile: number; // 0–1 relative rank across all CVEs
}

// Priority quadrant based on CVSS + EPSS percentile
export type EpssPriority = "IMMEDIATE" | "SCHEDULE" | "MONITOR" | "BACKLOG";

export function getEpssPriority(cvssScore: number | null, epssPercentile: number | null): EpssPriority {
  const highCvss = (cvssScore ?? 0) >= 7.0;
  const highEpss = (epssPercentile ?? 0) >= 0.5;

  if (highCvss && highEpss)  return "IMMEDIATE";
  if (highCvss && !highEpss) return "SCHEDULE";
  if (!highCvss && highEpss) return "MONITOR";
  return "BACKLOG";
}

const cache = new Map<string, { result: EpssResult; ts: number }>();

export async function fetchEpssForCves(
  cveIds: string[]
): Promise<Map<string, EpssResult>> {
  const results = new Map<string, EpssResult>();
  const toFetch: string[] = [];

  for (const cveId of cveIds) {
    const cached = cache.get(cveId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      results.set(cveId, cached.result);
    } else {
      toFetch.push(cveId);
    }
  }

  if (toFetch.length === 0) return results;

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const batch = toFetch.slice(i, i + BATCH_SIZE);
    try {
      const response = await axios.get(EPSS_API, {
        params: { cve: batch.join(",") },
        timeout: 10000,
      });

      for (const item of response.data?.data ?? []) {
        const result: EpssResult = {
          cveId:      item.cve,
          epssScore:  parseFloat(item.epss)       || 0,
          percentile: parseFloat(item.percentile) || 0,
        };
        results.set(item.cve, result);
        cache.set(item.cve, { result, ts: Date.now() });
      }
    } catch (error) {
      // EPSS is optional enrichment — never fail the scan
      console.error(`[EPSS] Batch fetch failed (index ${i}):`, error);
    }
  }

  return results;
}