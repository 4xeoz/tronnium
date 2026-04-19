import { Request, Response } from "express";
import { getDashboardOverview } from "./dashboard.service";
import prisma from "../../lib/prisma";
import { ok, err } from "../../lib/response-helpers";

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
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const data = await getDashboardOverview(environmentId);
    res.json(ok(data));
  } catch (error: any) {
    console.error("[DashboardOverview] Error:", error);
    res.status(500).json(err("FETCH_FAILED", error.message || "Failed to fetch dashboard overview"));
  }
}
