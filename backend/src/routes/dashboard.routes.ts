import { Router } from "express";
import { jwtAuthGuard } from "../auth/passport";
import { getDashboardOverviewHandler } from "../controllers/dashboard.controller";

const dashboardRouter = Router();

dashboardRouter.use(jwtAuthGuard());

/**
 * GET /dashboard/:environmentId/overview
 * Get unified dashboard overview for an environment
 */
dashboardRouter.get("/:environmentId/overview", getDashboardOverviewHandler);

export default dashboardRouter;
