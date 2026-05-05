import { Router } from "express";
import { jwtAuthGuard } from "../authentication/public";
import {
  createEnvironmentHandler,
  getEnvironmentsHandler,
  getEnvironmentByIdHandler,
  updateEnvironmentHandler,
  deleteEnvironmentHandler,
} from "./environments-core.controller";

const router = Router();

router.use(jwtAuthGuard());

router.post("/", createEnvironmentHandler);
router.get("/", getEnvironmentsHandler);
router.get("/:id", getEnvironmentByIdHandler);
router.put("/:id", updateEnvironmentHandler);
router.delete("/:id", deleteEnvironmentHandler);

export default router;
