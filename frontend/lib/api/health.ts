/**
 * Health API - Backend health check
 */

import { apiFetch } from "./client";

export type HealthStatus = {
  isOk: string;
  uptime: number;
};

export async function getHealth(): Promise<HealthStatus> {
  return apiFetch<HealthStatus>("/health");
}
