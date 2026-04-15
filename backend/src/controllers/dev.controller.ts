import { Request, Response } from "express";
import prisma from "../lib/prisma";
import { verifyEnvironment } from "../lib/verifyEnvironment";
import {
  generateMockVulnerabilities,
  clearMockVulnerabilities,
  getMockVulnerabilities,
} from "../services/mockVulnerability.service";
import type { PublicUser } from "../types/express";

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
      res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "environmentId is required",
      });
      return;
    }

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({
        success: false,
        error: "INVALID_INPUT",
        message: "prompt is required",
      });
      return;
    }

    // Check user has dev mode enabled
    const userAccount = await prisma.userAccount.findUnique({
      where: { id: user.id },
    });

    if (!userAccount?.devMode) {
      res.status(403).json({
        success: false,
        error: "DEV_MODE_REQUIRED",
        message: "Dev mode must be enabled to generate mock vulnerabilities",
      });
      return;
    }

    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json({ success: false, error: "Environment not found" });
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

    res.json({
      success: true,
      data: result,
      message: `Generated ${result.vulnerabilities.length} mock vulnerabilities and linked to ${result.assetScansCreated} assets`,
    });
  } catch (error: any) {
    console.error("[GenerateVulnerabilities] Error:", error);
    res.status(500).json({
      success: false,
      error: "GENERATION_FAILED",
      message: error.message || "Failed to generate mock vulnerabilities",
    });
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
      res.status(403).json({
        success: false,
        error: "DEV_MODE_REQUIRED",
        message: "Dev mode must be enabled",
      });
      return;
    }

    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json({ success: false, error: "Environment not found" });
      return;
    }

    const result = await clearMockVulnerabilities(environmentId);

    res.json({
      success: true,
      data: result,
      message: `Cleared ${result.deletedVulnerabilities} mock vulnerabilities and ${result.deletedScans} scans`,
    });
  } catch (error: any) {
    console.error("[ClearMockVulnerabilities] Error:", error);
    res.status(500).json({
      success: false,
      error: "CLEAR_FAILED",
      message: error.message || "Failed to clear mock vulnerabilities",
    });
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
      res.status(404).json({ success: false, error: "Environment not found" });
      return;
    }

    const vulnerabilities = await getMockVulnerabilities(environmentId);

    res.json({
      success: true,
      data: vulnerabilities,
      count: vulnerabilities.length,
    });
  } catch (error: any) {
    console.error("[GetMockVulnerabilities] Error:", error);
    res.status(500).json({
      success: false,
      error: "FETCH_FAILED",
      message: error.message || "Failed to fetch mock vulnerabilities",
    });
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
      res.status(404).json({ success: false, error: "Environment not found" });
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

    const totalCount = await prisma.vulnerability.count({
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
    });

    res.json({
      success: true,
      data: {
        total: totalCount,
        bySeverity: stats,
      },
    });
  } catch (error: any) {
    console.error("[GetMockVulnerabilityStats] Error:", error);
    res.status(500).json({
      success: false,
      error: "FETCH_FAILED",
      message: error.message || "Failed to fetch stats",
    });
  }
}
