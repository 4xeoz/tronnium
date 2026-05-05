import { Router } from "express";
import { jwtAuthGuard } from "../authentication/public";
import { getDashboardOverviewHandler } from "./dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.use(jwtAuthGuard());

/**
 * GET /dashboard/:environmentId/overview
 * Get unified dashboard overview for an environment
 */
dashboardRouter.get("/:environmentId/overview", getDashboardOverviewHandler);

export default dashboardRouter;
