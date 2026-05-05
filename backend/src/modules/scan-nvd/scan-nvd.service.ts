import { VulnSeverity } from "@prisma/client";

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
                cvssMetricV31?: Array<{ cvssData: { baseScore: number; vectorString: string } }>;
                cvssMetricV30?: Array<{ cvssData: { baseScore: number; vectorString: string } }>;
                cvssMetricV2?: Array<{ cvssData: { baseScore: number; vectorString: string } }>;
            };
            published: string;
            lastModified: string;
        };
    }>;
}

const NVD_API_KEY = process.env.NVD_API_KEY || "";
const RATE_LIMIT_MS = NVD_API_KEY ? 600 : 6000;
const CACHE_TTL_MS = 30 * 60 * 1000;

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

function getCacheKey(cpeName: string, pubStartDate?: Date, pubEndDate?: Date): string {
    if (!pubStartDate && !pubEndDate) return cpeName;
    const start = pubStartDate ? pubStartDate.toISOString().split('T')[0] : 'beginning';
    const end = pubEndDate ? pubEndDate.toISOString().split('T')[0] : 'now';
    return `${cpeName}:${start}:${end}`;
}

function isCacheValid(cpeName: string, pubStartDate?: Date, pubEndDate?: Date): boolean {
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

function extractCvssData(metrics: NvdCveResponse["vulnerabilities"][0]["cve"]["metrics"]): { score: number | null; vector: string | null; severity: VulnSeverity } {
    if (!metrics) {
        return { score: null, vector: null, severity: "UNKNOWN" };
    }

    if (metrics.cvssMetricV31 && metrics.cvssMetricV31.length > 0) {
        const v31 = metrics.cvssMetricV31[0].cvssData;
        return { score: v31.baseScore, vector: v31.vectorString, severity: mapV2ScoreToSeverity(v31.baseScore) };
    }

    if (metrics.cvssMetricV30 && metrics.cvssMetricV30.length > 0) {
        const v30 = metrics.cvssMetricV30[0].cvssData;
        return { score: v30.baseScore, vector: v30.vectorString, severity: mapV2ScoreToSeverity(v30.baseScore) };
    }

    if (metrics.cvssMetricV2 && metrics.cvssMetricV2.length > 0) {
        const v2 = metrics.cvssMetricV2[0].cvssData;
        return { score: v2.baseScore, vector: v2.vectorString, severity: mapV2ScoreToSeverity(v2.baseScore) };
    }

    return { score: null, vector: null, severity: "UNKNOWN" };
}

const MAX_NVD_PAGES = 50;
const RESULTS_PER_PAGE = 100;

export async function fetchCvesForCpe(
    cpeName: string,
    pubStartDate?: Date,
    pubEndDate?: Date
): Promise<CveData[]> {
    const cacheKey = getCacheKey(cpeName, pubStartDate, pubEndDate);

    if (isCacheValid(cpeName, pubStartDate, pubEndDate)) {
        return cveCache.get(cacheKey)!.data;
    }

    const headers: Record<string, string> = { "content-type": "application/json" };
    if (NVD_API_KEY) headers["X-API-Key"] = NVD_API_KEY;

    const allCveData: CveData[] = [];
    let startIndex = 0;
    let totalResults = 0;
    let pagesFetched = 0;

    try {
        do {
            await enforceRateLimit();

            const url = new URL("https://services.nvd.nist.gov/rest/json/cves/2.0");
            url.searchParams.set("cpeName", cpeName);
            url.searchParams.set("resultsPerPage", String(RESULTS_PER_PAGE));
            url.searchParams.set("startIndex", String(startIndex));
            if (pubStartDate) url.searchParams.set("pubStartDate", pubStartDate.toISOString());
            if (pubEndDate)   url.searchParams.set("pubEndDate",   pubEndDate.toISOString());

            const response = await fetch(url.toString(), { headers });
            if (!response.ok) {
                throw new Error(`NVD API error: ${response.status} ${response.statusText}`);
            }

            const data: NvdCveResponse = await response.json();

            if (pagesFetched === 0) {
                totalResults = data.totalResults ?? 0;
                console.log(`[NVD] CPE ${cpeName}: ${totalResults} total CVEs`);
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
                    publishedDate:      cve.published    ? new Date(cve.published)    : null,
                    lastModifiedDate:   cve.lastModified ? new Date(cve.lastModified) : null,
                };
            });

            allCveData.push(...page);
            startIndex += RESULTS_PER_PAGE;
            pagesFetched++;

            if (page.length < RESULTS_PER_PAGE) break;

        } while (startIndex < totalResults && pagesFetched < MAX_NVD_PAGES);

        if (pagesFetched >= MAX_NVD_PAGES) {
            console.warn(`[NVD] CPE ${cpeName}: hit ${MAX_NVD_PAGES}-page safety cap (${allCveData.length}/${totalResults} CVEs fetched)`);
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
