import { apiFetch, ApiResponse } from "./client";

export type ScheduleFrequency = "MINUTELY" | "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY";

export type ScanSchedule = {
  id: string;
  environmentId: string;
  frequency: ScheduleFrequency;
  hour: number;
  minute: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  fromDate: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertScheduleInput = {
  frequency: ScheduleFrequency;
  hour: number;
  minute?: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  fromDate?: string | null;
  isActive?: boolean;
};

export async function fetchSchedule(environmentId: string): Promise<ApiResponse<ScanSchedule | null>> {
  return apiFetch<ScanSchedule | null>(`/scans/${environmentId}/schedule`);
}

export async function upsertSchedule(
  environmentId: string,
  input: UpsertScheduleInput
): Promise<ApiResponse<ScanSchedule>> {
  return apiFetch<ScanSchedule>(`/scans/${environmentId}/schedule`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function deleteSchedule(environmentId: string): Promise<ApiResponse<null>> {
  return apiFetch<null>(`/scans/${environmentId}/schedule`, { method: "DELETE" });
}
