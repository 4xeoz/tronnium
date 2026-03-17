/**
 * Auth API - Authentication related operations
 */

import { apiFetch, ApiResponse, getBackendUrl } from "./client";

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
    const response = await apiFetch<User>("/auth/me");
    if (!response.success) {
      throw new Error(response.message || "Failed to fetch user");
    }
    return response.data;
  } catch {
    throw new Error("Not authenticated");
    
  }
}

export function getGoogleLoginUrl(): string {
  return `${getBackendUrl()}/auth/google`;
}
