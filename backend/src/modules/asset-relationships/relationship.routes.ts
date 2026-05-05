import { Router } from "express";
import { jwtAuthGuard } from "../authentication/public";
import { logRequest } from "../../middleware/logger";
import {
  getRelationshipsHandler,
  createRelationshipHandler,
  updateRelationshipHandler,
  deleteRelationshipHandler,
} from "./relationship.controller";

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
