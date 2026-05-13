import prisma from "../../lib/prisma";
import { SEED_TEMPLATES } from "./seed-templates";
import type { SeedTemplate } from "./seed-templates";
import { ScanStatus } from "@prisma/client";

export type SeedResult = {
  environmentId: string;
  environmentName: string;
  summary: {
    assets: number;
    vulnerabilities: number;
    relationships: number;
  };
};

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export async function seedEnvironment(
  userId: string,
  templateId: string
): Promise<SeedResult> {
  const template = SEED_TEMPLATES.find((t) => t.id === templateId);
  if (!template) {
    throw new Error(`Unknown template: ${templateId}`);
  }

  const suffix = randomSuffix();

  return prisma.$transaction(async (tx) => {
    // 1. Environment
    const env = await tx.environment.create({
      data: {
        name: template.name,
        description: template.description,
        ownerId: userId,
      },
    });

    // 2. Assets — build a key → created asset id map for relationship wiring
    const keyToId = new Map<string, string>();
    for (const assetDef of template.assets) {
      const asset = await tx.asset.create({
        data: {
          name: assetDef.name,
          type: assetDef.type,
          domain: assetDef.domain,
          status: "active",
          isExternallyFacing: assetDef.isExternallyFacing,
          environmentId: env.id,
        },
      });
      keyToId.set(assetDef.key, asset.id);

      // Create the AssetCpe record so the asset has an identified software stack
      await tx.assetCpe.create({
        data: {
          assetId: asset.id,
          cpeName: assetDef.cpe.name,
          title: assetDef.cpe.title,
          score: 0.92,
          vendor: assetDef.cpe.vendor,
          product: assetDef.cpe.product,
          version: assetDef.cpe.version,
          vendorScore: 90,
          productScore: 90,
          versionScore: 88,
          tokenOverlapScore: 90,
        },
      });
    }

    // 3. Vulnerabilities (per-asset scan chain for dashboard integration)
    let totalVulns = 0;
    for (const assetDef of template.assets) {
      if (!assetDef.vulns || assetDef.vulns.length === 0) continue;

      const assetId = keyToId.get(assetDef.key)!;
      const vulns = assetDef.vulns;

      const counts = {
        critical: vulns.filter((v) => v.severity === "CRITICAL").length,
        high: vulns.filter((v) => v.severity === "HIGH").length,
        medium: vulns.filter((v) => v.severity === "MEDIUM").length,
        low: vulns.filter((v) => v.severity === "LOW").length,
      };

      const scan = await tx.securityScan.create({
        data: {
          environmentId: env.id,
          status: ScanStatus.COMPLETED,
          isMock: true,
          startedAt: new Date(),
          completedAt: new Date(),
          totalAssets: 1,
          scannedAssets: 1,
          vulnerabilitiesFound: vulns.length,
          criticalCount: counts.critical,
          highCount: counts.high,
          mediumCount: counts.medium,
          lowCount: counts.low,
        },
      });

      const assetScan = await tx.assetScan.create({
        data: { scanId: scan.id, assetId, scannedAt: new Date() },
      });

      for (const vulnDef of vulns) {
        const cveId = `${vulnDef.cveIdPrefix}-${suffix}`;
        const cpeName = assetDef.cpe.name;

        const vuln = await tx.vulnerability.create({
          data: {
            cveId,
            description: vulnDef.description,
            cvssScore: vulnDef.cvssScore,
            cvssVector: vulnDef.cvssVector,
            epssScore: vulnDef.epssPercentile,
            epssPercentile: vulnDef.epssPercentile,
            severity: vulnDef.severity,
            isMock: true,
            createdBy: userId,
          },
        });

        await tx.vulnerabilityWorkflow.create({
          data: {
            environmentId: env.id,
            assetId,
            vulnerabilityId: vuln.id,
            cpeName,
            status: "OPEN",
          },
        });

        await tx.assetVulnerability.create({
          data: {
            assetScanId: assetScan.id,
            vulnerabilityId: vuln.id,
            cpeName,
          },
        });

        totalVulns++;
      }
    }

    // 4. Relationships
    for (const relDef of template.relationships) {
      const fromAssetId = keyToId.get(relDef.fromKey)!;
      const toAssetId = keyToId.get(relDef.toKey)!;

      await tx.relationship.create({
        data: {
          environmentId: env.id,
          fromAssetId,
          toAssetId,
          type: relDef.type,
          operationalCriticality: relDef.operationalCriticality,
          securityCriticality: relDef.securityCriticality,
        },
      });
    }

    return {
      environmentId: env.id,
      environmentName: env.name,
      summary: {
        assets: template.assets.length,
        vulnerabilities: totalVulns,
        relationships: template.relationships.length,
      },
    };
  });
}

export function listSeedTemplates() {
  return SEED_TEMPLATES.map(({ id, name, description, longDescription, tags, assets, relationships }) => ({
    id,
    name,
    description,
    longDescription,
    tags,
    stats: {
      assets: assets.length,
      vulnerabilities: assets.reduce((sum, a) => sum + (a.vulns?.length ?? 0), 0),
      relationships: relationships.length,
    },
  }));
}
