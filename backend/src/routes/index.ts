import { Router } from "express";
import { authRouter } from "./auth.routes";
import { healthRouter } from "./health.routes";
import { assetRouter } from "./asset.routes";
import environmentRouter from "./environment.routes";
import { relationshipRouter } from "./relationship.routes";
import scanRouter from "./scan.routes";
import aiRouter from "./ai.routes";
import devRouter from "./dev.routes";
import vulnerabilityWorkflowRouter from "./vulnerabilityWorkflow.routes";
import dashboardRouter from "./dashboard.routes";

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
