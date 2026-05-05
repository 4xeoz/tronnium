import { Router } from "express";
import { cpeFindHandler, cpeSemanticSearchHandler, cpeSemanticSearchRawHandler, cpeValidateHandler } from "./cpe.controller";
import { jwtAuthGuard } from "../authentication/public";

const router = Router();

router.get("/cpe/semantic-search", cpeSemanticSearchHandler);
router.get("/cpe/semantic-search-raw", cpeSemanticSearchRawHandler);
router.get("/cpe/find", jwtAuthGuard(), cpeFindHandler);
router.post("/cpe/validate", jwtAuthGuard(), cpeValidateHandler);

export const assetCpesRouter = router;
