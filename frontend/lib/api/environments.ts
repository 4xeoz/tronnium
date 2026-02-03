/**
 * Environment API - CRUD operations for environments
 */

import { apiFetch } from "./client";

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

// API Functions
export async function getEnvironments(): Promise<Environment[]> {
  return apiFetch<Environment[]>("/environments");
}

export async function getEnvironment(id: string): Promise<Environment> {
  return apiFetch<Environment>(`/environments/${id}`);
}

export async function createEnvironment(data: CreateEnvironmentInput): Promise<Environment> {
  return apiFetch<Environment>("/environments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteEnvironment(id: string): Promise<void> {
  await apiFetch<void>(`/environments/${id}`, {
    method: "DELETE",
  });
}
