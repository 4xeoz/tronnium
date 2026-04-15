import { Request, Response } from "express";
import { cpe } from "../services/cpe";
import { rankCpeCandidates } from "../services/cpeRankingEngine";
import type { CpeCandidate } from "../types/cpe.types";
import prisma from "../lib/prisma";
import { verifyEnvironment } from "../lib/verifyEnvironment";
import type { PublicUser } from "../types/express";
import { ScanStatus } from "@prisma/client";

// ============================================================================
// CPE ENDPOINTS
// ============================================================================
//
// POST /cpe/find
// --------------
// Find CPE(s) from an asset name (human-readable software/hardware name)
// Runs the full pipeline: Parse → Search NVD → Rank candidates
//
// Request Body:
//   { "assetName": "OpenSSL 1.1.1" }
//   { "assetName": "Siemens SIMATIC S7-1500 2.9.2" }
//   { "assetName": "Apache HTTP Server 2.4.51" }
//   { "assetName": "...", "topN": 10 }  // Optional: number of results (default: 5)
//
// Response:
//   {
//     "success": true,
//     "parsed": {
//       "raw": "OpenSSL 1.1.1",
//       "vendor": "openssl",
//       "product": "openssl",
//       "version": "1.1.1",
//       "tokens": ["openssl"],
//       "versionCandidates": ["1.1.1"]
//     },
//     "candidates": [
//       {
//         "cpeName": "cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*",
//         "cpeNameId": "abc123",
//         "title": "OpenSSL 1.1.1",
//         "score": 95.5,
//         "breakdown": {
//           "vendorScore": 1.0,
//           "productScore": 1.0,
//           "versionScore": 1.0,
//           "tokenOverlapScore": 0.75
//         }
//       },
//       // ... more ranked candidates
//     ],
//     "count": 5
//   }
//
// ============================================================================

export async function cpeFindHandler(req: Request, res: Response) {
    try {
        const { assetName, topN } = req.query;

        // Validate input
        if (!assetName || typeof assetName !== "string") {
            return res.status(400).json({
                success: false,
                error: "INVALID_INPUT",
                message: "assetName is required and must be a string",
            });
        }

        const trimmedAssetName = assetName.trim();
        if (trimmedAssetName.length < 2) {
            return res.status(400).json({
                success: false,
                error: "INVALID_INPUT",
                message: "assetName must be at least 2 characters long",
            });
        }

        const resultLimit = topN && !isNaN(Number(topN)) && Number(topN) > 0 
            ? Math.min(Number(topN), 20) 
            : 5;

        // Set headers for SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders(); // Important: flush headers immediately

        // Helper function to send SSE updates
        const sendProgress = (step: string, message: string, type: "progress" | "completed" | "error" = "progress", data?: any) => {
            res.write(`data: ${JSON.stringify({ type, step, message, data })}\n\n`);
        };

        // Progress callback that forwards to SSE
        const onProgress = (step: string, message: string) => {
            sendProgress(step, message, "progress");
        };

        // Phase 1 & 2: Parse asset and search NVD
        console.log(`[CPE Find] Processing: "${trimmedAssetName}"`);
        const { parsed, results } = await cpe.findCpe(trimmedAssetName, onProgress);

        // Phase 3, 4, 5: Rank the CPE candidates
        sendProgress("ranking", `Found ${results.length} candidates. Ranking and scoring...`, "progress");
        const rankedCandidates: CpeCandidate[] = rankCpeCandidates(parsed, results, resultLimit, onProgress);

        console.log(`[CPE Find] Found ${results.length} CPEs, returning top ${rankedCandidates.length} ranked candidates`);

        // Send completed response
        sendProgress("completed", "CPE search completed", "completed", {
            success: true,
            parsed: {
                raw: parsed.raw,
                normalized: parsed.normalized,
                vendor: parsed.vendor,
                product: parsed.product,
                version: parsed.version,
                tokens: parsed.tokens,
            },
            candidates: rankedCandidates.map((candidate) => ({
                cpeName: candidate.cpeName,
                cpeNameId: candidate.cpeNameId,
                title: candidate.title,
                score: candidate.score,
                vendor: candidate.deconstructed.vendor,
                product: candidate.deconstructed.product,
                version: candidate.deconstructed.version,
                breakdown: {
                    vendor: Math.round(candidate.breakdown.vendorScore * 100),
                    product: Math.round(candidate.breakdown.productScore * 100),
                    version: Math.round(candidate.breakdown.versionScore * 100),
                    tokenOverlap: Math.round(candidate.breakdown.tokenOverlapScore * 100),
                },
            })),
            count: rankedCandidates.length,
            totalFound: results.length,
        });

        res.end();
    } catch (error: any) {
        console.error("[CPE Find] Error:", error);
        res.write(`data: ${JSON.stringify({ type: "error", step: "error", message: error.message || "An error occurred" })}\n\n`);
        res.end();
    }
}

// ============================================================================
// POST /cpe/validate
// ------------------
// Validate a CPE string (check format and if it exists in NVD)
//
// Request Body:
//   { "cpeString": "cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*" }
//   { "cpeString": "cpe:2.3:h:siemens:simatic_s7-1500:-:*:*:*:*:*:*:*" }
//
// Response (valid & exists):
//   {
//     "success": true,
//     "isValid": true,
//     "existsInNvd": true,
//     "exactMatch": true,
//     "deprecated": false,
//     "message": "CPE is valid and exists in NVD database",
//     "parsed": {
//       "valid": true,
//       "part": "a",
//       "vendor": "openssl",
//       "product": "openssl",
//       "version": "1.1.1"
//     }
//   }
//
// Response (invalid format - 400):
//   {
//     "success": false,
//     "error": "INVALID_CPE_FORMAT",
//     "isValid": false,
//     "message": "Invalid CPE format: Must start with cpe:2.3:",
//     "parsed": { "valid": false, "error": "..." }
//   }
//
// Response (valid format but not found - 200):
//   {
//     "success": true,
//     "isValid": true,
//     "existsInNvd": false,
//     "exactMatch": false,
//     "message": "CPE format is valid but no matching entries found in NVD database"
//   }
//
// ============================================================================

export async function cpeValidateHandler(req: Request, res: Response) {
    try {
        const { cpeString } = req.body;

        // Validate input
        if (!cpeString || typeof cpeString !== 'string') {
            return res.status(400).json({
                success: false,
                error: "INVALID_INPUT",
                message: "cpeString is required and must be a string",
                example: { cpeString: "cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*" }
            });
        }

        const trimmedCpe = cpeString.trim();
        if (trimmedCpe.length < 10) {
            return res.status(400).json({
                success: false,
                error: "INVALID_INPUT",
                message: "cpeString is too short to be a valid CPE"
            });
        }

        console.log(`[CPE Validate] Validating: "${trimmedCpe}"`);
        const result = await cpe.validateCpe(trimmedCpe);

        // If CPE format is invalid, return 400
        if (!result.isValid) {
            return res.status(400).json({
                success: false,
                error: "INVALID_CPE_FORMAT",
                isValid: false,
                existsInNvd: false,
                exactMatch: false,
                deprecated: false,
                message: result.message,
                parsed: result.parsed
            });
        }

        // CPE format is valid - return the validation result
        return res.json({
            success: true,
            isValid: result.isValid,
            existsInNvd: result.existsInNvd,
            exactMatch: result.exactMatch,
            deprecated: result.deprecated,
            message: result.message,
            parsed: {
                part: result.parsed.part,
                vendor: result.parsed.vendor,
                product: result.parsed.product,
                version: result.parsed.version,
                update: result.parsed.update
            },
            // Only include matches count, not full data (to keep response lean)
            matchesFound: result.matches.length
        });
    } catch (error) {
        console.error("[CPE Validate] Error:", error);
        return res.status(500).json({
            success: false,
            error: "SERVER_ERROR",
            message: "Failed to validate CPE",
            detail: process.env.NODE_ENV === 'development' ? String(error) : undefined
        });
    }
}

// ============================================================================
// GET /assets/:environmentId
// --------------------------
// Get all assets for an environment
//
// Response:
//   {
//     "success": true,
//     "assets": [...]
//   }
// ============================================================================

export async function getAssetsHandler(req: Request, res: Response) {
    try {
        const { environmentId } = req.params;
        const user = req.user as PublicUser;


        if (!(await verifyEnvironment(user.id, environmentId))) {
            return res.status(404).json({ success: false, error: "Environment not found" });
        }

        const assets = await prisma.asset.findMany({
            where: { environmentId },
            orderBy: { createdAt: "desc" },
        });

        return res.json({
            success: true,
            data: assets,
            message: `Found ${assets.length} assets in environment ${environmentId}`,
        });
    } catch (error) {
        console.error("[Get Assets] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to get assets",
        });
    }
}

// ============================================================================
// POST /assets/:environmentId
// ---------------------------
// Create a new asset in an environment
//
// Request Body:
//   {
//     "name": "OpenSSL Server",          // Required: User-friendly name
//     "description": "Main SSL library", // Optional: Description
//     "cpes": [                          // Optional: Array of CPE objects with full metadata
//       { cpeName, cpeNameId, title, score, breakdown: { vendor, product, version, tokenOverlap } }
//     ],
//     "domain": "IT" | "OT" | "UNKNOWN"  // Optional: Asset domain
//   }
//
// Response:
//   {
//     "success": true,
//     "asset": { ... }
//   }
// ============================================================================

type CpeInput = {
    cpeName: string;
    cpeNameId: string;
    title: string;
    score: number;
    breakdown: {
        vendor: number;
        product: number;
        version: number;
        tokenOverlap: number;
    };
};

export async function createAssetHandler(req: Request, res: Response) {
    try {
        const { environmentId } = req.params;
        const user = req.user as PublicUser;
        const { name, description, cpes, domain, type, status, location, ipAddress, manufacturer, model, serialNumber } = req.body;

        // Validate input
        if (!name || typeof name !== "string") {
            return res.status(400).json({
                success: false,
                error: "INVALID_INPUT",
                message: "name is required and must be a string",
            });
        }

        if (!(await verifyEnvironment(user.id, environmentId))) {
            return res.status(404).json({ success: false, error: "Environment not found" });
        }

        // CPEs are trusted since they were displayed by the backend and selected by user
        // Store full CPE objects with scores and breakdown
        const selectedCpes: CpeInput[] = Array.isArray(cpes)
            ? cpes.filter((cpe: unknown): cpe is CpeInput =>
                typeof cpe === 'object' &&
                cpe !== null &&
                'cpeName' in cpe &&
                typeof (cpe as CpeInput).cpeName === 'string'
            )
            : [];

        // Create the asset
        const asset = await prisma.asset.create({
            data: {
                environmentId,
                name: name.trim(),
                description: description?.trim() || null,
                type: type?.trim() || "unknown",
                domain: domain || "UNKNOWN",
                status: status?.trim() || null,
                location: location?.trim() || null,
                ipAddress: ipAddress?.trim() || null,
                manufacturer: manufacturer?.trim() || null,
                model: model?.trim() || null,
                serialNumber: serialNumber?.trim() || null,
                cpes: selectedCpes,  // Stored as JSON
            },
        });


        return res.status(201).json({
            success: true,
            data: asset,
            message: "Asset created successfully",
        });
    } catch (error) {
        console.error("[Create Asset] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create asset",
        });
    }
}

export async function deleteAssetHandler(req: Request, res: Response) {
    try {
        const { environmentId, assetId } = req.params;
        const user = req.user as PublicUser;

        // validate input
        if (!assetId || typeof assetId !== "string") {
            return res.status(400).json({
                success: false,
                error: "INVALID_INPUT",
                message: "assetId is required and must be a string",
            });
        }


        if (!(await verifyEnvironment(user.id, environmentId))) {
            return res.status(404).json({ success: false, error: "Environment not found" });
        }

        // Verify asset belongs to environment
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, environmentId },
        });

        if (!asset) {
            return res.status(404).json({ success: false, error: "Asset not found in this environment" });
        }

        // Delete the Asset
        await prisma.asset.delete({
            where: { id: assetId },
        });
        return res.json({success: true, message: "Asset deleted successfully", });

    } 
    
    catch (error) {
        console.error("[Delete Asset] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete asset",
        });
    }
}

export async function updateAssetHandler(req: Request, res: Response) {
    try {
        const { environmentId, assetId } = req.params;
        const user = req.user as PublicUser;
        const { name, description, domain, type, status, location, ipAddress, x, y } = req.body;

        console.log(`[Update Asset] User ${user.id} updating asset ${assetId} in environment ${environmentId} with data:`, req.body);

        if (!(await verifyEnvironment(user.id, environmentId))) {
            return res.status(404).json({ success: false, error: "Environment not found" });
        }

        const asset = await prisma.asset.findFirst({
            where: { id: assetId, environmentId },
        });

        if (!asset) {
            return res.status(404).json({ success: false, error: "Asset not found in this environment" });
        }

        // Prepare update data
        const updateData: any = {};
        if (name && typeof name === "string") updateData.name = name.trim();
        if (description && typeof description === "string") updateData.description = description.trim();
        if (domain && typeof domain === "string") updateData.domain = domain.trim();
        if (type && typeof type === "string") updateData.type = type.trim();
        if (status && typeof status === "string") updateData.status = status.trim();
        if (location && typeof location === "string") updateData.location = location.trim();
        if (ipAddress && typeof ipAddress === "string") updateData.ipAddress = ipAddress.trim();
        if (typeof x === "number") updateData.x = x;
        if (typeof y === "number") updateData.y = y;

        // Update the Asset
        const updated = await prisma.asset.update({
            where: { id: assetId },
            data: updateData,
        });

        

        return res.json({
            success: true,
            data: updated,
            message: "Asset updated successfully",
        });
    } catch (error) {
        console.error("[Update Asset] Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update asset",
        });
    }
}

/**
 * Get vulnerabilities for a specific asset from the latest completed scan
 * GET /assets/:environmentId/:assetId/vulnerabilities
 */
export async function getAssetVulnerabilitiesHandler(req: Request, res: Response) {
    try {
        const { environmentId, assetId } = req.params;
        const user = req.user as PublicUser;

        // Validate input
        if (!assetId || typeof assetId !== "string") {
            return res.status(400).json({
                success: false,
                error: "INVALID_INPUT",
                message: "assetId is required and must be a string",
            });
        }

        if (!(await verifyEnvironment(user.id, environmentId))) {
            return res.status(404).json({ success: false, error: "Environment not found" });
        }

        // Verify asset belongs to environment
        const asset = await prisma.asset.findFirst({
            where: { id: assetId, environmentId },
        });

        if (!asset) {
            return res.status(404).json({
                success: false,
                error: "NOT_FOUND",
                message: "Asset not found in this environment",
            });
        }

        // Get the latest completed scan for this environment
        const latestScan = await prisma.securityScan.findFirst({
            where: {
                environmentId,
                status: ScanStatus.COMPLETED,
            },
            orderBy: { completedAt: "desc" },
            include: {
                assetScans: {
                    where: { assetId },
                    include: {
                        vulnerabilities: {
                            include: {
                                vulnerability: {
                                    select: {
                                        id: true,
                                        cveId: true,
                                        description: true,
                                        cvssScore: true,
                                        cvssVector: true,
                                        severity: true,
                                        publishedDate: true,
                                        lastModifiedDate: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!latestScan) {
            return res.status(404).json({
                success: false,
                error: "NO_SCAN_DATA",
                message: "No completed scan found for this environment. Run a scan first.",
            });
        }

        // Extract vulnerabilities from the asset scan
        const assetScan = latestScan.assetScans[0];
        
        if (!assetScan) {
            return res.json({
                success: true,
                data: {
                    assetId,
                    assetName: asset.name,
                    scanId: latestScan.id,
                    scannedAt: latestScan.completedAt,
                    vulnerabilityCount: 0,
                    vulnerabilities: [],
                },
                message: "Asset was not scanned in the latest scan run",
            });
        }

        // Format vulnerabilities
        const vulnerabilities = assetScan.vulnerabilities.map((av) => ({
            id: av.vulnerability.id,
            cveId: av.vulnerability.cveId,
            description: av.vulnerability.description,
            cvssScore: av.vulnerability.cvssScore,
            cvssVector: av.vulnerability.cvssVector,
            severity: av.vulnerability.severity,
            publishedDate: av.vulnerability.publishedDate,
            lastModifiedDate: av.vulnerability.lastModifiedDate,
            cpeName: av.cpeName,
        }));

        // Sort by severity (CRITICAL > HIGH > MEDIUM > LOW > UNKNOWN)
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
        vulnerabilities.sort((a, b) => {
            return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
        });

        return res.json({
            success: true,
            data: {
                assetId,
                assetName: asset.name,
                scanId: latestScan.id,
                scannedAt: assetScan.scannedAt,
                vulnerabilityCount: vulnerabilities.length,
                vulnerabilities,
            },
            message: `Found ${vulnerabilities.length} vulnerabilities for this asset`,
        });
    } catch (error) {
        console.error("[Get Asset Vulnerabilities] Error:", error);
        return res.status(500).json({
            success: false,
            error: "SERVER_ERROR",
            message: "Failed to fetch asset vulnerabilities",
        });
    }
}
