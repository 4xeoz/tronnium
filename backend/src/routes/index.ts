import { Router } from "express";
import { authRouter } from "../modules/authentication/auth.routes";
import { healthRouter } from "../modules/system-health/health.routes";
import { assetRouter } from "../modules/assets/asset.routes";
import environmentRouter from "../modules/environments/environment.routes";
import { relationshipRouter } from "../modules/asset-relationships/relationship.routes";
import scanRouter from "../modules/vulnerability-scans/scan.routes";
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
apiRouter.use("/assets", assetRouter);
apiRouter.use("/environments", environmentRouter);
apiRouter.use("/relationships", relationshipRouter);
apiRouter.use("/scans", scanRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/dev", devRouter);
apiRouter.use("/vulnerability-workflow", vulnerabilityWorkflowRouter);
apiRouter.use("/dashboard", dashboardRouter);
