import { Router } from "express";
import { explainCveHandler } from "../controllers/ai.controller";
import { socAnalysisHandler } from "../controllers/ai.controller";

const router = Router();

// POST /ai/explain-cve - Generate AI explanation for a CVE
router.post("/explain-cve", explainCveHandler);

// POST /ai/soc-analysis
router.post("/soc-analysis", socAnalysisHandler);

export default router;
