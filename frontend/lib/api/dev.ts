/**
 * Dev Mode API - Mock vulnerability generation and management
 */

import { apiFetch, ApiResponse } from "./client";

// Types
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

/**
 * Generate mock vulnerabilities using LLM
 */
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

/**
 * Get all mock vulnerabilities for an environment
 */
export async function getMockVulnerabilities(
  environmentId: string
): Promise<ApiResponse<MockVulnerability[]>> {
  return apiFetch<MockVulnerability[]>(`/dev/mock-vulnerabilities/${environmentId}`);
}

/**
 * Clear all mock vulnerabilities for an environment
 */
export async function clearMockVulnerabilities(
  environmentId: string
): Promise<ApiResponse<ClearMockVulnerabilitiesResponse>> {
  return apiFetch<ClearMockVulnerabilitiesResponse>(
    `/dev/mock-vulnerabilities/${environmentId}`,
    {
      method: "DELETE",
    }
  );
}

/**
 * Get mock vulnerability statistics
 */
export async function getMockVulnerabilityStats(
  environmentId: string
): Promise<ApiResponse<MockVulnerabilityStats>> {
  return apiFetch<MockVulnerabilityStats>(
    `/dev/mock-vulnerabilities/${environmentId}/stats`
  );
}

/**
 * Get severity color class for mock badges
 */
export function getMockSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500 text-white";
    case "HIGH":
      return "bg-orange-500 text-white";
    case "MEDIUM":
      return "bg-yellow-500 text-black";
    case "LOW":
      return "bg-blue-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
}

/**
 * Format CVE ID for display
 */
export function formatCveId(cveId: string): string {
  // If it's a mock CVE, make it clear
  if (cveId.startsWith("CVE-DEV-")) {
    return cveId.replace("CVE-DEV-", "DEV-");
  }
  return cveId;
}
