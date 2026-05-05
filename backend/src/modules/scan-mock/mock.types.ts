import type { VulnSeverity } from "@prisma/client";

export interface GeneratedVulnerability {
  cveId: string;
  description: string;
  severity: VulnSeverity;
  cvssScore: number;
  cvssVector: string;
  affectedAssetType: string;
  attackVector?: string;
  impact?: string;
}

export interface MockVulnGenerationResult {
  vulnerabilities: GeneratedVulnerability[];
  scanId: string;
  assetScansCreated: number;
}

export interface SelectedTarget {
  assetId: string;
  assetName: string;
  cpeIdentifier?: string;
}
