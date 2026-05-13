import cron from "node-cron";
import type { ScheduledTask } from "node-cron";
import { ScanStatus } from "@prisma/client";
import prisma from "./prisma";
import { getAllActiveSchedules, markScheduleRan, buildCronExpression, getSchedule } from "../modules/scan-schedule/scan-schedule.service";
import { runScan } from "../modules/scan-core/scan-core.service";

const jobs = new Map<string, ScheduledTask>();

async function triggerScheduledScan(environmentId: string, fromDate?: string | null) {
  console.log(`[Scheduler] Triggering scan for environment ${environmentId}`);
  try {
    const scan = await prisma.securityScan.create({
      data: {
        environmentId,
        status: ScanStatus.IN_PROGRESS,
        startedAt: new Date(),
      },
    });

    await markScheduleRan(environmentId);

    runScan(environmentId, scan.id, { fromDate: fromDate ? new Date(fromDate) : undefined }).catch((e) => {
      console.error(`[Scheduler] Scan failed for environment ${environmentId}:`, e.message);
    });
  } catch (e: any) {
    console.error(`[Scheduler] Failed to create scan for environment ${environmentId}:`, e.message);
  }
}

function registerJob(environmentId: string, cronExpr: string, fromDate?: string | null) {
  const existing = jobs.get(environmentId);
  if (existing) existing.stop();

  const task = cron.schedule(cronExpr, () => {
    triggerScheduledScan(environmentId, fromDate);
  });

  jobs.set(environmentId, task);
  console.log(`[Scheduler] Registered job for ${environmentId}: ${cronExpr}`);
}

export async function initScheduler() {
  const schedules = await getAllActiveSchedules();
  for (const s of schedules) {
    const expr = buildCronExpression(s.frequency, s.hour, s.minute, s.dayOfWeek, s.dayOfMonth);
    registerJob(s.environmentId, expr, s.fromDate);
  }
  console.log(`[Scheduler] Initialized ${schedules.length} scheduled scan(s)`);
}

export async function reloadSchedule(environmentId: string) {
  const s = await getSchedule(environmentId);
  if (!s || !s.isActive) {
    removeSchedule(environmentId);
    return;
  }
  const expr = buildCronExpression(s.frequency, s.hour, s.minute, s.dayOfWeek, s.dayOfMonth);
  registerJob(environmentId, expr, s.fromDate);
}

export function removeSchedule(environmentId: string) {
  const task = jobs.get(environmentId);
  if (task) {
    task.stop();
    jobs.delete(environmentId);
    console.log(`[Scheduler] Removed job for ${environmentId}`);
  }
}
