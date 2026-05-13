/**
 * AI API - AI-powered security analysis
 * Each function returns exactly what the backend sends, unwrapped.
 */

import { apiFetch, ApiResponse } from "./client";
import type { ScanSeverity } from "./scans";

// ─── Types ───────────────────────────────────────────────────

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

export type SocAnalysis = {
  systemImpact: string;
  attackScenario: string;
  remediationSteps: string[];
  industryGuidance: string;
  urgencyLevel: "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";
  model: string;
};

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

// ─── Fetch Functions ─────────────────────────────────────────

export async function fetchCveExplanation(request: ExplainCveRequest): Promise<ApiResponse<CveExplanation>> {
  return apiFetch<CveExplanation>("/ai/explain-cve", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function fetchSocAnalysis(request: SocAnalysisRequest): Promise<ApiResponse<SocAnalysis>> {
  return apiFetch<SocAnalysis>("/ai/soc-analysis", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export async function fetchEnvironmentBriefing(environmentId: string): Promise<ApiResponse<EnvironmentBriefing>> {
  return apiFetch<EnvironmentBriefing>("/ai/environment-briefing", {
    method: "POST",
    body: JSON.stringify({ environmentId }),
  });
}

export type ChatMessage = { role: "user" | "assistant"; content: string };

export async function fetchChatReply(
  environmentId: string,
  messages: ChatMessage[]
): Promise<ApiResponse<{ reply: string; model: string }>> {
  return apiFetch<{ reply: string; model: string }>("/ai/chat", {
    method: "POST",
    body: JSON.stringify({ environmentId, messages }),
  });
}
