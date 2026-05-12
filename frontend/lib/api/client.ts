/**
 * API Client - Base HTTP utilities for backend communication
 * All API calls should use these helpers for consistent error handling
 */

const DEFAULT_BACKEND_URL = "http://localhost:4000";

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;
}

/**
 * Build a full SSE URL from a path.
 * Uses the same backend URL as regular API calls.
 */
export function getSseUrl(path: string): string {
  return `${getBackendUrl()}${path}`;
}

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

/**
 * Core fetch wrapper. Returns the full ApiResponse<T> from the backend.
 * Throws on non-OK HTTP status or when json.success === false.
 *
 * Use this in the API layer when you want the raw response shape.
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${getBackendUrl()}${endpoint}`;

  const headers: Record<string, string> = {
    ...(options?.body ? { "Content-Type": "application/json" } : {}),
    ...(options?.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const errorJson = await response.json();
      errorMessage =
        (typeof errorJson.error === "string" && errorJson.error) ||
        (typeof errorJson.message === "string" && errorJson.message) ||
        errorMessage;
    } catch {
      const errorText = await response.text();
      if (errorText) errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }

  const json: ApiResponse<T> = await response.json();

  // if (json.success === false) {
  //   throw new Error(
  //     (typeof json.message === "string" && json.message) || "Request failed"
  //   );
  // }

  return json;
}

// /**
//  * Convenience wrapper that returns only the data payload.
//  * Use this in the intermediary layer or in components that don't need
//  * the full ApiResponse wrapper (success flag, message).
//  *
//  * Errors are still thrown — always wrap in try/catch.
//  */
// export async function apiFetchData<T>(
//   endpoint: string,
//   options?: RequestInit
// ): Promise<T> {
//   const response = await apiFetch<T>(endpoint, options);
//   return response.data;
// }
