import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import { verifyEnvironment } from "../../lib/verify-environment";
import {
  generateMockVulnerabilities,
  clearMockVulnerabilities,
  getMockVulnerabilities,
} from "../scan-mock/public";
import type { PublicUser } from "../../types/express";
import { ok, err } from "../../lib/response-helpers";
import { VulnSeverity, ScanStatus } from "@prisma/client";

/**
 * Generate mock vulnerabilities using LLM
 * POST /dev/generate-vulnerabilities
 */
export async function generateVulnerabilitiesHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { environmentId, prompt, count = 3, targets } = req.body;
    const user = req.user as PublicUser;

    // Validate input
    if (!environmentId || typeof environmentId !== "string") {
      res.status(400).json(err("INVALID_INPUT", "environmentId is required"));
      return;
    }

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json(err("INVALID_INPUT", "prompt is required"));
      return;
    }

    // Check user has dev mode enabled
    const userAccount = await prisma.userAccount.findUnique({
      where: { id: user.id },
    });

    if (!userAccount?.devMode) {
      res.status(403).json(err("DEV_MODE_REQUIRED", "Dev mode must be enabled to generate mock vulnerabilities"));
      return;
    }

    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    // Generate vulnerabilities
    const result = await generateMockVulnerabilities(
      prompt,
      Math.min(Math.max(1, count), 10), // Limit 1-10
      environmentId,
      user.id,
      targets // Pass selected targets to link only to specific assets/CPEs
    );

    res.json(
      ok(result, `Generated ${result.vulnerabilities.length} mock vulnerabilities and linked to ${result.assetScansCreated} assets`)
    );
  } catch (error: any) {
    console.error("[GenerateVulnerabilities] Error:", error);
    res.status(500).json(err("GENERATION_FAILED", error.message || "Failed to generate mock vulnerabilities"));
  }
}

/**
 * Clear all mock vulnerabilities for an environment
 * DELETE /dev/mock-vulnerabilities/:environmentId
 */
export async function clearMockVulnerabilitiesHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;

    // Check user has dev mode enabled
    const userAccount = await prisma.userAccount.findUnique({
      where: { id: user.id },
    });

    if (!userAccount?.devMode) {
      res.status(403).json(err("DEV_MODE_REQUIRED", "Dev mode must be enabled"));
      return;
    }

    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const result = await clearMockVulnerabilities(environmentId);

    res.json(
      ok(result, `Cleared ${result.deletedVulnerabilities} mock vulnerabilities and ${result.deletedScans} scans`)
    );
  } catch (error: any) {
    console.error("[ClearMockVulnerabilities] Error:", error);
    res.status(500).json(err("CLEAR_FAILED", error.message || "Failed to clear mock vulnerabilities"));
  }
}

/**
 * Get all mock vulnerabilities for an environment
 * GET /dev/mock-vulnerabilities/:environmentId
 */
export async function getMockVulnerabilitiesHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;

    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const vulnerabilities = await getMockVulnerabilities(environmentId);

    res.json(ok(vulnerabilities));
  } catch (error: any) {
    console.error("[GetMockVulnerabilities] Error:", error);
    res.status(500).json(err("FETCH_FAILED", error.message || "Failed to fetch mock vulnerabilities"));
  }
}

/**
 * Get mock vulnerability stats
 * GET /dev/mock-vulnerabilities/:environmentId/stats
 */
export async function getMockVulnerabilityStatsHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;

    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const stats = await prisma.vulnerability.groupBy({
      by: ["severity"],
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
      _count: {
        id: true,
      },
    });

    const totalCount = stats.reduce((sum, s) => sum + s._count.id, 0);

    res.json(
      ok({ total: totalCount, bySeverity: stats })
    );
  } catch (error: any) {
    console.error("[GetMockVulnerabilityStats] Error:", error);
    res.status(500).json(err("FETCH_FAILED", error.message || "Failed to fetch stats"));
  }
}

/**
 * Create a single test vulnerability manually
 * POST /dev/create-test-vulnerability
 */
export async function createTestVulnerabilityHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const {
      environmentId,
      assetId,
      cveId,
      cvssScore,
      cvssVector,
      epssPercentile,
      description,
      severity,
    } = req.body;
    const user = req.user as PublicUser;

    // Check dev mode
    const userAccount = await prisma.userAccount.findUnique({
      where: { id: user.id },
    });
    if (!userAccount?.devMode) {
      res.status(403).json(
        err("DEV_MODE_REQUIRED", "Dev mode must be enabled to create test vulnerabilities")
      );
      return;
    }

    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    // Validate asset exists in this environment
    const asset = await prisma.asset.findFirst({
      where: { id: assetId, environmentId },
    });
    if (!asset) {
      res.status(404).json(err("NOT_FOUND", "Asset not found in environment"));
      return;
    }

    // Validate required fields
    if (!cveId || typeof cveId !== "string") {
      res.status(400).json(err("INVALID_INPUT", "cveId is required"));
      return;
    }

    // Check for duplicate CVE ID
    const existing = await prisma.vulnerability.findUnique({
      where: { cveId },
    });
    if (existing) {
      res.status(409).json(err("DUPLICATE_CVE", `CVE ${cveId} already exists`));
      return;
    }

    // Create vulnerability
    const vuln = await prisma.vulnerability.create({
      data: {
        cveId,
        description: description || `Test vulnerability ${cveId}`,
        cvssScore: typeof cvssScore === "number" ? cvssScore : null,
        cvssVector: cvssVector || null,
        epssPercentile: typeof epssPercentile === "number" ? epssPercentile : null,
        severity: severity || "CRITICAL",
        isMock: true,
        createdBy: user.id,
      },
    });

    // Create workflow linking asset to vulnerability
    const workflow = await prisma.vulnerabilityWorkflow.create({
      data: {
        environmentId,
        assetId,
        vulnerabilityId: vuln.id,
        cpeName: "cpe:2.3:a:test:test:1.0",
        status: "OPEN",
      },
    });

    // ─── Create mock scan + asset scan + asset vulnerability ───────────────
    // This integrates the test vuln with the dashboard, asset vuln map,
    // and overview statistics (same chain as scanned vulnerabilities).

    const scan = await prisma.securityScan.create({
      data: {
        environmentId,
        status: ScanStatus.COMPLETED,
        isMock: true,
        startedAt: new Date(),
        completedAt: new Date(),
        totalAssets: 1,
        scannedAssets: 1,
        vulnerabilitiesFound: 1,
        criticalCount: severity === "CRITICAL" ? 1 : 0,
        highCount: severity === "HIGH" ? 1 : 0,
        mediumCount: severity === "MEDIUM" ? 1 : 0,
        lowCount: severity === "LOW" ? 1 : 0,
      },
    });

    const assetScan = await prisma.assetScan.create({
      data: {
        scanId: scan.id,
        assetId,
        scannedAt: new Date(),
      },
    });

    await prisma.assetVulnerability.create({
      data: {
        assetScanId: assetScan.id,
        vulnerabilityId: vuln.id,
        cpeName: "cpe:2.3:a:test:test:1.0",
      },
    });

    res.status(201).json(
      ok({ vulnerability: vuln, workflow, scanId: scan.id }, "Test vulnerability created")
    );
  } catch (error: any) {
    console.error("[CreateTestVulnerability] Error:", error);
    res.status(500).json(
      err("CREATE_FAILED", error.message || "Failed to create test vulnerability")
    );
  }
}
