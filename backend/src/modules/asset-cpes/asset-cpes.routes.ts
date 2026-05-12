import { Router } from "express";
import { cpeFindHandler, cpeSemanticSearchHandler, cpeSemanticSearchRawHandler, cpeValidateHandler } from "./cpe.controller";
import { jwtAuthGuard } from "../authentication/public";

const router = Router();

router.get("/cpe/find", cpeFindHandler);


router.use(jwtAuthGuard());

router.post("/cpe/semantic-search", cpeSemanticSearchHandler);
router.post("/cpe/semantic-search-raw", cpeSemanticSearchRawHandler);
router.post("/cpe/validate", cpeValidateHandler);

export const assetCpesRouter = router;
