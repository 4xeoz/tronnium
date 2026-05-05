import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { verifyEnvironment } from "../../lib/verify-environment";
import type { PublicUser } from "../../types/express";
import { ok, err } from "../../lib/response-helpers";

const VALID_TYPES = ["DEPENDS_ON", "CONTROLS", "PROVIDES_SERVICE", "SHARES_DATA_WITH"];
const VALID_CRITICALITIES = ["LOW", "MEDIUM", "HIGH"];

export async function getRelationshipsHandler(req: Request, res: Response) {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;

    if (!(await verifyEnvironment(user.id, environmentId))) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found"));
    }

    const relationships = await prisma.relationship.findMany({
      where: { environmentId },
      include: {
        fromAsset: true,
        toAsset: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json(
      ok(relationships, `Found ${relationships.length} relationships`)
    );
  } catch (error) {
    console.error("[Get Relationships] Error:", error);
    return res.status(500).json(err("FETCH_FAILED", "Failed to fetch relationships"));
  }
}

export async function createRelationshipHandler(req: Request, res: Response) {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;
    const { fromAssetId, toAssetId, type, criticality } = req.body;

    // Validation
    if (!fromAssetId || !toAssetId) {
      return res.status(400).json(
        err("INVALID_INPUT", "fromAssetId and toAssetId are required")
      );
    }

    if (fromAssetId === toAssetId) {
      return res.status(400).json(
        err("INVALID_INPUT", "Cannot create self-referencing relationships")
      );
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json(
        err("INVALID_INPUT", `Type must be one of: ${VALID_TYPES.join(", ")}`)
      );
    }

    if (!criticality || !VALID_CRITICALITIES.includes(criticality.toUpperCase())) {
      return res.status(400).json(
        err("INVALID_INPUT", `Criticality must be one of: ${VALID_CRITICALITIES.join(", ")}`)
      );
    }

    // Verify environment
    if (!(await verifyEnvironment(user.id, environmentId))) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found"));
    }

    // Verify both assets exist
    const [fromAsset, toAsset] = await Promise.all([
      prisma.asset.findFirst({
        where: { id: fromAssetId, environmentId },
      }),
      prisma.asset.findFirst({
        where: { id: toAssetId, environmentId },
      }),
    ]);

    if (!fromAsset || !toAsset) {
      return res.status(404).json(
        err("NOT_FOUND", "One or both assets not found in this environment")
      );
    }

    // Check for duplicate
    const existing = await prisma.relationship.findFirst({
      where: {
        fromAssetId,
        toAssetId,
        type,
        environmentId,
      },
    });

    // prevent closed loop relationships.
    const loopCheck = await prisma.relationship.findFirst({
      where: {
        fromAssetId: toAssetId,
        toAssetId: fromAssetId,
        type,
        environmentId,
      },
    });

    if (loopCheck) {
      return res.status(400).json(
        err("INVALID_INPUT", "Creating this relationship would create a closed loop. Please choose a different type or assets.")
      );
    }

    if (existing) {
      return res.status(409).json(
        err("CONFLICT", "This relationship already exists")
      );
    }

    // Create
    const relationship = await prisma.relationship.create({
      data: {
        environmentId,
        fromAssetId,
        toAssetId,
        type,
        criticality: criticality.toUpperCase(),
      },
      include: {
        fromAsset: true,
        toAsset: true,
      },
    });

    return res.status(201).json(
      ok(relationship, "Relationship created successfully")
    );
  } catch (error) {
    console.error("[Create Relationship] Error:", error);
    return res.status(500).json(err("CREATE_FAILED", "Failed to create relationship"));
  }
}

export async function updateRelationshipHandler(req: Request, res: Response) {
  try {
    const { environmentId, relationshipId } = req.params;
    const user = req.user as PublicUser;
    const { type, criticality } = req.body;

    // Verify environment
    if (!(await verifyEnvironment(user.id, environmentId))) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found"));
    }

    // Verify relationship exists
    const existing = await prisma.relationship.findFirst({
      where: { id: relationshipId, environmentId },
    });

    if (!existing) {
      return res.status(404).json(err("NOT_FOUND", "Relationship not found"));
    }

    // Validate updates
    const updates: Record<string, any> = {};

    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json(
          err("INVALID_INPUT", `Type must be one of: ${VALID_TYPES.join(", ")}`)
        );
      }
      updates.type = type;
    }

    if (criticality) {
      if (!VALID_CRITICALITIES.includes(criticality.toUpperCase())) {
        return res.status(400).json(
          err("INVALID_INPUT", `Criticality must be one of: ${VALID_CRITICALITIES.join(", ")}`)
        );
      }
      updates.criticality = criticality.toUpperCase();
    }

    // Update
    const updated = await prisma.relationship.update({
      where: { id: relationshipId },
      data: updates,
      include: {
        fromAsset: true,
        toAsset: true,
      },
    });

    return res.json(
      ok(updated, "Relationship updated successfully")
    );
  } catch (error) {
    console.error("[Update Relationship] Error:", error);
    return res.status(500).json(err("UPDATE_FAILED", "Failed to update relationship"));
  }
}

export async function deleteRelationshipHandler(req: Request, res: Response) {
  try {
    const { environmentId, relationshipId } = req.params;
    const user = req.user as PublicUser;

    // Verify environment
    if (!(await verifyEnvironment(user.id, environmentId))) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found"));
    }

    // Verify relationship exists
    const existing = await prisma.relationship.findFirst({
      where: { id: relationshipId, environmentId },
    });

    if (!existing) {
      return res.status(404).json(err("NOT_FOUND", "Relationship not found"));
    }

    // Delete
    await prisma.relationship.delete({
      where: { id: relationshipId },
    });

    return res.json(
      ok(null, "Relationship deleted successfully")
    );
  } catch (error) {
    console.error("[Delete Relationship] Error:", error);
    return res.status(500).json(err("DELETE_FAILED", "Failed to delete relationship"));
  }
}
