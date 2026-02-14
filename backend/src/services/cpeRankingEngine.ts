// ============================================================================
// CPE RANKING ENGINE
// ============================================================================
//
// This service handles Phase 3, 4, and 5 of the CPE Discovery Pipeline:
//   - Phase 3: CPE Deconstruction (parse cpeName into comparable components)
//   - Phase 4: Matching & Scoring Algorithm (score each CPE against input)
//   - Phase 5: Ranking & Output (sort and return top N candidates)
//
// Input: ParsedAsset + CpeProduct[] (from cpe.ts Phase 1 & 2)
// Output: Ranked CpeCandidate[] with similarity scores
//
// ============================================================================

// ============================================================================
// IMPORTS
// ============================================================================

import type {
    ParsedAsset,
    CpeDetails,
    CpeProduct,
    DeconstructedCpe,
    ScoreBreakdown,
    CpeCandidate,
} from '../types/cpe.types';
import type { ProgressCallback } from './cpe';

// Re-export types for consumers
export type { ParsedAsset, CpeProduct, CpeCandidate, ScoreBreakdown, DeconstructedCpe };

// ============================================================================
// SCORING WEIGHTS - Configurable
// ============================================================================

const WEIGHTS = {
    VENDOR: 0.25,       // 25% - Vendor match importance
    PRODUCT: 0.35,      // 35% - Product match importance (most important)
    VERSION: 0.25,      // 25% - Version match importance
    TOKEN_OVERLAP: 0.15 // 15% - Overall token similarity
};

// ============================================================================
// PHASE 3: CPE DECONSTRUCTION
// ============================================================================
//
// Goal: Parse each cpeName string into comparable components
//
// CPE 2.3 Format (13 colon-separated fields):
// cpe:2.3:<part>:<vendor>:<product>:<version>:<update>:<edition>:<language>:<sw_edition>:<target_sw>:<target_hw>:<other>
//
// Example Input:
//   "cpe:2.3:o:ewon:ewon_firmware:10.0s0:*:*:*:*:*:*:*"
//
// Example Output:
//   {
//     raw: "cpe:2.3:o:ewon:ewon_firmware:10.0s0:*:*:*:*:*:*:*",
//     part: "o",
//     vendor: "ewon",
//     product: "ewon_firmware",
//     version: "10.0s0",
//     update: "*",
//     ...
//     tokens: ["ewon", "ewon", "firmware", "10", "0s0"]
//   }
//
// Implementation Steps:
// 1. Split cpeName by ':'
// 2. Validate it has at least 5 parts (cpe, 2.3, part, vendor, product)
// 3. Extract each component (handle '*' as wildcard/empty)
// 4. Tokenize vendor + product for Jaccard similarity
//    - Replace underscores/hyphens with spaces
//    - Split into words
//    - Include version tokens if not wildcard
//
// TODO: Implement deconstructCpe(cpeName: string): DeconstructedCpe
// ============================================================================

/**
 * Parse a CPE 2.3 name into its component parts
 * CPE 2.3 Format: cpe:2.3:<part>:<vendor>:<product>:<version>:<update>:<edition>:<language>:<sw_edition>:<target_sw>:<target_hw>:<other>
 */
function deconstructCpe(cpeName: string): DeconstructedCpe {
    const parts = cpeName.split(':');
    
    // Validate minimum parts (cpe, 2.3, part, vendor, product)
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
    
    // Extract components (handle missing fields with '*')
    const vendor = parts[3] || '*';
    const product = parts[4] || '*';
    const version = parts[5] || '*';
    
    // Build tokens for Jaccard similarity
    const tokens: string[] = [];
    
    // Tokenize vendor (replace underscores/hyphens with spaces, split)
    if (vendor !== '*') {
        const vendorTokens = vendor.replace(/[_-]/g, ' ').split(' ').filter(t => t.length > 0);
        tokens.push(...vendorTokens);
    }
    
    // Tokenize product
    if (product !== '*') {
        const productTokens = product.replace(/[_-]/g, ' ').split(' ').filter(t => t.length > 0);
        tokens.push(...productTokens);
    }
    
    // Include version tokens if not wildcard
    if (version !== '*') {
        // Split version by dots and other separators, keep meaningful parts
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


// ============================================================================
// PHASE 4: MATCHING & SCORING ALGORITHM
// ============================================================================
//
// Goal: Score each CPE candidate against the input ParsedAsset
//
// ┌────────────────────────────────────────────────────────────────────────┐
// │  SCORING COMPONENTS (Total = 100%)                                     │
// ├────────────────────────────────────────────────────────────────────────┤
// │  Component        │ Weight │ Description                               │
// │───────────────────│────────│───────────────────────────────────────────│
// │  Vendor Match     │  25%   │ How well vendor names match               │
// │  Product Match    │  35%   │ How well product names match              │
// │  Version Match    │  25%   │ How well versions match                   │
// │  Token Overlap    │  15%   │ Jaccard similarity of all tokens          │
// └────────────────────────────────────────────────────────────────────────┘
//
// ============================================================================
// 4.1 VENDOR SCORING (0-1)
// ============================================================================
//
// Input: assetVendor (from ParsedAsset), cpeVendor (from DeconstructedCpe)
//
// Scoring Rules:
//   - Exact match ("ewon" == "ewon")                    → 1.0
//   - Substring match ("ewon" in "ewon_inc")           → 0.7
//   - Levenshtein distance <= 2                         → 0.5
//   - No match                                          → 0.0
//
// Edge Cases:
//   - assetVendor is null → return 0.0
//   - cpeVendor is "*" (wildcard) → return 0.3 (partial credit)
//   - Case insensitive comparison
//
// TODO: Implement scoreVendor(assetVendor: string | null, cpeVendor: string): number
// ============================================================================

/**
 * Score vendor match between asset and CPE
 * Returns 0-1 score
 */
function scoreVendor(assetVendor: string | null, cpeVendor: string): number {
    // Edge case: no asset vendor
    if (!assetVendor) {
        return 0.0;
    }
    
    // Edge case: wildcard CPE vendor
    if (cpeVendor === '*') {
        return 0.3;
    }
    
    const assetLower = assetVendor.toLowerCase();
    const cpeLower = cpeVendor.toLowerCase();
    
    // Exact match
    if (assetLower === cpeLower) {
        return 1.0;
    }
    
    // Substring match (either direction)
    if (assetLower.includes(cpeLower) || cpeLower.includes(assetLower)) {
        return 0.7;
    }
    
    // Levenshtein distance check
    const distance = levenshteinDistance(assetLower, cpeLower);
    if (distance <= 2) {
        return 0.5;
    }
    
    return 0.0;
}


// ============================================================================
// 4.2 PRODUCT SCORING (0-1)
// ============================================================================
//
// Input: assetProduct (from ParsedAsset), cpeProduct (from DeconstructedCpe)
//
// Strategy: Use MAXIMUM of two methods:
//   1. Tokenized Jaccard Similarity
//   2. Fuzzy Levenshtein Ratio
//
// Method 1 - Tokenized Jaccard:
//   - Tokenize both: "ewon_firmware" → ["ewon", "firmware"]
//   - Jaccard = |intersection| / |union|
//   - Example: ["ewon", "firmware"] vs ["firmware"]
//     - intersection = {"firmware"} = 1
//     - union = {"ewon", "firmware"} = 2
//     - Jaccard = 1/2 = 0.5
//
// Method 2 - Levenshtein Ratio:
//   - ratio = 1 - (distance / max(len(a), len(b)))
//   - Example: "firmware" vs "firmwares"
//     - distance = 1, max_len = 9
//     - ratio = 1 - (1/9) = 0.89
//
// Final Score = max(jaccard, levenshteinRatio)
//
// Edge Cases:
//   - assetProduct is null → return 0.0
//   - cpeProduct is "*" → return 0.2 (minimal credit)
//   - Compound products: "http server" vs "http_server" should score high
//
// TODO: Implement scoreProduct(assetProduct: string | null, cpeProduct: string): number
// ============================================================================

/**
 * Tokenize a string for comparison
 * Lowercase, replace underscores/hyphens with space, split, filter empty
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
    // Edge case: no asset product
    if (!assetProduct) {
        return 0.0;
    }
    
    // Edge case: wildcard CPE product
    if (cpeProduct === '*') {
        return 0.2;
    }
    
    // Method 1: Tokenized Jaccard Similarity
    const assetTokens = new Set(tokenize(assetProduct));
    const cpeTokens = new Set(tokenize(cpeProduct));
    const jaccardScore = jaccardSimilarity(assetTokens, cpeTokens);
    
    // Method 2: Levenshtein Ratio
    const assetLower = assetProduct.toLowerCase();
    const cpeLower = cpeProduct.toLowerCase().replace(/_/g, ' ');
    const levRatio = levenshteinRatio(assetLower, cpeLower);
    
    // Return maximum of both methods
    return Math.max(jaccardScore, levRatio);
}


// ============================================================================
// 4.3 VERSION SCORING (0-1)
// ============================================================================
//
// Input: assetVersion (from ParsedAsset), cpeVersion (from DeconstructedCpe)
//
// Scoring Rules (ordered by specificity):
//   - Exact match "10.0s0" == "10.0s0"                  → 1.0
//   - Major.minor match "10.0" matches "10.0.x"        → 0.8
//   - Major only match "10" matches "10.x.x"           → 0.5
//   - CPE version is "*" (wildcard)                    → 0.3
//   - No match                                          → 0.0
//
// Version Parsing Strategy:
//   - Split by '.' and compare segment by segment
//   - Handle suffixes: "10.0s0" → major=10, minor=0, suffix=s0
//   - Handle prefixes: "v2.3" → strip 'v', compare "2.3"
//
// Edge Cases:
//   - assetVersion is null → return 0.3 (version not required)
//   - Year versions: "2019" should match "2019"
//   - Build numbers: "2.4.51" vs "2.4.52" → 0.8 (major.minor match)
//
// TODO: Implement scoreVersion(assetVersion: string | null, cpeVersion: string): number
// TODO: Implement parseVersion(version: string): { major: string, minor: string, patch: string, suffix: string }
// ============================================================================

/**
 * Parse a version string into components
 * Handles: "10.0s0", "2.4.51", "v1.0", "2019"
 */
function parseVersion(version: string): { major: string; minor: string; patch: string; suffix: string } {
    // Strip leading 'v' or 'V'
    let cleaned = version.replace(/^[vV]/, '');
    
    // Split by dots
    const parts = cleaned.split('.');
    
    // Extract suffix from last part if it contains letters
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
        // Check if minor has suffix
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
    // Edge case: no asset version (version not required)
    if (!assetVersion) {
        return 0.3;
    }
    
    // Edge case: wildcard CPE version
    if (cpeVersion === '*') {
        return 0.3;
    }
    
    const assetLower = assetVersion.toLowerCase();
    const cpeLower = cpeVersion.toLowerCase();
    
    // Exact match
    if (assetLower === cpeLower) {
        return 1.0;
    }
    
    // Parse both versions
    const assetParsed = parseVersion(assetLower);
    const cpeParsed = parseVersion(cpeLower);
    
    // Major.minor.patch match (ignore suffix)
    if (assetParsed.major === cpeParsed.major && 
        assetParsed.minor === cpeParsed.minor && 
        assetParsed.patch === cpeParsed.patch) {
        return 0.95;
    }
    
    // Major.minor match
    if (assetParsed.major === cpeParsed.major && assetParsed.minor === cpeParsed.minor) {
        return 0.8;
    }
    
    // Major only match
    if (assetParsed.major === cpeParsed.major) {
        return 0.5;
    }
    
    // Year-based versions (4-digit years)
    if (/^\d{4}$/.test(assetLower) && /^\d{4}$/.test(cpeLower)) {
        if (assetLower === cpeLower) {
            return 1.0;
        }
        // Close year (within 1)
        const assetYear = parseInt(assetLower);
        const cpeYear = parseInt(cpeLower);
        if (Math.abs(assetYear - cpeYear) <= 1) {
            return 0.6;
        }
    }
    
    return 0.0;
}


// ============================================================================
// 4.4 TOKEN OVERLAP SCORING (Jaccard Similarity)
// ============================================================================
//
// Input: assetTokens (from ParsedAsset), cpeTokens (from DeconstructedCpe)
//
// Formula:
//   Jaccard(A, B) = |A ∩ B| / |A ∪ B|
//
// Example:
//   Asset tokens:  ["ewon", "firmware", "10", "0s0"]
//   CPE tokens:    ["ewon", "ewon", "firmware", "10", "0s0"]
//   
//   Set A = {ewon, firmware, 10, 0s0}
//   Set B = {ewon, firmware, 10, 0s0}
//   
//   Intersection = {ewon, firmware, 10, 0s0} = 4
//   Union = {ewon, firmware, 10, 0s0} = 4
//   Jaccard = 4/4 = 1.0
//
// Notes:
//   - Convert arrays to Sets (removes duplicates)
//   - Normalize tokens (lowercase, trim)
//   - Include version tokens in both sets
//
// TODO: Implement jaccardSimilarity(setA: Set<string>, setB: Set<string>): number
// TODO: Implement scoreTokenOverlap(assetTokens: string[], cpeTokens: string[]): number
// ============================================================================

/**
 * Calculate Jaccard similarity between two sets
 * Formula: |intersection| / |union|
 * Returns 0-1 score
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
 * Returns 0-1 score
 */
function scoreTokenOverlap(assetTokens: string[], cpeTokens: string[]): number {
    const setA = new Set(assetTokens.map(t => t.toLowerCase()));
    const setB = new Set(cpeTokens.map(t => t.toLowerCase()));
    
    return jaccardSimilarity(setA, setB);
}


// ============================================================================
// 4.5 FINAL SCORE CALCULATION
// ============================================================================
//
// Formula:
//   finalScore = (
//     vendorScore  * 0.25 +
//     productScore * 0.35 +
//     versionScore * 0.25 +
//     overlapScore * 0.15
//   ) * 100
//
// Returns: 0-100 (percentage)
//
// TODO: Implement calculateFinalScore(breakdown: ScoreBreakdown): number
// ============================================================================

/**
 * Calculate final weighted score
 * Returns 0-100 percentage
 */
function calculateFinalScore(breakdown: ScoreBreakdown): number {
    const weightedScore = 
        breakdown.vendorScore * WEIGHTS.VENDOR +
        breakdown.productScore * WEIGHTS.PRODUCT +
        breakdown.versionScore * WEIGHTS.VERSION +
        breakdown.tokenOverlapScore * WEIGHTS.TOKEN_OVERLAP;
    
    return Math.round(weightedScore * 100 * 100) / 100; // Round to 2 decimal places
}


// ============================================================================
// UTILITY FUNCTIONS NEEDED
// ============================================================================
//
// 1. Levenshtein Distance
//    - levenshteinDistance(a: string, b: string): number
//    - Returns edit distance (number of insertions, deletions, substitutions)
//
// 2. Levenshtein Ratio
//    - levenshteinRatio(a: string, b: string): number
//    - Returns 0-1 similarity (1 - distance/maxLength)
//
// 3. Jaccard Similarity
//    - jaccardSimilarity(setA: Set<string>, setB: Set<string>): number
//    - Returns |intersection| / |union|
//
// 4. Tokenizer
//    - tokenize(text: string): string[]
//    - Lowercase, replace _/- with space, split by space, filter empty
//
// 5. Version Parser
//    - parseVersion(version: string): { major, minor, patch, suffix }
//    - Handle: "10.0s0", "2.4.51", "v1.0", "2019"
//
// ============================================================================

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed
 */
function levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    
    // Create a 2D array for dynamic programming
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    
    // Base cases
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    
    // Fill the matrix
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + Math.min(
                    dp[i - 1][j],     // deletion
                    dp[i][j - 1],     // insertion
                    dp[i - 1][j - 1]  // substitution
                );
            }
        }
    }
    
    return dp[m][n];
}

/**
 * Calculate Levenshtein ratio (similarity) between two strings
 * Returns 0-1 score (1 = identical, 0 = completely different)
 */
function levenshteinRatio(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1; // Both empty strings
    
    const distance = levenshteinDistance(a, b);
    return 1 - (distance / maxLen);
}


// ============================================================================
// PHASE 5: RANKING & OUTPUT
// ============================================================================
//
// Goal: Sort candidates by score and return top N
//
// Input: CpeCandidate[] (unsorted, with scores)
// Output: CpeCandidate[] (sorted descending, limited to topN)
//
// Steps:
//   1. Sort by score descending: candidates.sort((a, b) => b.score - a.score)
//   2. Slice to top N: candidates.slice(0, topN)
//   3. Return with full details for transparency
//
// Default: topN = 5
//
// TODO: Implement rankCandidates(candidates: CpeCandidate[], topN?: number): CpeCandidate[]
// ============================================================================

/**
 * Rank candidates by score and return top N
 * Default: topN = 5
 */
function rankCandidates(candidates: CpeCandidate[], topN: number = 5): CpeCandidate[] {
    // Sort by score descending
    const sorted = [...candidates].sort((a, b) => b.score - a.score);
    
    // Return top N
    return sorted.slice(0, topN);
}


// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================
//
// Function: rankCpeCandidates(parsedAsset: ParsedAsset, cpeProducts: CpeProduct[]): CpeCandidate[]
//
// Flow:
//   1. For each cpeProduct in cpeProducts:
//      a. Deconstruct cpeName → DeconstructedCpe (Phase 3)
//      b. Score against parsedAsset → ScoreBreakdown (Phase 4)
//      c. Calculate final score → number
//      d. Build CpeCandidate object
//   2. Rank all candidates (Phase 5)
//   3. Return top 5
//
// Example Usage:
//   const parsed = await cpe.parseAsset("eWon eWon Firmware 10.0s0");
//   const results = await cpe.progressiveSearch(parsed);
//   const ranked = rankCpeCandidates(parsed, results);
//   // ranked[0] = { cpeName: "cpe:2.3:o:ewon:ewon_firmware:10.0s0:...", score: 94.25, ... }
//
// ============================================================================


// ============================================================================
// IMPLEMENTATION SECTION (TODO)
// ============================================================================

// TODO: Export types for use in cpe.ts
// export { CpeCandidate, ScoreBreakdown, DeconstructedCpe };

// TODO: Implement and export main function
// export function rankCpeCandidates(
//     parsedAsset: ParsedAsset, 
//     cpeProducts: CpeProduct[], 
//     topN: number = 5
// ): CpeCandidate[] {
//     // Implementation here
// }

/**
 * Score a single CPE candidate against the parsed asset
 * Returns a complete CpeCandidate with score breakdown
 */
function scoreCpeCandidate(parsedAsset: ParsedAsset, cpeProduct: CpeProduct): CpeCandidate | null {
    const cpe = cpeProduct.cpe;
    
    // Skip if no CPE data
    if (!cpe || !cpe.cpeName) {
        return null;
    }
    
    // Phase 3: Deconstruct CPE
    const deconstructed = deconstructCpe(cpe.cpeName);
    
    // Phase 4: Calculate component scores
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
    
    // Calculate final score
    const score = calculateFinalScore(breakdown);
    
    // Extract title (prefer English)
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
 * Main Orchestrator: Rank CPE candidates against a parsed asset
 * 
 * Flow:
 *   1. For each cpeProduct:
 *      a. Deconstruct cpeName → DeconstructedCpe (Phase 3)
 *      b. Score against parsedAsset → ScoreBreakdown (Phase 4)
 *      c. Calculate final score
 *      d. Build CpeCandidate object
 *   2. Rank all candidates (Phase 5)
 *   3. Return top N
 */
export function rankCpeCandidates(
    parsedAsset: ParsedAsset,
    cpeProducts: CpeProduct[],
    topN: number = 5,
    onProgress?: ProgressCallback
): CpeCandidate[] {
    const candidates: CpeCandidate[] = [];

    onProgress?.("scoring", `Scoring ${cpeProducts.length} candidates...`);

    // Score each CPE candidate
    for (const cpeProduct of cpeProducts) {
        const candidate = scoreCpeCandidate(parsedAsset, cpeProduct);
        if (candidate) {
            candidates.push(candidate);
        }
    }

    onProgress?.("ranking", `Ranking ${candidates.length} scored candidates...`);

    // Phase 5: Rank and return top N
    const ranked = rankCandidates(candidates, topN);
    onProgress?.("ranking", `Top ${ranked.length} candidates selected (best score: ${ranked[0]?.score ?? 0}%)`);
    return ranked;
}