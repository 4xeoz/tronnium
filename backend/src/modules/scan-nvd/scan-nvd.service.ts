import { VulnSeverity } from "@prisma/client";
import { ScanProgress } from "../scan-core/scan.types";

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
    totalResults: number;
    resultsPerPage: number;
    startIndex: number;
    vulnerabilities: Array<{
        cve: {
            id: string;
            descriptions: Array<{ value: string }>;
            metrics?: {
                cvssMetricV31?: Array<{
                    cvssData: { baseScore: number; vectorString: string };
                }>;
                cvssMetricV30?: Array<{
                    cvssData: { baseScore: number; vectorString: string };
                }>;
                cvssMetricV2?: Array<{
                    cvssData: { baseScore: number; vectorString: string };
                }>;
            };
            published: string;
            lastModified: string;
        };
    }>;
}

const NVD_API_KEY = process.env.NVD_API_KEY || "";
const RATE_LIMIT_MS = 6000;
const CACHE_TTL_MS = 30 * 60 * 1000;

export const MAX_SCAN_LOOKBACK_YEARS = 5;

let lastRequestTime = 0;
const cveCache = new Map<string, { data: CveData[]; timestamp: number }>();

async function enforceRateLimit(): Promise<void> {
    const timeSinceLastRequest = Date.now() - lastRequestTime;
    if (timeSinceLastRequest < RATE_LIMIT_MS) {
        const waitTime = RATE_LIMIT_MS - timeSinceLastRequest;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    lastRequestTime = Date.now();
}

function getCacheKey(
    cpeName: string,
    pubStartDate?: Date,
    pubEndDate?: Date,
): string {
    if (!pubStartDate && !pubEndDate) return cpeName;
    const start = pubStartDate
        ? pubStartDate.toISOString().split("T")[0]
        : "beginning";
    const end = pubEndDate ? pubEndDate.toISOString().split("T")[0] : "now";
    return `${cpeName}:${start}:${end}`;
}

function isCacheValid(
    cpeName: string,
    pubStartDate?: Date,
    pubEndDate?: Date,
): boolean {
    const cacheKey = getCacheKey(cpeName, pubStartDate, pubEndDate);
    const cached = cveCache.get(cacheKey);
    if (!cached) return false;
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

function extractCvssData(
    metrics: NvdCveResponse["vulnerabilities"][0]["cve"]["metrics"],
): { score: number | null; vector: string | null; severity: VulnSeverity } {
    if (!metrics) {
        return { score: null, vector: null, severity: "UNKNOWN" };
    }

    if (metrics.cvssMetricV31 && metrics.cvssMetricV31.length > 0) {
        const v31 = metrics.cvssMetricV31[0].cvssData;
        return {
            score: v31.baseScore,
            vector: v31.vectorString,
            severity: mapV2ScoreToSeverity(v31.baseScore),
        };
    }

    if (metrics.cvssMetricV30 && metrics.cvssMetricV30.length > 0) {
        const v30 = metrics.cvssMetricV30[0].cvssData;
        return {
            score: v30.baseScore,
            vector: v30.vectorString,
            severity: mapV2ScoreToSeverity(v30.baseScore),
        };
    }

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

const MAX_NVD_PAGES = 50;
const RESULTS_PER_PAGE = 100;
const MAX_WINDOW_DAYS = 119;

export async function fetchCvesForCpe(
    cpeName: string,
    pubStartDate?: Date,
    pubEndDate?: Date,
    onProgress?: (progress: ScanProgress) => void,
): Promise<CveData[]> {
    const cacheKey = getCacheKey(cpeName, pubStartDate, pubEndDate);

    if (isCacheValid(cpeName, pubStartDate, pubEndDate)) {
        return cveCache.get(cacheKey)!.data;
    }

    const headers: Record<string, string> = {
        "content-type": "application/json",
    };
    if (NVD_API_KEY) headers["X-API-Key"] = NVD_API_KEY;

    // Build 119-day windows covering the full requested range
    const windowMs = MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const rangeStart = pubStartDate ?? getMaxLookbackDate();
    const rangeEnd = pubEndDate ?? new Date();

    const windows: { start: Date; end: Date }[] = [];
    let cursor = rangeStart;
    while (cursor < rangeEnd) {
        const windowEnd = new Date(
            Math.min(cursor.getTime() + windowMs, rangeEnd.getTime()),
        );
        windows.push({ start: new Date(cursor), end: windowEnd });
        cursor = new Date(windowEnd.getTime() + 1);
    }

    const seenIds = new Set<string>();
    const allCveData: CveData[] = [];

    try {
        for (const window of windows) {
            let startIndex = 0;
            let totalResults = 0;
            let pagesFetched = 0;

            do {
                await enforceRateLimit();

                const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
                url.searchParams.set("virtualMatchString", cpeName);
                url.searchParams.set("resultsPerPage", String(RESULTS_PER_PAGE));
                url.searchParams.set("startIndex", String(startIndex));
                url.searchParams.set("pubStartDate", window.start.toISOString());
                url.searchParams.set("pubEndDate", window.end.toISOString());

                let response: Response | null = null;
                const MAX_RETRIES = 3;
                for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                    response = await fetch(url.toString(), { headers });

                    if (response.status === 429) {
                        const retryAfter = response.headers.get("Retry-After");
                        const waitMs = Math.max(retryAfter ? parseInt(retryAfter) * 1000 : 30_000, 3_000);
                        console.warn(
                            `[NVD] Rate limited. Waiting ${waitMs / 1000}s before retry (attempt ${attempt + 1}/${MAX_RETRIES})`,
                        );
                        onProgress?.({stage: "info", message: `Rate limited by NVD API. Retrying in ${waitMs / 1000} seconds...`});
                        await new Promise((resolve) => setTimeout(resolve, waitMs));
                        continue;
                    }

                    break;
                }

                if (!response || response.status === 429) {
                    throw new Error(
                        `NVD API error: rate limited after ${MAX_RETRIES} retries`,
                    );
                }

                if (response.status === 404) {
                    break;
                }

                if (!response.ok) {
                    throw new Error(
                        `NVD API error: ${response.status} ${response.statusText}`,
                    );
                }

                const data: NvdCveResponse = await response.json();

                if (pagesFetched === 0) {
                    totalResults = data.totalResults ?? 0;
                    const windowLabel = `${window.start.toISOString().split("T")[0]} → ${window.end.toISOString().split("T")[0]}`;
                    console.log(`[NVD] CPE ${cpeName} [${windowLabel}]: ${totalResults} CVEs`);
                    onProgress?.({stage: "info", message: `Found ${totalResults} CVEs for CPE ${cpeName} in date range ${windowLabel}`});

                }

                const page: CveData[] = (data.vulnerabilities || []).map((vuln) => {
                    const cve = vuln.cve;
                    const { score, vector, severity } = extractCvssData(cve.metrics);
                    return {
                        cveId: cve.id,
                        description: cve.descriptions[0]?.value ?? "No description",
                        cvssScore: score,
                        cvssVector: vector,
                        severity,
                        publishedDate: cve.published ? new Date(cve.published) : null,
                        lastModifiedDate: cve.lastModified
                            ? new Date(cve.lastModified)
                            : null,
                    };
                });

                for (const cve of page) {
                    if (!seenIds.has(cve.cveId)) {
                        seenIds.add(cve.cveId);
                        allCveData.push(cve);
                    }
                }

                startIndex += RESULTS_PER_PAGE;
                pagesFetched++;

                if (page.length < RESULTS_PER_PAGE) break;
            } while (startIndex < totalResults && pagesFetched < MAX_NVD_PAGES);
        }

        cveCache.set(cacheKey, { data: allCveData, timestamp: Date.now() });
        return allCveData;
    } catch (error) {
        console.error(`[NVD] Error fetching CVEs for CPE ${cpeName}:`, error);
        throw error;
    }
}

export function clearCveCache(cpeName?: string): void {
    if (cpeName) {
        for (const key of cveCache.keys()) {
            if (key.startsWith(cpeName)) {
                cveCache.delete(key);
            }
        }
    } else {
        cveCache.clear();
    }
}

export function getMaxLookbackDate(): Date {
    const date = new Date();
    date.setFullYear(date.getFullYear() - MAX_SCAN_LOOKBACK_YEARS);
    return date;
}

export function isValidLookbackDate(date: Date): boolean {
    const maxLookback = getMaxLookbackDate();
    return date >= maxLookback && date <= new Date();
}
