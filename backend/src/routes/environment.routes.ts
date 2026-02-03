import { Router } from "express";
import { jwtAuthGuard } from "../auth/passport";
import {
  createEnvironmentHandler,
  getEnvironmentsHandler,
  getEnvironmentByIdHandler,
  updateEnvironmentHandler,
  deleteEnvironmentHandler,
} from "../controllers/environment.controller";

const router = Router();

// All routes require authentication
router.use(jwtAuthGuard()); 

// POST /environments - Create new environment
router.post("/", createEnvironmentHandler);

// GET /environments - Get all environments for user
router.get("/", getEnvironmentsHandler);

// GET /environments/:id - Get single environment
router.get("/:id", getEnvironmentByIdHandler);

// PUT /environments/:id - Update environment
router.put("/:id", updateEnvironmentHandler);

// DELETE /environments/:id - Delete environment
router.delete("/:id", deleteEnvironmentHandler);

export default router;
