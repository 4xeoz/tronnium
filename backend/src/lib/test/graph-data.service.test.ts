import { describe, it, expect, beforeAll, afterAll } from "@jest/globals";
import prisma from "../prisma";
import {
  loadAdjacencyList,
  loadAssetVulnProfiles,
  calculateEdgeCost,
  checkExploitabilityGate,
  findEntryPoints,
} from "../graph-data.service";
import { seedTestUser, clearTestData } from "../../test/helper";
import type { AssetVulnProfile } from "../graph-data.service";

// ═══════════════════════════════════════════════════════════════════════════════
// Helper: build a minimal mock profile for pure unit tests
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

// ═══════════════════════════════════════════════════════════════════════════════
// calculateEdgeCost — pure unit tests (no DB)
// ═══════════════════════════════════════════════════════════════════════════════

describe("calculateEdgeCost", () => {
  it("MANAGED_BY/CRITICAL + high-confidence network pivot = minimum cost", () => {
    const profile = makeProfile({
      hasNetworkPivot: true,
      classifications: [
        {
          enablesNetworkPivot: true,
          enablesCredentialTheft: true,
          enablesInjection: true,
          isPhysicalOnly: false,
          requiresUserInteraction: false,
          isHighConfidence: true,
          isDoSOnly: false,
        },
      ],
    });
    const cost = calculateEdgeCost("MANAGED_BY", "CRITICAL", profile);
    expect(cost).toBe(0.8); // 1 × 1.0 × 0.8
  });

  it("returns Infinity for physical-only source asset", () => {
    const profile = makeProfile({ isPhysicalAccessOnly: true });
    const cost = calculateEdgeCost("NETWORK_CONNECTS_TO", "LOW", profile);
    expect(cost).toBe(Infinity);
  });

  it("NETWORK_CONNECTS_TO/HIGH + network pivot + UI costs more than without UI", () => {
    const withUI = makeProfile({
      hasNetworkPivot: true,
      classifications: [
        {
          enablesNetworkPivot: true,
          enablesCredentialTheft: false,
          enablesInjection: false,
          isPhysicalOnly: false,
          requiresUserInteraction: true,
          isHighConfidence: false,
          isDoSOnly: false,
        },
      ],
    });
    const withoutUI = makeProfile({
      hasNetworkPivot: true,
      classifications: [],
    });

    const costWithUI = calculateEdgeCost("NETWORK_CONNECTS_TO", "HIGH", withUI);
    const costWithoutUI = calculateEdgeCost("NETWORK_CONNECTS_TO", "HIGH", withoutUI);

    expect(costWithUI).toBe(3.9); // 2 × 1.3 × 1.5 × 1.0
    expect(costWithoutUI).toBe(2.6); // 2 × 1.3 × 1.0
    expect(costWithUI).toBeGreaterThan(costWithoutUI);
  });

  it("SHARES_CREDENTIALS_WITH/MEDIUM + only credential theft = 4.32", () => {
    const profile = makeProfile({
      hasCredentialTheft: true,
      hasNetworkPivot: false,
      classifications: [
        {
          enablesNetworkPivot: false,
          enablesCredentialTheft: true,
          enablesInjection: false,
          isPhysicalOnly: false,
          requiresUserInteraction: false,
          isHighConfidence: false,
          isDoSOnly: false,
        },
      ],
    });
    const cost = calculateEdgeCost("SHARES_CREDENTIALS_WITH", "MEDIUM", profile);
    expect(cost).toBe(4.32); // 2 × 1.8 × 1.2
  });

  it("RECEIVES_DATA_FROM/LOW + no known traversal = highest finite cost", () => {
    const profile = makeProfile({});
    const cost = calculateEdgeCost("RECEIVES_DATA_FROM", "LOW", profile);
    expect(cost).toBe(9.0); // 3 × 2.0 × 1.5
  });

  it("returns 9.0 when source asset has no vuln profile at all", () => {
    const cost = calculateEdgeCost("RECEIVES_DATA_FROM", "LOW", undefined);
    expect(cost).toBe(9.0); // 3 × 2.0 × 1.5
  });

  it("MANAGED_BY is cheaper than NETWORK_CONNECTS_TO for same vuln/criticality", () => {
    const profile = makeProfile({
      hasNetworkPivot: true,
      classifications: [
        {
          enablesNetworkPivot: true,
          enablesCredentialTheft: true,
          enablesInjection: true,
          isPhysicalOnly: false,
          requiresUserInteraction: false,
          isHighConfidence: true,
          isDoSOnly: false,
        },
      ],
    });
    const managed = calculateEdgeCost("MANAGED_BY", "HIGH", profile);
    const network = calculateEdgeCost("NETWORK_CONNECTS_TO", "HIGH", profile);
    expect(managed).toBeLessThan(network);
  });

  it("CRITICAL discount is cheaper than HIGH for same edge/vuln", () => {
    const profile = makeProfile({
      hasNetworkPivot: true,
      classifications: [
        {
          enablesNetworkPivot: true,
          enablesCredentialTheft: true,
          enablesInjection: true,
          isPhysicalOnly: false,
          requiresUserInteraction: false,
          isHighConfidence: true,
          isDoSOnly: false,
        },
      ],
    });
    const critical = calculateEdgeCost("MANAGED_BY", "CRITICAL", profile);
    const high = calculateEdgeCost("MANAGED_BY", "HIGH", profile);
    expect(critical).toBe(0.8);
    expect(high).toBe(1.0);
    expect(critical).toBeLessThan(high);
  });

  it("high-confidence network pivot is cheaper than non-high-confidence", () => {
    const highConf = makeProfile({
      hasNetworkPivot: true,
      classifications: [
        {
          enablesNetworkPivot: true,
          enablesCredentialTheft: true,
          enablesInjection: true,
          isPhysicalOnly: false,
          requiresUserInteraction: false,
          isHighConfidence: true,
          isDoSOnly: false,
        },
      ],
    });
    const lowConf = makeProfile({
      hasNetworkPivot: true,
      classifications: [
        {
          enablesNetworkPivot: true,
          enablesCredentialTheft: false,
          enablesInjection: false,
          isPhysicalOnly: false,
          requiresUserInteraction: false,
          isHighConfidence: false,
          isDoSOnly: false,
        },
      ],
    });

    const costHigh = calculateEdgeCost("EXECUTES_CODE_FROM", "HIGH", highConf);
    const costLow = calculateEdgeCost("EXECUTES_CODE_FROM", "HIGH", lowConf);

    expect(costHigh).toBe(1.0); // 1 × 1.0 × 1.0
    expect(costLow).toBe(1.3); // 1 × 1.3 × 1.0
    expect(costHigh).toBeLessThan(costLow);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// checkExploitabilityGate — pure unit tests (no DB)
// ═══════════════════════════════════════════════════════════════════════════════

describe("checkExploitabilityGate", () => {
  // ── Network-pivot-only edges ─────────────────────────────────────────────

  const PIVOT_EDGES = [
    "NETWORK_CONNECTS_TO",
    "MANAGED_BY",
    "EXECUTES_CODE_FROM",
    "RECEIVES_DATA_FROM",
  ];

  PIVOT_EDGES.forEach((edgeType) => {
    it(`${edgeType} passes when source has network pivot`, () => {
      const profile = makeProfile({ hasNetworkPivot: true });
      const result = checkExploitabilityGate(edgeType, profile);
      expect(result.passes).toBe(true);
      expect(result.reason).toBe("Network pivot capability available");
    });

    it(`${edgeType} fails when source has only credential theft`, () => {
      const profile = makeProfile({
        hasCredentialTheft: true,
        hasNetworkPivot: false,
      });
      const result = checkExploitabilityGate(edgeType, profile);
      expect(result.passes).toBe(false);
      expect(result.reason).toContain("requires a network pivot capability");
    });

    it(`${edgeType} fails when source has no exploitable vulns`, () => {
      const profile = makeProfile({
        hasNetworkPivot: false,
        hasCredentialTheft: false,
      });
      const result = checkExploitabilityGate(edgeType, profile);
      expect(result.passes).toBe(false);
      expect(result.reason).toContain("requires a network pivot capability");
    });
  });

  // ── Credential-accepting edges ───────────────────────────────────────────

  const CRED_EDGES = ["AUTHENTICATES_VIA", "SHARES_CREDENTIALS_WITH"];

  CRED_EDGES.forEach((edgeType) => {
    it(`${edgeType} passes when source has credential theft`, () => {
      const profile = makeProfile({
        hasCredentialTheft: true,
        hasNetworkPivot: false,
      });
      const result = checkExploitabilityGate(edgeType, profile);
      expect(result.passes).toBe(true);
      expect(result.reason).toBe("Credential theft capability available");
    });

    it(`${edgeType} passes when source has network pivot`, () => {
      const profile = makeProfile({
        hasNetworkPivot: true,
        hasCredentialTheft: false,
      });
      const result = checkExploitabilityGate(edgeType, profile);
      expect(result.passes).toBe(true);
      expect(result.reason).toBe("Network pivot capability available");
    });

    it(`${edgeType} fails when source has neither capability`, () => {
      const profile = makeProfile({
        hasNetworkPivot: false,
        hasCredentialTheft: false,
      });
      const result = checkExploitabilityGate(edgeType, profile);
      expect(result.passes).toBe(false);
      expect(result.reason).toContain(
        "requires credential theft or network pivot capability"
      );
    });
  });

  // ── Physical access barrier ──────────────────────────────────────────────

  it("fails for all edge types when source is physical-access-only", () => {
    const profile = makeProfile({
      isPhysicalAccessOnly: true,
      hasNetworkPivot: true, // even if pivot flag is set, physical wins
    });

    const allEdgeTypes = [
      "NETWORK_CONNECTS_TO",
      "MANAGED_BY",
      "EXECUTES_CODE_FROM",
      "AUTHENTICATES_VIA",
      "RECEIVES_DATA_FROM",
      "SHARES_CREDENTIALS_WITH",
    ];

    allEdgeTypes.forEach((edgeType) => {
      const result = checkExploitabilityGate(edgeType, profile);
      expect(result.passes).toBe(false);
      expect(result.reason).toBe(
        "Source asset requires physical access — gate closed"
      );
    });
  });

  // ── Missing profile ──────────────────────────────────────────────────────

  it("fails when source has no vuln profile at all (undefined)", () => {
    const result = checkExploitabilityGate("MANAGED_BY", undefined);
    expect(result.passes).toBe(false);
    expect(result.reason).toBe("Source asset has no exploitable vulnerabilities");
  });

  // ── Unknown edge type ────────────────────────────────────────────────────

  it("fails for unknown edge types", () => {
    const profile = makeProfile({ hasNetworkPivot: true });
    const result = checkExploitabilityGate("UNKNOWN_TYPE", profile);
    expect(result.passes).toBe(false);
    expect(result.reason).toBe("Unknown edge type: UNKNOWN_TYPE");
  });

  // ── Realism: DoS-only cannot open MANAGED_BY gate ────────────────────────

  it("MANAGED_BY fails when source only has DoS vulns (no pivot)", () => {
    const profile = makeProfile({
      hasNetworkPivot: false,
      hasCredentialTheft: false,
      classifications: [
        {
          enablesNetworkPivot: false,
          enablesCredentialTheft: false,
          enablesInjection: false,
          isPhysicalOnly: false,
          requiresUserInteraction: false,
          isHighConfidence: false,
          isDoSOnly: true,
        },
      ],
    });
    const result = checkExploitabilityGate("MANAGED_BY", profile);
    expect(result.passes).toBe(false);
    expect(result.reason).toContain("requires a network pivot capability");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// loadAssetVulnProfiles — DB integration tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("loadAssetVulnProfiles", () => {
  let userId: string;
  let envId: string;
  let assetAId: string;
  let assetBId: string;
  let assetCId: string;
  let vulnNetworkRceId: string;
  let vulnDosOnlyId: string;
  let vulnPhysicalId: string;
  let vulnNoVectorId: string;

  beforeAll(async () => {
    // --- Seed user + environment -------------------------------------------
    const seeded = await seedTestUser();
    userId = seeded.user.id;

    const env = await prisma.environment.create({
      data: { ownerId: userId, name: "Graph Test Env" },
    });
    envId = env.id;

    // --- Seed 3 assets -----------------------------------------------------
    const assetA = await prisma.asset.create({
      data: { environmentId: envId, name: "Asset A (Web Server)" },
    });
    assetAId = assetA.id;

    const assetB = await prisma.asset.create({
      data: { environmentId: envId, name: "Asset B (Resolved Only)" },
    });
    assetBId = assetB.id;

    const assetC = await prisma.asset.create({
      data: { environmentId: envId, name: "Asset C (Unclassifiable)" },
    });
    assetCId = assetC.id;

    // --- Seed 4 vulnerabilities --------------------------------------------
    const vNetworkRce = await prisma.vulnerability.upsert({
      where: { cveId: "CVE-2021-44228" },
      update: {},
      create: {
        cveId: "CVE-2021-44228",
        description: "Log4Shell — unauthenticated RCE",
        cvssScore: 9.8,
        cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        epssPercentile: 0.85,
      },
    });
    vulnNetworkRceId = vNetworkRce.id;

    const vDos = await prisma.vulnerability.upsert({
      where: { cveId: "CVE-2023-XXXX" },
      update: {},
      create: {
        cveId: "CVE-2023-XXXX",
        description: "Network DoS",
        cvssScore: 7.5,
        cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:N/A:H",
        epssPercentile: 0.30,
      },
    });
    vulnDosOnlyId = vDos.id;

    const vPhysical = await prisma.vulnerability.upsert({
      where: { cveId: "CVE-2022-YYYY" },
      update: {},
      create: {
        cveId: "CVE-2022-YYYY",
        description: "Physical access bypass",
        cvssScore: 6.2,
        cvssVector: "CVSS:3.1/AV:P/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N",
        epssPercentile: 0.10,
      },
    });
    vulnPhysicalId = vPhysical.id;

    const vNoVector = await prisma.vulnerability.upsert({
      where: { cveId: "CVE-2024-ZZZZ" },
      update: {},
      create: {
        cveId: "CVE-2024-ZZZZ",
        description: "Unknown severity vuln",
        cvssScore: 5.0,
        cvssVector: null,
        epssPercentile: 0.10,
      },
    });
    vulnNoVectorId = vNoVector.id;

    // --- Seed workflows ----------------------------------------------------
    // Asset A: 2 ACTIVE vulns (network RCE + DoS)
    await prisma.vulnerabilityWorkflow.create({
      data: {
        environmentId: envId,
        assetId: assetAId,
        vulnerabilityId: vulnNetworkRceId,
        cpeName: "cpe:2.3:a:apache:log4j:2.14.1",
        status: "OPEN",
      },
    });
    await prisma.vulnerabilityWorkflow.create({
      data: {
        environmentId: envId,
        assetId: assetAId,
        vulnerabilityId: vulnDosOnlyId,
        cpeName: "cpe:2.3:a:vendor:product:1.0",
        status: "IN_PROGRESS",
      },
    });

    // Asset B: 1 RESOLVED vuln (should not appear)
    await prisma.vulnerabilityWorkflow.create({
      data: {
        environmentId: envId,
        assetId: assetBId,
        vulnerabilityId: vulnPhysicalId,
        cpeName: "cpe:2.3:h:vendor:device:1.0",
        status: "RESOLVED",
      },
    });

    // Asset C: 1 ACTIVE vuln with no CVSS vector
    await prisma.vulnerabilityWorkflow.create({
      data: {
        environmentId: envId,
        assetId: assetCId,
        vulnerabilityId: vulnNoVectorId,
        cpeName: "cpe:2.3:a:unknown:product:1.0",
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    await clearTestData(userId);
  });

  // -------------------------------------------------------------------------
  // Core shape tests
  // -------------------------------------------------------------------------

  it("returns a Map with entries for assets that have ACTIVE workflows", async () => {
    const profiles = await loadAssetVulnProfiles(envId);

    expect(profiles.has(assetAId)).toBe(true);
    expect(profiles.has(assetCId)).toBe(true);
    expect(profiles.has(assetBId)).toBe(false); // RESOLVED only
  });

  it("aggregates maxCvss correctly for Asset A", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetAId)!;

    expect(profile.maxCvss).toBe(9.8); // Log4Shell is highest
  });

  it("aggregates maxEpss correctly for Asset A", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetAId)!;

    expect(profile.maxEpss).toBe(0.85);
  });

  it("computes bestAdjustedScore as cvssScore × (1 + epssPercentile)", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetAId)!;

    // Vuln 1: 9.8 × (1 + 0.85) = 18.13
    // Vuln 2: 7.5 × (1 + 0.30) = 9.75
    expect(profile.bestAdjustedScore).toBeCloseTo(18.13, 2);
  });

  // -------------------------------------------------------------------------
  // Classification flag tests
  // -------------------------------------------------------------------------

  it("Asset A: hasNetworkPivot = true (RCE vuln enables pivot)", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetAId)!;

    expect(profile.hasNetworkPivot).toBe(true);
    expect(profile.hasCredentialTheft).toBe(true);
    expect(profile.hasInjection).toBe(true);
  });

  it("Asset A: bestNetworkPivotScore equals Log4Shell adjusted score", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetAId)!;

    // Log4Shell: 9.8 × (1 + 0.85) = 18.13
    expect(profile.bestNetworkPivotScore).toBeCloseTo(18.13, 2);
  });

  it("Asset A: isPhysicalAccessOnly = false (network vulns exist)", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetAId)!;

    expect(profile.isPhysicalAccessOnly).toBe(false);
  });

  it("Asset A: classifications length = 2 (both vulns are parseable)", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetAId)!;

    expect(profile.classifications).toHaveLength(2);
  });

  it("Asset A: first classification is high-confidence RCE", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetAId)!;

    const rceClass = profile.classifications.find((c) => c.enablesNetworkPivot);
    expect(rceClass).toBeDefined();
    expect(rceClass!.enablesCredentialTheft).toBe(true);
    expect(rceClass!.enablesInjection).toBe(true);
    expect(rceClass!.isPhysicalOnly).toBe(false);
    expect(rceClass!.requiresUserInteraction).toBe(false);
    expect(rceClass!.isHighConfidence).toBe(true); // 9.8 + 0.85 EPSS
  });

  it("Asset A: DoS-only classification has no pivot flags", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetAId)!;

    const dosClass = profile.classifications.find((c) => c.isDoSOnly);
    expect(dosClass).toBeDefined();
    expect(dosClass!.enablesNetworkPivot).toBe(false);
    expect(dosClass!.enablesCredentialTheft).toBe(false);
    expect(dosClass!.enablesInjection).toBe(false);
    expect(dosClass!.requiresUserInteraction).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Unclassifiable / missing vector tests
  // -------------------------------------------------------------------------

  it("Asset C: has zero classifications but still has score aggregates", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetCId)!;

    expect(profile.classifications).toHaveLength(0);
    expect(profile.maxCvss).toBe(5.0);
    expect(profile.bestAdjustedScore).toBeCloseTo(5.5, 2); // 5.0 × 1.10
    expect(profile.bestNetworkPivotScore).toBe(0);
    expect(profile.hasInjection).toBe(false);
  });

  it("Asset C: isPhysicalAccessOnly = false (unclassifiable = unknown)", async () => {
    const profiles = await loadAssetVulnProfiles(envId);
    const profile = profiles.get(assetCId)!;

    // We can't confirm it's physical-only if we can't parse the vector
    expect(profile.isPhysicalAccessOnly).toBe(false);
    expect(profile.hasNetworkPivot).toBe(false);
    expect(profile.hasCredentialTheft).toBe(false);
    expect(profile.hasInjection).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Empty environment test
  // -------------------------------------------------------------------------

  it("returns an empty Map for an environment with no active workflows", async () => {
    const emptyEnv = await prisma.environment.create({
      data: { ownerId: userId, name: "Empty Env" },
    });

    const profiles = await loadAssetVulnProfiles(emptyEnv.id);
    expect(profiles.size).toBe(0);

    await prisma.environment.delete({ where: { id: emptyEnv.id } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// loadAdjacencyList — DB integration tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("loadAdjacencyList", () => {
  let adjEnvId: string;
  let adjAssetA: string;
  let adjAssetB: string;
  let adjAssetC: string;

  beforeAll(async () => {
    const seeded = await seedTestUser();
    const ownerId = seeded.user.id;

    const env = await prisma.environment.create({
      data: { ownerId, name: "Adjacency Test Env" },
    });
    adjEnvId = env.id;

    // Create 3 assets
    const a = await prisma.asset.create({
      data: { environmentId: adjEnvId, name: "Gateway", type: "firewall" },
    });
    adjAssetA = a.id;

    const b = await prisma.asset.create({
      data: { environmentId: adjEnvId, name: "App Server", type: "server" },
    });
    adjAssetB = b.id;

    const c = await prisma.asset.create({
      data: { environmentId: adjEnvId, name: "DB", type: "database", isExternallyFacing: true },
    });
    adjAssetC = c.id;

    // A → B (network connects, medium security criticality)
    await prisma.relationship.create({
      data: {
        environmentId: adjEnvId,
        fromAssetId: adjAssetA,
        toAssetId: adjAssetB,
        type: "NETWORK_CONNECTS_TO",
        operationalCriticality: "MEDIUM",
        securityCriticality: "MEDIUM",
      },
    });

    // B → C (authenticates via, high security criticality)
    await prisma.relationship.create({
      data: {
        environmentId: adjEnvId,
        fromAssetId: adjAssetB,
        toAssetId: adjAssetC,
        type: "AUTHENTICATES_VIA",
        operationalCriticality: "HIGH",
        securityCriticality: "HIGH",
      },
    });
  });

  afterAll(async () => {
    // Cascading deletes on environment will clean up assets + relationships
    await prisma.environment.deleteMany({ where: { id: adjEnvId } });
  });

  it("returns a Map with one entry per source asset", async () => {
    const adj = await loadAdjacencyList(adjEnvId);

    expect(adj.size).toBe(2); // Asset A and Asset B have outgoing edges
    expect(adj.has(adjAssetA)).toBe(true);
    expect(adj.has(adjAssetB)).toBe(true);
    expect(adj.has(adjAssetC)).toBe(false); // Asset C has no outgoing edges
  });

  it("maps Asset A → Asset B with correct edge metadata", async () => {
    const adj = await loadAdjacencyList(adjEnvId);
    const neighbors = adj.get(adjAssetA)!;

    expect(neighbors).toHaveLength(1);
    expect(neighbors[0].neighborId).toBe(adjAssetB);
    expect(neighbors[0].name).toBe("App Server");
    expect(neighbors[0].type).toBe("server");
    expect(neighbors[0].isExternallyFacing).toBe(false);
    expect(neighbors[0].edgeType).toBe("NETWORK_CONNECTS_TO");
    expect(neighbors[0].securityCriticality).toBe("MEDIUM");
  });

  it("maps Asset B → Asset C with correct edge metadata", async () => {
    const adj = await loadAdjacencyList(adjEnvId);
    const neighbors = adj.get(adjAssetB)!;

    expect(neighbors).toHaveLength(1);
    expect(neighbors[0].neighborId).toBe(adjAssetC);
    expect(neighbors[0].name).toBe("DB");
    expect(neighbors[0].type).toBe("database");
    expect(neighbors[0].isExternallyFacing).toBe(true);
    expect(neighbors[0].edgeType).toBe("AUTHENTICATES_VIA");
    expect(neighbors[0].securityCriticality).toBe("HIGH");
  });

  it("returns an empty Map for an environment with no relationships", async () => {
    const emptyEnv = await prisma.environment.create({
      data: { ownerId: (await seedTestUser()).user.id, name: "Empty Adj Env" },
    });

    const adj = await loadAdjacencyList(emptyEnv.id);
    expect(adj.size).toBe(0);

    await prisma.environment.delete({ where: { id: emptyEnv.id } });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findEntryPoints — DB integration tests
// ═══════════════════════════════════════════════════════════════════════════════

describe("findEntryPoints", () => {
  let epUserId: string;
  let epEnvId: string;
  let epAssetExtPivot: string;   // externally facing + network pivot
  let epAssetExtNoPivot: string; // externally facing + no pivot
  let epAssetIntPivot: string;   // internal + network pivot
  let epVulnRceId: string;

  beforeAll(async () => {
    const seeded = await seedTestUser();
    epUserId = seeded.user.id;

    const env = await prisma.environment.create({
      data: { ownerId: epUserId, name: "Entry Points Test Env" },
    });
    epEnvId = env.id;

    // --- Seed 3 assets with different externally-facing / pivot combos ---
    const extPivot = await prisma.asset.create({
      data: {
        environmentId: epEnvId,
        name: "External Web Server",
        isExternallyFacing: true,
      },
    });
    epAssetExtPivot = extPivot.id;

    const extNoPivot = await prisma.asset.create({
      data: {
        environmentId: epEnvId,
        name: "External Static Site",
        isExternallyFacing: true,
      },
    });
    epAssetExtNoPivot = extNoPivot.id;

    const intPivot = await prisma.asset.create({
      data: {
        environmentId: epEnvId,
        name: "Internal DB",
        isExternallyFacing: false,
      },
    });
    epAssetIntPivot = intPivot.id;

    // --- Seed 1 vulnerability (network RCE) ---
    const vRce = await prisma.vulnerability.upsert({
      where: { cveId: "CVE-EP-TEST-001" },
      update: {},
      create: {
        cveId: "CVE-EP-TEST-001",
        description: "Test RCE",
        cvssScore: 9.8,
        cvssVector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
        epssPercentile: 0.85,
      },
    });
    epVulnRceId = vRce.id;

    // --- Seed workflows ---
    // extPivot: OPEN RCE → hasNetworkPivot = true
    await prisma.vulnerabilityWorkflow.create({
      data: {
        environmentId: epEnvId,
        assetId: epAssetExtPivot,
        vulnerabilityId: epVulnRceId,
        cpeName: "cpe:2.3:a:test:product:1.0",
        status: "OPEN",
      },
    });

    // extNoPivot: no workflows → no profile
    // (intentionally empty)

    // intPivot: OPEN RCE → hasNetworkPivot = true, but NOT externally facing
    await prisma.vulnerabilityWorkflow.create({
      data: {
        environmentId: epEnvId,
        assetId: epAssetIntPivot,
        vulnerabilityId: epVulnRceId,
        cpeName: "cpe:2.3:a:test:product:2.0",
        status: "OPEN",
      },
    });
  });

  afterAll(async () => {
    await clearTestData(epUserId);
  });

  it("returns only externally-facing assets with network pivot", async () => {
    const profiles = await loadAssetVulnProfiles(epEnvId);
    const entryPoints = await findEntryPoints(epEnvId, profiles);

    expect(entryPoints).toHaveLength(1);
    expect(entryPoints[0]).toBe(epAssetExtPivot);
  });

  it("excludes externally-facing assets with no pivot", async () => {
    const profiles = await loadAssetVulnProfiles(epEnvId);
    const entryPoints = await findEntryPoints(epEnvId, profiles);

    expect(entryPoints).not.toContain(epAssetExtNoPivot);
  });

  it("excludes internal assets even if they have a pivot", async () => {
    const profiles = await loadAssetVulnProfiles(epEnvId);
    const entryPoints = await findEntryPoints(epEnvId, profiles);

    expect(entryPoints).not.toContain(epAssetIntPivot);
  });

  it("returns empty array when no assets match both conditions", async () => {
    const emptyEnv = await prisma.environment.create({
      data: { ownerId: epUserId, name: "Empty EP Env" },
    });

    const profiles = await loadAssetVulnProfiles(emptyEnv.id);
    const entryPoints = await findEntryPoints(emptyEnv.id, profiles);

    expect(entryPoints).toHaveLength(0);

    await prisma.environment.delete({ where: { id: emptyEnv.id } });
  });
});
