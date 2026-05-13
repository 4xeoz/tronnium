import { Request, Response } from "express";
import { ScheduleFrequency } from "@prisma/client";
import { verifyEnvironment } from "../../lib/verify-environment";
import { ok, err } from "../../lib/response-helpers";
import type { PublicUser } from "../../types/express";
import { getSchedule, upsertSchedule, deleteSchedule } from "./scan-schedule.service";
import { reloadSchedule, removeSchedule } from "../../lib/scan-scheduler";

export async function getScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;
    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }
    const schedule = await getSchedule(environmentId);
    res.json(ok(schedule));
  } catch (e: any) {
    res.status(500).json(err("FETCH_FAILED", e.message));
  }
}

export async function upsertScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;
    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }

    const { frequency, hour, minute, dayOfWeek, dayOfMonth, fromDate, isActive } = req.body;

    const validFrequencies: ScheduleFrequency[] = ["DAILY", "WEEKLY", "MONTHLY"];
    if (!validFrequencies.includes(frequency)) {
      res.status(400).json(err("INVALID_INPUT", "frequency must be DAILY, WEEKLY, or MONTHLY"));
      return;
    }
    if (typeof hour !== "number" || hour < 0 || hour > 23) {
      res.status(400).json(err("INVALID_INPUT", "hour must be 0-23"));
      return;
    }

    const schedule = await upsertSchedule(environmentId, {
      frequency,
      hour,
      minute,
      dayOfWeek,
      dayOfMonth,
      fromDate,
      isActive,
    });

    await reloadSchedule(environmentId);

    res.json(ok(schedule));
  } catch (e: any) {
    res.status(500).json(err("UPSERT_FAILED", e.message));
  }
}

export async function deleteScheduleHandler(req: Request, res: Response): Promise<void> {
  try {
    const { environmentId } = req.params;
    const user = req.user as PublicUser;
    if (!(await verifyEnvironment(user.id, environmentId))) {
      res.status(404).json(err("NOT_FOUND", "Environment not found"));
      return;
    }
    await deleteSchedule(environmentId);
    removeSchedule(environmentId);
    res.json(ok(null, "Schedule deleted"));
  } catch (e: any) {
    res.status(500).json(err("DELETE_FAILED", e.message));
  }
}
