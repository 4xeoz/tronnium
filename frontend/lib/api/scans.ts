/**
 * Scan API - Vulnerability scanning operations with SSE progress tracking
 */

import { apiFetch, ApiResponse } from "./client";

// Types
export type ScanStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type ScanSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type ScanResult = {
  scanId: string;
  status: ScanStatus;
  totalAssets: number;
  scannedAssets: number;
  vulnerabilitiesFound: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  riskScore: number | null;
};

export type ScanProgress = {
  type: "progress" | "completed" | "error";
  step?: string;
  message: string;
  data?: ScanResult;
  timestamp?: string;
};

export type Vulnerability = {
  id: string;
  cveId: string;
  description: string;
  cvssScore: number | null;
  cvssVector: string | null;
  severity: ScanSeverity;
  publishedDate: string | null;
  lastModifiedDate: string | null;
  isMock?: boolean;
  mockPrompt?: string | null;
};

export type AssetVulnerability = {
  vulnerability: Vulnerability;
  cpeName: string;
};

export type AssetScan = {
  id: string;
  scannedAt: string;
  asset: {
    id: string;
    name: string;
    type: string;
    domain: string;
  };
  vulnerabilities: AssetVulnerability[];
};

export type LatestScan = {
  id: string;
  environmentId: string;
  status: ScanStatus;
  startedAt: string;
  completedAt: string | null;
  totalAssets: number;
  scannedAssets: number;
  vulnerabilitiesFound: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  riskScore: number | null;
  assetScans: AssetScan[];
  createdAt: string;
  updatedAt: string;
};

export type ScanHistoryItem = {
  id: string;
  status: ScanStatus;
  startedAt: string;
  completedAt: string | null;
  totalAssets: number;
  scannedAssets: number;
  vulnerabilitiesFound: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  riskScore: number | null;
};

export type ScanSettings = {
  lastScanDate: string | null;
  maxLookbackDate: string;
  defaultFromDate: string;
  hasPreviousScan: boolean;
};

export type ScanFromDateOption = "all" | "last-scan" | "custom";

/**
 * Start a vulnerability scan with SSE progress updates
 * Uses POST to /scans/:environmentId with EventSource
 * 
 * @param environmentId - The environment to scan
 * @param fromDate - Optional: "last-scan" or ISO date string to scan from
 * @param onProgress - Callback for progress messages
 * @param onComplete - Callback when scan completes
 * @param onError - Callback on error
 */
export function startScan(
  environmentId: string,
  fromDate?: string,
  onProgress?: (message: string) => void,
  onComplete?: (result: ScanResult) => void,
  onError?: (error: string) => void
): EventSource {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  
  // Build URL with optional fromDate parameter
  const url = new URL(`${baseUrl}/scans/${environmentId}/start`);
  if (fromDate) {
    url.searchParams.set("fromDate", fromDate);
  }
  
  // Use /start endpoint for SSE (EventSource only supports GET)
  const eventSource = new EventSource(url.toString(), { withCredentials: true });

  eventSource.onmessage = (event) => {
    try {
      const data: ScanProgress = JSON.parse(event.data);

      if (data.type === "progress") {
        onProgress?.(data.message);
      } else if (data.type === "completed") {
        if (data.data) {
          onComplete?.(data.data);
        }
        eventSource.close();
      } else if (data.type === "error") {
        onError?.(data.message || "Scan failed");
        eventSource.close();
      }
    } catch (parseError) {
      console.error("Failed to parse SSE message:", parseError);
      onError?.("Failed to parse scan update");
      eventSource.close();
    }
  };

  eventSource.onerror = () => {
    onError?.("Connection error. Please try again.");
    eventSource.close();
  };

  return eventSource;
}

/**
 * Get the latest completed scan with full vulnerability details
 */
export async function getLatestScan(environmentId: string): Promise<ApiResponse<LatestScan>> {
  return apiFetch<LatestScan>(`/scans/${environmentId}/latest`);
}

/**
 * Get scan history for an environment
 * @param environmentId - Environment ID
 * @param limit - Number of scans to return (default: 10, max: 100)
 */
export async function getScanHistory(
  environmentId: string, 
  limit: number = 10
): Promise<ApiResponse<ScanHistoryItem[]>> {
  return apiFetch<ScanHistoryItem[]>(`/scans/${environmentId}?limit=${limit}`);
}

/**
 * Get scan settings for an environment
 * Returns last scan date, max lookback date, and other settings
 */
export async function getScanSettings(
  environmentId: string
): Promise<ApiResponse<ScanSettings>> {
  return apiFetch<ScanSettings>(`/scans/${environmentId}/settings`);
}

/**
 * Get a single scan by ID with full details
 * Includes all asset scans and vulnerabilities
 */
export async function getScanById(
  environmentId: string,
  scanId: string
): Promise<ApiResponse<LatestScan>> {
  return apiFetch<LatestScan>(`/scans/${environmentId}/${scanId}`);
}

/**
 * Calculate risk level from score
 */
export function getRiskLevel(score: number | null | undefined): {
  label: string;
  color: string;
} {
  if (score === null || score === undefined) {
    return { label: "Unknown", color: "text-text-muted" };
  }
  if (score < 20) return { label: "Low", color: "text-success-text" };
  if (score < 40) return { label: "Moderate", color: "text-warning-text" };
  if (score < 60) return { label: "High", color: "text-orange-500" };
  return { label: "Critical", color: "text-error-text" };
}

/**
 * Format severity badge color
 */
export function getSeverityColor(severity: ScanSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "HIGH":
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    case "MEDIUM":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "LOW":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    default:
      return "bg-surface-secondary text-text-muted border-border";
  }
}
