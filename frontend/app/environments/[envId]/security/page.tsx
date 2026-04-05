"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  FiShield,
  FiAlertTriangle,
  FiActivity,
  FiPlay,
  FiCheckCircle,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiFilter,
  FiUser,
  FiCalendar,
  FiExternalLink,
  FiMoreHorizontal,
  FiTrendingUp,
  FiTrendingDown,
  FiMinimize,
  FiMaximize,
  FiDownload,
  FiFlag,
  FiClock,
  FiXCircle,
  FiBarChart2,
  FiPieChart,
  FiLayers,
  FiCpu,
  FiServer,
  FiMonitor,
  FiHardDrive,
  FiTool,
  FiTarget,
  FiLayout,
  FiCheckSquare,
  FiMove,
} from "react-icons/fi";
import {
  getLatestScan,
  getScanHistory,
  getRiskLevel,
  getSeverityColor,
  useScan,
  type LatestScan,
  type ScanHistoryItem,
  type ScanSeverity,
} from "@/lib/api";
import { AIExplainButton } from "@/components/ui/AIExplainButton";
import {
  getWorkflows,
  updateWorkflow,
  getWorkflowStats,
  getOrCreateWorkflow,
  getStatusColor,
  getStatusLabel,
  VULN_STATUSES,
  type WorkflowItem,
  type VulnStatus,
  type WorkflowStats,
} from "@/lib/api/vulnerabilityWorkflow";

// ============================================
// TYPES
// ============================================

type AssetScanItem = {
  id: string;
  scannedAt: string;
  asset: {
    id: string;
    name: string;
    type: string;
    domain: string;
  };
  vulnerabilities: {
    vulnerability: {
      id: string;
      cveId: string;
      description: string;
      cvssScore: number | null;
      cvssVector: string | null;
      severity: ScanSeverity;
      publishedDate: string | null;
      lastModifiedDate: string | null;
      isMock?: boolean;
    };
    cpeName: string;
  }[];
};

type ViewMode = "assets" | "list" | "board" | "overview";
type TimeRange = "7d" | "30d" | "90d" | "all";

// ============================================
// SEVERITY CONFIG - Design System Colors
// ============================================

const SEVERITY_CONFIG = {
  CRITICAL: {
    color: "#DC2626",
    bg: "bg-red-500",
    bgLight: "bg-error-bg",
    border: "border-error-border",
    text: "text-error-text",
    textMuted: "text-red-400",
    label: "Critical",
    description: "Immediate action required",
  },
  HIGH: {
    color: "#EA580C",
    bg: "bg-orange-500",
    bgLight: "bg-warning-bg",
    border: "border-warning-border",
    text: "text-warning-text",
    textMuted: "text-orange-400",
    label: "High",
    description: "Address soon",
  },
  MEDIUM: {
    color: "#CA8A04",
    bg: "bg-yellow-500",
    bgLight: "bg-warning-bg",
    border: "border-warning-border",
    text: "text-warning-text",
    textMuted: "text-yellow-400",
    label: "Medium",
    description: "Plan to fix",
  },
  LOW: {
    color: "#2563EB",
    bg: "bg-blue-500",
    bgLight: "bg-info-bg",
    border: "border-info-border",
    text: "text-info-text",
    textMuted: "text-blue-400",
    label: "Low",
    description: "Low priority",
  },
  UNKNOWN: {
    color: "#6B7280",
    bg: "bg-gray-500",
    bgLight: "bg-surface-secondary",
    border: "border-border",
    text: "text-text-secondary",
    textMuted: "text-text-muted",
    label: "Unknown",
    description: "Unknown severity",
  },
};

const STATUS_COLORS: Record<VulnStatus, { bg: string; text: string; border: string; dot: string }> = {
  OPEN: { 
    bg: "bg-error-bg", 
    text: "text-error-text", 
    border: "border-error-border",
    dot: "bg-red-500"
  },
  IN_PROGRESS: { 
    bg: "bg-warning-bg", 
    text: "text-warning-text", 
    border: "border-warning-border",
    dot: "bg-amber-500"
  },
  RESOLVED: { 
    bg: "bg-success-bg", 
    text: "text-success-text", 
    border: "border-success-border",
    dot: "bg-green-500"
  },
  FALSE_POSITIVE: { 
    bg: "bg-surface-secondary", 
    text: "text-text-secondary", 
    border: "border-border",
    dot: "bg-gray-400"
  },
  RISK_ACCEPTED: { 
    bg: "bg-info-bg", 
    text: "text-info-text", 
    border: "border-info-border",
    dot: "bg-blue-500"
  },
};

const typeIcons: Record<string, React.ElementType> = {
  server: FiServer,
  workstation: FiMonitor,
  network: FiActivity,
  storage: FiHardDrive,
  iot: FiCpu,
  unknown: FiLayers,
};

// ============================================
// UTILITY COMPONENTS
// ============================================

function SectionHeader({ 
  title, 
  subtitle, 
  action 
}: { 
  title: string; 
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function Card({ 
  children, 
  className = "",
  padding = "normal"
}: { 
  children: React.ReactNode; 
  className?: string;
  padding?: "none" | "normal" | "large";
}) {
  const paddingClasses = {
    none: "",
    normal: "p-5",
    large: "p-6",
  };
  
  return (
    <div className={`bg-surface rounded-xl border border-border ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  colorClass 
}: { 
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "stable" | "neutral";
  trendValue?: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  const getTrendColor = () => {
    if (trend === "up") return "text-error-text";
    if (trend === "down") return "text-success-text";
    if (trend === "stable") return "text-text-muted";
    return "text-text-secondary";
  };

  const getTrendIcon = () => {
    if (trend === "up") return <FiTrendingUp className="w-3.5 h-3.5" />;
    if (trend === "down") return <FiTrendingDown className="w-3.5 h-3.5" />;
    if (trend === "stable") return <FiMinimize className="w-3.5 h-3.5" />;
    return null;
  };
  
  return (
    <Card className="hover:border-border-secondary transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-text-muted text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
          {subtitle && <p className="text-text-muted text-xs mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{trendValue || (trend === "up" ? "Increased" : trend === "down" ? "Decreased" : "Stable")}</span>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${colorClass} shrink-0 ml-3`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

function Badge({ 
  children, 
  variant = "default",
  size = "md"
}: { 
  children: React.ReactNode; 
  variant?: "default" | "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
}) {
  const variants = {
    default: "bg-surface-secondary text-text-secondary border-border",
    success: "bg-success-bg text-success-text border-success-border",
    warning: "bg-warning-bg text-warning-text border-warning-border",
    error: "bg-error-bg text-error-text border-error-border",
    info: "bg-info-bg text-info-text border-info-border",
    neutral: "bg-surface-tertiary text-text-muted border-border",
  };
  
  const sizes = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
  };
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-medium ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}

// ============================================
// CHART COMPONENTS
// ============================================

function SecurityScoreRing({ 
  score, 
  size = 120,
  strokeWidth = 8
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
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getBgColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
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

function SeverityBarChart({ 
  critical, 
  high, 
  medium, 
  low 
}: { 
  critical: number; 
  high: number; 
  medium: number; 
  low: number;
}) {
  const maxVal = Math.max(critical, high, medium, low, 1);
  
  const bars = [
    { label: "Critical", value: critical, color: "bg-red-500", textColor: "text-error-text" },
    { label: "High", value: high, color: "bg-orange-500", textColor: "text-warning-text" },
    { label: "Medium", value: medium, color: "bg-yellow-500", textColor: "text-warning-text" },
    { label: "Low", value: low, color: "bg-blue-500", textColor: "text-info-text" },
  ];

  return (
    <div className="space-y-3">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-3">
          <span className="text-xs text-text-muted w-14 shrink-0">{bar.label}</span>
          <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
            <div
              className={`h-full ${bar.color} rounded-full transition-all duration-500`}
              style={{ width: `${(bar.value / maxVal) * 100}%` }}
            />
          </div>
          <span className={`text-xs font-semibold ${bar.textColor} w-6 text-right shrink-0`}>{bar.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatusDonut({ 
  stats 
}: { 
  stats: WorkflowStats | null;
}) {
  if (!stats) return null;
  
  const data = [
    { label: "Open", value: stats.open, color: "#DC2626" },
    { label: "In Progress", value: stats.inProgress, color: "#D97706" },
    { label: "Resolved", value: stats.resolved, color: "#16A34A" },
    { label: "Risk Accepted", value: stats.byStatus.find(s => s.status === "RISK_ACCEPTED")?._count.id || 0, color: "#2563EB" },
    { label: "False Positive", value: stats.byStatus.find(s => s.status === "FALSE_POSITIVE")?._count.id || 0, color: "#9CA3AF" },
  ].filter(d => d.value > 0);
  
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-text-muted text-sm">
        No workflow data
      </div>
    );
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
              <circle
                key={i}
                cx="18"
                cy="18"
                r="15.9"
                fill="none"
                stroke={segment.color}
                strokeWidth="4"
                strokeDasharray={dashArray}
                strokeDashoffset={offset}
                className="transition-all duration-500"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-bold text-text-primary">{total}</span>
          <span className="text-[9px] text-text-muted uppercase">Total</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {data.slice(0, 4).map((item) => (
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

function TrendSparkline({ 
  data, 
  color = "#C3FA70" 
}: { 
  data: number[];
  color?: string;
}) {
  if (data.length < 2) return null;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(" ");
  
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-12">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        className="opacity-80"
      />
    </svg>
  );
}

function AssetTypeDistribution({ 
  assetScans 
}: { 
  assetScans: AssetScanItem[];
}) {
  const typeCount = assetScans.reduce((acc, item) => {
    acc[item.asset.type] = (acc[item.asset.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const types = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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
              <div
                className="h-full bg-brand-1/60 rounded-full"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-text-muted w-5 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ============================================
// SECURITY COMPONENTS
// ============================================

function SeverityBadge({ 
  severity, 
  count, 
  onClick, 
  isActive 
}: { 
  severity: keyof typeof SEVERITY_CONFIG;
  count: number;
  onClick: () => void;
  isActive: boolean;
}) {
  const config = SEVERITY_CONFIG[severity];
  
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
        isActive 
          ? `${config.bgLight} ${config.border} ring-2 ring-offset-1 ring-[${config.color}]` 
          : "bg-surface border-border hover:border-border-secondary"
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${config.bg}`} />
      <div className="text-left">
        <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
        <span className="text-text-primary font-bold ml-1.5">{count}</span>
      </div>
    </button>
  );
}

function StatusDropdown({ 
  status, 
  workflowId, 
  onChange 
}: { 
  status: VulnStatus;
  workflowId?: string;
  onChange: (id: string, status: VulnStatus) => void;
}) {
  const colors = STATUS_COLORS[status];
  
  if (!workflowId) {
    return (
      <Badge variant={status === "RESOLVED" ? "success" : status === "OPEN" ? "error" : status === "IN_PROGRESS" ? "warning" : "neutral"} size="sm">
        <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        {getStatusLabel(status)}
      </Badge>
    );
  }
  
  return (
    <select
      value={status}
      onChange={(e) => onChange(workflowId, e.target.value as VulnStatus)}
      className={`px-2 py-1 rounded-md text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity bg-transparent ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {VULN_STATUSES.map(s => (
        <option key={s} value={s}>{getStatusLabel(s)}</option>
      ))}
    </select>
  );
}

function VulnerabilityTable({ 
  vulnerabilities, 
  getWorkflowForVuln,
  onStatusChange,
  assetId,
}: { 
  vulnerabilities: AssetScanItem["vulnerabilities"];
  getWorkflowForVuln: (vulnId: string, assetId: string, cpeName: string) => WorkflowItem | undefined;
  onStatusChange: (id: string, status: VulnStatus) => void;
  assetId: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-surface-secondary border-b border-border">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">CVE ID</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Severity</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Description</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">CVSS</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {vulnerabilities.map((vuln, idx) => {
            const workflow = getWorkflowForVuln(vuln.vulnerability.id, assetId, vuln.cpeName);
            const config = SEVERITY_CONFIG[vuln.vulnerability.severity];
            
            return (
              <tr key={idx} className="hover:bg-surface-secondary/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-text-primary">
                      {vuln.vulnerability.cveId}
                    </span>
                    {vuln.vulnerability.isMock && (
                      <Badge variant="neutral" size="sm">MOCK</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge 
                    variant={vuln.vulnerability.severity === "CRITICAL" ? "error" : vuln.vulnerability.severity === "HIGH" ? "warning" : "info"}
                    size="sm"
                  >
                    {vuln.vulnerability.severity}
                  </Badge>
                </td>
                <td className="px-4 py-3 max-w-md">
                  <p className="text-sm text-text-secondary line-clamp-2">{vuln.vulnerability.description}</p>
                  <p className="text-xs text-text-muted mt-1 font-mono truncate">{vuln.cpeName}</p>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-text-primary">
                    {vuln.vulnerability.cvssScore?.toFixed(1) || "N/A"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <StatusDropdown 
                    status={(workflow?.status || "OPEN") as VulnStatus}
                    workflowId={workflow?.id}
                    onChange={onStatusChange}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <a
                      href={`https://nvd.nist.gov/vuln/detail/${vuln.vulnerability.cveId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-secondary rounded-md transition-colors"
                      title="View on NVD"
                    >
                      <FiExternalLink className="w-4 h-4" />
                    </a>
                    <AIExplainButton
                      cveId={vuln.vulnerability.cveId}
                      description={vuln.vulnerability.description}
                      cvssScore={vuln.vulnerability.cvssScore}
                      severity={vuln.vulnerability.severity}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function AssetAccordion({ 
  assetScan, 
  getWorkflowForVuln,
  onStatusChange,
}: { 
  assetScan: AssetScanItem;
  getWorkflowForVuln: (vulnId: string, assetId: string, cpeName: string) => WorkflowItem | undefined;
  onStatusChange: (id: string, status: VulnStatus) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const vulnCount = assetScan.vulnerabilities?.length || 0;
  
  const highestSeverity = assetScan.vulnerabilities.reduce((highest, v) => {
    const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
    return order[v.vulnerability.severity] > order[highest] 
      ? v.vulnerability.severity 
      : highest;
  }, "UNKNOWN" as ScanSeverity);
  
  const config = SEVERITY_CONFIG[highestSeverity];
  const Icon = typeIcons[assetScan.asset.type] || typeIcons.unknown;
  
  if (vulnCount === 0) return null;

  return (
    <Card padding="none" className="overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-surface-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center">
            <Icon className="w-5 h-5 text-text-muted" />
          </div>
          <div className="text-left">
            <h3 className="font-medium text-text-primary">{assetScan.asset.name}</h3>
            <p className="text-sm text-text-muted">{assetScan.asset.type} • {vulnCount} vulnerabilities</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge 
            variant={highestSeverity === "CRITICAL" ? "error" : highestSeverity === "HIGH" ? "warning" : "info"}
            size="sm"
          >
            {config.label}
          </Badge>
          {isExpanded ? (
            <FiChevronUp className="w-5 h-5 text-text-muted" />
          ) : (
            <FiChevronDown className="w-5 h-5 text-text-muted" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="border-t border-border">
          <VulnerabilityTable
            vulnerabilities={assetScan.vulnerabilities}
            getWorkflowForVuln={getWorkflowForVuln}
            onStatusChange={onStatusChange}
            assetId={assetScan.asset.id}
          />
        </div>
      )}
    </Card>
  );
}

function EmptyState({ onScan }: { onScan: () => void }) {
  return (
    <Card className="p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-bg flex items-center justify-center border border-success-border">
        <FiCheckCircle className="w-8 h-8 text-success-text" />
      </div>
      <h3 className="text-lg font-semibold text-text-primary mb-2">All Clear!</h3>
      <p className="text-text-secondary mb-6 max-w-md mx-auto text-sm">
        No vulnerabilities found in your environment. Run a security scan to check for the latest CVEs.
      </p>
      <button
        onClick={onScan}
        className="px-5 py-2.5 bg-text-primary text-surface rounded-lg font-medium hover:bg-text-primary/90 transition-colors inline-flex items-center gap-2"
      >
        <FiPlay className="w-4 h-4" />
        Start Security Scan
      </button>
    </Card>
  );
}

function ScanningProgress({ progress }: { progress: string }) {
  return (
    <div className="bg-info-bg border border-info-border rounded-xl p-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-info-bg flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-info-text border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-info-text">Security Scan in Progress</h3>
          <p className="text-info-text/80 text-sm mt-0.5">{progress}</p>
          <div className="mt-3 h-1.5 bg-info-border rounded-full overflow-hidden">
            <div className="h-full bg-info-text rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendAnalysisPanel({ 
  scanHistory,
  workflows,
}: { 
  scanHistory: ScanHistoryItem[];
  workflows: Map<string, WorkflowItem>;
}) {
  // Calculate trends from scan history
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
      const firstSeen = new Date(w.firstSeenAt);
      const resolved = new Date(w.resolvedAt!);
      const days = (resolved.getTime() - firstSeen.getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);
    
    return Math.round(totalDays / resolved.length);
  }, [workflows]);

  if (severityTrends.length < 2) {
    return (
      <Card className="p-8 text-center">
        <FiBarChart2 className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <p className="text-text-secondary text-sm">Not enough scan history for trend analysis.</p>
        <p className="text-text-muted text-xs mt-1">Run more scans to see trends over time.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="lg:col-span-2">
        <SectionHeader 
          title="Vulnerability Trends" 
          subtitle="Severity distribution over last 10 scans"
        />
        <div className="h-48 flex items-end gap-2 mt-4">
          {severityTrends.map((trend, i) => {
            const total = trend.critical + trend.high + trend.medium + trend.low;
            const maxTotal = Math.max(...severityTrends.map(t => t.critical + t.high + t.medium + t.low), 1);
            const height = (total / maxTotal) * 100;
            
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex flex-col-reverse rounded-t-md overflow-hidden" style={{ height: `${Math.max(height, 5)}%` }}>
                  <div className="bg-blue-500" style={{ height: `${(trend.low / maxTotal) * 100}%` }} />
                  <div className="bg-yellow-500" style={{ height: `${(trend.medium / maxTotal) * 100}%` }} />
                  <div className="bg-orange-500" style={{ height: `${(trend.high / maxTotal) * 100}%` }} />
                  <div className="bg-red-500" style={{ height: `${(trend.critical / maxTotal) * 100}%` }} />
                </div>
                <span className="text-[10px] text-text-muted rotate-0 whitespace-nowrap">{trend.date}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-xs text-text-secondary">Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span className="text-xs text-text-secondary">High</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="text-xs text-text-secondary">Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="text-xs text-text-secondary">Low</span>
          </div>
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
// BOARD VIEW (Kanban/Todo Style with Drag & Drop)
// ============================================

type VulnerabilityCard = {
  id: string;
  cveId: string;
  description: string;
  severity: ScanSeverity;
  cvssScore: number | null;
  assetName: string;
  assetType: string;
  cpeName: string;
  workflowId?: string;
  status: VulnStatus;
  isMock?: boolean;
};

function BoardView({
  assetScans,
  workflows,
  onStatusChange,
  environmentId,
  onWorkflowCreated,
}: {
  assetScans: AssetScanItem[];
  workflows: Map<string, WorkflowItem>;
  onStatusChange: (id: string, status: VulnStatus) => void;
  environmentId: string;
  onWorkflowCreated: (workflow: WorkflowItem) => void;
}) {
  const [draggedCard, setDraggedCard] = useState<VulnerabilityCard | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<VulnStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState<string | null>(null);

  // Flatten all vulnerabilities into cards
  const allCards: VulnerabilityCard[] = useMemo(() => {
    const cards: VulnerabilityCard[] = [];
    assetScans.forEach(assetScan => {
      assetScan.vulnerabilities.forEach(vuln => {
        const workflow = workflows.get(`${vuln.vulnerability.id}-${assetScan.asset.id}-${vuln.cpeName}`);
        cards.push({
          id: `${vuln.vulnerability.id}-${assetScan.asset.id}`,
          cveId: vuln.vulnerability.cveId,
          description: vuln.vulnerability.description,
          severity: vuln.vulnerability.severity,
          cvssScore: vuln.vulnerability.cvssScore,
          assetName: assetScan.asset.name,
          assetType: assetScan.asset.type,
          cpeName: vuln.cpeName,
          workflowId: workflow?.id,
          status: (workflow?.status || "OPEN") as VulnStatus,
          isMock: vuln.vulnerability.isMock,
        });
      });
    });
    return cards;
  }, [assetScans, workflows]);

  // Group by status
  const columns: { id: VulnStatus; title: string; cards: VulnerabilityCard[] }[] = [
    { id: "OPEN", title: "Open", cards: allCards.filter(c => c.status === "OPEN") },
    { id: "IN_PROGRESS", title: "In Progress", cards: allCards.filter(c => c.status === "IN_PROGRESS") },
    { id: "RESOLVED", title: "Resolved", cards: allCards.filter(c => c.status === "RESOLVED") },
    { id: "FALSE_POSITIVE", title: "False Positive", cards: allCards.filter(c => c.status === "FALSE_POSITIVE") },
    { id: "RISK_ACCEPTED", title: "Risk Accepted", cards: allCards.filter(c => c.status === "RISK_ACCEPTED") },
  ];

  const handleMove = async (card: VulnerabilityCard, newStatus: VulnStatus) => {
    if (card.status === newStatus) return;
    
    let workflowId = card.workflowId;
    
    // If no workflow exists, create one first
    if (!workflowId) {
      setIsCreatingWorkflow(card.id);
      try {
        // Extract vulnerability ID and asset ID from card.id (format: vulnId-assetId)
        const parts = card.id.split("-");
        const assetId = parts[parts.length - 1];
        const vulnerabilityId = parts.slice(0, -1).join("-");
        
        const response = await getOrCreateWorkflow(
          environmentId,
          assetId,
          vulnerabilityId,
          card.cpeName
        );
        
        if (response.data) {
          workflowId = response.data.id;
          onWorkflowCreated(response.data);
        } else {
          throw new Error("Failed to create workflow");
        }
      } catch (err) {
        console.error("Failed to create workflow:", err);
        setErrorMessage(`Cannot update ${card.cveId}: Failed to create workflow. Please try again.`);
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      } finally {
        setIsCreatingWorkflow(null);
      }
    }
    
    onStatusChange(workflowId, newStatus);
  };

  const handleDragStart = (card: VulnerabilityCard) => {
    setDraggedCard(card);
  };

  const handleDragOver = (e: React.DragEvent, columnId: VulnStatus) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: VulnStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedCard && draggedCard.status !== columnId) {
      handleMove(draggedCard, columnId);
    }
    setDraggedCard(null);
  };

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {errorMessage && (
        <div className="bg-error-bg border border-error-border text-error-text px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <FiAlertTriangle className="w-4 h-4" />
          {errorMessage}
        </div>
      )}

      {/* Drag Hint */}
      <div className="flex items-center gap-2 text-text-muted text-sm">
        <FiMove className="w-4 h-4" />
        <span>Drag cards between columns to change status, or use the menu</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(column => (
          <div 
            key={column.id} 
            className="flex-shrink-0 w-80 flex flex-col max-h-[calc(100vh-360px)]"
            onDragOver={(e) => handleDragOver(e, column.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className={`flex items-center justify-between p-3 rounded-t-lg border-t border-x transition-colors ${
              dragOverColumn === column.id 
                ? "bg-brand-1/20 border-brand-1" 
                : `${STATUS_COLORS[column.id].bg} ${STATUS_COLORS[column.id].border}`
            }`}>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[column.id].dot}`} />
                <span className={`font-medium text-sm ${STATUS_COLORS[column.id].text}`}>{column.title}</span>
              </div>
              <Badge variant="neutral" size="sm">{column.cards.length}</Badge>
            </div>
            
            {/* Column Content */}
            <div 
              className={`flex-1 overflow-y-auto border-x border-b border-border rounded-b-lg p-2 space-y-2 transition-colors ${
                dragOverColumn === column.id 
                  ? "bg-brand-1/10" 
                  : "bg-surface-secondary/50"
              }`}
            >
              {column.cards.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm border-2 border-dashed border-border rounded-lg">
                  Drop items here
                </div>
              ) : (
                column.cards.map(card => (
                  <BoardCard 
                    key={card.id} 
                    card={card} 
                    onMove={handleMove}
                    onDragStart={() => handleDragStart(card)}
                    isDragging={draggedCard?.id === card.id}
                    isCreatingWorkflow={isCreatingWorkflow === card.id}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BoardCard({
  card,
  onMove,
  onDragStart,
  isDragging,
  isCreatingWorkflow,
}: {
  card: VulnerabilityCard;
  onMove: (card: VulnerabilityCard, status: VulnStatus) => void;
  onDragStart: () => void;
  isDragging: boolean;
  isCreatingWorkflow?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const config = SEVERITY_CONFIG[card.severity];
  const Icon = typeIcons[card.assetType] || typeIcons.unknown;
  
  const moveOptions: VulnStatus[] = ["OPEN", "IN_PROGRESS", "RESOLVED", "FALSE_POSITIVE", "RISK_ACCEPTED"];

  const handleMove = (status: VulnStatus) => {
    setIsUpdating(true);
    onMove(card, status);
    // Reset after animation
    setTimeout(() => setIsUpdating(false), 500);
  };

  return (
    <div 
      draggable={!isCreatingWorkflow}
      onDragStart={onDragStart}
      className={`bg-surface rounded-lg border p-3 transition-all group ${
        isCreatingWorkflow
          ? "opacity-60 border-border cursor-wait"
          : isDragging 
          ? "opacity-50 rotate-2 shadow-lg cursor-grabbing" 
          : isUpdating
          ? "opacity-70 border-brand-1 ring-2 ring-brand-1/20"
          : "hover:shadow-md hover:border-border-secondary border-border cursor-grab"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-xs font-medium text-text-primary truncate">{card.cveId}</span>
          {card.isMock && <Badge variant="neutral" size="sm">MOCK</Badge>}
          {isCreatingWorkflow && (
            <span className="text-[10px] text-text-muted italic">Creating...</span>
          )}
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={isUpdating || isCreatingWorkflow}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-secondary rounded transition-colors disabled:opacity-50"
          >
            <FiMoreHorizontal className="w-4 h-4" />
          </button>
          
          {/* Move Menu */}
          {showMenu && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 w-44 bg-surface rounded-lg border border-border shadow-lg z-50 py-1">
                <div className="px-3 py-1.5 text-xs font-medium text-text-muted border-b border-border">
                  Move to...
                </div>
                {moveOptions.map(status => (
                  <button
                    key={status}
                    onClick={() => {
                      handleMove(status);
                      setShowMenu(false);
                    }}
                    disabled={card.status === status || !card.workflowId}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-surface-secondary transition-colors disabled:opacity-50 ${
                      card.status === status ? 'text-text-muted' : 'text-text-primary'
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[status].dot}`} />
                    {getStatusLabel(status)}
                    {card.status === status && <FiCheckCircle className="w-3 h-3 ml-auto" />}
                  </button>
                ))}
                {!card.workflowId && (
                  <div className="px-3 py-2 text-[10px] text-error-text border-t border-border">
                    Workflow not available
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Description */}
      <p className="text-xs text-text-secondary line-clamp-2 mb-3">{card.description}</p>
      
      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge 
            variant={card.severity === "CRITICAL" ? "error" : card.severity === "HIGH" ? "warning" : "info"}
            size="sm"
          >
            {card.severity}
          </Badge>
          {card.cvssScore && (
            <span className="text-xs text-text-muted">{card.cvssScore.toFixed(1)}</span>
          )}
        </div>
        {isUpdating && (
          <div className="w-4 h-4 border-2 border-brand-1 border-t-transparent rounded-full animate-spin" />
        )}
      </div>
      
      {/* Asset Info */}
      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
        <Icon className="w-3.5 h-3.5 text-text-muted" />
        <span className="text-xs text-text-muted truncate">{card.assetName}</span>
      </div>
      
      {/* Quick Actions */}
      <div className="flex gap-1 mt-2">
        {card.status !== "RESOLVED" && (
          <button
            onClick={() => handleMove("RESOLVED")}
            disabled={isUpdating || isCreatingWorkflow}
            className="flex-1 px-2 py-1 text-[10px] font-medium bg-success-bg text-success-text rounded hover:bg-success-bg/80 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <FiCheckCircle className="w-3 h-3" />
            Resolve
          </button>
        )}
        {card.status !== "IN_PROGRESS" && card.status !== "RESOLVED" && (
          <button
            onClick={() => handleMove("IN_PROGRESS")}
            disabled={isUpdating || isCreatingWorkflow}
            className="flex-1 px-2 py-1 text-[10px] font-medium bg-warning-bg text-warning-text rounded hover:bg-warning-bg/80 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <FiActivity className="w-3 h-3" />
            Start
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function SecurityPage() {
  const params = useParams();
  const envId = params.envId as string;

  const { 
    isScanning, 
    progress, 
    scanResult: contextScanResult, 
    environmentId: scanningEnvId,
    configureAndStartScan: contextStartScan,
  } = useScan();

  const [latestScan, setLatestScan] = useState<LatestScan | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [workflows, setWorkflows] = useState<Map<string, WorkflowItem>>(new Map());
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<ScanSeverity | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");

  const isScanningThisEnv = isScanning && scanningEnvId === envId;

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [latest, history] = await Promise.all([
        getLatestScan(envId).catch(() => null),
        getScanHistory(envId, 10),
      ]);
      setLatestScan(latest?.data || null);
      setScanHistory(history.data);
      
      const [workflowsRes, statsRes] = await Promise.all([
        getWorkflows(envId),
        getWorkflowStats(envId),
      ]);
      
      if (workflowsRes.data) {
        const map = new Map<string, WorkflowItem>();
        workflowsRes.data.forEach(w => {
          map.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w);
        });
        setWorkflows(map);
      }
      
      if (statsRes.data) {
        setWorkflowStats(statsRes.data);
      }
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [envId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (contextScanResult && scanningEnvId === envId) {
      loadData();
    }
  }, [contextScanResult, scanningEnvId, envId, loadData]);

  const handleStatusChange = async (workflowId: string, newStatus: VulnStatus) => {
    try {
      const response = await updateWorkflow(workflowId, { status: newStatus });
      if (response.data) {
        const w = response.data;
        setWorkflows(prev => new Map(prev.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w)));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const getWorkflowForVuln = (vulnId: string, assetId: string, cpeName: string) => {
    return workflows.get(`${vulnId}-${assetId}-${cpeName}`);
  };

  const severityCounts: Record<ScanSeverity, number> = {
    CRITICAL: latestScan?.criticalCount || 0,
    HIGH: latestScan?.highCount || 0,
    MEDIUM: latestScan?.mediumCount || 0,
    LOW: latestScan?.lowCount || 0,
    UNKNOWN: 0,
  };

  const filteredAssetScans = useMemo(() => {
    let filtered = latestScan?.assetScans || [];
    
    if (selectedSeverity) {
      filtered = filtered.filter(assetScan => 
        assetScan.vulnerabilities.some(v => v.vulnerability.severity === selectedSeverity)
      );
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(assetScan => 
        assetScan.asset.name.toLowerCase().includes(query) ||
        assetScan.vulnerabilities.some(v => 
          v.vulnerability.cveId.toLowerCase().includes(query) ||
          v.vulnerability.description.toLowerCase().includes(query)
        )
      );
    }
    
    return filtered;
  }, [latestScan?.assetScans, selectedSeverity, searchQuery]);

  const riskScore = latestScan?.riskScore ? Math.round((10 - latestScan.riskScore) * 10) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-32 bg-surface rounded-xl border border-border" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-28 bg-surface rounded-xl border border-border" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary">Security Overview</h1>
              <p className="text-text-muted text-sm mt-0.5">
                {latestScan?.completedAt
                  ? `Last scan: ${new Date(latestScan.completedAt).toLocaleString()}`
                  : "No scans performed yet"
                }
              </p>
            </div>
            <button
              onClick={() => contextStartScan(envId)}
              disabled={isScanningThisEnv}
              className="px-4 py-2 bg-text-primary text-surface rounded-lg font-medium hover:bg-text-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {isScanningThisEnv ? (
                <>
                  <div className="w-4 h-4 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                  Scanning...
                </>
              ) : (
                <>
                  <FiRefreshCw className="w-4 h-4" />
                  Run Scan
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Scanning Progress - Always visible */}
        {isScanningThisEnv && <ScanningProgress progress={progress} />}

        {/* View Tabs - Moved up, Board is default */}
        {latestScan && (
          <div className="flex items-center gap-2 border-b border-border">
            {[
              { id: "board", label: "Board", icon: FiLayout },
              { id: "assets", label: "By Asset", icon: FiServer },
              { id: "list", label: "List", icon: FiLayers },
              { id: "overview", label: "Overview", icon: FiPieChart },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as ViewMode)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  viewMode === tab.id
                    ? "border-text-primary text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Vulnerabilities Section */}
        {latestScan ? (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-text-secondary">Filter:</span>
              {(Object.keys(SEVERITY_CONFIG) as ScanSeverity[]).map(severity => (
                severityCounts[severity] > 0 && (
                  <SeverityBadge
                    key={severity}
                    severity={severity}
                    count={severityCounts[severity]}
                    onClick={() => setSelectedSeverity(selectedSeverity === severity ? null : severity)}
                    isActive={selectedSeverity === severity}
                  />
                )
              ))}
              {selectedSeverity && (
                <button
                  onClick={() => setSelectedSeverity(null)}
                  className="text-sm text-text-muted hover:text-text-primary font-medium flex items-center gap-1"
                >
                  <FiXCircle className="w-4 h-4" />
                  Clear
                </button>
              )}
              
              <div className="flex-1" />
              
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search CVEs, assets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1/20 focus:border-brand-1 transition-all w-64"
                />
              </div>
            </div>

            {/* Content based on view mode */}
            {viewMode === "assets" && (
              filteredAssetScans.length > 0 ? (
                <div className="space-y-3">
                  {filteredAssetScans.map(assetScan => (
                    <AssetAccordion
                      key={assetScan.id}
                      assetScan={assetScan}
                      getWorkflowForVuln={getWorkflowForVuln}
                      onStatusChange={handleStatusChange}
                    />
                  ))}
                </div>
              ) : (
                <Card className="p-12 text-center">
                  <FiSearch className="w-10 h-10 text-text-muted mx-auto mb-3" />
                  <p className="text-text-secondary">No vulnerabilities match your filters.</p>
                  <button
                    onClick={() => { setSelectedSeverity(null); setSearchQuery(""); }}
                    className="text-sm text-text-primary hover:underline mt-2"
                  >
                    Clear all filters
                  </button>
                </Card>
              )
            )}

            {viewMode === "list" && (
              <Card padding="none">
                <VulnerabilityTable
                  vulnerabilities={filteredAssetScans.flatMap(a => 
                    a.vulnerabilities.map(v => ({ ...v, assetId: a.asset.id }))
                  )}
                  getWorkflowForVuln={getWorkflowForVuln}
                  onStatusChange={handleStatusChange}
                  assetId=""
                />
              </Card>
            )}

            {viewMode === "board" && (
              <BoardView
                assetScans={filteredAssetScans}
                workflows={workflows}
                onStatusChange={handleStatusChange}
                environmentId={envId}
                onWorkflowCreated={(workflow) => {
                  // Add new workflow to the map
                  setWorkflows(prev => new Map(prev.set(`${workflow.vulnerabilityId}-${workflow.assetId}-${workflow.cpeName}`, workflow)));
                }}
              />
            )}

            {viewMode === "overview" && (
              <div className="space-y-6">
                {/* Stats Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card className="flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-text-muted text-sm font-medium mb-3">Security Score</p>
                      <div className="flex justify-center">
                        <SecurityScoreRing score={riskScore} size={100} strokeWidth={6} />
                      </div>
                    </div>
                  </Card>
                  
                  <StatCard
                    title="Total Vulnerabilities"
                    value={latestScan?.vulnerabilitiesFound || 0}
                    subtitle="Across all assets"
                    trend={scanHistory.length > 1 ? "up" : "neutral"}
                    icon={FiShield}
                    colorClass="bg-info-bg text-info-text"
                  />
                  <StatCard
                    title="Open Issues"
                    value={workflowStats?.open || 0}
                    subtitle="Need attention"
                    trend={workflowStats && workflowStats.open > 5 ? "up" : "stable"}
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
                      critical={severityCounts.CRITICAL}
                      high={severityCounts.HIGH}
                      medium={severityCounts.MEDIUM}
                      low={severityCounts.LOW}
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
            )}
          </div>
        ) : (
          <EmptyState onScan={() => contextStartScan(envId)} />
        )}
      </div>
    </div>
  );
}
