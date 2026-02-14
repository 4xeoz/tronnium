import { Router } from "express";
import { cpeFindHandler, cpeValidateHandler, createAssetHandler, deleteAssetHandler, getAssetsHandler } from "../controllers/asset.controller";
import { logRequest } from "../middleware/logger";
import { jwtAuthGuard } from "../auth/passport";

export const assetRouter = Router();

// Health check
assetRouter.get("/test", logRequest(), (req, res) => {
    res.json({ message: "Asset route is working!" });
});

// ============================================================================
// CPE ROUTES
// ============================================================================
//
// POST /cpe/find     - Find and rank CPE candidates from asset name
//                      Body: { "assetName": "OpenSSL 1.1.1", "topN": 5 }
//                      Returns: Ranked CPE candidates with scores
//
// POST /cpe/validate - Validate a CPE string format and existence in NVD
//                      Body: { "cpeString": "cpe:2.3:a:openssl:..." }
//                      Returns: Validation result with isValid, existsInNvd
//
// ============================================================================

// Find and rank CPE candidates from human-readable asset name
// Runs full pipeline: Parse → Search NVD → Rank & Score
assetRouter.get("/cpe/find", logRequest(), cpeFindHandler);

// Validate a CPE string against NVD database
// Checks both format validity and existence in NVD
assetRouter.post("/cpe/validate", logRequest(), cpeValidateHandler);

// ============================================================================
// ASSET CRUD ROUTES (Requires Authentication)
// ============================================================================

// GET /assets/:environmentId - Get all assets for an environment
assetRouter.get("/:environmentId", jwtAuthGuard(), logRequest(), getAssetsHandler);

// POST /assets/:environmentId - Create a new asset in an environment
assetRouter.post("/:environmentId", jwtAuthGuard(), logRequest(), createAssetHandler);

// POST /assets/:environmentId/:assetId/delete - Delete an asset from an environment
assetRouter.post("/:environmentId/:assetId/delete", jwtAuthGuard(), logRequest(), deleteAssetHandler);