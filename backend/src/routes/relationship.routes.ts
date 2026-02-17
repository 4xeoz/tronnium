// GET	/relationships/:environmentId	Get all relationships in environment
// POST	/relationships/:environmentId	Create a relationship
// PATCH	/relationships/:environmentId/:relationshipId	Update criticality/type
// DELETE	/relationships/:environmentId/:relationshipId	Delete a relationship

import { Router } from "express";
import { createRelationshipHandler, deleteRelationshipHandler, getRelationshipsHandler, updateRelationshipHandler } from "../controllers/relationships.controller";
import { logRequest } from "../middleware/logger";
import { jwtAuthGuard } from "../auth/passport";

export const relationshipRouter = Router();

relationshipRouter.use(jwtAuthGuard());

// Get all relationships for an environment 
relationshipRouter.get("/:environmentId",  getRelationshipsHandler);
relationshipRouter.post("/:environmentId", createRelationshipHandler);
relationshipRouter.patch("/:environmentId/:relationshipId", updateRelationshipHandler);
relationshipRouter.delete("/:environmentId/:relationshipId", deleteRelationshipHandler);

