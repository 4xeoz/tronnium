import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { verifyEnvironment } from "../../lib/verify-environment";
import type { PublicUser } from "../../types/express";
import { ok, err } from "../../lib/response-helpers";
import {
  computeEnvironmentBlastRadius,
  runWeightedTraversal,
} from "../../lib/graph-traversal.service";
import {
  loadAssetVulnProfiles,
  loadAdjacencyList,
  findEntryPoints,
} from "../../lib/graph-data.service";

const VALID_TYPES = ["NETWORK_CONNECTS_TO", "MANAGED_BY", "AUTHENTICATES_VIA", "EXECUTES_CODE_FROM", "RECEIVES_DATA_FROM", "SHARES_CREDENTIALS_WITH"];
const VALID_CRITICALITIES = ["LOW", "MEDIUM", "HIGH"];
const VALID_SECURITY_CRITICALITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

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
    const { fromAssetId, toAssetId, type, operationalCriticality, securityCriticality } = req.body;

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

    if (!operationalCriticality || !VALID_CRITICALITIES.includes(operationalCriticality.toUpperCase())) {
      return res.status(400).json(
        err("INVALID_INPUT", `operationalCriticality must be one of: ${VALID_CRITICALITIES.join(", ")}`)
      );
    }

    if (!securityCriticality || !VALID_SECURITY_CRITICALITIES.includes(securityCriticality.toUpperCase())) {
      return res.status(400).json(
        err("INVALID_INPUT", `securityCriticality must be one of: ${VALID_SECURITY_CRITICALITIES.join(", ")}`)
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
        operationalCriticality: operationalCriticality.toUpperCase(),
        securityCriticality: securityCriticality.toUpperCase(),
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
    const { type, operationalCriticality, securityCriticality } = req.body;

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

    if (operationalCriticality) {
      if (!VALID_CRITICALITIES.includes(operationalCriticality.toUpperCase())) {
        return res.status(400).json(
          err("INVALID_INPUT", `operationalCriticality must be one of: ${VALID_CRITICALITIES.join(", ")}`)
        );
      }
      updates.operationalCriticality = operationalCriticality.toUpperCase();
    }

    if (securityCriticality) {
      if (!VALID_SECURITY_CRITICALITIES.includes(securityCriticality.toUpperCase())) {
        return res.status(400).json(
          err("INVALID_INPUT", `securityCriticality must be one of: ${VALID_SECURITY_CRITICALITIES.join(", ")}`)
        );
      }
      updates.securityCriticality = securityCriticality.toUpperCase();
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

// ─── Blast Radius & Entry Points ────────────────────────────────────────────

/**
 * GET /relationships/:environmentId/blast-radius
 *
 * Query params:
 *   - costBudget      (number, default 50)
 *   - epssThreshold   (number, 0–1, optional)
 */
export async function getBlastRadiusHandler(req: Request, res: Response) {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;

    if (!(await verifyEnvironment(user.id, environmentId))) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found"));
    }

    const costBudget = req.query.costBudget
      ? parseFloat(req.query.costBudget as string)
      : undefined;
    const epssThreshold = req.query.epssThreshold
      ? parseFloat(req.query.epssThreshold as string)
      : undefined;

    const result = await computeEnvironmentBlastRadius(environmentId, {
      budget: costBudget,
      epssThreshold,
    });

    // Convert Map → array sorted by descending compromise score
    const sortedRisks = [...result.assetRisks.values()].sort(
      (a, b) => b.maxCompromiseScore - a.maxCompromiseScore
    );

    return res.json(
      ok({
        environmentId: result.environmentId,
        entryPoints: result.entryPoints,
        runs: result.runs,
        totalAssetsReached: result.totalAssetsReached,
        assetRisks: sortedRisks,
      })
    );
  } catch (error) {
    console.error("[Get Blast Radius] Error:", error);
    return res.status(500).json(err("BLAST_RADIUS_FAILED", "Failed to compute blast radius"));
  }
}

/**
 * GET /relationships/:environmentId/blast-radius/:assetId
 *
 * Run BFS from a single user-specified asset (skips entry-point detection).
 */
export async function getSingleAssetBlastRadiusHandler(
  req: Request,
  res: Response
) {
  try {
    const { environmentId, assetId } = req.params;
    const user = req.user as PublicUser;

    if (!(await verifyEnvironment(user.id, environmentId))) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found"));
    }

    const costBudget = req.query.costBudget
      ? parseFloat(req.query.costBudget as string)
      : undefined;

    const vulnProfiles = await loadAssetVulnProfiles(environmentId);
    const adjList = await loadAdjacencyList(environmentId);

    const result = runWeightedTraversal(
      [assetId],
      adjList,
      vulnProfiles,
      costBudget
    );

    // Convert reached Map to array for JSON
    const reachedArray = [...result.reached.entries()].map(
      ([assetId, node]) => ({
        assetId,
        ...node,
      })
    );

    return res.json(
      ok({
        sourceAssetId: assetId,
        budget: result.budget,
        nodesVisited: result.nodesVisited,
        edgesGated: result.edgesGated,
        reached: reachedArray,
        gatedEdges: result.gatedEdges,
      })
    );
  } catch (error) {
    console.error("[Get Single Asset Blast Radius] Error:", error);
    return res
      .status(500)
      .json(err("BLAST_RADIUS_FAILED", "Failed to compute single-asset blast radius"));
  }
}

/**
 * GET /relationships/:environmentId/entry-points
 *
 * Returns externally-facing assets with active network-pivot vulns,
 * including their base compromise scores.
 */
export async function getEntryPointsHandler(req: Request, res: Response) {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;

    if (!(await verifyEnvironment(user.id, environmentId))) {
      return res.status(404).json(err("NOT_FOUND", "Environment not found"));
    }

    const vulnProfiles = await loadAssetVulnProfiles(environmentId);
    const entryPointIds = await findEntryPoints(environmentId, vulnProfiles);

    if (entryPointIds.length === 0) {
      return res.json(ok([], "No entry points found"));
    }

    const assets = await prisma.asset.findMany({
      where: { id: { in: entryPointIds } },
      select: {
        id: true,
        name: true,
        type: true,
        isExternallyFacing: true,
      },
    });

    const withScores = assets.map((asset) => {
      const profile = vulnProfiles.get(asset.id);
      const baseCompromiseScore = profile?.bestNetworkPivotScore
        ? Math.min((profile.bestNetworkPivotScore / 20.0) * 100, 100)
        : 0;

      return {
        ...asset,
        baseCompromiseScore,
        hasNetworkPivot: profile?.hasNetworkPivot ?? false,
        hasCredentialTheft: profile?.hasCredentialTheft ?? false,
      };
    });

    // Sort by descending base compromise score
    withScores.sort((a, b) => b.baseCompromiseScore - a.baseCompromiseScore);

    return res.json(ok(withScores, `Found ${withScores.length} entry points`));
  } catch (error) {
    console.error("[Get Entry Points] Error:", error);
    return res.status(500).json(err("ENTRY_POINTS_FAILED", "Failed to fetch entry points"));
  }
}
