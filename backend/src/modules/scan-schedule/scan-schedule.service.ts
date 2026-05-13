import { ScheduleFrequency } from "@prisma/client";
import prisma from "../../lib/prisma";

export type UpsertScheduleInput = {
  frequency: ScheduleFrequency;
  hour: number;
  minute?: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  fromDate?: string | null;
  isActive?: boolean;
};

export function buildCronExpression(
  frequency: ScheduleFrequency,
  hour: number,
  minute: number,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null
): string {
  switch (frequency) {
    case "MINUTELY":
      return `* * * * *`;
    case "HOURLY":
      return `${minute} * * * *`;
    case "DAILY":
      return `${minute} ${hour} * * *`;
    case "WEEKLY":
      return `${minute} ${hour} * * ${dayOfWeek ?? 1}`;
    case "MONTHLY":
      return `${minute} ${hour} ${dayOfMonth ?? 1} * *`;
  }
}

export function computeNextRun(
  frequency: ScheduleFrequency,
  hour: number,
  minute: number,
  dayOfWeek?: number | null,
  dayOfMonth?: number | null
): Date {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);

  switch (frequency) {
    case "MINUTELY":
      next.setMinutes(next.getMinutes() + 1);
      break;
    case "HOURLY":
      next.setMinutes(minute);
      if (next <= now) next.setHours(next.getHours() + 1);
      break;
    case "DAILY":
      next.setHours(hour, minute);
      if (next <= now) next.setDate(next.getDate() + 1);
      break;
    case "WEEKLY": {
      next.setHours(hour, minute);
      const target = dayOfWeek ?? 1;
      const diff = (target - now.getDay() + 7) % 7 || 7;
      if (next > now && now.getDay() === target) break;
      next.setDate(next.getDate() + diff);
      break;
    }
    case "MONTHLY": {
      next.setHours(hour, minute);
      const target = dayOfMonth ?? 1;
      next.setDate(target);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      break;
    }
  }

  return next;
}

export async function getSchedule(environmentId: string) {
  return prisma.scanSchedule.findUnique({ where: { environmentId } });
}

export async function upsertSchedule(environmentId: string, input: UpsertScheduleInput) {
  const minute = input.minute ?? 0;
  const nextRunAt = computeNextRun(
    input.frequency,
    input.hour,
    minute,
    input.dayOfWeek,
    input.dayOfMonth
  );

  return prisma.scanSchedule.upsert({
    where: { environmentId },
    create: {
      environmentId,
      frequency: input.frequency,
      hour: input.hour,
      minute,
      dayOfWeek: input.dayOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      fromDate: input.fromDate ?? null,
      isActive: input.isActive ?? true,
      nextRunAt,
    },
    update: {
      frequency: input.frequency,
      hour: input.hour,
      minute,
      dayOfWeek: input.dayOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      fromDate: input.fromDate ?? null,
      isActive: input.isActive ?? true,
      nextRunAt,
    },
  });
}

export async function deleteSchedule(environmentId: string) {
  return prisma.scanSchedule.delete({ where: { environmentId } }).catch(() => null);
}

export async function getAllActiveSchedules() {
  return prisma.scanSchedule.findMany({ where: { isActive: true } });
}

export async function markScheduleRan(environmentId: string) {
  const schedule = await prisma.scanSchedule.findUnique({ where: { environmentId } });
  if (!schedule) return;
  const nextRunAt = computeNextRun(
    schedule.frequency,
    schedule.hour,
    schedule.minute,
    schedule.dayOfWeek,
    schedule.dayOfMonth
  );
  return prisma.scanSchedule.update({
    where: { environmentId },
    data: { lastRunAt: new Date(), nextRunAt },
  });
}
