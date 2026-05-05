import { Router } from "express";
import { getAssetVulnerabilitiesHandler } from "./asset-vulnerability.controller";
import { jwtAuthGuard } from "../authentication/public";

const router = Router();

router.get("/:environmentId/:assetId/vulnerabilities", jwtAuthGuard(), getAssetVulnerabilitiesHandler);

export const assetVulnerabilitiesRouter = router;
