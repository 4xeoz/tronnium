/**
 * Dev Mode API - Network operations for mock vulnerability generation
 * Each function returns exactly what the backend sends, unwrapped.
 */

import { apiFetch, ApiResponse } from "./client";

// ─── Types ───────────────────────────────────────────────────

export type MockVulnerability = {
  id: string;
  cveId: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  cvssScore: number | null;
  cvssVector: string | null;
  isMock: true;
  mockPrompt: string | null;
  createdAt: string;
  updatedAt: string;
  assetVulnerabilities: {
    assetScan: {
      asset: {
        id: string;
        name: string;
        type: string;
      };
    };
  }[];
};

export type GeneratedVulnerability = {
  cveId: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  cvssScore: number;
  cvssVector: string;
  affectedAssetType: string;
  attackVector?: string;
  impact?: string;
};

export type GenerateVulnerabilitiesResponse = {
  vulnerabilities: GeneratedVulnerability[];
  scanId: string;
  assetScansCreated: number;
};

export type SelectedTarget = {
  assetId: string;
  assetName: string;
  cpeIdentifier?: string;
};

export type MockVulnerabilityStats = {
  total: number;
  bySeverity: {
    severity: string;
    _count: { id: number };
  }[];
};

export type ClearMockVulnerabilitiesResponse = {
  deletedVulnerabilities: number;
  deletedScans: number;
};

export type CreateTestVulnerabilityRequest = {
  environmentId: string;
  assetId: string;
  cveId: string;
  cvssScore?: number;
  cvssVector?: string;
  epssPercentile?: number;
  description?: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
};

export type CreateTestVulnerabilityResponse = {
  vulnerability: {
    id: string;
    cveId: string;
    description: string;
    cvssScore: number | null;
    cvssVector: string | null;
    epssPercentile: number | null;
    severity: string;
    isMock: boolean;
  };
  workflow: {
    id: string;
    status: string;
  };
};

// ─── Fetch Functions ─────────────────────────────────────────

export async function fetchMockVulnerabilities(environmentId: string): Promise<ApiResponse<MockVulnerability[]>> {
  return apiFetch<MockVulnerability[]>(`/dev/mock-vulnerabilities/${environmentId}`);
}

export async function fetchMockVulnerabilityStats(environmentId: string): Promise<ApiResponse<MockVulnerabilityStats>> {
  return apiFetch<MockVulnerabilityStats>(`/dev/mock-vulnerabilities/${environmentId}/stats`);
}

// ─── Mutations ───────────────────────────────────────────────

export async function generateMockVulnerabilities(
  environmentId: string,
  prompt: string,
  count: number = 3,
  targets?: SelectedTarget[]
): Promise<ApiResponse<GenerateVulnerabilitiesResponse>> {
  return apiFetch<GenerateVulnerabilitiesResponse>("/dev/generate-vulnerabilities", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ environmentId, prompt, count, targets }),
  });
}

export async function clearMockVulnerabilities(environmentId: string): Promise<ApiResponse<ClearMockVulnerabilitiesResponse>> {
  return apiFetch<ClearMockVulnerabilitiesResponse>(`/dev/mock-vulnerabilities/${environmentId}`, {
    method: "DELETE",
  });
}

export async function createTestVulnerability(
  payload: CreateTestVulnerabilityRequest
): Promise<ApiResponse<CreateTestVulnerabilityResponse>> {
  return apiFetch<CreateTestVulnerabilityResponse>("/dev/create-test-vulnerability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
