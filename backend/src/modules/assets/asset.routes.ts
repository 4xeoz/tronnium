import { Router } from "express";
import { createAssetHandler, deleteAssetHandler, getAssetsHandler, updateAssetHandler } from "./asset.controller";
import { cpeFindHandler, cpeValidateHandler } from "./cpe/cpe.controller";
import { getAssetVulnerabilitiesHandler } from "./asset-vulnerability.controller";
import { jwtAuthGuard } from "../authentication/passport";

const router = Router();

// CPE endpoints
router.get("/cpe/find", jwtAuthGuard(), cpeFindHandler);
router.post("/cpe/validate", jwtAuthGuard(), cpeValidateHandler);

// Asset endpoints
router.get("/:environmentId", jwtAuthGuard(), getAssetsHandler);
router.post("/:environmentId", jwtAuthGuard(), createAssetHandler);
router.put("/:environmentId/:assetId", jwtAuthGuard(), updateAssetHandler);
router.delete("/:environmentId/:assetId", jwtAuthGuard(), deleteAssetHandler);
router.get("/:environmentId/:assetId/vulnerabilities", jwtAuthGuard(), getAssetVulnerabilitiesHandler);

export const assetRouter = router;
