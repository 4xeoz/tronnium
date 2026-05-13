import { describe, it, expect } from "@jest/globals";
import { runWeightedTraversal, analyzeAttackPaths, type AssetRisk } from "../graph-traversal.service";
import type { TraversalResult } from "../graph-traversal.service";
import type { AssetVulnProfile, Neighbor } from "../graph-data.service";

// ═══════════════════════════════════════════════════════════════════════════════
// Mock helpers
// ═══════════════════════════════════════════════════════════════════════════════

function makeProfile(
  overrides: Partial<AssetVulnProfile> = {}
): AssetVulnProfile {
  return {
    classifications: [],
    maxCvss: 0,
    maxEpss: 0,
    bestAdjustedScore: 0,
    bestNetworkPivotScore: 0,
    hasNetworkPivot: false,
    hasCredentialTheft: false,
    hasInjection: false,
    isPhysicalAccessOnly: false,
    ...overrides,
  };
}

function makeNeighbor(
  neighborId: string,
  edgeType: string,
  criticality: string
): Neighbor {
  return {
    neighborId,
    name: neighborId,
    type: "server",
    isExternallyFacing: false,
    edgeType: edgeType as any,
    securityCriticality: criticality,
  };
}

function makeAdjList(
  edges: Array<{ from: string; to: string; type: string; criticality: string }>
): Map<string, Neighbor[]> {
  const adj = new Map<string, Neighbor[]>();
  for (const e of edges) {
    const list = adj.get(e.from) ?? [];
    list.push(makeNeighbor(e.to, e.type, e.criticality));
    adj.set(e.from, list);
  }
  return adj;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mock graph A: reachability / gating / budget pruning (from Task 5.1)
// ═══════════════════════════════════════════════════════════════════════════════

const highConfPivotClass = {
  enablesNetworkPivot: true,
  enablesCredentialTheft: true,
  enablesInjection: true,
  isPhysicalOnly: false,
  requiresUserInteraction: false,
  isHighConfidence: true,
  isDoSOnly: false,
  isAdjacentOnly: false,
};

const credTheftClass = {
  enablesNetworkPivot: false,
  enablesCredentialTheft: true,
  enablesInjection: false,
  isPhysicalOnly: false,
  requiresUserInteraction: false,
  isHighConfidence: false,
  isDoSOnly: false,
  isAdjacentOnly: false,
};

const mockProfilesA = new Map<string, AssetVulnProfile>([
  [
    "E1",
    makeProfile({
      hasNetworkPivot: true,
      classifications: [highConfPivotClass],
    }),
  ],
  [
    "A",
    makeProfile({
      hasNetworkPivot: true,
      classifications: [highConfPivotClass],
    }),
  ],
  [
    "B",
    makeProfile({
      hasCredentialTheft: true,
      hasNetworkPivot: false,
      classifications: [credTheftClass],
    }),
  ],
  ["C", makeProfile({ hasNetworkPivot: false, hasCredentialTheft: false })],
  ["D", makeProfile({ hasNetworkPivot: false, hasCredentialTheft: false })],
  ["G", makeProfile({ hasNetworkPivot: false, hasCredentialTheft: false })],
]);

const mockAdjListA = makeAdjList([
  { from: "E1", to: "A", type: "NETWORK_CONNECTS_TO", criticality: "HIGH" },
  { from: "A", to: "B", type: "MANAGED_BY", criticality: "CRITICAL" },
  { from: "B", to: "C", type: "AUTHENTICATES_VIA", criticality: "HIGH" },
  { from: "A", to: "D", type: "EXECUTES_CODE_FROM", criticality: "MEDIUM" },
  { from: "B", to: "D", type: "SHARES_CREDENTIALS_WITH", criticality: "LOW" },
  { from: "B", to: "G", type: "MANAGED_BY", criticality: "HIGH" },
]);

// ═══════════════════════════════════════════════════════════════════════════════
// Mock graph B: score propagation (designed for Task 5.2)
// ═══════════════════════════════════════════════════════════════════════════════
//
//   E1 (entry, bestNetworkPivotScore=10) → A (pivot) → B (cred theft) → C
//                                      ↘ D
//
// Edge costs:
//   E1→A: NETWORK_CONNECTS_TO/HIGH  → 2×1.0×1.0 = 2.0
//   A→B:  MANAGED_BY/CRITICAL       → 1×1.0×0.8 = 0.8
//   B→C:  AUTHENTICATES_VIA/HIGH    → 1×1.8×1.0 = 1.8
//         (B has cred theft → knowledgeScore[C] += 0.5, then ×0.85 = 1.53)
//   A→D:  AUTHENTICATES_VIA/LOW     → 1×1.0×1.5 = 1.5
//         (A has no cred theft → knowledgeScore[D] stays 0, no discount)

const mockProfilesB = new Map<string, AssetVulnProfile>([
  [
    "E1",
    makeProfile({
      hasNetworkPivot: true,
      bestNetworkPivotScore: 10.0,
      classifications: [highConfPivotClass],
    }),
  ],
  [
    "A",
    makeProfile({
      hasNetworkPivot: true,
      bestNetworkPivotScore: 10.0,
      classifications: [highConfPivotClass],
    }),
  ],
  [
    "B",
    makeProfile({
      hasCredentialTheft: true,
      hasNetworkPivot: false,
      classifications: [credTheftClass],
    }),
  ],
  ["C", makeProfile({ hasNetworkPivot: false, hasCredentialTheft: false })],
  ["D", makeProfile({ hasNetworkPivot: false, hasCredentialTheft: false })],
]);

const mockAdjListB = makeAdjList([
  { from: "E1", to: "A", type: "NETWORK_CONNECTS_TO", criticality: "HIGH" },
  { from: "A", to: "B", type: "MANAGED_BY", criticality: "CRITICAL" },
  { from: "B", to: "C", type: "AUTHENTICATES_VIA", criticality: "HIGH" },
  { from: "A", to: "D", type: "AUTHENTICATES_VIA", criticality: "LOW" },
]);

// ═══════════════════════════════════════════════════════════════════════════════
// runWeightedTraversal — reachability tests (Task 5.1)
// ═══════════════════════════════════════════════════════════════════════════════

describe("runWeightedTraversal — reachability", () => {
  it("reaches all nodes within budget=6 with correct costs", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListA,
      mockProfilesA,
      6
    );

    expect(result.reached.has("E1")).toBe(true);
    expect(result.reached.has("A")).toBe(true);
    expect(result.reached.has("B")).toBe(true);
    expect(result.reached.has("C")).toBe(true);
    expect(result.reached.has("D")).toBe(true);
    expect(result.reached.has("G")).toBe(false);

    expect(result.reached.get("E1")!.cost).toBe(0);
    expect(result.reached.get("A")!.cost).toBe(2.0);
    expect(result.reached.get("B")!.cost).toBe(2.8);
    expect(result.reached.get("D")!.cost).toBe(3.2);
    expect(result.reached.get("C")!.cost).toBe(4.33); // 2.8 + 1.8×0.85 (knowledge discount)

    expect(result.reached.get("C")!.path).toEqual(["E1", "A", "B", "C"]);
    expect(result.reached.get("D")!.path).toEqual(["E1", "A", "D"]);
    expect(result.nodesVisited).toBe(5);
  });

  it("prunes nodes whose path exceeds budget=4", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListA,
      mockProfilesA,
      4
    );

    expect(result.reached.has("E1")).toBe(true);
    expect(result.reached.has("A")).toBe(true);
    expect(result.reached.has("B")).toBe(true);
    expect(result.reached.has("D")).toBe(true);
    expect(result.reached.has("C")).toBe(false);
    expect(result.reached.has("G")).toBe(false);
    expect(result.nodesVisited).toBe(4);
  });

  it("records gated edges and does not reach assets behind them", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListA,
      mockProfilesA,
      6
    );

    const gated = result.gatedEdges.filter(
      (g) => g.fromAssetId === "B" && g.toAssetId === "G"
    );
    expect(gated).toHaveLength(1);
    expect(gated[0].reason).toContain("requires a network pivot capability");
    expect(result.reached.has("G")).toBe(false);
  });

  it("handles entry points with no outgoing edges", () => {
    const adj = makeAdjList([]);
    const profiles = new Map<string, AssetVulnProfile>([
      ["E1", makeProfile({ hasNetworkPivot: true })],
    ]);

    const result = runWeightedTraversal(["E1"], adj, profiles, 10);

    expect(result.reached.has("E1")).toBe(true);
    expect(result.reached.get("E1")!.cost).toBe(0);
    expect(result.nodesVisited).toBe(1);
    expect(result.gatedEdges).toHaveLength(0);
  });

  it("returns empty result for empty entry points", () => {
    const result = runWeightedTraversal([], mockAdjListA, mockProfilesA, 10);

    expect(result.reached.size).toBe(0);
    expect(result.gatedEdges).toHaveLength(0);
    expect(result.nodesVisited).toBe(0);
  });

  it("blocks all traversal when source is physical-access-only", () => {
    const adj = makeAdjList([
      { from: "E1", to: "A", type: "NETWORK_CONNECTS_TO", criticality: "HIGH" },
    ]);
    const profiles = new Map<string, AssetVulnProfile>([
      [
        "E1",
        makeProfile({
          isPhysicalAccessOnly: true,
          hasNetworkPivot: true,
        }),
      ],
    ]);

    const result = runWeightedTraversal(["E1"], adj, profiles, 10);

    expect(result.reached.has("E1")).toBe(true);
    expect(result.reached.has("A")).toBe(false);
    expect(result.gatedEdges).toHaveLength(1);
    expect(result.gatedEdges[0].reason).toContain("physical access");
  });

  it("picks the cheaper path when multiple paths exist to the same node", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListA,
      mockProfilesA,
      6
    );

    const dPath = result.reached.get("D")!.path;
    expect(dPath).toEqual(["E1", "A", "D"]);
    expect(result.reached.get("D")!.cost).toBe(3.2);
  });

  it("tracks hops correctly", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListA,
      mockProfilesA,
      6
    );

    expect(result.reached.get("E1")!.hops).toBe(0);
    expect(result.reached.get("A")!.hops).toBe(1);
    expect(result.reached.get("B")!.hops).toBe(2);
    expect(result.reached.get("C")!.hops).toBe(3);
    expect(result.reached.get("D")!.hops).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// runWeightedTraversal — score propagation tests (Task 5.2)
// ═══════════════════════════════════════════════════════════════════════════════

describe("runWeightedTraversal — score propagation", () => {
  it("entry point gets initial compromise score from bestNetworkPivotScore", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListB,
      mockProfilesB,
      10
    );

    // E1 bestNetworkPivotScore = 10.0
    // Initial compromise = (10.0 / 20.0) × 100 = 50.0
    const e1 = result.reached.get("E1")!;
    expect(e1.compromiseScore).toBe(50.0);
    expect(e1.knowledgeScore).toBe(0);
  });

  it("compromise score decays per hop by securityCriticality", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListB,
      mockProfilesB,
      10
    );

    // E1: 50.0
    // A:  50.0 × 0.85 (HIGH decay)  = 42.5
    // B:  42.5 × 0.95 (CRITICAL)    = 40.375
    // C:  40.375 × 0.85 (HIGH)      = 34.31875
    // D:  42.5 × 0.65 (LOW)         = 27.625

    expect(result.reached.get("A")!.compromiseScore).toBeCloseTo(42.5, 2);
    expect(result.reached.get("B")!.compromiseScore).toBeCloseTo(40.375, 2);
    expect(result.reached.get("C")!.compromiseScore).toBeCloseTo(34.32, 2);
    expect(result.reached.get("D")!.compromiseScore).toBeCloseTo(27.625, 2);
  });

  it("knowledge score increases on AUTHENTICATES_VIA from cred-theft node", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListB,
      mockProfilesB,
      10
    );

    // B→C is AUTHENTICATES_VIA and B has credential theft
    // → knowledgeScore[C] = 0.5
    expect(result.reached.get("C")!.knowledgeScore).toBe(0.5);

    // E1, A, B have no knowledge gains
    expect(result.reached.get("E1")!.knowledgeScore).toBe(0);
    expect(result.reached.get("A")!.knowledgeScore).toBe(0);
    expect(result.reached.get("B")!.knowledgeScore).toBe(0);
  });

  it("knowledge score does NOT increase on non-auth edges", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListB,
      mockProfilesB,
      10
    );

    // A→D is AUTHENTICATES_VIA but A has NO credential theft
    // → knowledgeScore[D] stays 0
    expect(result.reached.get("D")!.knowledgeScore).toBe(0);
  });

  it("knowledge discount reduces effective edge cost", () => {
    const result = runWeightedTraversal(
      ["E1"],
      mockAdjListB,
      mockProfilesB,
      10
    );

    // Without knowledge discount, B→C would cost 1.8
    // With knowledge=0.5: 1.8 × (1 - 0.5×0.3) = 1.8 × 0.85 = 1.53
    // Total to C: 2.0 + 0.8 + 1.53 = 4.33
    expect(result.reached.get("C")!.cost).toBeCloseTo(4.33, 2);
  });

  it("caps knowledge score at 1.0", () => {
    // Build a graph where C is reached through multiple auth edges
    const adj = makeAdjList([
      { from: "E1", to: "A", type: "NETWORK_CONNECTS_TO", criticality: "HIGH" },
      { from: "A", to: "B", type: "AUTHENTICATES_VIA", criticality: "HIGH" },
      { from: "A", to: "C", type: "AUTHENTICATES_VIA", criticality: "HIGH" },
      { from: "B", to: "C", type: "AUTHENTICATES_VIA", criticality: "HIGH" },
    ]);

    const profiles = new Map<string, AssetVulnProfile>([
      ["E1", makeProfile({ hasNetworkPivot: true, bestNetworkPivotScore: 10 })],
      [
        "A",
        makeProfile({
          hasCredentialTheft: true,
          classifications: [credTheftClass],
        }),
      ],
      [
        "B",
        makeProfile({
          hasCredentialTheft: true,
          classifications: [credTheftClass],
        }),
      ],
      ["C", makeProfile()],
    ]);

    const result = runWeightedTraversal(["E1"], adj, profiles, 50);

    // A→C: +0.5 (knowledge=0.5)
    // B→C: +0.5 (knowledge=1.0)
    // Should cap at 1.0, not 1.5
    expect(result.reached.get("C")!.knowledgeScore).toBe(1.0);
  });

  it("entry point with no network-pivot score gets compromiseScore = 0", () => {
    const adj = makeAdjList([]);
    const profiles = new Map<string, AssetVulnProfile>([
      ["E1", makeProfile({ hasNetworkPivot: true, bestNetworkPivotScore: 0 })],
    ]);

    const result = runWeightedTraversal(["E1"], adj, profiles, 10);
    expect(result.reached.get("E1")!.compromiseScore).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeEnvironmentBlastRadius — aggregation tests (Task 6.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Helper that replicates the aggregation logic from computeEnvironmentBlastRadius
 * using pre-computed per-run TraversalResults (avoids mocking async DB calls).
 */
function aggregateRuns(
  entryPoints: string[],
  runs: ReturnType<typeof runWeightedTraversal>[]
): Map<string, AssetRisk> {
  const assetRisks = new Map<string, AssetRisk>();

  for (const result of runs) {
    const ep = result.entryPoints[0];
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

  return assetRisks;
}

// Mock graph C: two entry points converging on one target
//
//   E1 (high pivot) → A → T
//   E2 (low pivot)  → B → T
//   U (unreachable)

const mockProfilesC = new Map<string, AssetVulnProfile>([
  [
    "E1",
    makeProfile({
      hasNetworkPivot: true,
      bestNetworkPivotScore: 18.0,
      classifications: [highConfPivotClass],
    }),
  ],
  [
    "E2",
    makeProfile({
      hasNetworkPivot: true,
      bestNetworkPivotScore: 8.0,
      classifications: [highConfPivotClass],
    }),
  ],
  [
    "A",
    makeProfile({
      hasNetworkPivot: true,
      bestNetworkPivotScore: 10.0,
      classifications: [highConfPivotClass],
    }),
  ],
  [
    "B",
    makeProfile({
      hasNetworkPivot: true,
      bestNetworkPivotScore: 10.0,
      classifications: [highConfPivotClass],
    }),
  ],
  ["T", makeProfile()],
  ["U", makeProfile()],
]);

const mockAdjListC = makeAdjList([
  { from: "E1", to: "A", type: "NETWORK_CONNECTS_TO", criticality: "HIGH" },
  { from: "A", to: "T", type: "MANAGED_BY", criticality: "CRITICAL" },
  { from: "E2", to: "B", type: "NETWORK_CONNECTS_TO", criticality: "MEDIUM" },
  { from: "B", to: "T", type: "MANAGED_BY", criticality: "LOW" },
]);

describe("computeEnvironmentBlastRadius — aggregation", () => {
  it("target asset gets max compromise score across all entry points", () => {
    const runE1 = runWeightedTraversal(["E1"], mockAdjListC, mockProfilesC, 50);
    const runE2 = runWeightedTraversal(["E2"], mockAdjListC, mockProfilesC, 50);
    const risks = aggregateRuns(["E1", "E2"], [runE1, runE2]);

    const t = risks.get("T")!;

    // E1 path: E1(90) → A(76.5) → T(72.675)
    // E2 path: E2(40) → B(30) → T(19.5)
    expect(t.maxCompromiseScore).toBeCloseTo(72.675, 2);
  });

  it("target asset lists all entry points that can reach it", () => {
    const runE1 = runWeightedTraversal(["E1"], mockAdjListC, mockProfilesC, 50);
    const runE2 = runWeightedTraversal(["E2"], mockAdjListC, mockProfilesC, 50);
    const risks = aggregateRuns(["E1", "E2"], [runE1, runE2]);

    const t = risks.get("T")!;
    expect(t.reachableFromEntryPoints).toContain("E1");
    expect(t.reachableFromEntryPoints).toContain("E2");
    expect(t.reachableFromEntryPoints).toHaveLength(2);
  });

  it("intermediate nodes only appear in their respective entry-point runs", () => {
    const runE1 = runWeightedTraversal(["E1"], mockAdjListC, mockProfilesC, 50);
    const runE2 = runWeightedTraversal(["E2"], mockAdjListC, mockProfilesC, 50);
    const risks = aggregateRuns(["E1", "E2"], [runE1, runE2]);

    // A is only reachable from E1
    expect(risks.get("A")!.reachableFromEntryPoints).toEqual(["E1"]);

    // B is only reachable from E2
    expect(risks.get("B")!.reachableFromEntryPoints).toEqual(["E2"]);
  });

  it("unreachable asset is not present in the aggregated risk map", () => {
    const runE1 = runWeightedTraversal(["E1"], mockAdjListC, mockProfilesC, 50);
    const runE2 = runWeightedTraversal(["E2"], mockAdjListC, mockProfilesC, 50);
    const risks = aggregateRuns(["E1", "E2"], [runE1, runE2]);

    // U has no incoming edges → not reached by either run
    expect(risks.has("U")).toBe(false);
  });

  it("entry point itself is recorded with its own initial compromise score", () => {
    const runE1 = runWeightedTraversal(["E1"], mockAdjListC, mockProfilesC, 50);
    const risks = aggregateRuns(["E1"], [runE1]);

    const e1 = risks.get("E1")!;
    expect(e1.maxCompromiseScore).toBe(90.0); // (18/20)*100
    expect(e1.reachableFromEntryPoints).toEqual(["E1"]);
  });

  it("maxKnowledgeScore is also aggregated across runs", () => {
    // Build a graph where E1→A gives knowledge=0.5 to A, E2→A gives 0
    const adj = makeAdjList([
      { from: "E1", to: "A", type: "AUTHENTICATES_VIA", criticality: "HIGH" },
      { from: "E2", to: "A", type: "MANAGED_BY", criticality: "HIGH" },
    ]);
    const profiles = new Map<string, AssetVulnProfile>([
      [
        "E1",
        makeProfile({
          hasCredentialTheft: true,
          hasNetworkPivot: true,
          bestNetworkPivotScore: 10,
          classifications: [credTheftClass],
        }),
      ],
      [
        "E2",
        makeProfile({
          hasNetworkPivot: true,
          bestNetworkPivotScore: 10,
          classifications: [highConfPivotClass],
        }),
      ],
      ["A", makeProfile()],
    ]);

    const runE1 = runWeightedTraversal(["E1"], adj, profiles, 50);
    const runE2 = runWeightedTraversal(["E2"], adj, profiles, 50);
    const risks = aggregateRuns(["E1", "E2"], [runE1, runE2]);

    const a = risks.get("A")!;
    // E1→A is AUTHENTICATES_VIA from cred-theft node → knowledge=0.5
    // E2→A is MANAGED_BY (not auth/creds) → knowledge=0
    expect(a.maxKnowledgeScore).toBe(0.5);
  });
});
