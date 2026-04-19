"use client";

import type { DashboardOverview } from "@/lib/api/dashboard";

export function RiskSentence({ stats }: { stats: DashboardOverview["severityCounts"] }) {
  const total = stats.critical + stats.high + stats.medium + stats.low;
  if (total === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xl font-bold text-success-text tracking-[-0.3px]">No active vulnerabilities.</p>
        <p className="text-sm text-text-secondary mt-1">Environment is secure.</p>
      </div>
    );
  }
  return (
    <div className="py-3">
      <p className="text-[17px] font-semibold text-text-primary tracking-[-0.2px] leading-snug">
        <span className="text-text-primary">{total}</span> active {total === 1 ? "vulnerability" : "vulnerabilities"},{" "}
        <span className={`${stats.critical > 0 ? "text-error-text" : "text-warning-text"} font-bold`}>{stats.critical}</span> critical{" "}
        and <span className={`${stats.high > 0 ? "text-warning-text" : "text-text-primary"} font-bold`}>{stats.high}</span> high.
      </p>
    </div>
  );
}
