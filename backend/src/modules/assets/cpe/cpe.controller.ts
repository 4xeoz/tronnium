import { Request, Response } from "express";
import { cpe } from ".";
import { rankCpeCandidates } from "./cpe-ranking.service";
import type { CpeCandidate } from "../../../types/cpe.types";
import { ok, err } from "../../../lib/response-helpers";

export async function cpeFindHandler(req: Request, res: Response) {
    try {
        const { assetName, topN } = req.query;

        // Validate input
        if (!assetName || typeof assetName !== "string") {
            return res.status(400).json(
                err("INVALID_INPUT", "assetName is required and must be a string")
            );
        }

        const trimmedAssetName = assetName.trim();
        if (trimmedAssetName.length < 2) {
            return res.status(400).json(
                err("INVALID_INPUT", "assetName must be at least 2 characters long")
            );
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

export async function cpeValidateHandler(req: Request, res: Response) {
    try {
        const { cpeString } = req.body;

        // Validate input
        if (!cpeString || typeof cpeString !== 'string') {
            return res.status(400).json({
                ...err("INVALID_INPUT", "cpeString is required and must be a string"),
                example: { cpeString: "cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*" }
            });
        }

        const trimmedCpe = cpeString.trim();
        if (trimmedCpe.length < 10) {
            return res.status(400).json(
                err("INVALID_INPUT", "cpeString is too short to be a valid CPE")
            );
        }

        console.log(`[CPE Validate] Validating: "${trimmedCpe}"`);
        const result = await cpe.validateCpe(trimmedCpe);

        // If CPE format is invalid, return 400
        if (!result.isValid) {
            return res.status(400).json({
                ...err("INVALID_CPE_FORMAT", result.message),
                isValid: false,
                existsInNvd: false,
                exactMatch: false,
                deprecated: false,
                parsed: result.parsed
            });
        }

        // CPE format is valid - return the validation result
        return res.json({
            ...ok(null),
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
            matchesFound: result.matches.length
        });
    } catch (error) {
        console.error("[CPE Validate] Error:", error);
        return res.status(500).json({
            ...err("SERVER_ERROR", "Failed to validate CPE"),
            detail: process.env.NODE_ENV === 'development' ? String(error) : undefined
        });
    }
}
