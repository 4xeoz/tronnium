/**
 * Asset API - CRUD operations for assets and CPE discovery
 */

import { env } from "process";
import { apiFetch, ApiResponse } from "./client";

// Types
export type Asset = {
  id: string;
  environmentId: string;
  name: string;
  description: string | null;
  type: string;
  domain: "IT" | "OT" | "UNKNOWN";
  x: number | null;
  y: number | null;
  status: string | null;
  location: string | null;
  ipAddress: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  cpes: CpeCandidate[];  // Full CPE data with scores and breakdown
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type RelationType = "DEPENDS_ON" | "CONTROLS" | "PROVIDES_SERVICE" | "SHARES_DATA_WITH";
export type CriticalityLevel = "low" | "medium" | "high";

export type Relationship = {
  id: string;
  environmentId: string;
  fromAssetId: string;
  toAssetId: string;
  type: RelationType;
  criticality: CriticalityLevel;
  createdAt: string;
  updatedAt: string;
  fromAsset?: { id: string; name: string; type: string };
  toAsset?: { id: string; name: string; type: string };
};

export type CpeCandidate = {
  cpeName: string;
  cpeNameId: string;
  title: string;
  score: number;
  vendor: string;
  product: string;
  version: string;
  breakdown: {
    vendor: number;
    product: number;
    version: number;
    tokenOverlap: number;
  };
};

export type AssetVulnerabilityItem = {
  id: string;
  cveId: string;
  description: string;
  cvssScore: number | null;
  cvssVector: string | null;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  publishedDate: string | null;
  lastModifiedDate: string | null;
  cpeName: string;
};

export type AssetVulnerabilitiesResponse = {
  assetId: string;
  assetName: string;
  scanId: string;
  scannedAt: string;
  vulnerabilityCount: number;
  vulnerabilities: AssetVulnerabilityItem[];
};

export type CpeFindResponse = {
  success: boolean;
  parsed: {
    raw: string;
    normalized: string;
    vendor: string | null;
    product: string | null;
    version: string | null;
    tokens: string[];
  };
  candidates: CpeCandidate[];
  count: number;
  totalFound: number;
};

export type CpeValidateResponse = {
  success: boolean;
  isValid: boolean;
  existsInNvd: boolean;
  exactMatch: boolean;
  deprecated: boolean;
  message: string;
  parsed?: {
    part: string;
    vendor: string;
    product: string;
    version: string;
    update: string;
  };
  matchesFound?: number;
};

export type CreateAssetInput = {
  name: string;
  description?: string;
  type?: string;
  status?: string;
  location?: string;
  ipAddress?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  cpes?: CpeCandidate[];  // Full CPE data with scores and breakdown
  domain?: "IT" | "OT" | "UNKNOWN";
};

// API Functions

/**
 * Find CPE candidates from an asset name
 * @deprecated Use listenForCpeFindProgress for real-time updates
 */
export async function findCpe(assetName: string, topN: number = 5): Promise<ApiResponse<CpeFindResponse>> {
  const params = new URLSearchParams({
    assetName,
    topN: topN.toString(),
  });
  return apiFetch<CpeFindResponse>(`/assets/cpe/find?${params.toString()}`, {
    method: "GET",
  });
}

/**
 * Listen for CPE find progress updates using SSE
 */

export function listenForCpeFindProgress(
  assetName: string,
  topN: number = 5,
  onUpdate: (update: { step: string; message: string }) => void,
  onComplete: (result: CpeFindResponse) => void,
  onError: (error: string) => void
): EventSource {
  // Use the correct base URL (adjust based on your setup)
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const eventSource = new EventSource(
    `${baseUrl}/assets/cpe/find?assetName=${encodeURIComponent(assetName)}&topN=${topN}`
  );

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "progress") {
        onUpdate({ step: data.step || "Progress", message: data.message });
      } else if (data.type === "completed") {
        // Backend sends the result in data.data
        onComplete(data.data);
        eventSource.close();
      } else if (data.type === "error") {
        onError(data.message || "Unknown error");
        eventSource.close();
      }
    } catch (parseError) {
      console.error("Failed to parse SSE message:", parseError);
    }
  };

  eventSource.onerror = () => {
    onError("Connection error. Please try again.");
    eventSource.close();
  };

  return eventSource;
}



/**
 * Validate a CPE string
 */
export async function validateCpe(cpeString: string): Promise<ApiResponse<CpeValidateResponse>> {
  return apiFetch<CpeValidateResponse>("/assets/cpe/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cpeString }),
  });
}

/**
 * Get all assets for an environment
 */
export async function getAssets(environmentId: string): Promise<ApiResponse<Asset[]>> {
  return apiFetch<Asset[]>(
    `/assets/${environmentId}`
  );

}

/**
 * Create a new asset in an environment
 */
export async function createAsset(
  environmentId: string,
  data: CreateAssetInput
): Promise<ApiResponse<Asset>> {
  const response = await apiFetch<Asset>(
    `/assets/${environmentId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  return response;
}


export async function deleteAsset(
  assetId: string,
  environmentId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(
    `/assets/${environmentId}/${assetId}/delete`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },

    }

  );

}


export async function getAllRelationships(environmentId: string): Promise<ApiResponse<Relationship[]>> {
  const response = await apiFetch<Relationship[]>(
    `/relationships/${environmentId}`,
    {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    }
  );
  return response;
}

export async function createRelationship(
  environmentId: string,
  fromAssetId: string,
  toAssetId: string,
  type: RelationType,
  criticality: CriticalityLevel
): Promise<ApiResponse<Relationship>> {
  const response = await apiFetch<Relationship>(
    `/relationships/${environmentId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromAssetId, toAssetId, type, criticality }),
    }
  );
  return response;
}


export async function updateRelationship(
  environmentId: string,
  relationshipId: string,
  type?: RelationType,
  criticality?: CriticalityLevel
): Promise<ApiResponse<Relationship>> {
  const response = await apiFetch<Relationship>(
    `/relationships/${environmentId}/${relationshipId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...(type && { type }), ...(criticality && { criticality }) }),
    }
  );
  return response;
}

export async function deleteRelationship(
  environmentId: string,
  relationshipId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(
    `/relationships/${environmentId}/${relationshipId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    }
  );
} 


export async function updateAseetPosition(
  environmentId: string,
  assetId: string,
  x: number,
  y: number
): Promise<ApiResponse<Asset>> {
  const response = await apiFetch<Asset>(
    `/assets/${environmentId}/${assetId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({x, y}),
    }
  );
  console.log("Position update response:", response);
  return response;
}

/**
 * Get vulnerabilities for a specific asset from the latest scan
 */
export async function getAssetVulnerabilities(
  environmentId: string,
  assetId: string
): Promise<ApiResponse<AssetVulnerabilitiesResponse>> {
  return apiFetch<AssetVulnerabilitiesResponse>(
    `/assets/${environmentId}/${assetId}/vulnerabilities`
  );
}

    

