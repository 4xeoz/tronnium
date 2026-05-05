/**
 * API Client - Base HTTP utilities for backend communication
 * All API calls should use these helpers for consistent error handling
 */

const DEFAULT_BACKEND_URL = "http://localhost:4000";

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;
}

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

/**
 * Simplified fetch wrapper with:
 * - Automatic Content-Type: application/json for requests with a body
 * - Human-readable error extraction from JSON error responses
 * - Credentials always included (cookie-based auth)
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${getBackendUrl()}${endpoint}`;

  // Automatically add Content-Type for JSON bodies so Express can parse them.
  // Callers that need a different Content-Type can pass it via options.headers.
  const headers: Record<string, string> = {
    ...(options?.body ? { "Content-Type": "application/json" } : {}),
    ...(options?.headers as Record<string, string> | undefined),
  };

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  // Non-OK HTTP status: extract a human-readable message instead of throwing
  // the raw JSON string (which would show up verbatim in the UI).
  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`;
    try {
      const errorJson = await response.json();
      // Backend can use either "error" or "message" key
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

  if (json.success === false) {
    throw new Error(
      (typeof json.message === "string" && json.message) || "Request failed"
    );
  }

  return json;
}
