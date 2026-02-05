/**
 * Asset API - CRUD operations for assets and CPE discovery
 */

import { apiFetch } from "./client";

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
 */
export async function findCpe(assetName: string, topN: number = 5): Promise<CpeFindResponse> {
  return apiFetch<CpeFindResponse>("/assets/cpe/find", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetName, topN }),
  });
}

/**
 * Validate a CPE string
 */
export async function validateCpe(cpeString: string): Promise<CpeValidateResponse> {
  return apiFetch<CpeValidateResponse>("/assets/cpe/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cpeString }),
  });
}

/**
 * Get all assets for an environment
 */
export async function getAssets(environmentId: string): Promise<Asset[]> {
  const response = await apiFetch<{ success: boolean; assets: Asset[] }>(
    `/assets/${environmentId}`
  );
  return response.assets;
}

/**
 * Create a new asset in an environment
 */
export async function createAsset(
  environmentId: string,
  data: CreateAssetInput
): Promise<Asset> {
  const response = await apiFetch<{ success: boolean; asset: Asset }>(
    `/assets/${environmentId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }
  );
  return response.asset;
}
