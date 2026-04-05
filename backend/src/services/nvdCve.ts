import { VulnSeverity } from "@prisma/client";
import { cpe } from "./cpe";
import { NvdCpeResponse } from "../types/cpe.types";



interface CveData {
    cveId: string;
    description: string;
    cvssScore: number | null;
    cvssVector: string | null;
    severity: VulnSeverity;
    publishedDate: Date | null;
    lastModifiedDate: Date | null;
}

interface NvdCveResponse {
    vulnerabilities: Array<{
        cve: {
            id: string;
            descriptions: Array<{ value: string }>;
            metrics?: {
                cvssMetricV31?: Array<{ cvssData: { baseScore: number; vectorString: string } }>;
                cvssMetricV30?: Array<{ cvssData: { baseScore: number; vectorString: string } }>;
                cvssMetricV2?: Array<{ cvssData: { baseScore: number; vectorString: string } }>;
            };
            published: string;
            lastModified: string;
        };
    }>;
}





// Ratelimiting and cash configurations
const NVD_API_KEY = process.env.NVD_API_KEY || "";
const RATE_LIMIT_MS = NVD_API_KEY ? 600 : 6000; 
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Maximum scan lookback period (5 years)
export const MAX_SCAN_LOOKBACK_YEARS = 5;

let lastRequestTime = 0;
const cveCache = new Map<string, { data: CveData[], timestamp: number }>();

async function enforceRateLimit(): Promise<void> {
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
        const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
}

// Generate cache key including date range
function getCacheKey(cpeName: string, pubStartDate?: Date, pubEndDate?: Date): string {
    if (!pubStartDate && !pubEndDate) return cpeName;
    const start = pubStartDate ? pubStartDate.toISOString().split('T')[0] : 'beginning';
    const end = pubEndDate ? pubEndDate.toISOString().split('T')[0] : 'now';
    return `${cpeName}:${start}:${end}`;
}

// check if the cach is still valid
function isCacheValid(cpeName: string, pubStartDate?: Date, pubEndDate?: Date): boolean {
    const cacheKey = getCacheKey(cpeName, pubStartDate, pubEndDate);
    const cached = cveCache.get(cacheKey);
    if(!cached) return false;
    const age = Date.now() - cached.timestamp;
    return age < CACHE_TTL_MS;

}

function mapV2ScoreToSeverity(score: number): VulnSeverity {
    if (score >= 9.0) return "CRITICAL";
    if (score >= 7.0) return "HIGH";
    if (score >= 4.0) return "MEDIUM";
    if (score > 0) return "LOW";
    return "UNKNOWN";
}

// extract relevant CVSS score and vector withe priority to v3,1 then v3.0, then v2.0
function extractCvssData(metrics: NvdCveResponse["vulnerabilities"][0]["cve"]["metrics"]): { score: number | null; vector: string | null; severity: VulnSeverity } {
    if (!metrics) {
        return { score: null, vector: null, severity: "UNKNOWN" };
    }

    // priority to CVSS v3.1
    if (metrics.cvssMetricV31 && metrics.cvssMetricV31.length > 0) {
        const v31 = metrics.cvssMetricV31[0].cvssData;
        return {
            score: v31.baseScore,
            vector: v31.vectorString,
            severity: mapV2ScoreToSeverity(v31.baseScore),
        };
    }

    // fallback to CVSS v3.0
    if (metrics.cvssMetricV30 && metrics.cvssMetricV30.length > 0) {
        const v30 = metrics.cvssMetricV30[0].cvssData;
        return {
            score: v30.baseScore,
            vector: v30.vectorString,
            severity: mapV2ScoreToSeverity(v30.baseScore),
        };
    }

    // fallback to CVSS v2.0
    if (metrics.cvssMetricV2 && metrics.cvssMetricV2.length > 0) {
        const v2 = metrics.cvssMetricV2[0].cvssData;
        return {
            score: v2.baseScore,
            vector: v2.vectorString,
            severity: mapV2ScoreToSeverity(v2.baseScore),
        };
    }

    return { score: null, vector: null, severity: "UNKNOWN" };
}


function mapCvssV3ToSeverity(score: number): VulnSeverity {
  if (score >= 9.0) return "CRITICAL";
  if (score >= 7.0) return "HIGH";
  if (score >= 4.0) return "MEDIUM";
  if (score > 0) return "LOW";
  return "NONE";
}

/**
 * Fetch CVE data from NVD for a given CPE name
 * Rate-limited and cached (mirrors cpe.ts pattern)
 * 
 * @param cpeName - The CPE name to search for
 * @param pubStartDate - Optional: Only return CVEs published on or after this date
 * @param pubEndDate - Optional: Only return CVEs published on or before this date
 */
export async function fetchCvesFroCpe(
    cpeName: string, 
    pubStartDate?: Date, 
    pubEndDate?: Date
): Promise<CveData[]> {
    const cacheKey = getCacheKey(cpeName, pubStartDate, pubEndDate);
    
    // check cache first
    if (isCacheValid(cpeName, pubStartDate, pubEndDate)) {
        return cveCache.get(cacheKey)!.data;
    }

    // enforce rate limit
    await enforceRateLimit();

    try { 
        const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
        url.searchParams.set("cpeName", cpeName);
        url.searchParams.set("resultsPerPage", "100");

        // Add date filters if provided
        if (pubStartDate) {
            url.searchParams.set("pubStartDate", pubStartDate.toISOString());
        }
        if (pubEndDate) {
            url.searchParams.set("pubEndDate", pubEndDate.toISOString());
        }

        const headers: Record<string, string> = {
            "content-type": "application/json",
        };

        if (NVD_API_KEY) {
            headers["X-API-Key"] = NVD_API_KEY;
        }

        const response = await fetch(url.toString(), { headers});

        if (!response.ok) {
            throw new Error(`NVD API error: ${response.status} ${response.statusText}`);
        }

        const data: NvdCveResponse = await response.json();

        // prase and map CVE data
        const cveData : CveData[] = (data.vulnerabilities || []).map((vuln) => {
            const cve = vuln.cve;
            const { score, vector, severity } = extractCvssData(cve.metrics);

            return {
                cveId: cve.id,
                description: cve.descriptions.length > 0 ? cve.descriptions[0].value : "No description",
                cvssScore: score,
                cvssVector: vector,
                severity,
                publishedDate: cve.published ? new Date(cve.published) : null,
                lastModifiedDate: cve.lastModified ? new Date(cve.lastModified) : null,
             };
        });
        
        // cache the result
        cveCache.set(cacheKey, { data: cveData, timestamp: Date.now() });

        return cveData;
    } catch (error) {
        console.error(`Error fetching CVEs for CPE ${cpeName}:`, error);
        throw error;
    }
}

export function clearCveCache(cpeName?: string): void {
    if (cpeName) {
        // Clear all cache entries that start with this CPE name
        for (const key of cveCache.keys()) {
            if (key.startsWith(cpeName)) {
                cveCache.delete(key);
            }
        }
    } else {
        cveCache.clear();
    }
}

/**
 * Get the maximum allowed lookback date (5 years ago)
 */
export function getMaxLookbackDate(): Date {
    const date = new Date();
    date.setFullYear(date.getFullYear() - MAX_SCAN_LOOKBACK_YEARS);
    return date;
}

/**
 * Validate if a date is within the allowed lookback period
 */
export function isValidLookbackDate(date: Date): boolean {
    const maxLookback = getMaxLookbackDate();
    return date >= maxLookback && date <= new Date();
}