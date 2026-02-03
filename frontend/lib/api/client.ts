/**
 * API Client - Base HTTP utilities for backend communication
 * All API calls should use these helpers for consistent error handling
 */

const DEFAULT_BACKEND_URL = "http://localhost:4000";

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;
}

export type ApiResult<T> = {
  data: T | null;
  error: string | null;
  status: number | null;
};

/**
 * Generic API request helper with error handling
 */
export async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResult<T>> {
  const url = `${getBackendUrl()}${endpoint}`;

  try {
    const response = await fetch(url, {
      credentials: "include", // Always include cookies for auth
      ...options,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        data: null,
        error: errorText || `Request failed with status ${response.status}`,
        status: response.status,
      };
    }

    const data = (await response.json()) as T;
    return { data, error: null, status: response.status };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Network error",
      status: null,
    };
  }
}

/**
 * Simplified fetch that throws on error (for simpler try/catch usage)
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${getBackendUrl()}${endpoint}`;

  const response = await fetch(url, {
    credentials: "include",
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return response.json();
}
