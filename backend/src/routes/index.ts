import { Router } from "express";
import { authRouter } from "./auth.routes";
import { healthRouter } from "./health.routes";
import { assetRouter } from "./asset.routes";
import environmentRouter from "./environment.routes";
import { relationshipRouter } from "./relationship.routes";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.send("Tronnium backend is running. Visit /health");
});

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/assets", assetRouter);
apiRouter.use("/environments", environmentRouter);
apiRouter.use("/relationships", relationshipRouter);
