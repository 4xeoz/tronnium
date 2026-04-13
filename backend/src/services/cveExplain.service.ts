import { GoogleGenerativeAI } from "@google/generative-ai";

export type CveExplanation = {
	summary: string;
	impact: string;
	remediationSteps: string[];
	model: string;
};

type ExplainCveOptions = {
	model?: string;
	temperature?: number;
};

const apiKey = process.env.GEMINI_API_KEY;
const defaultModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const client = apiKey ? new GoogleGenerativeAI(apiKey) : null;

const fallbackExplanation: CveExplanation = {
	summary:
		"AI explanation is currently unavailable. Please check the official NVD database for details about this CVE.",
	impact: "Unable to analyze impact at this time.",
	remediationSteps: [
		"Visit the National Vulnerability Database (NVD) for official details",
		"Contact your security team for guidance",
		"Check vendor security advisories for patches",
	],
	model: "stub",
};

function parseExplanation(content: string, model: string): CveExplanation {
	try {
		const parsed = JSON.parse(content);
		return {
			summary: parsed.summary || fallbackExplanation.summary,
			impact: parsed.impact || fallbackExplanation.impact,
			remediationSteps:
				parsed.remediationSteps || fallbackExplanation.remediationSteps,
			model,
		};
	} catch (error) {
		throw new Error(`Failed to parse explanation JSON: ${String(error)}`);
	}
}

/**
 * Generate an AI explanation for a CVE vulnerability
 */
export async function explainCve(
	cveId: string,
	cveDescription: string,
	cvssScore: number | null,
	severity: string,
	options: ExplainCveOptions = {},
): Promise<CveExplanation> {
	if (!client) {
		console.warn("API_KEY is missing. Using fallback explanation.");
		return fallbackExplanation;
	}

	const modelName = options.model || defaultModel;
	const temperature = options.temperature ?? 0.3;

	const prompt = `You are a cybersecurity expert. Explain this CVE vulnerability in clear, actionable terms for a security analyst.

CVE ID: ${cveId}
Severity: ${severity}${cvssScore ? `\nCVSS Score: ${cvssScore}` : ""}
Original Description: ${cveDescription}

Provide your response as JSON with this structure:
{
  "summary": "A 1-2 sentence plain English summary of what this vulnerability is",
  "impact": "A brief explanation of what an attacker could do and the business impact",
  "remediationSteps": ["Step 1", "Step 2", "Step 3"] // 2-4 actionable remediation steps
}

Guidelines:
- Summary should be concise and technical but understandable
- Impact should focus on realistic attack scenarios and business consequences
- Remediation steps should be specific, ordered by priority, and actionable
- Do not include any markdown formatting or code blocks in the JSON`;

	const model = client.getGenerativeModel({ model: modelName });

	const result = await model.generateContent({
		contents: [
			{
				role: "user",
				parts: [{ text: prompt }],
			},
		],
		generationConfig: {
			temperature,
			responseMimeType: "application/json",
		},
	});

	const content = result.response.text();
	if (!content) {
		throw new Error("Gemini returned an empty response");
	}

	return parseExplanation(content, modelName);
}



export type SocAnalysis = {
  systemImpact: string;       // How this vuln threatens this specific asset type
  attackScenario: string;     // Step-by-step exploitation path for this system
  remediationSteps: string[]; // 2–5 steps prioritized for this asset type
  industryGuidance: string;   // NIST / ICS-CERT / CIS / vendor patch guidance
  urgencyLevel: "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";
  model: string;
};

type AnalyzeSocContextInput = {
    cveId: string;
    description: string;
    cvssScore: number | null;
    severity: string;
    cvssVector: string | null;
    assetName: string;
    assetType: string;
    cpeName: string;
};






const fallbackSocAnalysis: Omit<SocAnalysis, "model"> = {
  systemImpact: "AI analysis unavailable. Check the NVD entry for this CVE.",
  attackScenario: "Unable to generate attack scenario at this time.",
  remediationSteps: [
    "Apply the latest vendor security patch",
    "Check NVD for official remediation guidance",
    "Consult your security team",
  ],
  industryGuidance: "Refer to NIST NVD, CIS Controls, and vendor advisories.",
  urgencyLevel: "HIGH",
};

function parseSocAnalysis(content: string, model: string): SocAnalysis {
  try {
	const parsed = JSON.parse(content);
	return {
	  systemImpact: parsed.systemImpact || fallbackSocAnalysis.systemImpact,
	  attackScenario: parsed.attackScenario || fallbackSocAnalysis.attackScenario,
	  remediationSteps: parsed.remediationSteps || fallbackSocAnalysis.remediationSteps,
	  industryGuidance: parsed.industryGuidance || fallbackSocAnalysis.industryGuidance,
	  urgencyLevel: parsed.urgencyLevel || fallbackSocAnalysis.urgencyLevel,
	  model,
	};
  } catch (error) {
	throw new Error(`Failed to parse SOC analysis JSON: ${String(error)}`);
  }
}







export async function analyzeSocContext({
	cveId,
	description,
	cvssScore,
	severity,
	cvssVector,
	assetName,
	assetType,
	cpeName,
}: AnalyzeSocContextInput): Promise<SocAnalysis> {
	
	if (!client) {
		console.warn("API_KEY is missing. Unable to perform SOC analysis.");
		throw new Error("AI analysis is unavailable");
	}

	const prompt = `You are an expert SOC analyst. A vulnerability has been detected on a specific asset.

VULNERABILITY:
CVE: ${cveId}
Severity: ${severity}
CVSS Score: ${cvssScore}
CVSS Vector: ${cvssVector}
Description: ${description}

AFFECTED SYSTEM:
Asset Name: {assetName}
Asset Type: {assetType}  (e.g. server, workstation, iot, plc, firewall)
CPE: {cpeName}

Provide a context-aware security analysis tailored to this specific system type.
Return as JSON:
{
  "systemImpact": "1-2 sentences: how this vulnerability specifically threatens this asset type",
  "attackScenario": "Step-by-step realistic exploitation path for this specific system",
  "remediationSteps": ["Prioritized step 1 for this asset type", "step 2", "step 3"],
  "industryGuidance": "Relevant standards: NIST SP 800-82 for OT/ICS assets, NIST CSF for IT, CIS Controls v8, ICS-CERT advisories, or vendor patch bulletins",
  "urgencyLevel": "IMMEDIATE or HIGH or MEDIUM or LOW — based on CVSS score AND asset type criticality"
}`

	const model = client.getGenerativeModel({ model: defaultModel });
	
	const result = await model.generateContent({
		contents: [
			{
				role: "user",
				parts: [{ text: prompt }],
			},
		],
		generationConfig: {
			temperature: 0.3,
			responseMimeType: "application/json",
		},
	});

	const content = result.response.text();
	if (!content) {
		throw new Error("Gemini returned an empty response");
	}

	return parseSocAnalysis(content, defaultModel);


}
