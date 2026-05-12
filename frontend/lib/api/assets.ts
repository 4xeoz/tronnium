/**
 * Asset API - Network operations for assets, CPE discovery, and relationships
 * Each function returns exactly what the backend sends, unwrapped.
 */

import { apiFetch, ApiResponse, getSseUrl } from "./client";

// ─── Types ───────────────────────────────────────────────────

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
  cpes: CpeCandidate[];
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

export type CpeSemanticSearchResponse = {

    rawAssetName: string;
    results: {
      cpeName: string;
      title: string;
      similarity: number;
    }[];
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
  cpes?: CpeCandidate[];
  domain?: "IT" | "OT" | "UNKNOWN";
};

// ─── Asset Fetch Functions ───────────────────────────────────

export async function fetchAssets(environmentId: string): Promise<ApiResponse<Asset[]>> {
  return apiFetch<Asset[]>(`/assets/${environmentId}`);
}

export async function fetchAssetVulnerabilities(
  environmentId: string,
  assetId: string
): Promise<ApiResponse<AssetVulnerabilitiesResponse>> {
  return apiFetch<AssetVulnerabilitiesResponse>(
    `/assets/${environmentId}/${assetId}/vulnerabilities`
  );
}

// ─── Asset Mutations ─────────────────────────────────────────

export async function createAsset(
  environmentId: string,
  data: CreateAssetInput
): Promise<ApiResponse<Asset>> {
  return apiFetch<Asset>(`/assets/${environmentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export async function deleteAsset(assetId: string, environmentId: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return apiFetch<{ success: boolean; message: string }>(
    `/assets/${environmentId}/${assetId}/delete`,
    { method: "POST" }
  );
}

export async function updateAssetPosition(
  environmentId: string,
  assetId: string,
  x: number,
  y: number
): Promise<ApiResponse<Asset>> {
  return apiFetch<Asset>(`/assets/${environmentId}/${assetId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ x, y }),
  });
}

// ─── CPE Operations ──────────────────────────────────────────

/**
 * Find CPE candidates from an asset name (REST fallback)
 * @deprecated Use listenForCpeFindProgress for real-time SSE updates
 */
export async function fetchCpeCandidates(
  assetName: string,
  topN: number = 5
): Promise<ApiResponse<CpeFindResponse>> {
  const params = new URLSearchParams({ assetName, topN: topN.toString() });
  return apiFetch<CpeFindResponse>(`/assets/cpe/find?${params.toString()}`);
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
  const url = getSseUrl(`/assets/cpe/find?assetName=${encodeURIComponent(assetName)}&topN=${topN}`);
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === "progress") {
        onUpdate({ step: data.step || "Progress", message: data.message });
      } else if (data.type === "completed") {
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

export function fetchCpeSemanticSearchProgress(assetName: string, topN: number = 5) : Promise<ApiResponse<CpeSemanticSearchResponse>> {
  return apiFetch<CpeSemanticSearchResponse>("/assets/cpe/semantic-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: assetName, limit: topN })
  });
}


export async function validateCpeString(cpeString: string): Promise<ApiResponse<CpeValidateResponse>> {
  return apiFetch<CpeValidateResponse>("/assets/cpe/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cpeString }),
  });
}

// ─── Relationship Operations ─────────────────────────────────

export async function fetchRelationships(environmentId: string): Promise<ApiResponse<Relationship[]>> {
  return apiFetch<Relationship[]>(`/relationships/${environmentId}`);
}

export async function createRelationship(
  environmentId: string,
  fromAssetId: string,
  toAssetId: string,
  type: RelationType,
  criticality: CriticalityLevel
): Promise<ApiResponse<Relationship>> {
  return apiFetch<Relationship>(`/relationships/${environmentId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromAssetId, toAssetId, type, criticality }),
  });
}

export async function updateRelationship(
  environmentId: string,
  relationshipId: string,
  type?: RelationType,
  criticality?: CriticalityLevel
): Promise<ApiResponse<Relationship>> {
  return apiFetch<Relationship>(`/relationships/${environmentId}/${relationshipId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...(type && { type }), ...(criticality && { criticality }) }),
  });
}

export async function deleteRelationship(
  environmentId: string,
  relationshipId: string
): Promise<ApiResponse<{ success: boolean; message: string }>> {
  return apiFetch<{ success: boolean; message: string }>(
    `/relationships/${environmentId}/${relationshipId}`,
    { method: "DELETE" }
  );
}
