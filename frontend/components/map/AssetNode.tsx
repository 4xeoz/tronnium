"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { FiCpu, FiServer, FiDatabase, FiWifi, FiShield, FiHardDrive, FiGlobe, FiLock } from "react-icons/fi";
import type { Asset, ScanSeverity } from "@/lib/api";
import type { VulnSummary } from "@/app/environments/[envId]/map/page";

const typeConfig: Record<string, { icon: React.ElementType; accent: string }> = {
  server:   { icon: FiServer,    accent: "var(--info-text)" },
  database: { icon: FiDatabase,  accent: "var(--warning-text)" },
  network:  { icon: FiWifi,      accent: "var(--success-text)" },
  firewall: { icon: FiShield,    accent: "var(--error-text)" },
  iot:      { icon: FiHardDrive, accent: "var(--warning-text)" },
  unknown:  { icon: FiCpu,       accent: "var(--text-muted)" },
};

const SEVERITY_BORDER: Record<ScanSeverity, string> = {
  CRITICAL: "border-red-500",
  HIGH:     "border-orange-500",
  MEDIUM:   "border-yellow-500",
  LOW:      "border-blue-400",
  UNKNOWN:  "border-border",
};

const SEVERITY_GLOW: Record<ScanSeverity, string> = {
  CRITICAL: "drop-shadow(0 0 8px rgba(239,68,68,0.7))",
  HIGH:     "drop-shadow(0 0 8px rgba(249,115,22,0.6))",
  MEDIUM:   "drop-shadow(0 0 8px rgba(234,179,8,0.5))",
  LOW:      "drop-shadow(0 0 6px rgba(96,165,250,0.5))",
  UNKNOWN:  "none",
};

const VULN_BADGE: Record<ScanSeverity, { bg: string; text: string; label: string }> = {
  CRITICAL: { bg: "bg-red-500",    text: "text-white", label: "CRIT" },
  HIGH:     { bg: "bg-orange-500", text: "text-white", label: "HIGH" },
  MEDIUM:   { bg: "bg-yellow-500", text: "text-black", label: "MED" },
  LOW:      { bg: "bg-blue-400",   text: "text-white", label: "LOW" },
  UNKNOWN:  { bg: "bg-gray-400",   text: "text-white", label: "?" },
};

function getTintColor(score: number): string {
  if (score <= 30) {
    const intensity = 0.08 + (score / 30) * 0.22;
    return `rgba(34, 197, 94, ${intensity})`;
  }
  if (score <= 60) {
    const intensity = 0.08 + ((score - 30) / 30) * 0.22;
    return `rgba(245, 158, 11, ${intensity})`;
  }
  const intensity = 0.08 + ((score - 60) / 40) * 0.22;
  return `rgba(239, 68, 68, ${intensity})`;
}

function AssetNode({ data, selected }: NodeProps<{
  asset: Asset;
  label: string;
  vulnSummary?: VulnSummary;
  isEntryPoint?: boolean;
  riskOverlay?: { compromiseScore: number; knowledgeScore: number; hops: number } | null;
  isGated?: boolean;
  isAnalysisSource?: boolean;
  isAnalysisModeActive?: boolean;
}>) {
  const asset = data.asset;
  const vulnSummary = data.vulnSummary;
  const cpeCount = Array.isArray(asset.cpes) ? asset.cpes.length : 0;
  const config = typeConfig[asset.type] || typeConfig.unknown;
  const Icon = config.icon;
  const isActive = asset.status === "active";

  const sev = vulnSummary?.highestSeverity;
  const hasVulns = (vulnSummary?.total ?? 0) > 0;

  const ro = data.riskOverlay;
  const isGated = data.isGated;
  const isAnalysisSource = data.isAnalysisSource;
  const isAnalysisModeActive = data.isAnalysisModeActive;

  // Background tint from compromise score
  const tintColor = ro ? getTintColor(ro.compromiseScore) : undefined;
  const scoreBadge = ro ? `${Math.round(ro.compromiseScore)}%` : null;

  // Outer opacity: gated = 40%, unrelated in analysis mode = 50%
  let outerOpacity = 1;
  if (isGated) {
    outerOpacity = 0.4;
  } else if (isAnalysisModeActive && !isAnalysisSource && !ro) {
    outerOpacity = 0.5;
  }

  const borderClass = selected
    ? "border-brand-1"
    : isAnalysisSource
    ? "border-[var(--brand-color-1)]"
    : sev
    ? SEVERITY_BORDER[sev]
    : "border-border hover:border-border-secondary";

  const glowFilter = selected
    ? `drop-shadow(0 0 8px ${config.accent})`
    : sev
    ? SEVERITY_GLOW[sev]
    : undefined;

  // Badge: show worst severity count
  const badgeCount = sev === "CRITICAL" ? vulnSummary!.critical
    : sev === "HIGH"   ? vulnSummary!.high
    : sev === "MEDIUM" ? vulnSummary!.medium
    : sev === "LOW"    ? vulnSummary!.low
    : 0;
  const badge = sev ? VULN_BADGE[sev] : null;

  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-border !border-surface" />

      <div
        className="relative group transition-opacity duration-200"
        style={{ filter: glowFilter, opacity: outerOpacity }}
      >
        {/* Analysis source ring */}
        {isAnalysisSource && (
          <div className="absolute -inset-1 rounded-xl border-2 border-[var(--brand-color-1)] pointer-events-none" />
        )}

        {/* Critical pulsing ring */}
        {sev === "CRITICAL" && (
          <div className="absolute inset-0 rounded-xl border-2 border-red-500 animate-pulse pointer-events-none" />
        )}

        {/* Card */}
        <div
          className={`w-48 rounded-xl border bg-surface px-3 py-3 transition-all duration-200 ${borderClass} relative`}
          style={tintColor ? { backgroundColor: tintColor } : undefined}
        >
          {/* Externally facing indicator */}
          {asset.isExternallyFacing && (
            <div
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-warning-bg border border-warning-border flex items-center justify-center z-10"
              title="Externally facing (public internet)"
            >
              <FiGlobe className="w-2.5 h-2.5 text-warning-text" />
            </div>
          )}

          {/* Entry point indicator */}
          {data.isEntryPoint && (
            <div
              className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-info-bg border border-info-border flex items-center justify-center z-10"
              title="Entry point asset"
            >
              <FiShield className="w-2.5 h-2.5 text-info-text" />
            </div>
          )}

          {/* Gated lock icon */}
          {isGated && (
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-surface/90 border border-border flex items-center justify-center z-20"
              title="Gated — exploitability check failed"
            >
              <FiLock className="w-4 h-4 text-text-muted" />
            </div>
          )}

          {/* Analysis source label */}
          {isAnalysisSource && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[var(--brand-color-1)] text-white text-[8px] font-bold uppercase tracking-wider z-10">
              Origin
            </div>
          )}

          {/* Top row: icon + name + status dot */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `color-mix(in srgb, ${config.accent} 15%, transparent)` }}
            >
              <Icon className="w-4 h-4" style={{ color: config.accent }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-text-primary truncate">{asset.name}</div>
              <div className="text-[10px] text-text-muted capitalize">{asset.type}</div>
            </div>
            {/* Status dot */}
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: isActive ? "var(--status-active)" : "var(--status-inactive)" }}
            />
          </div>

          {/* Bottom row: badges */}
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                asset.domain === "IT"
                  ? "bg-info-bg text-info-text"
                  : asset.domain === "OT"
                  ? "bg-warning-bg text-warning-text"
                  : "bg-surface-secondary text-text-muted"
              }`}
            >
              {asset.domain}
            </span>
            {cpeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-success-bg text-success-text text-[9px] font-medium">
                {cpeCount} CPE{cpeCount > 1 ? "s" : ""}
              </span>
            )}
            {asset.isExternallyFacing && (
              <span className="px-1.5 py-0.5 rounded bg-warning-bg text-warning-text text-[9px] font-medium border border-warning-border">
                Public
              </span>
            )}
            {asset.ipAddress && (
              <span className="px-1.5 py-0.5 rounded bg-surface-secondary text-text-muted text-[9px] font-mono truncate max-w-[72px]">
                {asset.ipAddress}
              </span>
            )}
            {/* Vulnerability badge */}
            {hasVulns && badge && (
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${badge.bg} ${badge.text}`}>
                {badgeCount} {badge.label}
              </span>
            )}
            {/* Compromise score badge */}
            {scoreBadge && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-bold text-white"
                style={{
                  backgroundColor:
                    ro!.compromiseScore > 60 ? "rgba(239,68,68,0.9)" :
                    ro!.compromiseScore > 30 ? "rgba(245,158,11,0.9)" :
                    "rgba(34,197,94,0.9)",
                }}
              >
                {scoreBadge}
              </span>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-border !border-surface" />
    </>
  );
}

export default memo(AssetNode);
