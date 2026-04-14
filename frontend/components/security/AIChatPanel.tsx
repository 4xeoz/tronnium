"use client";

import { useState, useEffect, useCallback } from "react";
import { FiAlertTriangle, FiCopy, FiCheck } from "react-icons/fi";
import {
  requestEnvironmentBriefing,
  type EnvironmentBriefing,
  type CriticalFinding,
} from "@/lib/api/ai";

const RISK_STYLES: Record<EnvironmentBriefing["overallRisk"], { badge: string }> = {
  CRITICAL: { badge: "bg-error-bg text-error-text border-error-border" },
  HIGH:     { badge: "bg-warning-bg text-warning-text border-warning-border" },
  MEDIUM:   { badge: "bg-info-bg text-info-text border-info-border" },
  LOW:      { badge: "bg-success-bg text-success-text border-success-border" },
};

const URGENCY_DOT: Record<CriticalFinding["urgency"], string> = {
  IMMEDIATE: "bg-error-text",
  HIGH:      "bg-warning-text",
  MEDIUM:    "bg-info-text",
  LOW:       "bg-success-text",
};

type Props = {
  environmentId: string;
  hasActiveScan: boolean;
  vulnCount: number;
};

export default function AIChatPanel({ environmentId, hasActiveScan, vulnCount }: Props) {
  const [briefing, setBriefing] = useState<EnvironmentBriefing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showNextMoves, setShowNextMoves] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadBriefing = useCallback(async () => {
    if (!hasActiveScan) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await requestEnvironmentBriefing(environmentId);
      if (res.success && res.data) {
        setBriefing(res.data);
      } else {
        setError(res.message || "Failed to fetch AI briefing.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [environmentId, hasActiveScan]);

  useEffect(() => {
    loadBriefing();
  }, [loadBriefing]);

  const handleCopy = async () => {
    if (!briefing) return;
    const text = [
      `Risk Level: ${briefing.overallRisk}`,
      ``,
      briefing.threatSummary,
      ``,
      ...(briefing.criticalFindings.length ? ["Critical Findings:", ...briefing.criticalFindings.map(f => `- ${f.title}: ${f.description} (${f.affectedAssets.join(", ")}) → ${f.recommendedAction}`)] : []),
      ``,
      ...(briefing.prioritizedActions.length ? ["Prioritized Actions:", ...briefing.prioritizedActions.map((a, i) => `${i + 1}. ${a}`)] : []),
      ``,
      ...(briefing.industryGuidance ? ["Industry Guidance:", briefing.industryGuidance] : []),
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!hasActiveScan) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mb-3">
          <FiAlertTriangle className="w-5 h-5 text-text-muted" />
        </div>
        <p className="text-sm text-text-secondary">No scan data available. Run a scan first to enable AI analysis.</p>
      </div>
    );
  }

  if (vulnCount === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-success-bg flex items-center justify-center mb-3 border border-success-border">
          <FiCheck className="w-5 h-5 text-success-text" />
        </div>
        <p className="text-sm text-text-secondary">No active vulnerabilities found. Your environment appears clean.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-brand-1 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-secondary">Analyzing environment...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-error-bg flex items-center justify-center mb-3 border border-error-border">
          <FiAlertTriangle className="w-5 h-5 text-error-text" />
        </div>
        <p className="text-sm text-error-text mb-3">{error}</p>
        <button onClick={loadBriefing} className="text-sm text-brand-2 font-semibold hover:underline">Retry</button>
      </div>
    );
  }

  if (!briefing) return null;

  const riskStyle = RISK_STYLES[briefing.overallRisk];

  return (
    <div className="h-full overflow-y-auto px-4 py-4 space-y-4">
      {/* Risk summary card */}
      <div className="bg-surface-secondary border border-border rounded-[16px] p-4">
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${riskStyle.badge}`}>
            {briefing.overallRisk} RISK
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary px-2 py-1 rounded-[8px] hover:bg-surface transition-colors"
          >
            {copied ? <FiCheck className="w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed">{briefing.threatSummary}</p>
      </div>

      {/* Critical findings */}
      {briefing.criticalFindings.length > 0 && (
        <div className="bg-surface-secondary border border-border rounded-[16px] p-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Critical Findings</p>
          <div className="space-y-3">
            {briefing.criticalFindings.map((finding, i) => (
              <div key={i} className="bg-surface rounded-[12px] p-3 border border-border">
                <div className="flex items-start gap-2 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${URGENCY_DOT[finding.urgency]}`} />
                  <p className="text-sm font-medium text-text-primary">{finding.title}</p>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed ml-3.5 mb-1.5">{finding.description}</p>
                <div className="ml-3.5 flex flex-wrap gap-1.5 items-center">
                  {finding.affectedAssets.map((asset) => (
                    <span key={asset} className="text-xs bg-surface-secondary border border-border text-text-muted px-1.5 py-0.5 rounded">{asset}</span>
                  ))}
                  <span className="text-xs text-brand-2 font-medium">→ {finding.recommendedAction}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Systemic risks */}
      {briefing.systemicRisks.length > 0 && (
        <div className="bg-surface-secondary border border-border rounded-[16px] p-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Systemic Risks</p>
          <ul className="space-y-1">
            {briefing.systemicRisks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                <FiAlertTriangle className="w-3 h-3 text-warning-text shrink-0 mt-0.5" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next moves toggle */}
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setShowNextMoves(v => !v)}
          className="w-full px-3 py-2 text-xs font-semibold bg-brand-1 text-brand-2 hover:opacity-90 rounded-full transition-all"
        >
          {showNextMoves ? "Hide Next Moves" : "Show Next Moves"}
        </button>
      </div>

      {/* Next moves content */}
      {showNextMoves && (
        <div className="bg-surface-secondary border border-border rounded-[16px] p-4 space-y-3">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Prioritized Remediation Steps</p>
          {briefing.prioritizedActions.length > 0 ? (
            <ol className="space-y-2">
              {briefing.prioritizedActions.map((action, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
                  <span className="w-5 h-5 rounded-full bg-brand-1/10 text-brand-2 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                  {action}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-text-secondary">No specific remediation steps identified.</p>
          )}
          {briefing.industryGuidance && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Industry Guidance</p>
              <p className="text-xs text-text-secondary leading-relaxed">{briefing.industryGuidance}</p>
            </div>
          )}
        </div>
      )}

      {briefing.model !== "stub" && (
        <p className="text-xs text-text-muted text-center">Powered by {briefing.model}</p>
      )}
    </div>
  );
}
