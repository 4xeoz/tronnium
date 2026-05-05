import type { UrgencyLevel } from "../../lib/severity";

export type { UrgencyLevel };

export interface CriticalFinding {
  title: string;
  description: string;
  affectedAssets: string[];
  urgency: UrgencyLevel;
  recommendedAction: string;
}

export interface EnvironmentBriefing {
  overallRisk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  threatSummary: string;
  criticalFindings: CriticalFinding[];
  systemicRisks: string[];
  prioritizedActions: string[];
  industryGuidance: string;
  model: string;
}

export interface AssetScanEntry {
  asset: {
    name: string;
    type: string;
    domain: string;
  };
  vulnerabilities: {
    vulnerability: {
      cveId: string;
      description: string;
      severity: string;
      cvssScore: number | null;
    };
  }[];
}
