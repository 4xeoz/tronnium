/**
 * AI API - AI-powered features for security analysis
 */

import { apiFetch, ApiResponse } from "./client";
import { ScanSeverity } from "./scans";

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

/**
 * Generate AI explanation for a CVE vulnerability
 */
export async function explainCve(
	request: ExplainCveRequest
): Promise<ApiResponse<CveExplanation>> {
	return apiFetch<CveExplanation>("/ai/explain-cve", {
		method: "POST",
		body: JSON.stringify(request),
	});
}
