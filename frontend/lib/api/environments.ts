/**
 * Environment API - Network operations for environments
 * Each function returns exactly what the backend sends, unwrapped.
 */

import { apiFetch, ApiResponse } from "./client";

// Types
export type Environment = {
  id: string;
  name: string;
  description: string | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  assetCount?: number;
};

export type CreateEnvironmentInput = {
  name: string;
  description?: string;
  labels?: string[];
};

// ─── Fetch Functions ─────────────────────────────────────────

export async function fetchEnvironments(): Promise<ApiResponse<Environment[]>> {
  return apiFetch<Environment[]>("/environments");
}

export async function fetchEnvironmentById(id: string): Promise<ApiResponse<Environment>> {
  return apiFetch<Environment>(`/environments/${id}`);
}

// ─── Mutations ───────────────────────────────────────────────

export async function createEnvironment(data: CreateEnvironmentInput): Promise<ApiResponse<Environment>> {
  return apiFetch<Environment>("/environments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteEnvironment(id: string): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/environments/${id}`, {
    method: "DELETE",
  });
}
