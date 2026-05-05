"use client";

import { FiCheckCircle, FiChevronRight } from "react-icons/fi";
import { Badge } from "@/components/ui/Badge";
import type { Asset } from "@/lib/api";
import { typeIcons, SEVERITY_BADGE } from "./dashboard-constants";

export function AssetCard({ asset, onClick, vulnCount, highestSeverity, wasScanned }: {
  asset: Asset;
  onClick: () => void;
  vulnCount?: number;
  highestSeverity?: string | null;
  wasScanned?: boolean;
}) {
  const cpeList = Array.isArray(asset.cpes) ? asset.cpes : [];
  const Icon = typeIcons[asset.type] || typeIcons.unknown;
  const isActive = asset.status === "active";
  const isSecure = wasScanned && (vulnCount === 0 || vulnCount === undefined);

  const borderClass =
    highestSeverity === "CRITICAL" ? "border-error-text/40 hover:border-error-text/70" :
    highestSeverity === "HIGH"     ? "border-warning-text/40 hover:border-warning-text/70" :
    isSecure                       ? "border-success-text/30 hover:border-success-text/50" :
    "border-border hover:border-border-secondary";

  const iconBgClass =
    highestSeverity === "CRITICAL" ? "bg-error-bg text-error-text" :
    highestSeverity === "HIGH"     ? "bg-warning-bg text-warning-text" :
    isSecure                       ? "bg-success-bg text-success-text" :
    "bg-surface-secondary text-text-muted";

  return (
    <button
      onClick={onClick}
      className={`w-full bg-surface rounded-[16px] border p-4 text-left transition-all duration-150 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 group ${borderClass}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconBgClass}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-text-primary text-sm">{asset.name}</div>
            <div className="text-xs text-text-muted capitalize">{asset.type}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: isActive ? "var(--status-active)" : "var(--status-inactive)" }} />
            <span className="text-[10px] text-text-muted capitalize">{asset.status || "unknown"}</span>
          </div>
          {vulnCount !== undefined && vulnCount > 0 && highestSeverity && SEVERITY_BADGE[highestSeverity] ? (
            <Badge variant={SEVERITY_BADGE[highestSeverity].variant} size="sm">
              {SEVERITY_BADGE[highestSeverity].text} · {vulnCount}
            </Badge>
          ) : isSecure ? (
            <Badge variant="success" size="sm"><FiCheckCircle className="w-3 h-3" /> Secure</Badge>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3">
        <Badge variant={asset.domain === "IT" ? "info" : asset.domain === "OT" ? "warning" : "neutral"} size="sm">{asset.domain}</Badge>
        <Badge variant={cpeList.length > 0 ? "success" : "neutral"} size="sm">
          {cpeList.length > 0 ? `${cpeList.length} CPE${cpeList.length > 1 ? "s" : ""}` : "No CPE"}
        </Badge>
      </div>

      {cpeList.length > 0 && (
        <div className="text-[10px] text-text-muted font-mono truncate bg-surface-secondary rounded-lg px-2 py-1">
          {cpeList[0].cpeName}
        </div>
      )}

      <div className="flex items-center justify-end mt-3 text-text-muted group-hover:text-text-secondary transition-colors">
        <span className="text-[10px] mr-1">Details</span>
        <FiChevronRight className="w-3 h-3" />
      </div>
    </button>
  );
}
