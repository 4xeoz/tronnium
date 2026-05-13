import { Router } from "express";
import { jwtAuthGuard } from "../authentication/public";
import {
  getScheduleHandler,
  upsertScheduleHandler,
  deleteScheduleHandler,
} from "./scan-schedule.controller";

const scanScheduleRouter = Router();

scanScheduleRouter.use(jwtAuthGuard());

scanScheduleRouter.get("/:environmentId/schedule", getScheduleHandler);
scanScheduleRouter.put("/:environmentId/schedule", upsertScheduleHandler);
scanScheduleRouter.delete("/:environmentId/schedule", deleteScheduleHandler);

export default scanScheduleRouter;
