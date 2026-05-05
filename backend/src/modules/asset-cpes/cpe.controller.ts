import { Request, Response } from "express";
import { findCpe, validateCpe } from ".";
import { rankCpeCandidates } from "./search/cpe-ranking.service";
import type { CpeCandidate } from "./cpe.types";
import { ok, err } from "../../lib/response-helpers";
import { semanticCpeSearch, semanticCpeSearchRaw } from "./search-vector/cpe-vector-search.service";

export async function cpeFindHandler(req: Request, res: Response) {
    try {
        const { assetName, topN } = req.query;

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

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const sendProgress = (step: string, message: string, type: "progress" | "completed" | "error" = "progress", data?: any) => {
            res.write(`data: ${JSON.stringify({ type, step, message, data })}\n\n`);
        };

        const onProgress = (step: string, message: string) => {
            sendProgress(step, message, "progress");
        };

        console.log(`[CPE Find] Processing: "${trimmedAssetName}"`);
        const { parsed, results } = await findCpe(trimmedAssetName, onProgress);

        sendProgress("ranking", `Found ${results.length} candidates. Ranking and scoring...`, "progress");
        const rankedCandidates: CpeCandidate[] = rankCpeCandidates(parsed, results, resultLimit, onProgress);

        console.log(`[CPE Find] Found ${results.length} CPEs, returning top ${rankedCandidates.length} ranked candidates`);

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

        if (!cpeString || typeof cpeString !== 'string') {
            return res.status(400).json(
                err("INVALID_INPUT", "cpeString is required and must be a string — example: cpe:2.3:a:openssl:openssl:1.1.1:*:*:*:*:*:*:*")
            );
        }

        const trimmedCpe = cpeString.trim();
        if (trimmedCpe.length < 10) {
            return res.status(400).json(
                err("INVALID_INPUT", "cpeString is too short to be a valid CPE")
            );
        }

        const result = await validateCpe(trimmedCpe);

        if (!result.isValid) {
            return res.status(400).json(
                err("INVALID_CPE_FORMAT", result.message)
            );
        }

        return res.json(ok({
            isValid: result.isValid,
            existsInNvd: result.existsInNvd,
            exactMatch: result.exactMatch,
            deprecated: result.deprecated,
            parsed: {
                part: result.parsed.part,
                vendor: result.parsed.vendor,
                product: result.parsed.product,
                version: result.parsed.version,
                update: result.parsed.update
            },
            matchesFound: result.matches.length,
        }, result.message));
    } catch (error) {
        console.error("[CPE Validate] Error:", error);
        return res.status(500).json(err("SERVER_ERROR", "Failed to validate CPE"));
    }
}


export async function cpeSemanticSearchHandler(req: Request, res: Response) {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return res.status(400).json(
        err("INVALID_INPUT", "q is required and must be at least 2 characters")
      );
    }

    const limitN =
      limit && !isNaN(Number(limit))
        ? Math.min(Math.max(1, Number(limit)), 20)
        : 10;

    console.log(`[CPE Semantic] Searching: "${q.trim()}" (limit: ${limitN})`);

    const { queryText, results } = await semanticCpeSearch(q.trim(), limitN);

    return res.status(200).json(
      ok({
        queryText,
        results: results.map((r) => ({
          cpeName: r.cpeName,
          title: r.title,
          similarity: r.similarity,
        })),
      })
    );
  } catch (error: any) {
    console.error("[CPE Semantic] Error:", error);
    return res.status(500).json(
      err("SERVER_ERROR", error.message ?? "Search failed")
    );
  }
}

// cpe search without parsing asset name, pass it to the model directly as raw input
export async function cpeSemanticSearchRawHandler(req: Request, res: Response) {
  try {
    const { q, limit } = req.query;

    if (!q || typeof q !== "string" || q.trim().length < 2) {
      return res.status(400).json(
        err("INVALID_INPUT", "q is required and must be at least 2 characters")
      );
    }

    const limitN =
      limit && !isNaN(Number(limit))
        ? Math.min(Math.max(1, Number(limit)), 20)
        : 10;

    console.log(`[CPE Semantic Raw] Searching: "${q.trim()}" (limit: ${limitN})`);

    const { queryText, results } = await semanticCpeSearchRaw(q.trim(), limitN);

    return res.status(200).json(
      ok({
        queryText,
        results: results.map((r) => ({
          cpeName: r.cpeName,
          title: r.title,
          similarity: r.similarity,
        })),
      })
    );
  } catch (error: any) {
    console.error("[CPE Semantic Raw] Error:", error);
    return res.status(500).json(
      err("SERVER_ERROR", error.message ?? "Search failed")
    );
  }
}

