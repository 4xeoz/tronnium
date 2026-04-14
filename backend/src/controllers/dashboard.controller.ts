import { Request, Response } from "express";
import { getDashboardOverview } from "../services/dashboard.service";
import prisma from "../lib/prisma";

export async function getDashboardOverviewHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { environmentId } = req.params;
    const user = req.user!;

    const environment = await prisma.environment.findFirst({
      where: { id: environmentId, ownerId: user.id },
    });

    if (!environment) {
      res.status(404).json({ success: false, error: "NOT_FOUND", message: "Environment not found" });
      return;
    }

    const data = await getDashboardOverview(environmentId);
    res.json({ success: true, data });
  } catch (error: any) {
    console.error("[DashboardOverview] Error:", error);
    res.status(500).json({ success: false, error: "FETCH_FAILED", message: error.message || "Failed to fetch dashboard overview" });
  }
}
