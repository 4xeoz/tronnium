/**
 * Scan API - Network operations for vulnerability scanning
 * Each function returns exactly what the backend sends, unwrapped.
 */

import { apiFetch, ApiResponse, getSseUrl } from "./client";

// ─── Types ───────────────────────────────────────────────────

export type ScanStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type ScanSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";

export type ScanResult = {
  id: string;
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

// POST to start scan — returns scanId immediately
export async function startScan(
  environmentId: string,
  fromDate?: string,
): Promise<ApiResponse<{ scanId: string; alreadyRunning: boolean }>> {
  const params = fromDate ? `?fromDate=${encodeURIComponent(fromDate)}` : "";
  return apiFetch<{ scanId: string; alreadyRunning: boolean }>(
    `/scans/${environmentId}/start${params}`,
    { method: "POST" },
  );
}

  // SSE to watch progress 
export function listenForScanProgress(
  environmentId: string,
  scanId: string,
  onProgress: (message: string) => void,
  onComplete: (data: { scanId: string }) => void,
  onError: (error: string) => void
): EventSource {
  const url = getSseUrl(`/scans/${environmentId}/progress/${scanId}`);
  console.log("[SSE] Connecting to:", url);
  const eventSource = new EventSource(url, { withCredentials: true });

  eventSource.onopen = () => {
    console.log("[SSE] Connection opened, readyState:", eventSource.readyState);
  };

  eventSource.onmessage = (event) => {
    console.log("[SSE] Raw message received:", event.data);
    try {
      const data = JSON.parse(event.data);
      console.log("[SSE] Parsed event:", data);
      if (data.type === "progress") onProgress(data.message);
      else if (data.type === "completed") { onComplete(data.data); eventSource.close(); }
      else if (data.type === "error") { onError(data.message); eventSource.close(); }
      else if (data.type === "done") { onComplete({ scanId }); eventSource.close(); }
      else console.warn("[SSE] Unknown event type:", data.type);
    } catch (e) {
      console.error("[SSE] Failed to parse event:", event.data, e);
      onError("Failed to parse update");
      eventSource.close();
    }
  };

  eventSource.onerror = (e) => {
    console.error("[SSE] Connection error, readyState:", eventSource.readyState, e);
    onError("Connection error. Please try again.");
    eventSource.close();
  };

  return eventSource;
}


// ─── Fetch Functions ─────────────────────────────────────────

export async function fetchLatestScan(environmentId: string): Promise<ApiResponse<LatestScan>> {
  return apiFetch<LatestScan>(`/scans/${environmentId}/latest`);
}

export async function fetchScanHistory(
  environmentId: string,
  limit: number = 10
): Promise<ApiResponse<ScanHistoryItem[]>> {
  return apiFetch<ScanHistoryItem[]>(`/scans/${environmentId}?limit=${limit}`);
}

export async function fetchScanSettings(environmentId: string): Promise<ApiResponse<ScanSettings>> {
  return apiFetch<ScanSettings>(`/scans/${environmentId}/settings`);
}

export async function fetchScanById(
  environmentId: string,
  scanId: string
): Promise<ApiResponse<LatestScan>> {
  return apiFetch<LatestScan>(`/scans/${environmentId}/${scanId}`);
}

export async function deleteScan(environmentId: string, scanId: string): Promise<ApiResponse<void>> {
  return apiFetch<void>(`/scans/${environmentId}/${scanId}`, { method: "DELETE" });
}


