"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { FiShield, FiAlertTriangle } from "react-icons/fi";
import {
  requestEnvironmentBriefing,
  type EnvironmentBriefing,
  type CriticalFinding,
} from "@/lib/api/ai";

// ============================================================
// Types
// ============================================================

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  query: "summary" | "next-moves" | null; // which section of the briefing to show
  briefing: EnvironmentBriefing | null;   // populated for assistant messages
  text: string | null;                    // populated for user / error / welcome
  timestamp: Date;
};

// ============================================================
// Styling constants
// ============================================================

const RISK_STYLES: Record<EnvironmentBriefing["overallRisk"], { badge: string }> = {
  CRITICAL: { badge: "bg-red-500/15 text-red-400 border-red-500/30" },
  HIGH:     { badge: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  MEDIUM:   { badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  LOW:      { badge: "bg-green-500/15 text-green-400 border-green-500/30" },
};

const URGENCY_DOT: Record<CriticalFinding["urgency"], string> = {
  IMMEDIATE: "bg-red-500",
  HIGH:      "bg-orange-500",
  MEDIUM:    "bg-yellow-500",
  LOW:       "bg-blue-500",
};

// ============================================================
// Main panel
// ============================================================

type Props = {
  environmentId: string;
  hasActiveScan: boolean; // false → disable both buttons
  vulnCount: number;      // 0 → disable "next moves" button
};

export default function AIChatPanel({ environmentId, hasActiveScan, vulnCount }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedBriefing, setCachedBriefing] = useState<EnvironmentBriefing | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine welcome text based on environment state
  const welcomeText = !hasActiveScan
    ? "No scan data available. Run a scan first to enable AI analysis."
    : vulnCount === 0
    ? "No active vulnerabilities found in the latest scan. Your environment appears clean."
    : "Ready to analyze your environment. Use the buttons below to get started.";

  // Set welcome message on mount only
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        query: null,
        briefing: null,
        text: welcomeText,
        timestamp: new Date(),
      },
    ]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addMessage = useCallback((msg: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [
      ...prev,
      { ...msg, id: `${Date.now()}-${Math.random()}`, timestamp: new Date() },
    ]);
  }, []);

  const handleQuery = useCallback(
    async (query: "summary" | "next-moves") => {
      const label = query === "summary" ? "Environment Summary" : "What are the next moves?";

      // Show user bubble immediately
      addMessage({ role: "user", query, briefing: null, text: label });
      setIsLoading(true);

      try {
        let briefing = cachedBriefing;

        if (!briefing) {
          const res = await requestEnvironmentBriefing(environmentId);
          if (res.success && res.data) {
            briefing = res.data;
            setCachedBriefing(briefing);
          } else {
            addMessage({
              role: "error",
              query: null,
              briefing: null,
              text: res.message || "Failed to fetch AI briefing. Please try again.",
            });
            return;
          }
        }

        addMessage({ role: "assistant", query, briefing, text: null });
      } catch (err) {
        addMessage({
          role: "error",
          query: null,
          briefing: null,
          text: err instanceof Error ? err.message : "An unexpected error occurred.",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [environmentId, cachedBriefing, addMessage]
  );

  const buttonsDisabled = isLoading || !hasActiveScan;
  const nextMovesDisabled = buttonsDisabled || vulnCount === 0;

  return (
    <div
      className="bg-surface border border-border rounded-xl overflow-hidden flex flex-col"
      style={{ height: "420px" }}
    >
      {/* Panel header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-secondary/30 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
          <FiShield className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">AI Security Analyst</p>
          <p className="text-xs text-text-muted">Powered by Gemini · Environment-level analysis</p>
        </div>
      </div>

      {/* Scrollable message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        {isLoading && <TypingIndicator />}
      </div>

      {/* Preset action buttons */}
      <div className="shrink-0 px-4 py-3 border-t border-border bg-surface-secondary/20 flex items-center gap-2 flex-wrap">
        <button
          onClick={() => handleQuery("summary")}
          disabled={buttonsDisabled}
          className="px-3 py-2 text-xs font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Environment Summary
        </button>
        <button
          onClick={() => handleQuery("next-moves")}
          disabled={nextMovesDisabled}
          title={vulnCount === 0 ? "No vulnerabilities to remediate" : undefined}
          className="px-3 py-2 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 hover:border-emerald-500/50 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          What are the next moves?
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Message bubble
// ============================================================

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="bg-indigo-600/20 border border-indigo-500/30 text-text-primary rounded-2xl rounded-tr-sm px-3 py-2 max-w-xs text-sm">
          {msg.text}
        </div>
      </div>
    );
  }

  if (msg.role === "error") {
    return (
      <div className="flex justify-start">
        <div className="bg-error-bg border border-error-border text-error-text rounded-2xl rounded-tl-sm px-3 py-2 max-w-sm text-sm flex items-start gap-2">
          <FiAlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {msg.text}
        </div>
      </div>
    );
  }

  // Assistant bubble
  return (
    <div className="flex justify-start">
      <div className="bg-surface-secondary border border-border rounded-2xl rounded-tl-sm px-4 py-3 w-full text-sm space-y-3">
        {msg.query === null && (
          <p className="text-text-secondary">{msg.text}</p>
        )}
        {msg.query === "summary" && msg.briefing && (
          <SummaryResponse briefing={msg.briefing} />
        )}
        {msg.query === "next-moves" && msg.briefing && (
          <NextMovesResponse briefing={msg.briefing} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Summary response — shows risk level, findings, systemic risks
// ============================================================

function SummaryResponse({ briefing }: { briefing: EnvironmentBriefing }) {
  const riskStyle = RISK_STYLES[briefing.overallRisk];

  return (
    <div className="space-y-3">
      {/* Overall risk */}
      <div className="flex items-center gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${riskStyle.badge}`}>
          {briefing.overallRisk} RISK
        </span>
        <span className="text-xs text-text-muted">Overall environment risk level</span>
      </div>

      {/* Threat summary */}
      <p className="text-text-secondary leading-relaxed">{briefing.threatSummary}</p>

      {/* Critical findings */}
      {briefing.criticalFindings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Critical Findings
          </p>
          <div className="space-y-2">
            {briefing.criticalFindings.map((finding, i) => (
              <div key={i} className="bg-surface rounded-lg p-2.5 border border-border">
                <div className="flex items-start gap-2 mb-1">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${URGENCY_DOT[finding.urgency]}`} />
                  <p className="text-sm font-medium text-text-primary">{finding.title}</p>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed ml-3.5 mb-1.5">
                  {finding.description}
                </p>
                <div className="ml-3.5 flex flex-wrap gap-1.5 items-center">
                  {finding.affectedAssets.map((asset) => (
                    <span
                      key={asset}
                      className="text-xs bg-surface-secondary border border-border text-text-muted px-1.5 py-0.5 rounded"
                    >
                      {asset}
                    </span>
                  ))}
                  <span className="text-xs text-indigo-400 font-medium">
                    → {finding.recommendedAction}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Systemic risks */}
      {briefing.systemicRisks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
            Systemic Risks
          </p>
          <ul className="space-y-1">
            {briefing.systemicRisks.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-text-secondary">
                <FiAlertTriangle className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {briefing.model !== "stub" && (
        <p className="text-xs text-text-muted pt-1 border-t border-border">
          Powered by {briefing.model}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Next moves response — shows prioritized actions + guidance
// ============================================================

function NextMovesResponse({ briefing }: { briefing: EnvironmentBriefing }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
        Prioritized Remediation Steps
      </p>

      {briefing.prioritizedActions.length > 0 ? (
        <ol className="space-y-2">
          {briefing.prioritizedActions.map((action, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-text-secondary">
              <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {action}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-text-secondary">
          No specific remediation steps identified.
        </p>
      )}

      {briefing.industryGuidance && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
            Industry Guidance
          </p>
          <p className="text-xs text-text-secondary leading-relaxed">{briefing.industryGuidance}</p>
        </div>
      )}

      {briefing.model !== "stub" && (
        <p className="text-xs text-text-muted pt-1 border-t border-border">
          Powered by {briefing.model}
        </p>
      )}
    </div>
  );
}

// ============================================================
// Typing indicator — shown while waiting for API
// ============================================================

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-surface-secondary border border-border rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 bg-text-muted rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <div
            className="w-2 h-2 bg-text-muted rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <div
            className="w-2 h-2 bg-text-muted rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      </div>
    </div>
  );
}
