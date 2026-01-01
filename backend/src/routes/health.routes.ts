import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ isOk: "ok", uptime: process.uptime() });
});
