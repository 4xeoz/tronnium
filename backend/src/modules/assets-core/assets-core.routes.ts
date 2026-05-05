import { Router } from "express";
import { createAssetHandler, deleteAssetHandler, getAssetsHandler, updateAssetHandler } from "./assets-core.controller";
import { jwtAuthGuard } from "../authentication/public";

const router = Router();

router.get("/:environmentId", jwtAuthGuard(), getAssetsHandler);
router.post("/:environmentId", jwtAuthGuard(), createAssetHandler);
router.put("/:environmentId/:assetId", jwtAuthGuard(), updateAssetHandler);
router.delete("/:environmentId/:assetId", jwtAuthGuard(), deleteAssetHandler);

export const assetsCoreRouter = router;
