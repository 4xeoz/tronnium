import type { UrgencyLevel } from "../../lib/severity";

export type { UrgencyLevel };

export interface SocAnalysis {
  systemImpact: string;
  attackScenario: string;
  remediationSteps: string[];
  industryGuidance: string;
  urgencyLevel: UrgencyLevel;
  model: string;
}

export interface SocAnalysisInput {
  cveId: string;
  description: string;
  severity: string;
  cvssScore: number | null;
  cvssVector: string | null;
  assetName: string;
  assetType: string;
  cpeName: string;
}
