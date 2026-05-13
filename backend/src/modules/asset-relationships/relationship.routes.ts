import { Router } from "express";
import { jwtAuthGuard } from "../authentication/public";
import { logRequest } from "../../middleware/logger";
import {
  getRelationshipsHandler,
  createRelationshipHandler,
  updateRelationshipHandler,
  deleteRelationshipHandler,
  getBlastRadiusHandler,
  getSingleAssetBlastRadiusHandler,
  getEntryPointsHandler,
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

/**
 * Blast radius & entry point endpoints
 */
relationshipRouter.get(
  "/:environmentId/blast-radius",
  jwtAuthGuard(),
  logRequest(),
  getBlastRadiusHandler
);

relationshipRouter.get(
  "/:environmentId/blast-radius/:assetId",
  jwtAuthGuard(),
  logRequest(),
  getSingleAssetBlastRadiusHandler
);

relationshipRouter.get(
  "/:environmentId/entry-points",
  jwtAuthGuard(),
  logRequest(),
  getEntryPointsHandler
);
