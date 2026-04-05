import { Router } from "express";
import { explainCveHandler } from "../controllers/ai.controller";

const router = Router();

// POST /ai/explain-cve - Generate AI explanation for a CVE
router.post("/explain-cve", explainCveHandler);

export default router;
