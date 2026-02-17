import { Request, Response } from "express";
import prisma from "../lib/prisma";
import type { PublicUser } from "../types/express";

/**
 * Relationship API Controller
 * Handles CRUD operations for asset relationships/dependencies
 */

const VALID_TYPES = ["DEPENDS_ON", "CONTROLS", "PROVIDES_SERVICE", "SHARES_DATA_WITH"];
const VALID_CRITICALITIES = ["low", "medium", "high"];

/**
 * Verify environment belongs to authenticated user
 */
async function verifyEnvironmentOwner(environmentId: string, userId: string) {
  return prisma.environment.findFirst({
    where: { id: environmentId, ownerId: userId },
  });
}

/**
 * GET /relationships/:environmentId
 * Get all relationships for an environment
 */
export async function getRelationshipsHandler(req: Request, res: Response) {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;

    const env = await verifyEnvironmentOwner(environmentId, user.id);
    if (!env) {
      return res.status(404).json({
        success: false,
        message: "Environment not found",
      });
    }

    const relationships = await prisma.relationship.findMany({
      where: { environmentId },
      include: {
        fromAsset: { select: { id: true, name: true, type: true } },
        toAsset: { select: { id: true, name: true, type: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({
      success: true,
      data: relationships,
      message: `Found ${relationships.length} relationships`,
    });
  } catch (error) {
    console.error("[Get Relationships] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch relationships",
    });
  }
}

/**
 * POST /relationships/:environmentId
 * Create a new relationship between assets
 */
export async function createRelationshipHandler(req: Request, res: Response) {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;
    const { fromAssetId, toAssetId, type, criticality } = req.body;

    // Validation
    if (!fromAssetId || !toAssetId) {
      return res.status(400).json({
        success: false,
        message: "fromAssetId and toAssetId are required",
      });
    }

    if (fromAssetId === toAssetId) {
      return res.status(400).json({
        success: false,
        message: "Cannot create self-referencing relationships",
      });
    }

    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Type must be one of: ${VALID_TYPES.join(", ")}`,
      });
    }

    if (!criticality || !VALID_CRITICALITIES.includes(criticality.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Criticality must be one of: ${VALID_CRITICALITIES.join(", ")}`,
      });
    }

    // Verify environment
    const env = await verifyEnvironmentOwner(environmentId, user.id);
    if (!env) {
      return res.status(404).json({
        success: false,
        message: "Environment not found",
      });
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
      return res.status(404).json({
        success: false,
        message: "One or both assets not found in this environment",
      });
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

    if (existing) {
      return res.status(409).json({
        success: false,
        message: "This relationship already exists",
      });
    }

    // Create
    const relationship = await prisma.relationship.create({
      data: {
        environmentId,
        fromAssetId,
        toAssetId,
        type,
        criticality: criticality.toLowerCase(),
      },
      include: {
        fromAsset: { select: { id: true, name: true, type: true } },
        toAsset: { select: { id: true, name: true, type: true } },
      },
    });

    return res.status(201).json({
      success: true,
      data: relationship,
      message: "Relationship created successfully",
    });
  } catch (error) {
    console.error("[Create Relationship] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create relationship",
    });
  }
}

/**
 * PATCH /relationships/:environmentId/:relationshipId
 * Update a relationship
 */
export async function updateRelationshipHandler(req: Request, res: Response) {
  try {
    const { environmentId, relationshipId } = req.params;
    const user = req.user as PublicUser;
    const { type, criticality } = req.body;

    // Verify environment
    const env = await verifyEnvironmentOwner(environmentId, user.id);
    if (!env) {
      return res.status(404).json({
        success: false,
        message: "Environment not found",
      });
    }

    // Verify relationship exists
    const existing = await prisma.relationship.findFirst({
      where: { id: relationshipId, environmentId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Relationship not found",
      });
    }

    // Validate updates
    const updates: Record<string, any> = {};

    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return res.status(400).json({
          success: false,
          message: `Type must be one of: ${VALID_TYPES.join(", ")}`,
        });
      }
      updates.type = type;
    }

    if (criticality) {
      if (!VALID_CRITICALITIES.includes(criticality.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: `Criticality must be one of: ${VALID_CRITICALITIES.join(", ")}`,
        });
      }
      updates.criticality = criticality.toLowerCase();
    }

    // Update
    const updated = await prisma.relationship.update({
      where: { id: relationshipId },
      data: updates,
      include: {
        fromAsset: { select: { id: true, name: true, type: true } },
        toAsset: { select: { id: true, name: true, type: true } },
      },
    });

    return res.json({
      success: true,
      data: updated,
      message: "Relationship updated successfully",
    });
  } catch (error) {
    console.error("[Update Relationship] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update relationship",
    });
  }
}

/**
 * DELETE /relationships/:environmentId/:relationshipId
 * Delete a relationship
 */
export async function deleteRelationshipHandler(req: Request, res: Response) {
  try {
    const { environmentId, relationshipId } = req.params;
    const user = req.user as PublicUser;

    // Verify environment
    const env = await verifyEnvironmentOwner(environmentId, user.id);
    if (!env) {
      return res.status(404).json({
        success: false,
        message: "Environment not found",
      });
    }

    // Verify relationship exists
    const existing = await prisma.relationship.findFirst({
      where: { id: relationshipId, environmentId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: "Relationship not found",
      });
    }

    // Delete
    await prisma.relationship.delete({
      where: { id: relationshipId },
    });

    return res.json({
      success: true,
      message: "Relationship deleted successfully",
    });
  } catch (error) {
    console.error("[Delete Relationship] Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete relationship",
    });
  }
}
