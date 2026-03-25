/**
 * Health API - Backend health check
 */

import { apiFetch, ApiResponse } from "./client";

export type HealthStatus = {
  isOk: string;
  uptime: number;
};

export async function getHealth(): Promise<ApiResponse<HealthStatus>> {
  return apiFetch<HealthStatus>("/health");
}
