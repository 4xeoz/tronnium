"use client";

import { useMemo } from "react";
import {
  FiFlag, FiCheckCircle, FiBarChart2,
  FiServer, FiMonitor, FiHardDrive, FiCpu, FiLayers,
  FiAlertTriangle,
} from "react-icons/fi";
import { type WorkflowItem } from "@/lib/api/vulnerabilityWorkflow";
import { Card, SectionHeader, StatCard } from "./SecurityUI";
import { INACTIVE_STATUSES } from "@/lib/securityConstants";
import type { AssetScan as AssetScanItem, ScanHistoryItem } from "@/lib/api";

const typeIcons: Record<string, React.ElementType> = {
  server: FiServer, workstation: FiMonitor, storage: FiHardDrive, iot: FiCpu, unknown: FiLayers,
};

function RiskSentence({
  total,
  critical,
  high,
  newThisScan,
}: {
  total: number;
  critical: number;
  high: number;
  newThisScan: number;
}) {
  if (total === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[28px] font-bold text-success-text tracking-[-0.5px]">No active vulnerabilities.</p>
        <p className="text-[17px] text-text-secondary mt-1">Environment is secure.</p>
      </div>
    );
  }
  return (
    <div className="text-center py-8">
      <p className="text-[28px] font-bold text-text-primary tracking-[-0.5px] leading-tight">
        <span className="text-text-primary">{total}</span> active {total === 1 ? "vulnerability" : "vulnerabilities"},{" "}
        <span className={`${critical > 0 ? "text-error-text" : "text-warning-text"} font-bold`}>{critical}</span> critical{" "}
        and <span className={`${high > 0 ? "text-warning-text" : "text-text-primary"} font-bold`}>{high}</span> high.
      </p>
      {newThisScan > 0 && (
        <p className="text-[17px] text-text-secondary mt-2">
          <span className="text-brand-2 font-semibold">{newThisScan}</span> new {newThisScan === 1 ? "finding" : "findings"} since last scan.
        </p>
      )}
    </div>
  );
}

function TrendAnalysisPanel({ scanHistory }: { scanHistory: ScanHistoryItem[] }) {
  const severityTrends = useMemo(() => {
    return scanHistory
      .filter(scan => scan.completedAt)
      .slice(0, 10)
      .reverse()
      .map(scan => ({
        date: new Date(scan.completedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        total: scan.vulnerabilitiesFound,
        critical: scan.criticalCount,
        high: scan.highCount,
        medium: scan.mediumCount,
        low: scan.lowCount,
      }));
  }, [scanHistory]);

  if (severityTrends.length < 2) {
    return (
      <Card className="p-8 text-center">
        <FiBarChart2 className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary text-sm">Not enough scan history for trend analysis.</p>
      </Card>
    );
  }

  const maxTotal = Math.max(...severityTrends.map(t => t.total), 1);
  const current = severityTrends[severityTrends.length - 1].total;
  const previous = severityTrends[severityTrends.length - 2].total;
  const delta = current - previous;

  return (
    <Card>
      <SectionHeader
        title="Vulnerability Trends"
        subtitle={
          delta === 0
            ? "No change vs last scan"
            : `${delta > 0 ? "↑" : "↓"} ${Math.abs(delta)} ${Math.abs(delta) === 1 ? "finding" : "findings"} vs last scan`
        }
      />
      <div className="h-48 flex items-end gap-2 mt-4">
        {severityTrends.map((trend, i) => {
          const height = (trend.total / maxTotal) * 100;
          const isLast = i === severityTrends.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: `${Math.max(height, 5)}%` }}>
                <div className="bg-success-text" style={{ height: `${(trend.low / maxTotal) * 100}%` }} />
                <div className="bg-info-text"    style={{ height: `${(trend.medium / maxTotal) * 100}%` }} />
                <div className="bg-warning-text" style={{ height: `${(trend.high / maxTotal) * 100}%` }} />
                <div className="bg-error-text"   style={{ height: `${(trend.critical / maxTotal) * 100}%` }} />
              </div>
              <span className={`text-[10px] whitespace-nowrap ${isLast ? "text-text-primary font-medium" : "text-text-muted"}`}>{trend.date}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center gap-4 mt-4">
        {[
          ["bg-error-text", "Critical"],
          ["bg-warning-text", "High"],
          ["bg-info-text", "Medium"],
          ["bg-success-text", "Low"],
        ].map(([color, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            <span className="text-xs text-text-secondary">{label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TopExposureList({ assetScans, workflows }: { assetScans: AssetScanItem[]; workflows: Map<string, WorkflowItem> }) {
  const typeOpenCount = useMemo(() => {
    const counts: Record<string, number> = {};
    assetScans.forEach(item => {
      const openCount = item.vulnerabilities.filter(v => {
        const wf = workflows.get(`${v.vulnerability.id}-${item.asset.id}-${v.cpeName}`);
        return !wf || !INACTIVE_STATUSES.has(wf.status);
      }).length;
      if (openCount > 0) {
        counts[item.asset.type] = (counts[item.asset.type] || 0) + openCount;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [assetScans, workflows]);

  if (typeOpenCount.length === 0) {
    return (
      <Card className="p-6">
        <SectionHeader title="What to Watch" />
        <p className="text-sm text-text-muted">No open exposure by asset type.</p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <SectionHeader title="What to Watch" />
      <div className="space-y-3 mt-2">
        {typeOpenCount.map(([type, count]) => {
          const Icon = typeIcons[type] || typeIcons.unknown;
          return (
            <div key={type} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface-secondary flex items-center justify-center">
                  <Icon className="w-4 h-4 text-text-muted" />
                </div>
                <span className="text-sm font-medium text-text-primary capitalize">{type}</span>
              </div>
              <span className="text-sm font-semibold text-text-secondary">{count} open</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default function OverviewPanel({
  stats,
  assetScans,
  scanHistory,
  workflows,
  slaBreaches,
  newThisScan,
}: {
  stats: { total: number; critical: number; high: number; medium: number; low: number; resolved: number };
  assetScans: AssetScanItem[];
  scanHistory: ScanHistoryItem[];
  workflows: Map<string, WorkflowItem>;
  slaBreaches: number;
  newThisScan: number;
}) {
  return (
    <div className="space-y-6">
      {/* Hero Risk Sentence */}
      <div className="bg-surface rounded-[16px] border border-border px-6">
        <RiskSentence
          total={stats.total}
          critical={stats.critical}
          high={stats.high}
          newThisScan={newThisScan}
        />
      </div>

      {/* Big 3 Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Critical / High"
          value={`${stats.critical} / ${stats.high}`}
          subtitle="Need immediate review"
          icon={FiFlag}
          colorClass={stats.critical > 0 ? "bg-error-bg text-error-text" : stats.high > 0 ? "bg-warning-bg text-warning-text" : "bg-surface-secondary text-text-secondary"}
        />
        <StatCard
          title="Past SLA"
          value={slaBreaches}
          subtitle={slaBreaches > 0 ? "Overdue vulnerabilities" : "All within SLA"}
          icon={FiAlertTriangle}
          colorClass={slaBreaches > 0 ? "bg-error-bg text-error-text" : "bg-success-bg text-success-text"}
        />
        <StatCard
          title="Resolved"
          value={stats.resolved}
          subtitle={`${stats.total} still open`}
          icon={FiCheckCircle}
          colorClass="bg-success-bg text-success-text"
        />
      </div>

      {/* Trend + Exposure */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <TrendAnalysisPanel scanHistory={scanHistory} />
        </div>
        <div>
          <TopExposureList assetScans={assetScans} workflows={workflows} />
        </div>
      </div>
    </div>
  );
}
