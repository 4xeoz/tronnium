/**
 * Auth API - Authentication related network operations
 * Each function returns exactly what the backend sends, unwrapped.
 */

import { apiFetch, ApiResponse, getBackendUrl } from "./client";

// Types
export type User = {
  id?: string;
  email?: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  devMode: boolean;
};

// ─── Fetch Functions ─────────────────────────────────────────

export async function fetchCurrentUser(): Promise<ApiResponse<User>> {
  return apiFetch<User>("/auth/me");
}

// ─── Utilities ───────────────────────────────────────────────

export function getGoogleLoginUrl(): string {
  return `${getBackendUrl()}/auth/google`;
}
