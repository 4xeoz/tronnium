import { Router } from "express";
import { jwtAuthGuard } from "../auth/passport";
import { logRequest } from "../middleware/logger";
import {
  getRelationshipsHandler,
  createRelationshipHandler,
  updateRelationshipHandler,
  deleteRelationshipHandler,
} from "../controllers/relationship.controller";

export const relationshipRouter = Router();

/**
 * Relationship endpoints
 */
relationshipRouter.get(
  "/:environmentId",
  jwtAuthGuard(),
  logRequest(),
  getRelationshipsHandler
);

relationshipRouter.post(
  "/:environmentId",
  jwtAuthGuard(),
  logRequest(),
  createRelationshipHandler
);

relationshipRouter.patch(
  "/:environmentId/:relationshipId",
  jwtAuthGuard(),
  logRequest(),
  updateRelationshipHandler
);

relationshipRouter.delete(
  "/:environmentId/:relationshipId",
  jwtAuthGuard(),
  logRequest(),
  deleteRelationshipHandler
);
