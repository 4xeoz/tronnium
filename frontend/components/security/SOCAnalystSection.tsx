"use client";

import { useState, useCallback } from "react";
import { FiShield, FiAlertCircle } from "react-icons/fi";
import { requestSocAnalysis, type SocAnalysis, type ScanSeverity } from "@/lib/api";
import { UrgencyBadge } from "./UrgencyBadge";

interface SocAnalystVuln {
  cveId: string;
  description: string;
  severity: ScanSeverity;
  cvssScore: number | null;
  cvssVector: string | null;
  assetName: string;
  cpeName: string;
}

export function SOCAnalystSection({
  vuln,
  assetType,
}: {
  vuln: SocAnalystVuln;
  assetType: string;
}) {
  const [analysis, setAnalysis] = useState<SocAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await requestSocAnalysis({
        cveId: vuln.cveId,
        description: vuln.description,
        severity: vuln.severity,
        cvssScore: vuln.cvssScore,
        cvssVector: vuln.cvssVector,
        assetName: vuln.assetName,
        assetType,
        cpeName: vuln.cpeName,
      });
      if (res.success && res.data) {
        setAnalysis(res.data);
      } else {
        setError(res.message || "Failed to generate analysis");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [vuln, assetType]);

  if (!analysis && !isLoading && !error) {
    return (
      <button
        onClick={runAnalysis}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all"
      >
        <FiShield className="w-3.5 h-3.5" />
        Run SOC Analysis
      </button>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-sm">
        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        Analyzing system context...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-error-text text-sm">
        <FiAlertCircle className="w-4 h-4 shrink-0" />
        <span>{error}</span>
        <button onClick={runAnalysis} className="underline ml-1 shrink-0">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <UrgencyBadge level={analysis!.urgencyLevel} />
        {analysis!.model !== "stub" && (
          <span className="text-xs text-text-muted">Powered by {analysis!.model}</span>
        )}
      </div>

      <div>
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">System Impact</h4>
        <p className="text-sm text-text-secondary leading-relaxed">{analysis!.systemImpact}</p>
      </div>

      <div>
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Attack Scenario</h4>
        <p className="text-sm text-text-secondary leading-relaxed">{analysis!.attackScenario}</p>
      </div>

      <div>
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Remediation Steps</h4>
        <ol className="space-y-1.5">
          {analysis!.remediationSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      <div>
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Industry Guidance</h4>
        <p className="text-sm text-text-secondary leading-relaxed">{analysis!.industryGuidance}</p>
      </div>
    </div>
  );
}
