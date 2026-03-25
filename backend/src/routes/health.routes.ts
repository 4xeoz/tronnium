import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({ 
    sucess: true,
    data : {
      isOk: "ok",
      uptime: process.uptime(),
    },
    message: "Health check successful"
   });
});
