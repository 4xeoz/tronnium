import { Router } from "express";
import { jwtAuthGuard } from "../auth/passport";
import {
	explainCveHandler,
	socAnalysisHandler,
	environmentBriefingHandler,
} from "../controllers/ai.controller";

const router = Router();

// POST /ai/explain-cve
// Generic CVE explanation — no auth required, no asset context
router.post("/explain-cve", explainCveHandler);

// POST /ai/soc-analysis
// Context-aware analysis for one CVE on one specific asset — no auth required
router.post("/soc-analysis", socAnalysisHandler);

// POST /ai/environment-briefing
// Holistic environment briefing across all assets — auth required (reads DB)
router.post("/environment-briefing", jwtAuthGuard(), environmentBriefingHandler);

export default router;
