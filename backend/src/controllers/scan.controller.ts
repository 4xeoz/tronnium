import { Request, Response } from "express";
import { runScan, getLatestScan, getScanHistory } from "../services/scane.service";
import prisma from "../lib/prisma";

/**
 * Start a vulnerability scan with SSE progress updates
 * POST /scans/:environmentId
 */
export async function startScanHandler(req: Request, res: Response): Promise<void> {
  const { environmentId } = req.params;
  const userId = req.user?.id;

  // Validate required parameters
  if (!environmentId || !userId) {
    res.status(400).json({ error: "Missing environmentId or user context" });
    return;
  }

  try {
    // Verify user owns this environment
    const environment = await prisma.environment.findFirst({
      where: {
        id: environmentId,
        ownerId: userId,
      },
    });

    if (!environment) {
      res.status(404).json({ error: "Environment not found" });
      return;
    }

    // Setup SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable Nginx buffering
    res.flushHeaders();

    // Run scan with progress callback
    const scanResult = await runScan(environmentId, (progress) => {
      const event = {
        type: "progress",
        step: progress.stage,
        message: progress.message,
        timestamp: new Date().toISOString(),
      };

      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Send completed event
    const completedEvent = {
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
    };

    res.write(`data: ${JSON.stringify(completedEvent)}\n\n`);
    res.end();
  } catch (error) {
    console.error("Scan error:", error);

    const errorEvent = {
      type: "error",
      message: error instanceof Error ? error.message : "Unknown error occurred",
      timestamp: new Date().toISOString(),
    };

    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
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
    res.status(400).json({ error: "Missing environmentId or user context" });
    return;
  }

  try {
    // Verify user owns this environment
    const environment = await prisma.environment.findFirst({
      where: {
        id: environmentId,
        ownerId: userId,
      },
    });

    if (!environment) {
      res.status(404).json({ error: "Environment not found" });
      return;
    }

    const latestScan = await getLatestScan(environmentId);

    if (!latestScan) {
      res.status(404).json({ error: "No completed scans found for this environment" });
      return;
    }

    res.json({
      success: true,
      data: latestScan,
    });
  } catch (error) {
    console.error("Failed to fetch latest scan:", error);
    res.status(500).json({
      error: "Failed to fetch latest scan",
      details: error instanceof Error ? error.message : undefined,
    });
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
    res.status(400).json({ error: "Missing environmentId or user context" });
    return;
  }

  // Validate limit
  if (isNaN(limit) || limit < 1 || limit > 100) {
    res.status(400).json({ error: "Limit must be between 1 and 100" });
    return;
  }

  try {
    // Verify user owns this environment
    const environment = await prisma.environment.findFirst({
      where: {
        id: environmentId,
        ownerId: userId,
      },
    });

    if (!environment) {
      res.status(404).json({ error: "Environment not found" });
      return;
    }

    const history = await getScanHistory(environmentId, limit);

    res.json({
      success: true,
      count: history.length,
      data: history,
    });
  } catch (error) {
    console.error("Failed to fetch scan history:", error);
    res.status(500).json({
      error: "Failed to fetch scan history",
      details: error instanceof Error ? error.message : undefined,
    });
  }
}