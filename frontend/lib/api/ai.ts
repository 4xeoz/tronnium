/**
 * AI API - AI-powered features for security analysis
 */

import { apiFetch, ApiResponse } from "./client";
import { ScanSeverity } from "./scans";

// ============================================================
// Existing — Generic CVE Explanation
// ============================================================

export type CveExplanation = {
  summary: string;
  impact: string;
  remediationSteps: string[];
  model: string;
};

export type ExplainCveRequest = {
  cveId: string;
  description: string;
  cvssScore: number | null;
  severity: ScanSeverity;
};

export async function explainCve(
  request: ExplainCveRequest
): Promise<ApiResponse<CveExplanation>> {
  return apiFetch<CveExplanation>("/ai/explain-cve", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================================
// Tier 1 — Per-CVE SOC Analysis
// ============================================================

export type SocAnalysisRequest = {
  cveId: string;
  description: string;
  severity: ScanSeverity;
  cvssScore: number | null;
  cvssVector: string | null;
  assetName: string;
  assetType: string;
  cpeName: string;
};

export type SocAnalysis = {
  systemImpact: string;
  attackScenario: string;
  remediationSteps: string[];
  industryGuidance: string;
  urgencyLevel: "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";
  model: string;
};

export async function requestSocAnalysis(
  request: SocAnalysisRequest
): Promise<ApiResponse<SocAnalysis>> {
  return apiFetch<SocAnalysis>("/ai/soc-analysis", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

// ============================================================
// Tier 2 — Full Environment AI Briefing
// ============================================================

export type CriticalFinding = {
  title: string;
  description: string;
  affectedAssets: string[];
  urgency: "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";
  recommendedAction: string;
};

export type EnvironmentBriefing = {
  overallRisk: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  threatSummary: string;
  criticalFindings: CriticalFinding[];
  systemicRisks: string[];
  prioritizedActions: string[];
  industryGuidance: string;
  model: string;
};

export async function requestEnvironmentBriefing(
  environmentId: string
): Promise<ApiResponse<EnvironmentBriefing>> {
  return apiFetch<EnvironmentBriefing>("/ai/environment-briefing", {
    method: "POST",
    body: JSON.stringify({ environmentId }),
  });
}
