"use client";

import { useMemo } from "react";
import {
  FiShield,
  FiFlag,
  FiActivity,
  FiCheckCircle,
  FiBarChart2,
  FiClock,
  FiServer,
  FiMonitor,
  FiHardDrive,
  FiCpu,
  FiLayers,
  FiTarget,
} from "react-icons/fi";
import { type WorkflowItem, type WorkflowStats, type VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import { Card, SectionHeader, StatCard } from "./SecurityUI";
import type { AssetScan as AssetScanItem, ScanHistoryItem } from "@/lib/api";

// ============================================
// SECURITY SCORE RING
// ============================================

function SecurityScoreRing({
  score,
  size = 120,
  strokeWidth = 8,
}: {
  score: number | null;
  size?: number;
  strokeWidth?: number;
}) {
  const value = score ?? 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  const getColor = () => {
    if (value >= 80) return "text-success-text";
    if (value >= 60) return "text-warning-text";
    if (value >= 40) return "text-orange-500";
    return "text-error-text";
  };

  const getBgColor = () => {
    if (value >= 80) return "#16A34A";
    if (value >= 60) return "#D97706";
    if (value >= 40) return "#EA580C";
    return "#DC2626";
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-surface-secondary" />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={getBgColor()} strokeWidth={strokeWidth} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold ${getColor()}`}>{score !== null ? Math.round(score) : "--"}</span>
        <span className="text-[10px] text-text-muted uppercase tracking-wide">Score</span>
      </div>
    </div>
  );
}

// ============================================
// SEVERITY BAR CHART
// ============================================

function SeverityBarChart({ critical, high, medium, low }: { critical: number; high: number; medium: number; low: number }) {
  const maxVal = Math.max(critical, high, medium, low, 1);
  const bars = [
    { label: "Critical", value: critical, color: "bg-red-500",    textColor: "text-error-text" },
    { label: "High",     value: high,     color: "bg-orange-500", textColor: "text-warning-text" },
    { label: "Medium",   value: medium,   color: "bg-yellow-500", textColor: "text-warning-text" },
    { label: "Low",      value: low,      color: "bg-blue-500",   textColor: "text-info-text" },
  ];

  return (
    <div className="space-y-3">
      {bars.map(bar => (
        <div key={bar.label} className="flex items-center gap-3">
          <span className="text-xs text-text-muted w-14 shrink-0">{bar.label}</span>
          <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
            <div className={`h-full ${bar.color} rounded-full transition-all duration-500`} style={{ width: `${(bar.value / maxVal) * 100}%` }} />
          </div>
          <span className={`text-xs font-semibold ${bar.textColor} w-6 text-right shrink-0`}>{bar.value}</span>
        </div>
      ))}
    </div>
  );
}

// ============================================
// STATUS DONUT
// ============================================

function StatusDonut({ stats }: { stats: WorkflowStats | null }) {
  if (!stats) return null;

  const byStatus = (status: VulnStatus) => stats.byStatus.find(s => s.status === status)?._count.id || 0;

  const data = [
    { label: "Open",           value: stats.open,                       color: "#DC2626" },
    { label: "In Progress",    value: stats.inProgress,                 color: "#D97706" },
    { label: "Resolved",       value: byStatus("RESOLVED"),             color: "#16A34A" },
    { label: "Risk Accepted",  value: byStatus("RISK_ACCEPTED"),        color: "#2563EB" },
    { label: "False Positive", value: byStatus("FALSE_POSITIVE"),       color: "#9CA3AF" },
  ].filter(d => d.value > 0);

  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return <div className="h-32 flex items-center justify-center text-text-muted text-sm">No workflow data</div>;
  }

  let cumulativePercent = 0;

  return (
    <div className="flex items-center gap-6">
      <div className="relative w-28 h-28">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          {data.map((segment, i) => {
            const percent = (segment.value / total) * 100;
            const dashArray = `${percent} ${100 - percent}`;
            const offset = 100 - cumulativePercent;
            cumulativePercent += percent;
            return (
              <circle key={i} cx="18" cy="18" r="15.9" fill="none" stroke={segment.color} strokeWidth="4"
                strokeDasharray={dashArray} strokeDashoffset={offset} className="transition-all duration-500" />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-text-primary">{total}</span>
          <span className="text-[9px] text-text-muted uppercase">Total</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {data.slice(0, 4).map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-text-secondary flex-1">{item.label}</span>
            <span className="text-xs font-medium text-text-primary">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// ASSET TYPE DISTRIBUTION
// ============================================

const typeIcons: Record<string, React.ElementType> = {
  server:      FiServer,
  workstation: FiMonitor,
  storage:     FiHardDrive,
  iot:         FiCpu,
  unknown:     FiLayers,
};

function AssetTypeDistribution({ assetScans }: { assetScans: AssetScanItem[] }) {
  const typeCount = assetScans.reduce((acc, item) => {
    acc[item.asset.type] = (acc[item.asset.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const types = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = assetScans.length || 1;

  return (
    <div className="space-y-2">
      {types.map(([type, count]) => {
        const Icon = typeIcons[type] || typeIcons.unknown;
        return (
          <div key={type} className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-secondary capitalize flex-1">{type}</span>
            <div className="flex-1 h-1.5 bg-surface-secondary rounded-full overflow-hidden max-w-[80px]">
              <div className="h-full bg-brand-1/60 rounded-full" style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <span className="text-xs text-text-muted w-5 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// TREND ANALYSIS PANEL
// ============================================

function TrendAnalysisPanel({
  scanHistory,
  workflows,
}: {
  scanHistory: ScanHistoryItem[];
  workflows: Map<string, WorkflowItem>;
}) {
  const severityTrends = useMemo(() => {
    return scanHistory.slice(0, 10).reverse().map(scan => ({
      date: new Date(scan.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      critical: scan.criticalCount,
      high: scan.highCount,
      medium: scan.mediumCount,
      low: scan.lowCount,
    }));
  }, [scanHistory]);

  const avgResolutionTime = useMemo(() => {
    const resolved = Array.from(workflows.values()).filter(w => w.status === "RESOLVED" && w.resolvedAt);
    if (resolved.length === 0) return null;
    const totalDays = resolved.reduce((sum, w) => {
      const days = (new Date(w.resolvedAt!).getTime() - new Date(w.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    return Math.round(totalDays / resolved.length);
  }, [workflows]);

  if (severityTrends.length < 2) {
    return (
      <Card className="p-8 text-center">
        <FiBarChart2 className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary text-sm">Not enough scan history for trend analysis.</p>
      </Card>
    );
  }

  const maxTotal = Math.max(...severityTrends.map(t => t.critical + t.high + t.medium + t.low), 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="lg:col-span-2">
        <SectionHeader title="Vulnerability Trends" subtitle="Severity distribution over last 10 scans" />
        <div className="h-48 flex items-end gap-2 mt-4">
          {severityTrends.map((trend, i) => {
            const total = trend.critical + trend.high + trend.medium + trend.low;
            const height = (total / maxTotal) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: `${Math.max(height, 5)}%` }}>
                  <div className="bg-blue-500"   style={{ height: `${(trend.low    / maxTotal) * 100}%` }} />
                  <div className="bg-yellow-500" style={{ height: `${(trend.medium / maxTotal) * 100}%` }} />
                  <div className="bg-orange-500" style={{ height: `${(trend.high   / maxTotal) * 100}%` }} />
                  <div className="bg-red-500"    style={{ height: `${(trend.critical/ maxTotal) * 100}%` }} />
                </div>
                <span className="text-[10px] text-text-muted whitespace-nowrap">{trend.date}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-4">
          {[["bg-red-500", "Critical"], ["bg-orange-500", "High"], ["bg-yellow-500", "Medium"], ["bg-blue-500", "Low"]].map(([color, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
              <span className="text-xs text-text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-4">
        <StatCard
          title="Avg Resolution Time"
          value={avgResolutionTime !== null ? `${avgResolutionTime}d` : "N/A"}
          subtitle={avgResolutionTime !== null ? "From open to resolved" : "No resolved vulnerabilities yet"}
          icon={FiClock}
          colorClass="bg-info-bg text-info-text"
        />
        <StatCard
          title="Total Scans"
          value={scanHistory.length}
          subtitle="Security scans completed"
          icon={FiTarget}
          colorClass="bg-surface-secondary text-text-secondary"
        />
      </div>
    </div>
  );
}

// ============================================
// OVERVIEW PANEL (exported)
// ============================================

export default function OverviewPanel({
  latestScan,
  scanHistory,
  workflows,
  workflowStats,
  securityScore,
}: {
  latestScan: { criticalCount: number; highCount: number; mediumCount: number; lowCount: number; vulnerabilitiesFound: number; assetScans: AssetScanItem[] };
  scanHistory: ScanHistoryItem[];
  workflows: Map<string, WorkflowItem>;
  workflowStats: WorkflowStats | null;
  securityScore: number | null;
}) {
  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-muted text-sm font-medium mb-3">Security Score</p>
            <div className="flex justify-center">
              <SecurityScoreRing score={securityScore} size={100} strokeWidth={6} />
            </div>
          </div>
        </Card>
        <StatCard
          title="Total Vulnerabilities"
          value={latestScan.vulnerabilitiesFound}
          subtitle="Across all assets"
          icon={FiShield}
          colorClass="bg-info-bg text-info-text"
        />
        <StatCard
          title="Open Issues"
          value={workflowStats?.open || 0}
          subtitle="Need attention"
          icon={FiFlag}
          colorClass="bg-error-bg text-error-text"
        />
        <StatCard
          title="In Progress"
          value={workflowStats?.inProgress || 0}
          subtitle="Being resolved"
          icon={FiActivity}
          colorClass="bg-warning-bg text-warning-text"
        />
        <StatCard
          title="Resolved"
          value={workflowStats?.resolved || 0}
          subtitle="This period"
          trend="down"
          icon={FiCheckCircle}
          colorClass="bg-success-bg text-success-text"
        />
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <SectionHeader title="Severity Distribution" />
          <SeverityBarChart
            critical={latestScan.criticalCount}
            high={latestScan.highCount}
            medium={latestScan.mediumCount}
            low={latestScan.lowCount}
          />
        </Card>
        <Card>
          <SectionHeader title="Remediation Status" />
          <StatusDonut stats={workflowStats} />
        </Card>
        <Card>
          <SectionHeader title="Assets by Type" />
          <AssetTypeDistribution assetScans={latestScan.assetScans} />
        </Card>
      </div>

      {/* Trends */}
      {scanHistory.length > 1 && (
        <TrendAnalysisPanel scanHistory={scanHistory} workflows={workflows} />
      )}
    </div>
  );
}
