/**
 * Auth API - Authentication related operations
 */

import { apiFetch, getBackendUrl } from "./client";

// Types
export type User = {
  email?: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
};

// API Functions
export async function getCurrentUser(): Promise<User | null> {
  try {
    return await apiFetch<User>("/auth/me");
  } catch {
    return null;
  }
}

export function getGoogleLoginUrl(): string {
  return `${getBackendUrl()}/auth/google`;
}
