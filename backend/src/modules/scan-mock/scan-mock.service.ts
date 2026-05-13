import { VulnSeverity, ScanStatus } from "@prisma/client";
import prisma from "../../lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  GeneratedVulnerability,
  MockVulnGenerationResult,
  SelectedTarget,
} from "./mock.types";
import { countSeverities, calculateRiskScore } from "../../lib/severity";

export async function generateMockVulnerabilities(
  prompt: string,
  count: number,
  environmentId: string,
  userId: string,
  targets?: SelectedTarget[]
): Promise<MockVulnGenerationResult> {
  const llmPrompt = buildGenerationPrompt(prompt, count);

  console.log(`[MockVuln] Generating ${count} vulnerabilities with prompt: "${prompt}"`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured. Cannot generate mock vulnerabilities.");
  }

  const client = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const model = client.getGenerativeModel({ model: modelName });

  const result = await model.generateContent({
    contents: [{ role: "user", parts: [{ text: llmPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: "application/json",
    },
  });

  const content = result.response.text();
  if (!content) {
    throw new Error("LLM returned empty response");
  }

  let generated: GeneratedVulnerability[] = [];

  try {
    const parsed = JSON.parse(content);

    if (Array.isArray(parsed)) {
      generated = parsed;
    } else if (parsed.vulnerabilities && Array.isArray(parsed.vulnerabilities)) {
      generated = parsed.vulnerabilities;
    } else {
      const possibleArrays = Object.values(parsed).filter(v => Array.isArray(v));
      if (possibleArrays.length > 0) {
        generated = possibleArrays[0] as GeneratedVulnerability[];
      }
    }
  } catch (error) {
    console.error("[MockVuln] Failed to parse LLM response:", error);
    console.error("[MockVuln] Raw response:", content.substring(0, 500));
    throw new Error("Failed to parse generated vulnerabilities from LLM response");
  }

  generated = generated.slice(0, count).map(v => ({
    ...v,
    cveId: generateMockCveId(),
    severity: validateSeverity(v.severity),
    cvssScore: Math.min(10, Math.max(0, v.cvssScore || 5.0)),
  }));

  console.log(`[MockVuln] Generated ${generated.length} vulnerabilities`);
  console.log(`[MockVuln] Targets: ${targets ? targets.map(t => `${t.assetName}${t.cpeIdentifier ? ` (${t.cpeIdentifier})` : ''}`).join(', ') : 'All assets'}`);

  for (const vuln of generated) {
    await prisma.vulnerability.create({
      data: {
        cveId: vuln.cveId,
        description: vuln.description,
        severity: vuln.severity,
        cvssScore: vuln.cvssScore,
        cvssVector: vuln.cvssVector || generateCvssVector(vuln.severity),
        isMock: true,
        mockPrompt: prompt,
        createdBy: userId,
        publishedDate: new Date(),
        lastModifiedDate: new Date(),
      },
    });
  }

  const scanResult = await createMockScan(environmentId, generated, targets);

  return {
    vulnerabilities: generated,
    scanId: scanResult.scanId,
    assetScansCreated: scanResult.assetScansCreated,
  };
}

function buildGenerationPrompt(userPrompt: string, count: number): string {
  return `
You are a cybersecurity expert creating realistic mock CVEs for testing a vulnerability management dashboard.

USER REQUEST: "${userPrompt}"

Generate ${count} realistic, detailed vulnerabilities. Each vulnerability should be believable and include technical details that would appear in a real CVE.

For each vulnerability, provide:
- description: Detailed technical explanation (2-3 sentences)
- severity: One of: CRITICAL, HIGH, MEDIUM, LOW
- cvssScore: Realistic CVSS v3.1 score (0.0-10.0)
- cvssVector: Valid CVSS v3.1 vector string
- affectedAssetType: Type of asset affected (e.g., "web-server", "database", "firewall", "api-gateway", "load-balancer", "iot-device")
- attackVector: How the attack works (e.g., "Network", "Local", "Physical")
- impact: Business/technical impact description

Return ONLY a JSON array in this exact format:
[
  {
    "description": "Remote code execution vulnerability in Apache HTTP Server 2.4.49...",
    "severity": "CRITICAL",
    "cvssScore": 9.8,
    "cvssVector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    "affectedAssetType": "web-server",
    "attackVector": "Network",
    "impact": "Complete system compromise allowing remote code execution"
  }
]

Make the vulnerabilities diverse in type, severity, and affected systems. Do not include cveId - that will be generated automatically.
`;
}

function generateMockCveId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CVE-DEV-${timestamp}-${random}`;
}

function validateSeverity(severity: string): VulnSeverity {
  const validSeverities: VulnSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"];
  const normalized = severity?.toUpperCase() as VulnSeverity;
  return validSeverities.includes(normalized) ? normalized : "MEDIUM";
}

function generateCvssVector(severity: VulnSeverity): string {
  const vectors: Record<VulnSeverity, string> = {
    CRITICAL: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    HIGH: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H",
    MEDIUM: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:L",
    LOW: "CVSS:3.1/AV:L/AC:H/PR:H/UI:N/S:U/C:L/I:N/A:N",
    UNKNOWN: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:N",
    NONE: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:N",
  };
  return vectors[severity] || vectors.MEDIUM;
}

async function createMockScan(
  environmentId: string,
  vulnerabilities: GeneratedVulnerability[],
  targets?: SelectedTarget[]
): Promise<{ scanId: string; assetScansCreated: number }> {
  let targetAssets: SelectedTarget[];

  if (targets && targets.length > 0) {
    targetAssets = targets;
    console.log(`[MockVuln] Using ${targets.length} selected targets`);
  } else {
    const allAssets = await prisma.asset.findMany({
      where: { environmentId },
      take: 10,
    });
    targetAssets = allAssets.map(a => ({ assetId: a.id, assetName: a.name }));
    console.log(`[MockVuln] No targets specified, using all ${targetAssets.length} assets`);
  }

  if (targetAssets.length === 0) {
    throw new Error("No assets found in environment to link vulnerabilities to");
  }

  const severityCounts = countSeverities(vulnerabilities);
  const riskScore = calculateRiskScore(severityCounts, targetAssets.length);

  const scan = await prisma.securityScan.create({
    data: {
      environmentId,
      status: ScanStatus.COMPLETED,
      isMock: true,
      startedAt: new Date(),
      completedAt: new Date(),
      totalAssets: targetAssets.length,
      scannedAssets: targetAssets.length,
      vulnerabilitiesFound: vulnerabilities.length,
      criticalCount: severityCounts.critical,
      highCount: severityCounts.high,
      mediumCount: severityCounts.medium,
      lowCount: severityCounts.low,
      riskScore,
    },
  });

  console.log(`[MockVuln] Created mock scan: ${scan.id}`);

  let assetScansCreated = 0;

  for (let i = 0; i < targetAssets.length; i++) {
    const target = targetAssets[i];

    const startIdx = Math.floor((i * vulnerabilities.length) / targetAssets.length);
    const endIdx = Math.floor(((i + 1) * vulnerabilities.length) / targetAssets.length);
    const assetVulns = vulnerabilities.slice(startIdx, endIdx);

    if (assetVulns.length === 0) continue;

    const assetScan = await prisma.assetScan.create({
      data: {
        scanId: scan.id,
        assetId: target.assetId,
        scannedAt: new Date(),
      },
    });

    for (const vuln of assetVulns) {
      const vulnerability = await prisma.vulnerability.findUnique({
        where: { cveId: vuln.cveId },
      });

      if (vulnerability) {
        const cpeName = target.cpeIdentifier || `cpe:2.3:a:${target.assetName}:unknown:1.0:*:*:*:*:*:*:*`;

        await prisma.assetVulnerability.create({
          data: {
            assetScanId: assetScan.id,
            vulnerabilityId: vulnerability.id,
            cpeName: cpeName,
          },
        });

        console.log(`[MockVuln] Linked ${vuln.cveId} to ${target.assetName} with CPE: ${cpeName.substring(0, 60)}...`);
      }
    }

    assetScansCreated++;
  }

  console.log(`[MockVuln] Created ${assetScansCreated} asset scans with linked vulnerabilities`);

  return { scanId: scan.id, assetScansCreated };
}

export async function clearMockVulnerabilities(environmentId: string): Promise<{
  deletedVulnerabilities: number;
  deletedScans: number;
}> {
  console.log(`[MockVuln] Clearing mock data for environment: ${environmentId}`);

  const mockScans = await prisma.securityScan.findMany({
    where: {
      environmentId,
      assetScans: {
        some: {
          vulnerabilities: {
            some: {
              vulnerability: {
                isMock: true,
              },
            },
          },
        },
      },
    },
  });

  const scanIds = mockScans.map(s => s.id);

  await prisma.assetVulnerability.deleteMany({
    where: {
      assetScan: {
        scanId: { in: scanIds },
      },
    },
  });

  await prisma.assetScan.deleteMany({
    where: {
      scanId: { in: scanIds },
    },
  });

  await prisma.securityScan.deleteMany({
    where: {
      id: { in: scanIds },
    },
  });

  const deletedVulns = await prisma.vulnerability.deleteMany({
    where: {
      isMock: true,
      assetVulnerabilities: {
        some: {
          assetScan: {
            scanId: { in: scanIds },
          },
        },
      },
    },
  });

  console.log(`[MockVuln] Deleted ${deletedVulns.count} mock vulnerabilities and ${scanIds.length} scans`);

  return {
    deletedVulnerabilities: deletedVulns.count,
    deletedScans: scanIds.length,
  };
}

export async function getMockVulnerabilities(environmentId: string) {
  const vulnerabilities = await prisma.vulnerability.findMany({
    where: {
      isMock: true,
      assetVulnerabilities: {
        some: {
          assetScan: {
            scan: {
              environmentId,
            },
          },
        },
      },
    },
    include: {
      assetVulnerabilities: {
        include: {
          assetScan: {
            include: {
              asset: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return vulnerabilities;
}
