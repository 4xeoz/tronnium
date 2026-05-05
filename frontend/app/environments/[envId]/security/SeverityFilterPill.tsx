"use client";

import { SEVERITY_CONFIG } from "@/lib/securityConstants";
import type { ScanSeverity } from "@/lib/api";

export function SeverityFilterPill({ severity, count, isActive, onClick }: { severity: ScanSeverity; count: number; isActive: boolean; onClick: () => void }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-xs font-semibold ${
        isActive ? `${config.bgLight} ${config.border}` : "bg-surface border-border hover:border-border-secondary"
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${config.bg}`} />
      <span className={config.text}>{config.label}</span>
      <span className="text-text-primary font-bold">{count}</span>
    </button>
  );
}
