import type { ScanStatus } from "@prisma/client";

export interface ScanProgress {
  stage: "scanning" | "processing" | "completed" | "error" | "info";
  message: string;
}

export interface ScanResult {
  id:                   string;
  status:               ScanStatus;
  totalAssets:          number;
  scannedAssets:        number;
  vulnerabilitiesFound: number;
  criticalCount:        number;
  highCount:            number;
  mediumCount:          number;
  lowCount:             number;
  riskScore:            number | null;
  epssRiskScore:        number | null; // ADD
}

export interface ScanOptions {
  /**
   * Scan from this date onwards.
   * If not provided, scans all CVEs.
   * If "last-scan", uses the date of the previous completed scan.
   * Max lookback: 5 years
   */
  fromDate?: Date | "last-scan";
}

export interface LatestScanSummary {
  id: string;
  completedAt: Date | null;
  riskScore: number | null;
  activeBreakdown: {
    open: number;
    inProgress: number;
    resolved: number;
  };
}

export interface RecentScanSummary {
  id: string;
  startedAt: Date;
  completedAt: Date | null;
  status: string;
}


