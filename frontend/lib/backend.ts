import { apiRequest } from "./apiClient";

export type HealthResponse = {
  isOk: string;
  uptime: number;
};

export type UserResponse = {
  email?: string;
  name: string;
  role: string;
};

const DEFAULT_BACKEND_URL = "http://localhost:4000";

function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;
}

export async function fetchHealth(): Promise<HealthResponse> {
  const backendUrl = getBackendBaseUrl();

  const response = await fetch(`${backendUrl}/health`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  const payload = (await response.json()) as HealthResponse;
  return payload;
}

export async function fetchUser(): Promise<UserResponse | null> {
  const backendUrl = getBackendBaseUrl();

  try {
    const response = await fetch(`${backendUrl}/auth/me`, {
      credentials: "include", // Include cookies
    });


    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as UserResponse;
    return payload;
  } catch {
    return null;
  }
}

export function getBackendUrl() {
  return getBackendBaseUrl();
}

