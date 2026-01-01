import { Router } from "express";
import { jwtAuthGuard } from "../auth/passport";
import passport from "passport";
import { logRequest } from "../middleware/logger";
import { analyzeAssetTextHandler } from "../controllers/asset.controller";

export const assetRouter = Router();

assetRouter.get("/test" , logRequest(), (req, res) => {
    res.json({ message: "Asset route is working!" });
});

assetRouter.post("/analyze", analyzeAssetTextHandler);