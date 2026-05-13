import { Router } from "express";
import { jwtAuthGuard } from "../authentication/public";
import {
	explainCveHandler,
	socAnalysisHandler,
	environmentBriefingHandler,
	chatHandler,
} from "./ai.controller";

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

// POST /ai/chat
// Multi-turn chat with full environment context — auth required
router.post("/chat", jwtAuthGuard(), chatHandler);

export default router;
