import { Router } from "express";
import { authRouter } from "../modules/authentication/auth.routes";
import { healthRouter } from "../modules/system-health/health.routes";
import { assetsCoreRouter } from "../modules/assets-core/assets-core.routes";
import { assetCpesRouter } from "../modules/asset-cpes/asset-cpes.routes";
import { assetVulnerabilitiesRouter } from "../modules/asset-vulnerabilities/asset-vulnerabilities.routes";
import environmentRouter from "../modules/environments-core/environments-core.routes";
import { relationshipRouter } from "../modules/asset-relationships/relationship.routes";
import scanRouter from "../modules/scan-core/scan-core.routes";
import aiRouter from "../modules/ai-security/ai.routes";
import devRouter from "../modules/developer-tools/dev.routes";
import vulnerabilityWorkflowRouter from "../modules/vulnerability-workflows/vulnerability-workflow.routes";
import dashboardRouter from "../modules/reporting/dashboard.routes";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.send("Tronnium backend is running. Visit /health");
});

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/assets", assetsCoreRouter);
apiRouter.use("/assets", assetCpesRouter);
apiRouter.use("/assets", assetVulnerabilitiesRouter);
apiRouter.use("/environments", environmentRouter);
apiRouter.use("/relationships", relationshipRouter);
apiRouter.use("/scans", scanRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/dev", devRouter);
apiRouter.use("/vulnerability-workflow", vulnerabilityWorkflowRouter);
apiRouter.use("/dashboard", dashboardRouter);
