import { geminiClient, defaultModel, callGemini } from "../../lib/gemini";
import type {
  CriticalFinding,
  EnvironmentBriefing,
  AssetScanEntry,
} from "./briefing.types";
import { SEVERITY_RANK, countSeverities } from "../../lib/severity";

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

export function buildVulnerabilityMatrix(assetScans: AssetScanEntry[]): string {
  const totals: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
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

  const systemicCves = [...cveToAssets.entries()]
    .filter(([, assets]) => assets.length >= 2)
    .map(([cveId, assets]) => `${cveId} (on: ${assets.join(", ")})`);

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

export async function analyzeEnvironment(assetScans: AssetScanEntry[]): Promise<EnvironmentBriefing> {
  if (!geminiClient) {
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
