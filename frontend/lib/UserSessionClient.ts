'use server';

import { cookies } from "next/headers";
import { apiRequest } from "./apiClient";

type UserResponse = {
  email?: string;
  name: string;
  role: string;
};

const DEFAULT_BACKEND_URL = "http://localhost:4000";

function getBackendBaseUrl() {
  return process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;
}



export async function fetchUserServerSide(): Promise<UserResponse | null> {
  const backendUrl = getBackendBaseUrl();

  const cookie = await cookies();
  const accessToken = cookie.get("token")?.value;

  if (!accessToken) {
    return null;
  }

  try {
    const response = await fetch(`${backendUrl}/auth/me`, {
        headers: {
            'Authorization': `Bearer ${accessToken}`,
        },
      
    });

    // console.log("Server-side fetchUser sent request with token:", accessToken);


    if (!response.ok) {
      return null;
    }

    console.log("Server-side fetchUser response:", response.status);

    const payload = (await response.json()) as UserResponse;
    return payload;
  } catch {
    return null;
  }
}

export async function fetchUserServerSideAPIREQUEST(): Promise<UserResponse | null> {
  const backendUrl = getBackendBaseUrl();

  try {
    const response = await apiRequest<UserResponse>(`auth/me`, {
      credentials: "include", // Include cookies
    });



    if (!response.error) {
      return null;
    }

    const payload = (await response.payload) as UserResponse;
    return payload;
  } catch {
    return null;
  }
}



