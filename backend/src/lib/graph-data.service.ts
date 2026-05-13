import prisma from "./prisma";
import { parseCvssVector, classifyVuln } from "./cvss-parser";
import type { VulnClassification } from "./cvss-parser";
import { Asset, RelationType } from "@prisma/client";

export type AssetVulnProfile = {
  classifications: VulnClassification[];
  maxCvss: number;
  maxEpss: number;
  bestAdjustedScore: number;
  bestNetworkPivotScore: number;
  hasNetworkPivot: boolean;
  hasCredentialTheft: boolean;
  hasInjection: boolean;
  isPhysicalAccessOnly: boolean;
};

/**
 * Build an in-memory lookup table of per-asset vulnerability profiles.
 *
 * Queries all OPEN / IN_PROGRESS VulnerabilityWorkflows for the environment,
 * joins their Vulnerability metadata, parses each CVSS vector, classifies it,
 * and aggregates the results per asset.
 *
 * @param environmentId UUID of the environment to load profiles for
 * @returns Map<assetId, AssetVulnProfile>
 */
export async function loadAssetVulnProfiles(
  environmentId: string
): Promise<Map<string, AssetVulnProfile>> {
  const workflows = await prisma.vulnerabilityWorkflow.findMany({
    where: {
      environmentId,
      status: { in: ["OPEN", "IN_PROGRESS"] },
    },
    include: {
      vulnerability: {
        select: {
          cvssScore: true,
          cvssVector: true,
          epssScore: true,
          epssPercentile: true,
        },
      },
    },
  });

  const profiles = new Map<string, AssetVulnProfile>();

  for (const wf of workflows) {
    const assetId = wf.assetId;
    const vuln = wf.vulnerability;

    // --- get or create the asset profile ------------------------------------
    let profile = profiles.get(assetId);
    if (!profile) {
      profile = {
        classifications: [],
        maxCvss: 0,
        maxEpss: 0,
        bestAdjustedScore: 0,
        bestNetworkPivotScore: 0,
        hasNetworkPivot: false,
        hasCredentialTheft: false,
        hasInjection: false,
        isPhysicalAccessOnly: true,
      };
      profiles.set(assetId, profile);
    }

    // --- raw score aggregates (always updated, even if classification fails) -
    const cvssScore = vuln.cvssScore ?? 0;
    const epssPercentile = vuln.epssPercentile ?? 0;

    profile.maxCvss = Math.max(profile.maxCvss, cvssScore);
    profile.maxEpss = Math.max(profile.maxEpss, epssPercentile);

    // bestAdjustedScore = cvssScore × (1 + epssPercentile)
    // range: cvssScore (when EPSS = 0) → 2× cvssScore (when EPSS = 1.0)
    const adjustedScore = cvssScore * (1 + epssPercentile);
    profile.bestAdjustedScore = Math.max(profile.bestAdjustedScore, adjustedScore);

    // --- parse vector → classify -------------------------------------------
    const parsed = parseCvssVector(vuln.cvssVector);
    const classification = classifyVuln(parsed, epssPercentile, cvssScore);

    if (classification) {
      profile.classifications.push(classification);

      // OR-style flags: one true vuln flips the asset flag to true
      if (classification.enablesNetworkPivot) {
        profile.hasNetworkPivot = true;
        profile.bestNetworkPivotScore = Math.max(
          profile.bestNetworkPivotScore,
          adjustedScore
        );
      }
      if (classification.enablesCredentialTheft) {
        profile.hasCredentialTheft = true;
      }
      if (classification.enablesInjection) {
        profile.hasInjection = true;
      }

      // AND-style flag: stays true only while every classified vuln is physical-only
      if (!classification.isPhysicalOnly) {
        profile.isPhysicalAccessOnly = false;
      }
    } else {
      // Unclassifiable vuln (missing/malformed vector) means we can't confirm
      // it's physical-only, so we conservatively mark the asset as reachable.
      profile.isPhysicalAccessOnly = false;
    }
  }

  return profiles;
}


// ─── Neighbor type (what the BFS consumes per edge) ───────────────────────

export type Neighbor = {
  neighborId: string;
  name: string;
  type: string;
  isExternallyFacing: boolean;
  edgeType: RelationType;
  securityCriticality: string;
};

/**
 * Build a directed adjacency list for every relationship in the environment.
 *
 * @param environmentId UUID of the environment
 * @returns Map<fromAssetId, Neighbor[]> — O(1) neighbor lookup
 */
export async function loadAdjacencyList(
  environmentId: string
): Promise<Map<string, Neighbor[]>> {
  const relationships = await prisma.relationship.findMany({
    where: { environmentId },
    include: {
      toAsset: {
        select: {
          id: true,
          name: true,
          type: true,
          isExternallyFacing: true,
        },
      },
    },
  });

  const adjacency = new Map<string, Neighbor[]>();

  for (const rel of relationships) {
    const fromId = rel.fromAssetId;
    const to = rel.toAsset;

    const neighbor: Neighbor = {
      neighborId: to.id,
      name: to.name,
      type: to.type,
      isExternallyFacing: to.isExternallyFacing,
      edgeType: rel.type,
      securityCriticality: rel.securityCriticality,
    };

    const neighbors = adjacency.get(fromId) ?? [];
    neighbors.push(neighbor);
    adjacency.set(fromId, neighbors);
  }

  return adjacency;
}



/**
 * Find all externally-facing assets that have an active network pivot
 * vulnerability. These are the BFS entry points (seeds).
 *
 * @param environmentId   UUID of the environment
 * @param vulnProfiles    Pre-loaded vulnerability profiles
 * @returns Array of entry-point asset IDs
 */
export async function findEntryPoints(
  environmentId: string,
  vulnProfiles: Map<string, AssetVulnProfile>
): Promise<string[]> {
  const assets = await prisma.asset.findMany({
    where: {
      environmentId,
      isExternallyFacing: true,
    },
    select: { id: true },
  });

  return assets
    .map((a) => a.id)
    .filter((id) => {
      const profile = vulnProfiles.get(id);
      return profile?.hasNetworkPivot === true;
    });
}



const BASE_EDGE_COST: Record<string, number> = {
  MANAGED_BY: 1,
  AUTHENTICATES_VIA: 1,
  EXECUTES_CODE_FROM: 1,
  NETWORK_CONNECTS_TO: 2,
  SHARES_CREDENTIALS_WITH: 2,
  RECEIVES_DATA_FROM: 3,
};

const CRITICALITY_DISCOUNT: Record<string, number> = {
  CRITICAL: 0.8,
  HIGH: 1.0,
  MEDIUM: 1.2,
  LOW: 1.5,
};

/**
 * Compute the traversal cost for a single directed edge.
 *
 * Lower cost = more dangerous = BFS should prefer this path.
 * Infinity = impassable (physical-only source asset).
 *
 * @param edgeType            Relationship type (e.g. "NETWORK_CONNECTS_TO")
 * @param securityCriticality Security criticality string (e.g. "CRITICAL")
 * @param sourceVulnProfile   Vulnerability profile of the SOURCE asset
 * @returns traversal cost (number or Infinity)
 */
export function calculateEdgeCost(
  edgeType: string,
  securityCriticality: string,
  sourceVulnProfile: AssetVulnProfile | undefined
): number {
  // ─── Base cost ------------------------------------------------------------
  const baseCost = BASE_EDGE_COST[edgeType] ?? 3;

  // ─── Vulnerability traversal multiplier -----------------------------------
  const vulnMultiplier = computeVulnMultiplier(sourceVulnProfile);

  if (vulnMultiplier === Infinity) {
    return Infinity;
  }

  // ─── Security criticality discount ----------------------------------------
  const discount = CRITICALITY_DISCOUNT[securityCriticality] ?? 1.5;

  // ─── Final cost -----------------------------------------------------------
  const rawCost = baseCost * vulnMultiplier * discount;
  return Math.round(rawCost * 100) / 100;
}


function computeVulnMultiplier(
  profile: AssetVulnProfile | undefined
): number {
  if (!profile) {
    return 2.0; // No active vulns = expensive/unknown traversal
  }

  if (profile.isPhysicalAccessOnly) {
    return Infinity;
  }

  const hasHighConfidence = profile.classifications.some(
    (c) => c.isHighConfidence
  );

  // Base multiplier from the strongest available exploit type
  let multiplier: number;
  if (profile.hasNetworkPivot && hasHighConfidence) {
    multiplier = 1.0;
  } else if (profile.hasNetworkPivot) {
    multiplier = 1.3;
  } else if (profile.hasCredentialTheft) {
    multiplier = 1.8;
  } else {
    multiplier = 2.0;
  }

  // Penalty only when every pivot-capable vuln requires user interaction.
  // If even one clean (UI:N) exploit exists, the attacker uses that one.
  const pivotVulns = profile.classifications.filter((c) => c.enablesNetworkPivot);
  const allPivotsNeedUI =
    pivotVulns.length > 0 && pivotVulns.every((c) => c.requiresUserInteraction);
  if (allPivotsNeedUI) {
    multiplier *= 1.5;
  }

  return multiplier;
}


// ─── Exploitability Gate ────────────────────────────────────────────────────

export type EdgeGateResult = {
  passes: boolean;
  reason: string;
};

/**
 * Check whether the source asset's vulnerability profile is sufficient to
 * "open the gate" for traversing a specific edge type.
 *
 * This is what makes the BFS realistic rather than theoretical:
 * - A DoS-only vuln cannot open a MANAGED_BY gate (the attacker gained nothing).
 * - A credential-theft vuln CAN open an AUTHENTICATES_VIA gate (stolen creds
 *   are enough to log into an auth server).
 * - Physical-only vulns block remote traversal for ALL edge types.
 *
 * @param edgeType            Relationship type (e.g. "NETWORK_CONNECTS_TO")
 * @param sourceVulnProfile   Vulnerability profile of the SOURCE asset
 * @returns { passes, reason }
 */
export function checkExploitabilityGate(
  edgeType: string,
  sourceVulnProfile: AssetVulnProfile | undefined
): EdgeGateResult {
  // Universal barrier: if every classified vuln is physical-only, the attacker
  // cannot reach this asset remotely → no edge can be traversed.
  if (sourceVulnProfile?.isPhysicalAccessOnly) {
    return {
      passes: false,
      reason: "Source asset requires physical access — gate closed",
    };
  }

  // No active vulns at all → nothing to exploit → gate stays closed
  if (!sourceVulnProfile) {
    return {
      passes: false,
      reason: "Source asset has no exploitable vulnerabilities",
    };
  }

  switch (edgeType) {
    // ── Edges that require network pivot (RCE / remote code exec) ────────────
    case "NETWORK_CONNECTS_TO":
    case "MANAGED_BY":
    case "EXECUTES_CODE_FROM":
    case "RECEIVES_DATA_FROM":
      if (sourceVulnProfile.hasNetworkPivot) {
        return {
          passes: true,
          reason: "Network pivot capability available",
        };
      }
      return {
        passes: false,
        reason: `Edge type ${edgeType} requires a network pivot capability`,
      };

    // ── Edges that accept credential theft OR network pivot ──────────────────
    case "AUTHENTICATES_VIA":
    case "SHARES_CREDENTIALS_WITH":
      if (sourceVulnProfile.hasNetworkPivot) {
        return {
          passes: true,
          reason: "Network pivot capability available",
        };
      }
      if (sourceVulnProfile.hasCredentialTheft) {
        return {
          passes: true,
          reason: "Credential theft capability available",
        };
      }
      return {
        passes: false,
        reason: `Edge type ${edgeType} requires credential theft or network pivot capability`,
      };

    default:
      return {
        passes: false,
        reason: `Unknown edge type: ${edgeType}`,
      };
  }
}


