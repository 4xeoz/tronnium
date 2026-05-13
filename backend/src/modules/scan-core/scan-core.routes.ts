import { Router } from "express";
import { jwtAuthGuard } from "../authentication/public";
import {
  startScanHandler,
  getLatestScanHandler,
  getScanHistoryHandler,
  getScanSettingsHandler,
  getScanByIdHandler,
  deleteScanHandler,
  getScanProgressHandler,
} from "./scan-core.controller";

const scanCoreRouter = Router();

scanCoreRouter.use(jwtAuthGuard());

scanCoreRouter.get("/:environmentId", getScanHistoryHandler);
scanCoreRouter.get("/:environmentId/latest", getLatestScanHandler);
scanCoreRouter.post("/:environmentId/start", startScanHandler);
scanCoreRouter.get("/:environmentId/start", startScanHandler);
scanCoreRouter.get("/:environmentId/settings", getScanSettingsHandler);
scanCoreRouter.get("/:environmentId/progress/:scanId", getScanProgressHandler);
scanCoreRouter.get("/:environmentId/:scanId", getScanByIdHandler);
scanCoreRouter.delete("/:environmentId/:scanId", deleteScanHandler);



export default scanCoreRouter;
