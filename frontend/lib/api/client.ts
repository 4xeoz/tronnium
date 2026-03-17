/**
 * API Client - Base HTTP utilities for backend communication
 * All API calls should use these helpers for consistent error handling
 */

const DEFAULT_BACKEND_URL = "http://localhost:4000";

export function getBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;
}

// export type ApiResult<T> = {
//   data: T | null;
//   error: string | null;
//   message: string | null;
// };

// /**
//  * Generic API request helper with error handling
//  */
// export async function apiRequest<T>(
//   endpoint: string,
//   options?: RequestInit
// ): Promise<ApiResult<T>> {
//   const url = `${getBackendUrl()}${endpoint}`;

//   try {
//     const response = await fetch(url, {
//       credentials: "include", // Always include cookies for auth
//       ...options,
//     });

//     if (!response.ok) {
//       const errorText = await response.text();
//       return {
//         data: null,
//         error: errorText || `Request failed with status ${response.status}`,
//         message: null,
//       };
//     }

//     const data = (await response.json()) as T;
//     return { data, error: null, message: null };
//   } catch (error) {
//     return {
//       data: null,
//       error: error instanceof Error ? error.message : "Network error",
//       message: null,
//     };
//   }
// }


export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

/**
 * Simplified fetch that throws on error (for simpler try/catch usage)
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${getBackendUrl()}${endpoint}`;

  console.log(`[API] Request: ${options?.method || "GET"} ${url}`);
  if (options?.body) {
    console.log(`[API] Request body:`, options.body);
  }

  const response = await fetch(url, { credentials: "include", ...options });

  console.log(`[API] Response status: ${response.status} ${response.statusText}`);

  // ❌ HTTP error (404, 500, etc.)
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[API] Error response:`, errorText);
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  // ✅ Parse JSON once
  const json: ApiResponse<T> = await response.json();
  console.log(`[API] Response body:`, json);


  console.log(`[API] Success:`, json);

  return json; // ✅ Success
}