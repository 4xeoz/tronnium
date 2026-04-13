import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================
// Gemini client setup (shared across all functions)
// ============================================================

const apiKey = process.env.GEMINI_API_KEY;
const defaultModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// ============================================================
// Shared helper — call Gemini and get text back
// ============================================================

async function callGemini(prompt: string): Promise<string> {
	const model = client!.getGenerativeModel({ model: defaultModel });
	const result = await model.generateContent({
		contents: [{ role: "user", parts: [{ text: prompt }] }],
		generationConfig: {
			temperature: 0.3,
			responseMimeType: "application/json",
		},
	});
	const content = result.response.text();
	if (!content) throw new Error("Gemini returned an empty response");
	return content;
}

// ============================================================
// EXISTING — Generic CVE Explanation
// ============================================================

export type CveExplanation = {
	summary: string;
	impact: string;
	remediationSteps: string[];
	model: string;
};

const fallbackExplanation: CveExplanation = {
	summary: "AI explanation is currently unavailable. Please check the official NVD database for details about this CVE.",
	impact: "Unable to analyze impact at this time.",
	remediationSteps: [
		"Visit the National Vulnerability Database (NVD) for official details",
		"Contact your security team for guidance",
		"Check vendor security advisories for patches",
	],
	model: "stub",
};

/**
 * Generate a generic AI explanation for a CVE.
 * No asset context — use analyzeSocContext for system-specific analysis.
 */
export async function explainCve(
	cveId: string,
	cveDescription: string,
	cvssScore: number | null,
	severity: string
): Promise<CveExplanation> {
	if (!client) {
		console.warn("[AI] GEMINI_API_KEY missing. Using fallback CVE explanation.");
		return fallbackExplanation;
	}

	const prompt = `You are a cybersecurity expert. Explain this CVE vulnerability in clear, actionable terms for a security analyst.

CVE ID: ${cveId}
Severity: ${severity}${cvssScore ? `\nCVSS Score: ${cvssScore}` : ""}
Original Description: ${cveDescription}

Return as JSON:
{
  "summary": "A 1-2 sentence plain English summary of what this vulnerability is",
  "impact": "A brief explanation of what an attacker could do and the business impact",
  "remediationSteps": ["Step 1", "Step 2", "Step 3"]
}`;

	const content = await callGemini(prompt);
	const parsed = JSON.parse(content);

	return {
		summary: parsed.summary || fallbackExplanation.summary,
		impact: parsed.impact || fallbackExplanation.impact,
		remediationSteps: parsed.remediationSteps || fallbackExplanation.remediationSteps,
		model: defaultModel,
	};
}

// ============================================================
// TIER 1 — Per-CVE SOC Analysis (system-context-aware)
// ============================================================

export type SocAnalysis = {
	systemImpact: string;
	attackScenario: string;
	remediationSteps: string[];
	industryGuidance: string;
	urgencyLevel: "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";
	model: string;
};

export type SocAnalysisInput = {
	cveId: string;
	description: string;
	severity: string;
	cvssScore: number | null;
	cvssVector: string | null;
	assetName: string;
	assetType: string;
	cpeName: string;
};

const VALID_URGENCY = ["IMMEDIATE", "HIGH", "MEDIUM", "LOW"] as const;

const fallbackSocAnalysis: Omit<SocAnalysis, "model"> = {
	systemImpact: "AI analysis unavailable. Check NVD for this CVE.",
	attackScenario: "Unable to generate attack scenario at this time.",
	remediationSteps: [
		"Apply the latest vendor security patch",
		"Check NVD for official remediation guidance",
		"Consult your security team",
	],
	industryGuidance: "Refer to NIST NVD, CIS Controls v8, and vendor advisories.",
	urgencyLevel: "HIGH",
};

/**
 * Generate a context-aware SOC analysis for one CVE on one specific asset.
 * Takes the asset type and CPE into account to tailor the output.
 */
export async function analyzeSocContext(input: SocAnalysisInput): Promise<SocAnalysis> {
	if (!client) {
		console.warn("[AI] GEMINI_API_KEY missing. Using fallback SOC analysis.");
		return { ...fallbackSocAnalysis, model: "stub" };
	}

	const prompt = `You are an expert SOC analyst. A vulnerability has been detected on a specific asset in the organization's infrastructure.

VULNERABILITY:
CVE: ${input.cveId}
Severity: ${input.severity}
CVSS Score: ${input.cvssScore ?? "N/A"}
CVSS Vector: ${input.cvssVector ?? "N/A"}
Description: ${input.description}

AFFECTED SYSTEM:
Asset Name: ${input.assetName}
Asset Type: ${input.assetType}
CPE: ${input.cpeName}

Provide a context-aware security analysis tailored to this specific system type. Return as JSON:
{
  "systemImpact": "1-2 sentences on how this vulnerability specifically threatens this asset type and what damage it could cause",
  "attackScenario": "Realistic step-by-step exploitation path for this specific system type",
  "remediationSteps": ["Prioritized step 1 for this asset type", "Step 2", "Step 3"],
  "industryGuidance": "Relevant standards: use NIST SP 800-82 or ICS-CERT for OT/ICS assets, NIST CSF or CIS Controls v8 for IT assets",
  "urgencyLevel": "IMMEDIATE or HIGH or MEDIUM or LOW — based on CVSS score and asset type criticality"
}`;

	const content = await callGemini(prompt);
	const parsed = JSON.parse(content);

	const urgencyLevel = VALID_URGENCY.includes(parsed.urgencyLevel)
		? parsed.urgencyLevel
		: "HIGH";

	return {
		systemImpact: parsed.systemImpact || fallbackSocAnalysis.systemImpact,
		attackScenario: parsed.attackScenario || fallbackSocAnalysis.attackScenario,
		remediationSteps: parsed.remediationSteps || fallbackSocAnalysis.remediationSteps,
		industryGuidance: parsed.industryGuidance || fallbackSocAnalysis.industryGuidance,
		urgencyLevel,
		model: defaultModel,
	};
}

// ============================================================
// TIER 2 — Full Environment AI Briefing
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

// The shape of each asset scan entry passed in from the controller
export type AssetScanEntry = {
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
};

const SEVERITY_RANK: Record<string, number> = {
	CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4,
};

const VALID_RISK_LEVELS = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

const fallbackBriefing: Omit<EnvironmentBriefing, "model"> = {
	overallRisk: "HIGH",
	threatSummary: "AI briefing unavailable. Review the vulnerability list manually.",
	criticalFindings: [],
	systemicRisks: [],
	prioritizedActions: [
		"Address all CRITICAL vulnerabilities first",
		"Review HIGH vulnerabilities and assign owners",
		"Run a full security scan to update findings",
	],
	industryGuidance: "Refer to NIST CSF, CIS Controls v8, and ICS-CERT advisories.",
};

/**
 * Build a compact vulnerability matrix text to fit in the Gemini prompt.
 * Shows full descriptions only for CRITICAL/HIGH to avoid token explosion.
 * Highlights CVEs that appear on multiple assets (systemic risks).
 */
function buildVulnerabilityMatrix(assetScans: AssetScanEntry[]): string {
	// Count totals by severity across all assets
	const totals: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };

	// Track which assets each CVE appears on (to find systemic risks)
	const cveToAssets = new Map<string, string[]>();

	for (const scan of assetScans) {
		for (const av of scan.vulnerabilities) {
			const { cveId, severity } = av.vulnerability;
			if (severity in totals) totals[severity]++;

			const existing = cveToAssets.get(cveId) ?? [];
			existing.push(scan.asset.name);
			cveToAssets.set(cveId, existing);
		}
	}

	// CVEs that appear on 2 or more assets are systemic
	const systemicCves = [...cveToAssets.entries()]
		.filter(([, assets]) => assets.length >= 2)
		.map(([cveId, assets]) => `${cveId} (on: ${assets.join(", ")})`);

	// Count asset domains
	const domains: Record<string, number> = { IT: 0, OT: 0, UNKNOWN: 0 };
	for (const scan of assetScans) {
		const d = scan.asset.domain in domains ? scan.asset.domain : "UNKNOWN";
		domains[d]++;
	}

	const lines: string[] = [];

	lines.push("ENVIRONMENT VULNERABILITY MATRIX");
	lines.push(
		`${assetScans.length} assets (${domains.IT} IT, ${domains.OT} OT) | ` +
		`CRITICAL:${totals.CRITICAL} HIGH:${totals.HIGH} MEDIUM:${totals.MEDIUM} LOW:${totals.LOW}`
	);
	lines.push("");

	if (systemicCves.length > 0) {
		lines.push("SYSTEMIC RISKS (same CVE on multiple assets):");
		for (const entry of systemicCves) {
			lines.push(`  - ${entry}`);
		}
		lines.push("");
	}

	for (const scan of assetScans) {
		const { name, type, domain } = scan.asset;
		lines.push(`ASSET: ${name} [${type}, ${domain}]`);

		// Sort vulnerabilities by severity (most severe first)
		const sorted = [...scan.vulnerabilities].sort(
			(a, b) =>
				(SEVERITY_RANK[a.vulnerability.severity] ?? 4) -
				(SEVERITY_RANK[b.vulnerability.severity] ?? 4)
		);

		const criticalAndHigh = sorted.filter(
			(av) => av.vulnerability.severity === "CRITICAL" || av.vulnerability.severity === "HIGH"
		);
		const mediumAndLowCount = sorted.filter(
			(av) => av.vulnerability.severity === "MEDIUM" || av.vulnerability.severity === "LOW"
		).length;

		for (const av of criticalAndHigh) {
			const { cveId, severity, cvssScore, description } = av.vulnerability;
			const score = cvssScore ? ` (${cvssScore})` : "";
			// Show more description for CRITICAL, less for HIGH
			const maxLength = severity === "CRITICAL" ? 150 : 80;
			const truncated = description.length > maxLength
				? description.slice(0, maxLength) + "..."
				: description;
			lines.push(`  ${severity}${score} ${cveId}: ${truncated}`);
		}

		if (mediumAndLowCount > 0) {
			lines.push(`  + ${mediumAndLowCount} more (MEDIUM/LOW)`);
		}

		lines.push("");
	}

	return lines.join("\n");
}

/**
 * Generate a holistic AI security briefing for an entire environment.
 * Looks at all assets and their CVEs together to identify cross-asset patterns
 * and produce a prioritized action plan for the security team.
 */
export async function analyzeEnvironment(assetScans: AssetScanEntry[]): Promise<EnvironmentBriefing> {
	if (!client) {
		console.warn("[AI] GEMINI_API_KEY missing. Using fallback environment briefing.");
		return { ...fallbackBriefing, model: "stub" };
	}

	if (assetScans.length === 0) {
		return {
			overallRisk: "LOW",
			threatSummary: "No vulnerabilities detected in the latest scan. Environment appears clean.",
			criticalFindings: [],
			systemicRisks: [],
			prioritizedActions: ["Maintain regular scanning schedule to detect new CVEs early"],
			industryGuidance: "Continue following NIST CSF and CIS Controls v8.",
			model: defaultModel,
		};
	}

	const matrix = buildVulnerabilityMatrix(assetScans);

	const prompt = `You are a senior SOC analyst presenting a threat briefing to the security team.

Here is the current vulnerability landscape of the environment:

${matrix}

Analyze this data and provide a holistic security briefing. Focus on cross-asset patterns, the highest-priority risks, and what the team should do first given limited remediation time.

Return as JSON:
{
  "overallRisk": "CRITICAL or HIGH or MEDIUM or LOW",
  "threatSummary": "2-3 sentence executive overview of the environment's current security posture",
  "criticalFindings": [
    {
      "title": "Short title for this finding",
      "description": "What this finding means and why it matters",
      "affectedAssets": ["asset-name-1", "asset-name-2"],
      "urgency": "IMMEDIATE or HIGH or MEDIUM or LOW",
      "recommendedAction": "The specific action to take for this finding"
    }
  ],
  "systemicRisks": [
    "Description of a risk pattern or shared vulnerability affecting multiple assets"
  ],
  "prioritizedActions": [
    "1. First action the team should take (most critical)",
    "2. Second action",
    "3. Third action"
  ],
  "industryGuidance": "Mix in NIST CSF and CIS Controls v8 for IT assets, and ICS-CERT advisories or NIST SP 800-82 for any OT/ICS assets present"
}

Limit criticalFindings to the top 5 most important items. Order prioritizedActions from highest to lowest urgency.`;

	const content = await callGemini(prompt);
	const parsed = JSON.parse(content);

	return {
		overallRisk: VALID_RISK_LEVELS.includes(parsed.overallRisk) ? parsed.overallRisk : "HIGH",
		threatSummary: parsed.threatSummary || fallbackBriefing.threatSummary,
		criticalFindings: Array.isArray(parsed.criticalFindings) ? parsed.criticalFindings.slice(0, 5) : [],
		systemicRisks: Array.isArray(parsed.systemicRisks) ? parsed.systemicRisks : [],
		prioritizedActions: Array.isArray(parsed.prioritizedActions) ? parsed.prioritizedActions : fallbackBriefing.prioritizedActions,
		industryGuidance: parsed.industryGuidance || fallbackBriefing.industryGuidance,
		model: defaultModel,
	};
}
