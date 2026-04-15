import { Request, Response } from "express";
import { runScan, getLatestScan, getScanHistory, getScanById, ScanOptions } from "../services/scan.service";
import prisma from "../lib/prisma";
import { verifyEnvironment } from "../lib/verifyEnvironment";
import { getMaxLookbackDate } from "../services/nvdCve";
import { ScanStatus } from "@prisma/client";

/**
 * Start a vulnerability scan with SSE progress updates
 * GET /scans/:environmentId/start
 *
 * Query Parameters:
 * - fromDate: "last-scan" or ISO date string (optional)
 *           "last-scan" = only scan for CVEs published since the last scan
 *           ISO date = only scan for CVEs published since this date (max 5 years ago)
 *           omitted = scan for all CVEs
 */
export async function startScanHandler(req: Request, res: Response): Promise<void> {
  const { environmentId } = req.params;
  const userId = req.user?.id;
  const { fromDate } = req.query;

  if (!environmentId || !userId) {
    res.status(400).json({ success: false, error: "Missing environmentId or user context" });
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json({ success: false, error: "Environment not found" });
      return;
    }

    // Parse scan options
    const scanOptions: ScanOptions = {};

    if (fromDate) {
      if (fromDate === "last-scan") {
        scanOptions.fromDate = "last-scan";
      } else {
        const parsedDate = new Date(fromDate as string);
        if (isNaN(parsedDate.getTime())) {
          res.status(400).json({ success: false, error: "Invalid fromDate format. Use 'last-scan' or ISO date string" });
          return;
        }
        scanOptions.fromDate = parsedDate;
      }
    }

    // Setup SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const scanResult = await runScan(environmentId, scanOptions, (progress) => {
      res.write(`data: ${JSON.stringify({ type: "progress", step: progress.stage, message: progress.message, timestamp: new Date().toISOString() })}\n\n`);
    });

    res.write(`data: ${JSON.stringify({
      type: "completed",
      data: {
        scanId: scanResult.scanId,
        status: scanResult.status,
        totalAssets: scanResult.totalAssets,
        scannedAssets: scanResult.scannedAssets,
        vulnerabilitiesFound: scanResult.vulnerabilitiesFound,
        criticalCount: scanResult.criticalCount,
        highCount: scanResult.highCount,
        mediumCount: scanResult.mediumCount,
        lowCount: scanResult.lowCount,
        riskScore: scanResult.riskScore,
      },
      timestamp: new Date().toISOString(),
    })}\n\n`);
    res.end();
  } catch (error) {
    console.error("Scan error:", error);
    res.write(`data: ${JSON.stringify({ type: "error", message: error instanceof Error ? error.message : "Unknown error occurred", timestamp: new Date().toISOString() })}\n\n`);
    res.end();
  }
}

/**
 * Get the latest completed scan for an environment
 * GET /scans/:environmentId/latest
 */
export async function getLatestScanHandler(req: Request, res: Response): Promise<void> {
  const { environmentId } = req.params;
  const userId = req.user?.id;

  if (!environmentId || !userId) {
    res.status(400).json({ success: false, error: "Missing environmentId or user context" });
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json({ success: false, error: "Environment not found" });
      return;
    }

    const latestScan = await getLatestScan(environmentId);

    if (!latestScan) {
      res.status(404).json({ success: false, error: "No completed scans found for this environment" });
      return;
    }

    res.json({ success: true, data: latestScan });
  } catch (error) {
    console.error("Failed to fetch latest scan:", error);
    res.status(500).json({ success: false, error: "Failed to fetch latest scan" });
  }
}

/**
 * Get scan history for an environment
 * GET /scans/:environmentId
 */
export async function getScanHistoryHandler(req: Request, res: Response): Promise<void> {
  const { environmentId } = req.params;
  const userId = req.user?.id;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

  if (!environmentId || !userId) {
    res.status(400).json({ success: false, error: "Missing environmentId or user context" });
    return;
  }

  if (isNaN(limit) || limit < 1 || limit > 100) {
    res.status(400).json({ success: false, error: "Limit must be between 1 and 100" });
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json({ success: false, error: "Environment not found" });
      return;
    }

    const history = await getScanHistory(environmentId, limit);

    res.json({ success: true, count: history.length, data: history });
  } catch (error) {
    console.error("Failed to fetch scan history:", error);
    res.status(500).json({ success: false, error: "Failed to fetch scan history" });
  }
}

/**
 * Get scan settings for an environment
 * GET /scans/:environmentId/settings
 */
export async function getScanSettingsHandler(req: Request, res: Response): Promise<void> {
  const { environmentId } = req.params;
  const userId = req.user?.id;

  if (!environmentId || !userId) {
    res.status(400).json({ success: false, error: "Missing environmentId or user context" });
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json({ success: false, error: "Environment not found" });
      return;
    }

    const lastScan = await prisma.securityScan.findFirst({
      where: { environmentId, status: ScanStatus.COMPLETED, isMock: false },
      orderBy: { completedAt: "desc" },
    });

    const maxLookbackDate = getMaxLookbackDate();
    const lastScanDate = lastScan?.completedAt || null;
    const defaultFromDate = lastScanDate || maxLookbackDate;

    res.json({
      success: true,
      data: {
        lastScanDate: lastScanDate?.toISOString() || null,
        maxLookbackDate: maxLookbackDate.toISOString(),
        defaultFromDate: defaultFromDate.toISOString(),
        hasPreviousScan: !!lastScanDate,
      },
    });
  } catch (error) {
    console.error("Failed to fetch scan settings:", error);
    res.status(500).json({ success: false, error: "Failed to fetch scan settings" });
  }
}

/**
 * Get a single scan by ID with full details
 * GET /scans/:environmentId/:scanId
 */
export async function getScanByIdHandler(req: Request, res: Response): Promise<void> {
  const { environmentId, scanId } = req.params;
  const userId = req.user?.id;

  if (!environmentId || !scanId || !userId) {
    res.status(400).json({ success: false, error: "Missing required parameters" });
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json({ success: false, error: "Environment not found" });
      return;
    }

    const scan = await getScanById(scanId, environmentId);

    if (!scan) {
      res.status(404).json({ success: false, error: "Scan not found" });
      return;
    }

    res.json({ success: true, data: scan });
  } catch (error) {
    console.error("Failed to fetch scan:", error);
    res.status(500).json({ success: false, error: "Failed to fetch scan" });
  }
}

/**
 * Delete a scan by ID
 * DELETE /scans/:environmentId/:scanId
 *
 * Cascades: SecurityScan → AssetScan → AssetVulnerability (via DB cascade rules).
 * VulnerabilityWorkflow records are NOT deleted (they track remediation state
 * independently of individual scan runs).
 * Disallows deletion of scans that are currently IN_PROGRESS.
 */
export async function deleteScanHandler(req: Request, res: Response): Promise<void> {
  const { environmentId, scanId } = req.params;
  const userId = req.user?.id;

  if (!environmentId || !scanId || !userId) {
    res.status(400).json({ success: false, error: "Missing required parameters" });
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json({ success: false, error: "Environment not found" });
      return;
    }

    const scan = await prisma.securityScan.findFirst({
      where: { id: scanId, environmentId },
      select: { id: true, status: true },
    });

    if (!scan) {
      res.status(404).json({ success: false, error: "Scan not found" });
      return;
    }

    if (scan.status === "IN_PROGRESS") {
      res.status(409).json({ success: false, error: "Cannot delete a scan that is currently in progress" });
      return;
    }

    await prisma.securityScan.delete({ where: { id: scanId } });

    res.json({ success: true, message: "Scan deleted successfully" });
  } catch (error) {
    console.error("[Scan] deleteScan error:", error);
    res.status(500).json({ success: false, error: "Failed to delete scan" });
  }
}
