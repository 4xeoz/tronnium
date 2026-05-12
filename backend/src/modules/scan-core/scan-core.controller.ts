import { Request, Response } from "express";
import { runScan, getLatestScan, getScanHistory, getScanById } from "./scan-core.service";
import type { ScanOptions, ScanProgress } from "./scan.types";
import prisma from "../../lib/prisma";
import { verifyEnvironment } from "../../lib/verify-environment";
import { getMaxLookbackDate } from "../scan-nvd/public";
import { ScanStatus } from "@prisma/client";
import { ok, err } from "../../lib/response-helpers";
import { createScanEmitter, getScanEmitter, removeScanEmitter } from "../../lib/scan-progress.bus";

export async function startScanHandler(req: Request, res: Response): Promise<void> {
  const { environmentId } = req.params;
  const userId = req.user?.id;
  const { fromDate } = req.query;

  if (!environmentId || !userId) {
    res.status(400).json(err("INVALID_INPUT", "Missing environmentId or user context"));
    return;
  }

  try {

    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    // Prevent concurrent scans on the same environment
    const runningScan = await prisma.securityScan.findFirst({
      where: { environmentId, status: ScanStatus.IN_PROGRESS },
      select: { id: true, startedAt: true },
    });

    // If already running, return its scanId so client can connect to its progress stream
    if (runningScan) {
      res.status(200).json(ok({ scanId: runningScan.id, alreadyRunning: true }));
      return;
    }

    const scanOptions: ScanOptions = {};
    if (fromDate) {
      if (fromDate === "last-scan") {
        scanOptions.fromDate = "last-scan";
      } else {
        const parsedDate = new Date(fromDate as string);
        if (isNaN(parsedDate.getTime())) {
          res.status(400).json(err("INVALID_INPUT", "Invalid fromDate format. Use 'last-scan' or ISO date string"));
          return;
        }
        scanOptions.fromDate = parsedDate;
      }
    }

    // Create DB record first so we have a scanId to return immediately
    const scan = await prisma.securityScan.create({
      data: { environmentId, status: ScanStatus.IN_PROGRESS, startedAt: new Date() },
    });

    const emitter = createScanEmitter(scan.id);

    // Fire scan in background — do NOT await
    runScan(environmentId, scan.id, scanOptions, (progress) => {
      emitter.emit("progress", progress);
    }).then(() => {
      emitter.emit("completed", { scanId: scan.id });
      removeScanEmitter(scan.id);
    }).catch((error) => {
      emitter.emit("error", error instanceof Error ? error.message : "Unknown error occurred");
      removeScanEmitter(scan.id);
    });

    // Respond immediately with the scanId
    res.status(200).json(ok({ scanId: scan.id, alreadyRunning: false }));
      
        
  } catch (error) {
    console.error("Failed to start scan:", error);
    res.status(500).json(err("START_FAILED", "Failed to start scan"));
  }
}

export async function getLatestScanHandler(req: Request, res: Response): Promise<void> {
  const { environmentId } = req.params;
  const userId = req.user?.id;

  if (!environmentId || !userId) {
    res.status(400).json(err("INVALID_INPUT", "Missing environmentId or user context"));
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const latestScan = await getLatestScan(environmentId);

    if (!latestScan) {
      res.status(404).json(err("NOT_FOUND", "No completed scans found for this environment"));
      return;
    }

    res.json(ok(latestScan));
  } catch (error) {
    console.error("Failed to fetch latest scan:", error);
    res.status(500).json(err("FETCH_FAILED", "Failed to fetch latest scan"));
  }
}

export async function getScanHistoryHandler(req: Request, res: Response): Promise<void> {
  const { environmentId } = req.params;
  const userId = req.user?.id;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;

  if (!environmentId || !userId) {
    res.status(400).json(err("INVALID_INPUT", "Missing environmentId or user context"));
    return;
  }

  if (isNaN(limit) || limit < 1 || limit > 100) {
    res.status(400).json(err("INVALID_INPUT", "Limit must be between 1 and 100"));
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const history = await getScanHistory(environmentId, limit);

    res.json(ok(history));
  } catch (error) {
    console.error("Failed to fetch scan history:", error);
    res.status(500).json(err("FETCH_FAILED", "Failed to fetch scan history"));
  }
}

export async function getScanSettingsHandler(req: Request, res: Response): Promise<void> {
  const { environmentId } = req.params;
  const userId = req.user?.id;

  if (!environmentId || !userId) {
    res.status(400).json(err("INVALID_INPUT", "Missing environmentId or user context"));
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const lastScan = await prisma.securityScan.findFirst({
      where: { environmentId, status: ScanStatus.COMPLETED, isMock: false },
      orderBy: { completedAt: "desc" },
    });

    const maxLookbackDate = getMaxLookbackDate();
    const lastScanDate = lastScan?.completedAt || null;
    const defaultFromDate = lastScanDate || maxLookbackDate;

    res.json(
      ok({
        lastScanDate,
        maxLookbackDate,
        defaultFromDate,
        hasPreviousScan: !!lastScanDate,
      })
    );
  } catch (error) {
    console.error("Failed to fetch scan settings:", error);
    res.status(500).json(err("FETCH_FAILED", "Failed to fetch scan settings"));
  }
}

export async function getScanByIdHandler(req: Request, res: Response): Promise<void> {
  const { environmentId, scanId } = req.params;
  const userId = req.user?.id;

  if (!environmentId || !scanId || !userId) {
    res.status(400).json(err("INVALID_INPUT", "Missing required parameters"));
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const scan = await getScanById(scanId, environmentId);

    if (!scan) {
      res.status(404).json(err("NOT_FOUND", "Scan not found"));
      return;
    }

    res.json(ok(scan));
  } catch (error) {
    console.error("Failed to fetch scan:", error);
    res.status(500).json(err("FETCH_FAILED", "Failed to fetch scan"));
  }
}

export async function deleteScanHandler(req: Request, res: Response): Promise<void> {
  const { environmentId, scanId } = req.params;
  const userId = req.user?.id;

  if (!environmentId || !scanId || !userId) {
    res.status(400).json(err("INVALID_INPUT", "Missing required parameters"));
    return;
  }

  try {
    if (!(await verifyEnvironment(userId, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const scan = await prisma.securityScan.findFirst({
      where: { id: scanId, environmentId },
      select: { id: true, status: true },
    });

    if (!scan) {
      res.status(404).json(err("NOT_FOUND", "Scan not found"));
      return;
    }

    if (scan.status === "IN_PROGRESS") {
      res.status(409).json(err("CONFLICT", "Cannot delete a scan that is currently in progress"));
      return;
    }

    await prisma.securityScan.delete({ where: { id: scanId } });

    res.json(ok(null, "Scan deleted successfully"));
  } catch (error) {
    console.error("[Scan] deleteScan error:", error);
    res.status(500).json(err("DELETE_FAILED", "Failed to delete scan"));
  }
}


export async function getScanProgressHandler(req: Request, res: Response): Promise<void> {
  const { environmentId, scanId } = req.params;
  const userId = req.user?.id;

  if (!environmentId || !scanId || !userId) {
    res.status(400).json(err("INVALID_INPUT", "Missing required parameters"));
    return;
  }

  if (!(await verifyEnvironment(userId, environmentId))) {
    res.status(404).json(err("NOT_FOUND", "Environment not found"));
    return;
  }

  const emitter = getScanEmitter(scanId);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // scane already completed or doesn't exist
  if (!emitter) {
    res.write(`data: ${JSON.stringify({ type: "completed", message: "Scan already completed" })}\n\n`);
    res.end();
    return;
  }

  const onProgress = (progress: ScanProgress) => {
    res.write(`data: ${JSON.stringify({ type: "progress", step: progress.stage, message: progress.message, timestamp: new Date().toISOString() })}\n\n`);
  };

  const onDone = (data: { scanId: string }) => {
    res.write(`data: ${JSON.stringify({ type: "completed", data, timestamp: new Date().toISOString() })}\n\n`);
    res.end();
  };

  const onError = (message: string) => {
    res.write(`data: ${JSON.stringify({ type: "error", message, timestamp: new Date().toISOString() })}\n\n`);
    res.end();
  };

  emitter.on("progress", onProgress);
  emitter.on("completed", onDone);
  emitter.on("error", onError);

  // Client disconnected — remove listeners but scan keeps running
  req.on("close", () => {
    emitter.off("progress", onProgress);
    emitter.off("completed", onDone);
    emitter.off("error", onError);
  });
}
