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
	summary: "AI explanation is currently unavailable. Please check the official NVD database for details about this CVE.",
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
			remediationSteps: parsed.remediationSteps || fallbackExplanation.remediationSteps,
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
	options: ExplainCveOptions = {}
): Promise<CveExplanation> {
	if (!client) {
		console.warn("GEMINI_API_KEY is missing. Using fallback explanation.");
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
