/**
 * Auth API - Authentication related operations
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

// API Functions
export async function getCurrentUser(): Promise<ApiResponse<User>> {
  return apiFetch<User>("/auth/me");
}

export function getGoogleLoginUrl(): string {
  return `${getBackendUrl()}/auth/google`;
}
