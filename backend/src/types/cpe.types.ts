// ============================================================================
// CPE TYPES - Centralized Type Definitions
// ============================================================================
//
// This file contains all shared interfaces for the CPE Discovery Pipeline.
// Import from here to avoid circular dependencies and ensure consistency.
//
// Usage:
//   import { ParsedAsset, CpeProduct, CpeCandidate } from '../types/cpe.types';
//
// ============================================================================

// ============================================================================
// NVD API RESPONSE TYPES
// ============================================================================

/**
 * Title object from NVD CPE data
 */
export interface CpeTitle {
    title: string | null;
    lang: string | null;
}

/**
 * Reference object from NVD CPE data
 */
export interface CpeRef {
    ref: string | null;
    type: string | null;
}

/**
 * Detailed CPE information from NVD API
 */
export interface CpeDetails {
    deprecated: boolean | null;
    cpeName: string | null;
    cpeNameId: string | null;
    lastModified: string | null;
    created: string | null;
    titles: CpeTitle[] | null;
    refs: CpeRef[] | null;
}

/**
 * Single product entry from NVD API response
 */
export interface CpeProduct {
    cpe: CpeDetails | null;
}

/**
 * Full NVD CPE API response structure
 */
export interface NvdCpeResponse {
    resultsPerPage: number | null;
    startIndex: number | null;
    totalResults: number | null;
    format: string | null;
    version: string | null;
    timestamp: string | null;
    products: CpeProduct[] | null;
}

/**
 * Wrapper for NVD API result
 */
export interface NvdApiResult {
    result: NvdCpeResponse | null;
}

// ============================================================================
// ASSET PARSING TYPES (Phase 1)
// ============================================================================

/**
 * Parsed asset from user input
 * Output of Phase 1: Asset Parsing
 * 
 * Example:
 *   Input: "Apache HTTP Server 2.4.51"
 *   Output: {
 *     raw: "Apache HTTP Server 2.4.51",
 *     normalized: "apache http server 2.4.51",
 *     tokens: ["apache", "http", "server"],
 *     vendor: "apache",
 *     product: "http server",
 *     version: "2.4.51",
 *     versionCandidates: ["2.4.51", "2.4", "2"]
 *   }
 */
export interface ParsedAsset {
    raw: string;                    // Original input untouched
    normalized: string;             // Lowercased, trimmed, cleaned
    tokens: string[];               // Array of meaningful words (versions removed)
    vendor: string | null;          // Extracted vendor name
    product: string | null;         // Extracted product name
    version: string | null;         // Primary version string (e.g., "2.4.51")
    versionCandidates: string[];    // Fallback version tokens for progressive search
}

// ============================================================================
// CPE PARSING TYPES (Phase 3)
// ============================================================================

/**
 * Parsed CPE 2.3 string components
 * Used for validation and comparison
 * 
 * CPE 2.3 Format:
 * cpe:2.3:<part>:<vendor>:<product>:<version>:<update>:<edition>:<language>:<sw_edition>:<target_sw>:<target_hw>:<other>
 */
export interface ParsedCpe {
    valid: boolean;
    raw: string;
    part: string | null;        // a=application, o=os, h=hardware
    vendor: string | null;
    product: string | null;
    version: string | null;
    update: string | null;
    edition: string | null;
    language: string | null;
    swEdition: string | null;
    targetSw: string | null;
    targetHw: string | null;
    other: string | null;
    error?: string;             // Error message if parsing failed
}

/**
 * Deconstructed CPE with tokens for scoring
 * Extended version of ParsedCpe with tokenization for Jaccard similarity
 */
export interface DeconstructedCpe {
    raw: string;                // Original cpeName string
    part: string;               // a=application, o=os, h=hardware
    vendor: string;             // e.g., "ewon"
    product: string;            // e.g., "ewon_firmware"
    version: string;            // e.g., "10.0s0" or "*"
    update: string;             // e.g., "*"
    edition: string;
    language: string;
    swEdition: string;
    targetSw: string;
    targetHw: string;
    other: string;
    tokens: string[];           // All meaningful tokens combined for Jaccard
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Result of CPE validation against NVD
 */
export interface CpeValidationResult {
    isValid: boolean;           // CPE format is valid
    existsInNvd: boolean;       // CPE exists in NVD database
    exactMatch: boolean;        // Exact CPE found (not just partial)
    parsed: ParsedCpe;          // Parsed CPE components
    matches: CpeProduct[];      // Matching CPEs from NVD
    deprecated: boolean;        // If the CPE is deprecated
    message: string;            // Human-readable result
}

// ============================================================================
// SCORING TYPES (Phase 4)
// ============================================================================

/**
 * Score breakdown for transparency and debugging
 * Each component is 0-1, weights applied in final calculation
 */
export interface ScoreBreakdown {
    vendorScore: number;        // 0-1, weighted 25%
    productScore: number;       // 0-1, weighted 35%
    versionScore: number;       // 0-1, weighted 25%
    tokenOverlapScore: number;  // 0-1 (Jaccard similarity), weighted 15%
}

/**
 * Scoring weights configuration
 */
export interface ScoringWeights {
    VENDOR: number;
    PRODUCT: number;
    VERSION: number;
    TOKEN_OVERLAP: number;
}

// ============================================================================
// RANKING TYPES (Phase 5)
// ============================================================================

/**
 * Final CPE candidate with score
 * Output of the ranking engine
 */
export interface CpeCandidate {
    cpeName: string;                    // Full CPE 2.3 string
    cpeNameId: string;                  // NVD unique ID
    title: string | null;               // Human-readable title from NVD
    score: number;                      // 0-100 percentage
    breakdown: ScoreBreakdown;          // Individual component scores
    deconstructed: DeconstructedCpe;    // Parsed CPE components
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request body for POST /cpe/find
 */
export interface CpeFindRequest {
    assetName: string;
    topN?: number;
}

/**
 * Response for POST /cpe/find
 */
export interface CpeFindResponse {
    success: boolean;
    parsed?: {
        raw: string;
        normalized: string;
        vendor: string | null;
        product: string | null;
        version: string | null;
        tokens: string[];
    };
    candidates?: Array<{
        cpeName: string;
        cpeNameId: string;
        title: string | null;
        score: number;
        breakdown: {
            vendor: number;
            product: number;
            version: number;
            tokenOverlap: number;
        };
    }>;
    count?: number;
    totalFound?: number;
    error?: string;
    message?: string;
}

/**
 * Request body for POST /cpe/validate
 */
export interface CpeValidateRequest {
    cpeString: string;
}

/**
 * Response for POST /cpe/validate
 */
export interface CpeValidateResponse {
    success: boolean;
    isValid: boolean;
    existsInNvd?: boolean;
    exactMatch?: boolean;
    deprecated?: boolean;
    message: string;
    parsed?: {
        part: string | null;
        vendor: string | null;
        product: string | null;
        version: string | null;
        update: string | null;
    };
    matchesFound?: number;
    error?: string;
}
