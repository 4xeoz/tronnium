import axios from 'axios';
import type {
    CpeTitle,
    CpeRef,
    CpeDetails,
    CpeProduct,
    NvdCpeResponse,
    NvdApiResult,
    ParsedAsset,
    ParsedCpe,
    CpeValidationResult,
} from '../types/cpe.types';

// Common vendor aliases and known vendors for better matching
const KNOWN_VENDORS: Set<string> = new Set([
    'microsoft', 'apple', 'google', 'apache', 'oracle', 'ibm', 'cisco',
    'adobe', 'mozilla', 'linux', 'canonical', 'redhat', 'debian', 'ubuntu',
    'openssl', 'openssh', 'nginx', 'php', 'python', 'nodejs', 'java',
    'wordpress', 'drupal', 'joomla', 'magento', 'prestashop',
    'samsung', 'huawei', 'dell', 'hp', 'lenovo', 'asus', 'acer',
    'vmware', 'citrix', 'fortinet', 'paloalto', 'checkpoint',
    'ewon', 'hms', 'siemens', 'schneider', 'rockwell', 'honeywell',
]);

// Words that indicate they're NOT a vendor (should be skipped)
const NON_VENDOR_WORDS: Set<string> = new Set([
    'server', 'client', 'firmware', 'software', 'hardware', 'driver',
    'http', 'https', 'ftp', 'ssh', 'ssl', 'tls', 'tcp', 'udp',
    'web', 'mail', 'dns', 'proxy', 'gateway', 'firewall', 'router',
    'the', 'for', 'and', 'with', 'pro', 'enterprise', 'professional',
    'standard', 'edition', 'version', 'update', 'patch', 'release',
]);

class Cpe {
    // Simple in-memory cache for API responses
    private cache: Map<string, { data: any; timestamp: number }> = new Map();
    private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
    
    // Rate limiting: NVD allows ~5 requests per 30 seconds without API key
    private lastRequestTime = 0;
    private readonly MIN_REQUEST_INTERVAL_MS = 6000; // 6 seconds between requests

    private async queryNvdApi(cpe: string, keyword: string): Promise<any> {
        const cacheKey = `cpe:${cpe}|kw:${keyword}`;
        
        // Check cache first
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
            console.log(`[NVD API] Cache hit for: "${keyword || cpe}"`);
            return cached.data;
        }

        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL_MS) {
            const waitTime = this.MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest;
            console.log(`[NVD API] Rate limiting, waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        this.lastRequestTime = Date.now();

        let url: string;
        if (cpe) {
            url = `https://services.nvd.nist.gov/rest/json/cpes/2.0?cpeMatchString=${encodeURIComponent(cpe)}&resultsPerPage=10`;
        } else if (keyword) {
            url = `https://services.nvd.nist.gov/rest/json/cpes/2.0?keywordSearch=${encodeURIComponent(keyword)}&resultsPerPage=10`;
        } else {
            throw new Error('Either cpe or keyword must be provided to query NVD API.');
        }

        console.log(`[NVD API] Fetching: "${keyword || cpe}"`);
        const response = await axios.get(url);
        
        // Cache the result
        this.cache.set(cacheKey, { data: response.data, timestamp: Date.now() });
        
        return response.data;
    }
    

    private async preprocessDataExtractor(rawData: any): Promise<any> {
        // Placeholder for any preprocessing logic if needed in the future
        return rawData;
    }

    private async normalizedText(text: string, options?: { preserveVersions?: boolean }): Promise<string> {
        const opts = options || {};
        opts.preserveVersions = opts.preserveVersions ?? false;

        if (opts.preserveVersions) {
            // Preserve version-like patterns (e.g., 2.4.51, 1.0.0a, v2.3)
            return text
                .trim()
                .toLowerCase()
                .replace(/[_\-]/g, ' ')
                .replace(/[^\w\s.]/g, '')
                .replace(/\s+/g, ' ');
        }

        return text
            .trim()
            .toLowerCase()
            .replace(/[_\-.]/g, ' ')
            .replace(/[^\w\s]/g, '')
            .replace(/\s+/g, ' ');
    }

    /**
     * Extract version string from raw input BEFORE tokenization
     * This preserves "2.4.51" as a single string instead of splitting into ["2", "4", "51"]
     */
    private extractVersionFromRaw(text: string): { version: string | null; textWithoutVersion: string } {
        // Patterns to match version strings (ordered by specificity)
        const versionPatterns = [
            /\bv?(\d+\.\d+\.\d+(?:\.\d+)?(?:[a-z]\d*)?)\b/i,  // 2.4.51, 1.0.0a, 10.0s0
            /\bv?(\d+\.\d+(?:[a-z]\d*)?)\b/i,                  // 2.4, 1.0a
            /\b(v\d+(?:\.\d+)*)\b/i,                            // v2, v2.3
        ];

        for (const pattern of versionPatterns) {
            const match = text.match(pattern);
            if (match) {
                const version = match[1].replace(/^v/i, ''); // Remove leading 'v'
                const textWithoutVersion = text.replace(match[0], ' ').replace(/\s+/g, ' ').trim();
                return { version, textWithoutVersion };
            }
        }

        return { version: null, textWithoutVersion: text };
    }



    private async tokenizeText(text: string): Promise<string[]> {
        const normalized = await this.normalizedText(text);
        return normalized.split(' ').filter(token => token.length > 0);
    }

    private async versionCandidatesExtractor(tokens: string[]): Promise<string[]> {
        if (tokens.length === 0) {
            return [];
        }

        // Patterns that indicate a token could be a version
        // Collect ALL matching tokens as candidates for phase 2 resolution
        const versionPatterns = [
            /^\d+(\.\d+){1,3}([a-zA-Z0-9]+)?$/, // e.g., 1.0, 2.3.4, 3.1.4b
            /^\d+\.\d+(\.\d+)?[a-z]\d*$/i,   // e.g., 2.0a, 3.1.4b2
            /^\d+\.\d+(\.\d+)?$/,                  
            /^v?\d+(\.\d+)+$/i, 
            /^\d+\.\d+[-_]\d+$/, 
            /^\d+\.\d+$/, 
            /^\d{4}$/,      // Year-like versions: 2019, 2021
            /^\d+$/,        // Pure numbers
            /^\d+[a-z]$/i,  // e.g., 1k, 2a
        ];

        const candidates: string[] = [];

        // Collect all version candidates WITHOUT mutating the original tokens array
        for (const token of tokens) {
            for (const pattern of versionPatterns) {
                if (pattern.test(token)) {
                    candidates.push(token);
                    break;
                }
            }
        }
        
        return candidates;
    }

    private async vendorExtractor(tokens: string[]): Promise<string | null> {
        if (tokens.length === 0) {
            return null;
        }

        // Strategy 1: Check if any token is a known vendor
        for (const token of tokens) {
            const cleaned = token.replace(/(inc|corp|ltd|llc|gmbh|co)$/i, '').trim();
            if (KNOWN_VENDORS.has(cleaned)) {
                return cleaned;
            }
        }

        // Strategy 2: First non-generic word is likely the vendor
        for (const token of tokens) {
            const cleaned = token.replace(/(inc|corp|ltd|llc|gmbh|co)$/i, '').trim();
            if (cleaned.length > 1 && !NON_VENDOR_WORDS.has(cleaned)) {
                return cleaned;
            }
        }

        // Fallback: first token
        return tokens[0].replace(/(inc|corp|ltd|llc|gmbh|co)$/i, '').trim();
    }

    private async productExtractor(tokens: string[], vendor: string | null): Promise<string | null> {
        if (tokens.length === 0) {
            return null;
        }

        // Remove vendor from tokens
        let productTokens = vendor 
            ? tokens.filter(token => token !== vendor)
            : tokens;
    
        if (productTokens.length === 0) {
            // If vendor was the only token, it might be both vendor AND product (e.g., "OpenSSL")
            return vendor;
        }

        // If first remaining token is a known vendor, that's also the product (self-named product)
        // e.g., "OpenSSL" is both vendor and product
        if (productTokens[0] && KNOWN_VENDORS.has(productTokens[0])) {
            return productTokens[0];
        }

        // Look for meaningful product name (skip generic words)
        for (const token of productTokens) {
            if (!NON_VENDOR_WORDS.has(token) && token.length > 1) {
                return token;
            }
        }

        // Fallback: join remaining tokens for compound product names
        // e.g., "HTTP Server" -> "http server"
        const meaningfulTokens = productTokens.filter(t => !NON_VENDOR_WORDS.has(t) || productTokens.length <= 2);
        return meaningfulTokens.slice(0, 2).join(' ') || productTokens[0];
    }

    public async parseAsset(rawAssetName: string): Promise<ParsedAsset> {
        // Extract version FIRST before tokenization to preserve "2.4.51" as single string
        const { version, textWithoutVersion } = this.extractVersionFromRaw(rawAssetName);
        
        // Tokenize the text without version
        const normalized = await this.normalizedText(textWithoutVersion, { preserveVersions: false });
        const tokens = normalized.split(' ').filter(token => token.length > 0);
        
        // Extract vendor and product from non-version tokens
        const vendor = await this.vendorExtractor(tokens);
        const product = await this.productExtractor(tokens, vendor);
        
        // Fallback version candidates (if main version extraction failed)
        const versionCandidates = version ? [version] : await this.versionCandidatesExtractor(tokens);

        return {
            raw: rawAssetName,
            normalized: await this.normalizedText(rawAssetName, { preserveVersions: true }),
            tokens,
            vendor,
            product,
            version,
            versionCandidates,
        };
    }

    // Phase 2: Progressive NVD Search
    // ┌──────────────────────────────────────────────────────────────────────┐
    // │  Search 1: vendor + product                                          │
    // │  Query: "ewon firmware"                                              │
    // ├──────────────────────────────────────────────────────────────────────┤
    // │  Results > 5?                                                        │
    // │    │NO ──────► Results >= 1? ──YES──► Use Search 1 results           │
    // │    │                │NO                                              │
    // │    │                ▼                                                │
    // │    │           Return empty (no broader search)                      │
    // │    │                                                                 │
    // │   YES                                                                │
    // │    │                                                                 │
    // │    ▼                                                                 │
    // │  Has versionCandidates[0]?                                           │
    // │    │NO ──────► Use Search 1 results (can't narrow further)           │
    // │    │                                                                 │
    // │   YES                                                                │
    // │    │                                                                 │
    // │    ▼                                                                 │
    // │  ┌─────────────────────────────────────────────────────────────────┐ │
    // │  │  LOOP: i = 0, currentResults = Search 1 results                 │ │
    // │  │                                                                 │ │
    // │  │  Search N: vendor + product + versionCandidates[0..i]           │ │
    // │  │  Query: "ewon firmware 10" → "ewon firmware 10 0s0" etc.        │ │
    // │  │                                                                 │ │
    // │  │  Results = 0?  ──YES──► Return previous currentResults          │ │
    // │  │       │                                                         │ │
    // │  │      NO                                                         │ │
    // │  │       │                                                         │ │
    // │  │       ▼                                                         │ │
    // │  │  Results <= 5?  ──YES──► Return these results ✓                 │ │
    // │  │       │                                                         │ │
    // │  │      NO                                                         │ │
    // │  │       │                                                         │ │
    // │  │       ▼                                                         │ │
    // │  │  currentResults = these results                                 │ │
    // │  │  i++ (add next version candidate)                               │ │
    // │  │                                                                 │ │
    // │  │  More versionCandidates?  ──YES──► Continue loop                │ │
    // │  │       │                                                         │ │
    // │  │      NO                                                         │ │
    // │  │       │                                                         │ │
    // │  │       ▼                                                         │ │
    // │  │  Return currentResults (best we could narrow)                   │ │
    // │  └─────────────────────────────────────────────────────────────────┘ │
    // └──────────────────────────────────────────────────────────────────────┘
    //
    // Pseudocode:
    // ```
    // async progressiveSearch(parsed: ParsedAsset): Promise<CpeProduct[]> {
    //   const baseQuery = `${parsed.vendor} ${parsed.product}`.trim();
    //   let search1 = await queryNvdApi('', baseQuery);
    //   
    //   if (search1.totalResults <= 5) {
    //     return search1.totalResults >= 1 ? search1.products : [];
    //   }
    //   
    //   // Need to narrow down - use version candidates progressively
    //   if (parsed.versionCandidates.length === 0) {
    //     return search1.products; // Can't narrow further
    //   }
    //   
    //   let currentResults = search1.products;
    //   let queryParts = [baseQuery];
    //   
    //   for (const candidate of parsed.versionCandidates) {
    //     queryParts.push(candidate);
    //     const query = queryParts.join(' ');
    //     const searchN = await queryNvdApi('', query);
    //     
    //     if (searchN.totalResults === 0) {
    //       return currentResults; // Went too narrow, use previous
    //     }
    //     
    //     currentResults = searchN.products;
    //     
    //     if (searchN.totalResults <= 5) {
    //       return currentResults; // Found good narrow set
    //     }
    //   }
    //   
    //   return currentResults; // Return best we got
    // }
    // ```

    public async progressiveSearch(parsedAsset: ParsedAsset): Promise<CpeProduct[]> {
        // Build smart search queries
        const vendor = parsedAsset.vendor || '';
        const product = parsedAsset.product || '';
        const version = parsedAsset.version;
        
        // If vendor and product are the same (e.g., "openssl"), use just one
        const baseQuery = vendor === product 
            ? vendor 
            : `${vendor} ${product}`.trim();
        
        if (!baseQuery) {
            console.log(`[Progressive Search] No vendor/product extracted, using raw input`);
            return (await this.queryNvdApi('', parsedAsset.raw)).products || [];
        }

        console.log(`[Progressive Search] Starting with base query: "${baseQuery}"`);
        let search1Data = await this.queryNvdApi('', baseQuery);
        const search1Results: CpeProduct[] = search1Data.products || [];
        const search1Total = search1Data.totalResults || 0;
        console.log(`[Progressive Search] Initial search found ${search1Total} results`);

        if (search1Total <= 10) {
            console.log(`[Progressive Search] <= 10 results, returning initial results`);
            return search1Total >= 1 ? search1Results : [];
        }

        // Try with full version string first (e.g., "openssl 1.1.1")
        if (version) {
            const versionQuery = `${baseQuery} ${version}`;
            console.log(`[Progressive Search] Trying with version: "${versionQuery}"`);
            const versionData = await this.queryNvdApi('', versionQuery);
            const versionResults: CpeProduct[] = versionData.products || [];
            const versionTotal = versionData.totalResults || 0;
            console.log(`[Progressive Search] Version query returned ${versionTotal} results`);

            if (versionTotal >= 1 && versionTotal <= 10) {
                console.log(`[Progressive Search] Good match with version!`);
                return versionResults;
            }
            
            if (versionTotal === 0) {
                // Version too specific, return base results
                console.log(`[Progressive Search] Version too specific, returning base results`);
                return search1Results;
            }
        }

        // Fallback: progressive narrowing with version candidates
        if (parsedAsset.versionCandidates.length === 0) {
            console.log(`[Progressive Search] No version candidates, returning initial results`);
            return search1Results;
        }
        
        console.log(`[Progressive Search] Too many results (${search1Total}), narrowing with candidates: ${parsedAsset.versionCandidates.join(', ')}`);
        let currentResults: CpeProduct[] = search1Results;
        let queryParts: string[] = [baseQuery];

        for (const candidate of parsedAsset.versionCandidates) {
            queryParts.push(candidate);
            const query = queryParts.join(' ');
            console.log(`[Progressive Search] Trying query: "${query}"`);
            const searchNData = await this.queryNvdApi('', query);
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

    /**
     * High-level method: parse asset and search NVD
     */
    public async findCpe(rawAssetName: string): Promise<{ parsed: ParsedAsset; results: CpeProduct[] }> {
        const parsed = await this.parseAsset(rawAssetName);
        const results = await this.progressiveSearch(parsed);
        return { parsed, results };
    }

    // ============================================================================
    // CPE VALIDATION - Validate if a CPE string exists in NVD
    // ============================================================================
    //
    // CPE 2.3 Format:
    // cpe:2.3:part:vendor:product:version:update:edition:language:sw_edition:target_sw:target_hw:other
    //
    // Example: cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*
    //
    // Parts:
    //   a = application
    //   o = operating system  
    //   h = hardware
    //
    // Validation Strategy:
    // 1. Parse and validate CPE format locally (syntax check)
    // 2. Query NVD API with exact CPE match
    // 3. Return validation result with match details
    // ============================================================================

    /**
     * Parse a CPE 2.3 string into its components
     */
    public parseCpe(cpeString: string): ParsedCpe {
        const result: ParsedCpe = {
            valid: false,
            raw: cpeString,
            part: null,
            vendor: null,
            product: null,
            version: null,
            update: null,
            edition: null,
            language: null,
            swEdition: null,
            targetSw: null,
            targetHw: null,
            other: null,
        };

        if (!cpeString || typeof cpeString !== 'string') {
            result.error = 'CPE string is empty or invalid';
            return result;
        }

        const trimmed = cpeString.trim().toLowerCase();

        // Check for CPE 2.3 format
        if (!trimmed.startsWith('cpe:2.3:')) {
            // Try to handle CPE 2.2 format (cpe:/a:vendor:product:version)
            if (trimmed.startsWith('cpe:/')) {
                result.error = 'CPE 2.2 format detected. Please use CPE 2.3 format (cpe:2.3:...)';
                return result;
            }
            result.error = 'Invalid CPE format. Must start with "cpe:2.3:"';
            return result;
        }

        // Split CPE into components
        const parts = trimmed.split(':');
        
        // CPE 2.3 should have 13 parts: cpe, 2.3, part, vendor, product, version, update, edition, language, sw_edition, target_sw, target_hw, other
        if (parts.length < 5) {
            result.error = `Invalid CPE format: expected at least 5 components, got ${parts.length}`;
            return result;
        }

        // Validate part (a, o, h)
        const partValue = parts[2];
        if (!['a', 'o', 'h'].includes(partValue)) {
            result.error = `Invalid CPE part: "${partValue}". Must be 'a' (application), 'o' (OS), or 'h' (hardware)`;
            return result;
        }

        result.part = partValue;
        result.vendor = parts[3] && parts[3] !== '*' ? parts[3] : null;
        result.product = parts[4] && parts[4] !== '*' ? parts[4] : null;
        result.version = parts[5] && parts[5] !== '*' ? parts[5] : null;
        result.update = parts[6] && parts[6] !== '*' ? parts[6] : null;
        result.edition = parts[7] && parts[7] !== '*' ? parts[7] : null;
        result.language = parts[8] && parts[8] !== '*' ? parts[8] : null;
        result.swEdition = parts[9] && parts[9] !== '*' ? parts[9] : null;
        result.targetSw = parts[10] && parts[10] !== '*' ? parts[10] : null;
        result.targetHw = parts[11] && parts[11] !== '*' ? parts[11] : null;
        result.other = parts[12] && parts[12] !== '*' ? parts[12] : null;

        // Must have at least vendor
        if (!result.vendor) {
            result.error = 'CPE must have a vendor specified';
            return result;
        }

        result.valid = true;
        return result;
    }

    /**
     * Validate a CPE string against NVD database
     * Returns detailed validation result including whether CPE exists
     */
    public async validateCpe(cpeString: string): Promise<CpeValidationResult> {
        console.log(`[CPE Validation] Validating: "${cpeString}"`);

        // Step 1: Parse and validate format locally
        const parsed = this.parseCpe(cpeString);

        if (!parsed.valid) {
            return {
                isValid: false,
                existsInNvd: false,
                exactMatch: false,
                parsed,
                matches: [],
                deprecated: false,
                message: `Invalid CPE format: ${parsed.error}`,
            };
        }

        console.log(`[CPE Validation] Format valid. Vendor: ${parsed.vendor}, Product: ${parsed.product}, Version: ${parsed.version}`);

        // Step 2: Query NVD API with the CPE
        try {
            const nvdData = await this.queryNvdApi(cpeString.toLowerCase(), '');
            const products: CpeProduct[] = nvdData.products || [];
            const totalResults = nvdData.totalResults || 0;

            console.log(`[CPE Validation] NVD returned ${totalResults} results`);

            if (totalResults === 0) {
                return {
                    isValid: true,
                    existsInNvd: false,
                    exactMatch: false,
                    parsed,
                    matches: [],
                    deprecated: false,
                    message: 'CPE format is valid but no matching entries found in NVD database',
                };
            }

            // Check for exact match
            const normalizedInput = cpeString.toLowerCase().trim();
            const exactMatch = products.find(p => 
                p.cpe?.cpeName?.toLowerCase() === normalizedInput
            );

            const isDeprecated = exactMatch?.cpe?.deprecated === true;

            if (exactMatch) {
                return {
                    isValid: true,
                    existsInNvd: true,
                    exactMatch: true,
                    parsed,
                    matches: products,
                    deprecated: isDeprecated,
                    message: isDeprecated 
                        ? 'CPE exists in NVD but is DEPRECATED' 
                        : 'CPE is valid and exists in NVD database',
                };
            }

            // Partial matches found
            return {
                isValid: true,
                existsInNvd: true,
                exactMatch: false,
                parsed,
                matches: products,
                deprecated: false,
                message: `CPE format valid. No exact match, but ${totalResults} similar CPEs found`,
            };

        } catch (error) {
            console.error(`[CPE Validation] NVD API error:`, error);
            return {
                isValid: true,
                existsInNvd: false,
                exactMatch: false,
                parsed,
                matches: [],
                deprecated: false,
                message: `CPE format valid but NVD lookup failed: ${String(error)}`,
            };
        }
    }

    /**
     * Quick check if CPE exists (simpler return type)
     */
    public async cpeExists(cpeString: string): Promise<boolean> {
        const result = await this.validateCpe(cpeString);
        return result.existsInNvd;
    }

    /**
     * Build a CPE 2.3 string from components
     */
    public buildCpe(options: {
        part: 'a' | 'o' | 'h';
        vendor: string;
        product: string;
        version?: string;
        update?: string;
        edition?: string;
        language?: string;
        swEdition?: string;
        targetSw?: string;
        targetHw?: string;
        other?: string;
    }): string {
        const escape = (s: string | undefined) => s?.replace(/:/g, '\\:') || '*';
        
        return [
            'cpe',
            '2.3',
            options.part,
            escape(options.vendor.toLowerCase()),
            escape(options.product.toLowerCase()),
            escape(options.version),
            escape(options.update),
            escape(options.edition),
            escape(options.language),
            escape(options.swEdition),
            escape(options.targetSw),
            escape(options.targetHw),
            escape(options.other),
        ].join(':');
    }

}

export const cpe = new Cpe();