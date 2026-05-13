import prisma from "./prisma";
import {
  loadAssetVulnProfiles,
  loadAdjacencyList,
  findEntryPoints,
  type AssetVulnProfile,
  type Neighbor,
  checkExploitabilityGate,
  calculateEdgeCost,
} from "./graph-data.service";

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_BUDGET = 50;

/**
 * Compromise score decay per security-criticality level.
 * Higher criticality = less decay (more compromise preserved).
 */
const COMPROMISE_DECAY_RATE: Record<string, number> = {
  CRITICAL: 0.95,
  HIGH: 0.85,
  MEDIUM: 0.75,
  LOW: 0.65,
};

/** Max possible EPSS-adjusted CVSS (10.0 × 2.0) */
const MAX_ADJUSTED_SCORE = 20.0;

/** Knowledge increment per credential-theft traversal, capped at 1.0 */
const KNOWLEDGE_INCREMENT = 0.5;
const MAX_KNOWLEDGE = 1.0;

// ─── Types ──────────────────────────────────────────────────────────────────

type PQNode = {
  assetId: string;
  cost: number;
  hops: number;
  path: string[];
};

type GatedEdge = {
  fromAssetId: string;
  toAssetId: string;
  edgeType: string;
  reason: string;
};

export type ReachedNode = {
  cost: number;
  hops: number;
  path: string[];
  compromiseScore: number;
  knowledgeScore: number;
};

export type TraversalResult = {
  reached: Map<string, ReachedNode>;
  gatedEdges: GatedEdge[];
  entryPoints: string[];
  budget: number;
  nodesVisited: number;
  edgesGated: number;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute the initial compromise score for an entry-point asset.
 * Based on the best EPSS-adjusted CVSS among its network-pivot vulns,
 * normalized to a 0–100 scale.
 */
function computeInitialCompromiseScore(
  profile: AssetVulnProfile | undefined
): number {
  if (!profile || profile.bestNetworkPivotScore <= 0) return 0;
  return Math.min(
    (profile.bestNetworkPivotScore / MAX_ADJUSTED_SCORE) * 100,
    100
  );
}

/**
 * Compute the compromise decay factor for a given security criticality.
 */
function getCompromiseDecay(criticality: string): number {
  return COMPROMISE_DECAY_RATE[criticality] ?? 0.7;
}

// ─── Core Algorithm ─────────────────────────────────────────────────────────

export function runWeightedTraversal(
  entryPoints: string[],
  adjList: Map<string, Neighbor[]>,
  vulnProfiles: Map<string, AssetVulnProfile>,
  budget: number = DEFAULT_BUDGET
): TraversalResult {
  const reached = new Map<string, ReachedNode>();
  const gatedEdges: GatedEdge[] = [];
  const visited = new Set<string>();

  // Per-asset score trackers (updated as we discover paths)
  const compromiseScores = new Map<string, number>();
  const knowledgeScores = new Map<string, number>();

  // Seed entry points with their initial scores
  for (const ep of entryPoints) {
    compromiseScores.set(ep, computeInitialCompromiseScore(vulnProfiles.get(ep)));
    knowledgeScores.set(ep, 0);
  }

  // Priority queue: lowest cumulative cost first
  const pq: PQNode[] = entryPoints.map((id) => ({
    assetId: id,
    cost: 0,
    hops: 0,
    path: [id],
  }));
  pq.sort((a, b) => a.cost - b.cost);

  let nodesVisited = 0;

  while (pq.length > 0) {
    const node = pq.shift()!;
    nodesVisited++;

    if (visited.has(node.assetId)) continue;
    visited.add(node.assetId);

    // Record the best path to this asset (with its current scores)
    reached.set(node.assetId, {
      cost: node.cost,
      hops: node.hops,
      path: node.path,
      compromiseScore: compromiseScores.get(node.assetId) ?? 0,
      knowledgeScore: knowledgeScores.get(node.assetId) ?? 0,
    });

    const neighbors = adjList.get(node.assetId) ?? [];
    for (const neighbor of neighbors) {
      const profile = vulnProfiles.get(node.assetId);

      // ─── Gate check ──────────────────────────────────────────────────────
      const gate = checkExploitabilityGate(neighbor.edgeType, profile);
      if (!gate.passes) {
        gatedEdges.push({
          fromAssetId: node.assetId,
          toAssetId: neighbor.neighborId,
          edgeType: neighbor.edgeType,
          reason: gate.reason,
        });
        continue;
      }

      // ─── Knowledge score update for destination ──────────────────────────
      // Credential-theft traversal increases attacker knowledge about the target
      if (
        (neighbor.edgeType === "AUTHENTICATES_VIA" ||
          neighbor.edgeType === "SHARES_CREDENTIALS_WITH") &&
        profile?.hasCredentialTheft
      ) {
        const currentKnowledge = knowledgeScores.get(neighbor.neighborId) ?? 0;
        knowledgeScores.set(
          neighbor.neighborId,
          Math.min(currentKnowledge + KNOWLEDGE_INCREMENT, MAX_KNOWLEDGE)
        );
      }

      // ─── Cost calculation (with knowledge discount) ──────────────────────
      const baseCost = calculateEdgeCost(
        neighbor.edgeType,
        neighbor.securityCriticality,
        profile
      );
      if (baseCost === Infinity) continue;

      // Knowledge about the destination makes future paths toward it cheaper
      const knowledgeDiscount =
        1 - (knowledgeScores.get(neighbor.neighborId) ?? 0) * 0.3;
      const effectiveCost = baseCost * knowledgeDiscount;

      const newCost = node.cost + effectiveCost;

      // ─── Budget pruning ──────────────────────────────────────────────────
      if (newCost > budget) continue;

      // ─── Compromise score propagation ────────────────────────────────────
      const decay = getCompromiseDecay(neighbor.securityCriticality);
      const parentCompromise = compromiseScores.get(node.assetId) ?? 0;
      const newCompromise = parentCompromise * decay;

      // Keep the highest compromise score seen for this node
      const existingCompromise = compromiseScores.get(neighbor.neighborId) ?? 0;
      if (newCompromise > existingCompromise) {
        compromiseScores.set(neighbor.neighborId, newCompromise);
      }

      // ─── Push to PQ if not already visited ───────────────────────────────
      if (!visited.has(neighbor.neighborId)) {
        pq.push({
          assetId: neighbor.neighborId,
          cost: newCost,
          hops: node.hops + 1,
          path: [...node.path, neighbor.neighborId],
        });
        pq.sort((a, b) => a.cost - b.cost);
      }
    }
  }

  return {
    reached,
    gatedEdges,
    entryPoints,
    budget,
    nodesVisited,
    edgesGated: gatedEdges.length,
  };
}

// ─── Orchestrator ───────────────────────────────────────────────────────────

export async function analyzeAttackPaths(
  environmentId: string,
  budget: number = DEFAULT_BUDGET
): Promise<TraversalResult> {
  const vulnProfiles = await loadAssetVulnProfiles(environmentId);
  const adjList = await loadAdjacencyList(environmentId);
  const entryPoints = await findEntryPoints(environmentId, vulnProfiles);

  return runWeightedTraversal(entryPoints, adjList, vulnProfiles, budget);
}

// ─── Blast Radius Aggregation ───────────────────────────────────────────────

export type AssetRisk = {
  assetId: string;
  maxCompromiseScore: number;
  maxKnowledgeScore: number;
  reachableFromEntryPoints: string[];
};

export type EnvironmentBlastRadius = {
  environmentId: string;
  assetRisks: Map<string, AssetRisk>;
  entryPoints: string[];
  runs: number;
  totalAssetsReached: number;
};

/**
 * Run the weighted BFS from every entry point independently, then aggregate
 * the worst-case compromise and knowledge scores per asset.
 *
 * @param environmentId  UUID of the environment to analyze
 * @param config         Optional config (budget)
 * @returns EnvironmentBlastRadius — every asset with its max scores
 */
export async function computeEnvironmentBlastRadius(
  environmentId: string,
  config: { budget?: number } = {}
): Promise<EnvironmentBlastRadius> {
  const budget = config.budget ?? DEFAULT_BUDGET;

  // Phase 3: Load all data into memory
  const vulnProfiles = await loadAssetVulnProfiles(environmentId);
  const adjList = await loadAdjacencyList(environmentId);
  const entryPoints = await findEntryPoints(environmentId, vulnProfiles);

  // Phase 5: Run one BFS per entry point (independent blast radii)
  const perRunResults: TraversalResult[] = [];
  for (const ep of entryPoints) {
    const result = runWeightedTraversal([ep], adjList, vulnProfiles, budget);
    perRunResults.push(result);
  }

  // Phase 6: Aggregate max scores across all entry points
  const assetRisks = new Map<string, AssetRisk>();

  for (const result of perRunResults) {
    const ep = result.entryPoints[0]; // each run has exactly one entry point

    for (const [assetId, node] of result.reached) {
      let risk = assetRisks.get(assetId);
      if (!risk) {
        risk = {
          assetId,
          maxCompromiseScore: 0,
          maxKnowledgeScore: 0,
          reachableFromEntryPoints: [],
        };
        assetRisks.set(assetId, risk);
      }

      risk.maxCompromiseScore = Math.max(
        risk.maxCompromiseScore,
        node.compromiseScore
      );
      risk.maxKnowledgeScore = Math.max(
        risk.maxKnowledgeScore,
        node.knowledgeScore
      );

      if (!risk.reachableFromEntryPoints.includes(ep)) {
        risk.reachableFromEntryPoints.push(ep);
      }
    }
  }

  // Include all environment assets — unreachable ones get score 0
  const allAssets = await prisma.asset.findMany({
    where: { environmentId },
    select: { id: true },
  });

  for (const asset of allAssets) {
    if (!assetRisks.has(asset.id)) {
      assetRisks.set(asset.id, {
        assetId: asset.id,
        maxCompromiseScore: 0,
        maxKnowledgeScore: 0,
        reachableFromEntryPoints: [],
      });
    }
  }

  return {
    environmentId,
    assetRisks,
    entryPoints,
    runs: perRunResults.length,
    totalAssetsReached: assetRisks.size,
  };
}
