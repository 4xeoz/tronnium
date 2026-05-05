// CPE Ranking Engine — Phase 3-5 of the CPE Discovery Pipeline
// Input: ParsedAsset + CpeProduct[]  →  Output: Ranked CpeCandidate[]

import type {
    ParsedAsset,
    CpeDetails,
    CpeProduct,
    DeconstructedCpe,
    ScoreBreakdown,
    CpeCandidate,
} from '../cpe.types';
import type { ProgressCallback } from '../nvd-client';

// Re-export types for consumers
export type { ParsedAsset, CpeProduct, CpeCandidate, ScoreBreakdown, DeconstructedCpe };

// Scoring weights (vendor + product + version + token overlap = 100%)
const WEIGHTS = {
    VENDOR: 0.25,       // 25% - Vendor match importance
    PRODUCT: 0.35,      // 35% - Product match importance (most important)
    VERSION: 0.25,      // 25% - Version match importance
    TOKEN_OVERLAP: 0.15 // 15% - Overall token similarity
};

/**
 * Parse a CPE 2.3 name into its component parts
 * CPE 2.3 Format: cpe:2.3:<part>:<vendor>:<product>:<version>:<update>:<edition>:<language>:<sw_edition>:<target_sw>:<target_hw>:<other>
 */
function deconstructCpe(cpeName: string): DeconstructedCpe {
    const parts = cpeName.split(':');

    if (parts.length < 5) {
        return {
            raw: cpeName,
            part: '',
            vendor: '',
            product: '',
            version: '*',
            update: '*',
            edition: '*',
            language: '*',
            swEdition: '*',
            targetSw: '*',
            targetHw: '*',
            other: '*',
            tokens: []
        };
    }

    const vendor = parts[3] || '*';
    const product = parts[4] || '*';
    const version = parts[5] || '*';

    const tokens: string[] = [];

    if (vendor !== '*') {
        const vendorTokens = vendor.replace(/[_-]/g, ' ').split(' ').filter(t => t.length > 0);
        tokens.push(...vendorTokens);
    }

    if (product !== '*') {
        const productTokens = product.replace(/[_-]/g, ' ').split(' ').filter(t => t.length > 0);
        tokens.push(...productTokens);
    }

    if (version !== '*') {
        const versionTokens = version.replace(/[._-]/g, ' ').split(' ').filter(t => t.length > 0);
        tokens.push(...versionTokens);
    }

    return {
        raw: cpeName,
        part: parts[2] || '',
        vendor: vendor,
        product: product,
        version: version,
        update: parts[6] || '*',
        edition: parts[7] || '*',
        language: parts[8] || '*',
        swEdition: parts[9] || '*',
        targetSw: parts[10] || '*',
        targetHw: parts[11] || '*',
        other: parts[12] || '*',
        tokens: tokens.map(t => t.toLowerCase())
    };
}


/**
 * Score vendor match between asset and CPE
 * Returns 0-1 score
 */
function scoreVendor(assetVendor: string | null, cpeVendor: string): number {
    if (!assetVendor) {
        return 0.0;
    }

    if (cpeVendor === '*') {
        return 0.3;
    }

    const assetLower = assetVendor.toLowerCase();
    const cpeLower = cpeVendor.toLowerCase();

    if (assetLower === cpeLower) {
        return 1.0;
    }

    if (assetLower.includes(cpeLower) || cpeLower.includes(assetLower)) {
        return 0.7;
    }

    const distance = levenshteinDistance(assetLower, cpeLower);
    if (distance <= 2) {
        return 0.5;
    }

    return 0.0;
}


/**
 * Tokenize a string for comparison
 */
function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/[_-]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 0);
}

/**
 * Score product match using max of Jaccard and Levenshtein methods
 * Returns 0-1 score
 */
function scoreProduct(assetProduct: string | null, cpeProduct: string): number {
    if (!assetProduct) {
        return 0.0;
    }

    if (cpeProduct === '*') {
        return 0.2;
    }

    const assetTokens = new Set(tokenize(assetProduct));
    const cpeTokens = new Set(tokenize(cpeProduct));
    const jaccardScore = jaccardSimilarity(assetTokens, cpeTokens);

    const assetLower = assetProduct.toLowerCase();
    const cpeLower = cpeProduct.toLowerCase().replace(/_/g, ' ');
    const levRatio = levenshteinRatio(assetLower, cpeLower);

    return Math.max(jaccardScore, levRatio);
}


/**
 * Parse a version string into components
 */
function parseVersion(version: string): { major: string; minor: string; patch: string; suffix: string } {
    let cleaned = version.replace(/^[vV]/, '');

    const parts = cleaned.split('.');

    let patch = '';
    let suffix = '';

    if (parts.length >= 3) {
        const lastPart = parts[2];
        const match = lastPart.match(/^(\d*)(.*)$/);
        if (match) {
            patch = match[1] || '';
            suffix = match[2] || '';
        }
    } else if (parts.length === 2) {
        const match = parts[1].match(/^(\d*)(.*)$/);
        if (match) {
            parts[1] = match[1] || '';
            suffix = match[2] || '';
        }
    }

    return {
        major: parts[0] || '',
        minor: parts[1] || '',
        patch: patch || (parts[2] || ''),
        suffix: suffix
    };
}

/**
 * Score version match between asset and CPE
 * Returns 0-1 score
 */
function scoreVersion(assetVersion: string | null, cpeVersion: string): number {
    if (!assetVersion) {
        return 0.3;
    }

    if (cpeVersion === '*') {
        return 0.3;
    }

    const assetLower = assetVersion.toLowerCase();
    const cpeLower = cpeVersion.toLowerCase();

    if (assetLower === cpeLower) {
        return 1.0;
    }

    const assetParsed = parseVersion(assetLower);
    const cpeParsed = parseVersion(cpeLower);

    if (assetParsed.major === cpeParsed.major &&
        assetParsed.minor === cpeParsed.minor &&
        assetParsed.patch === cpeParsed.patch) {
        return 0.95;
    }

    if (assetParsed.major === cpeParsed.major && assetParsed.minor === cpeParsed.minor) {
        return 0.8;
    }

    if (assetParsed.major === cpeParsed.major) {
        return 0.5;
    }

    if (/^\d{4}$/.test(assetLower) && /^\d{4}$/.test(cpeLower)) {
        if (assetLower === cpeLower) {
            return 1.0;
        }
        const assetYear = parseInt(assetLower);
        const cpeYear = parseInt(cpeLower);
        if (Math.abs(assetYear - cpeYear) <= 1) {
            return 0.6;
        }
    }

    return 0.0;
}


/**
 * Calculate Jaccard similarity between two sets
 */
function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 && setB.size === 0) {
        return 0;
    }

    let intersection = 0;
    for (const item of setA) {
        if (setB.has(item)) {
            intersection++;
        }
    }

    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}

/**
 * Score token overlap using Jaccard similarity
 */
function scoreTokenOverlap(assetTokens: string[], cpeTokens: string[]): number {
    const setA = new Set(assetTokens.map(t => t.toLowerCase()));
    const setB = new Set(cpeTokens.map(t => t.toLowerCase()));

    return jaccardSimilarity(setA, setB);
}


/**
 * Calculate final weighted score. Returns 0-100 percentage.
 */
function calculateFinalScore(breakdown: ScoreBreakdown): number {
    const weightedScore =
        breakdown.vendorScore * WEIGHTS.VENDOR +
        breakdown.productScore * WEIGHTS.PRODUCT +
        breakdown.versionScore * WEIGHTS.VERSION +
        breakdown.tokenOverlapScore * WEIGHTS.TOKEN_OVERLAP;

    return Math.round(weightedScore * 100 * 100) / 100;
}


/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;

    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],
                    dp[i][j - 1],
                    dp[i - 1][j - 1]
                );
            }
        }
    }

    return dp[m][n];
}

/**
 * Levenshtein ratio (similarity) between two strings. Returns 0-1.
 */
function levenshteinRatio(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;

    const distance = levenshteinDistance(a, b);
    return 1 - (distance / maxLen);
}


/**
 * Rank candidates by score and return top N
 */
function rankCandidates(candidates: CpeCandidate[], topN: number = 5): CpeCandidate[] {
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    return sorted.slice(0, topN);
}


/**
 * Score a single CPE candidate against the parsed asset
 */
function scoreCpeCandidate(parsedAsset: ParsedAsset, cpeProduct: CpeProduct): CpeCandidate | null {
    const cpe = cpeProduct.cpe;

    if (!cpe || !cpe.cpeName) {
        return null;
    }

    const deconstructed = deconstructCpe(cpe.cpeName);

    const vendorScore = scoreVendor(parsedAsset.vendor, deconstructed.vendor);
    const productScore = scoreProduct(parsedAsset.product, deconstructed.product);
    const versionScore = scoreVersion(parsedAsset.version, deconstructed.version);
    const tokenOverlapScore = scoreTokenOverlap(parsedAsset.tokens, deconstructed.tokens);

    const breakdown: ScoreBreakdown = {
        vendorScore,
        productScore,
        versionScore,
        tokenOverlapScore
    };

    const score = calculateFinalScore(breakdown);

    let title: string | null = null;
    if (cpe.titles && cpe.titles.length > 0) {
        const englishTitle = cpe.titles.find(t => t.lang === 'en');
        title = englishTitle?.title || cpe.titles[0]?.title || null;
    }

    return {
        cpeName: cpe.cpeName,
        cpeNameId: cpe.cpeNameId || '',
        title,
        score,
        breakdown,
        deconstructed
    };
}

/**
 * Rank CPE candidates against a parsed asset. Returns top N by score.
 */
export function rankCpeCandidates(
    parsedAsset: ParsedAsset,
    cpeProducts: CpeProduct[],
    topN: number = 5,
    onProgress?: ProgressCallback
): CpeCandidate[] {
    const candidates: CpeCandidate[] = [];

    onProgress?.("scoring", `Scoring ${cpeProducts.length} candidates...`);

    for (const cpeProduct of cpeProducts) {
        const candidate = scoreCpeCandidate(parsedAsset, cpeProduct);
        if (candidate) {
            candidates.push(candidate);
        }
    }

    onProgress?.("ranking", `Ranking ${candidates.length} scored candidates...`);

    const ranked = rankCandidates(candidates, topN);
    onProgress?.("ranking", `Top ${ranked.length} candidates selected (best score: ${ranked[0]?.score ?? 0}%)`);
    return ranked;
}
