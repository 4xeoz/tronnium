// app/api/logout/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getBackendUrl } from "@/lib/backend";

export async function POST(request: NextRequest) {
  try {

    console.log("Logout API route called");
    const backendUrl = getBackendUrl();
    
    // Forward the request to the backend logout endpoint
    // Note: credentials: "include" doesn't work server-side, so we manually forward cookies
    const response = await fetch(`${backendUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Cookie: request.headers.get("cookie") || "",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: "Logout failed" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Create response and forward the Set-Cookie header from backend
    const res = NextResponse.json(data);
    
    // Forward any Set-Cookie headers from the backend response
    const setCookieHeader = response.headers.get("set-cookie");
    if (setCookieHeader) {
      res.headers.set("set-cookie", setCookieHeader);
    }
    
    return res;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
