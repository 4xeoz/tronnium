import { geminiClient, defaultModel, callGemini } from "../lib/gemini";

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
  if (!geminiClient) {
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
