import { Router } from "express";
import { jwtAuthGuard } from "../auth/passport";
import {
  startScanHandler,
  getLatestScanHandler,
  getScanHistoryHandler,
  getScanSettingsHandler,
  getScanByIdHandler,
} from "../controllers/scan.controller";

const scanRouter = Router();

// Apply JWT auth to all scan routes
scanRouter.use(jwtAuthGuard());

/**
 * GET /scans/:environmentId
 * Get scan history for an environment (last 10 scans by default)
 * Query params: ?limit=20
 */
scanRouter.get("/:environmentId", getScanHistoryHandler);

/**
 * GET /scans/:environmentId/latest
 * Get the most recent completed scan with full details
 */
scanRouter.get("/:environmentId/latest", getLatestScanHandler);

/**
 * GET /scans/:environmentId/start
 * Start a new vulnerability scan (SSE stream)
 * Note: Uses GET because EventSource only supports GET requests
 */
scanRouter.get("/:environmentId/start", startScanHandler);

/**
 * GET /scans/:environmentId/settings
 * Get scan settings and configuration options
 * Returns last scan date, max lookback date, etc.
 */
scanRouter.get("/:environmentId/settings", getScanSettingsHandler);

/**
 * GET /scans/:environmentId/:scanId
 * Get a single scan by ID with full details
 */
scanRouter.get("/:environmentId/:scanId", getScanByIdHandler);

export default scanRouter;