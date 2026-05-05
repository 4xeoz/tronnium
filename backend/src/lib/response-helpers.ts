/**
 * Standardized API response helpers
 *
 * Success shape: { success: true, data: T, message?: string }
 * Error shape:  { success: false, error: string, message: string }
 */

export function ok<T>(data: T, message?: string) {
  return { success: true as const, data, ...(message ? { message } : {}) };
}

export function err(error: string, message: string) {
  return { success: false as const, error, message };
}
