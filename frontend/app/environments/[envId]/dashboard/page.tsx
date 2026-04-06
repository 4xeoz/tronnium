"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FiBox,
  FiServer,
  FiPlus,
  FiCpu,
  FiChevronRight,
  FiDatabase,
  FiWifi,
  FiHardDrive,
  FiSearch,
  FiShield,
  FiAlertTriangle,
  FiActivity,
  FiBarChart2,
  FiClock,
  FiPlay,
  FiMap,
  FiZap,
  FiTrendingUp,
  FiCheckCircle,
  FiXCircle,
  FiCode,
  FiAlertOctagon,
  FiUserX,
  FiList,
} from "react-icons/fi";
import { getEnvironment, getAssets, type Environment, type Asset } from "@/lib/api";
import { getLatestScan, getScanHistory, getRiskLevel, useScan, useUser, type LatestScan, type ScanHistoryItem } from "@/lib/api";
import { getWorkflowStats, getWorkflows, type WorkflowStats, type WorkflowItem, type VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import { getDaysOpen, getSlaStatus } from "@/lib/vulnAge";
import AddAssetSlideOver from "@/components/assets/AddAssetSlideOver";
import AssetDetailsSlideOver from "@/components/assets/AssetDetailsSlideOver";
import DevModeModal from "@/components/dev/DevModeModal";

// ============== Shared helpers ==============

const typeIcons: Record<string, React.ElementType> = {
  server: FiServer,
  database: FiDatabase,
  network: FiWifi,
  iot: FiHardDrive,
  unknown: FiCpu,
};

function StatCard({
  icon,
  label,
  value,
  sub,
  colorClass = "text-brand-1",
  trend,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  colorClass?: string;
  trend?: "up" | "down" | "neutral";
  onClick?: () => void;
}) {
  const CardWrapper = onClick ? "button" : "div";
  return (
    <CardWrapper
      onClick={onClick}
      className={`bg-surface rounded-xl border border-border p-4 text-left transition-all ${
        onClick ? "hover:border-brand-1/50 hover:shadow-sm cursor-pointer" : ""
      }`}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-brand-1/10 rounded-lg flex items-center justify-center">
          <span className={colorClass}>{icon}</span>
        </div>
        <span className="text-text-secondary text-sm">{label}</span>
        {trend && (
          <span className={`text-xs ${trend === "up" ? "text-success-text" : trend === "down" ? "text-error-text" : "text-text-muted"}`}>
            <FiTrendingUp className={`w-3 h-3 inline ${trend === "down" ? "rotate-180" : ""}`} />
          </span>
        )}
      </div>
      <span className="text-2xl font-bold text-text-primary">{value}</span>
      {sub && <span className="text-xs text-text-muted ml-2">{sub}</span>}
    </CardWrapper>
  );
}

function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
      {action}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center">
      <div className="w-14 h-14 bg-surface-secondary rounded-full flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-text-secondary text-sm mb-4 max-w-sm mx-auto">{description}</p>
      {action}
    </div>
  );
}

// Security Score Ring Component
function SecurityScoreRing({ score, size = 80 }: { score: number | null; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = score !== null ? Math.min(100, Math.max(0, score)) : 0;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const { color, label } = score !== null 
    ? score < 20 ? { color: "#22c55e", label: "Low" }
      : score < 40 ? { color: "#eab308", label: "Moderate" }
      : score < 60 ? { color: "#f97316", label: "High" }
      : { color: "#ef4444", label: "Critical" }
    : { color: "#6b7280", label: "N/A" };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-surface-secondary"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={score !== null ? strokeDashoffset : circumference}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-text-primary">{score !== null ? score.toFixed(0) : "--"}</span>
        <span className="text-[9px] text-text-muted uppercase">{label}</span>
      </div>
    </div>
  );
}

// Vulnerability Bar Chart
function VulnBarChart({ critical, high, medium, low }: { critical: number; high: number; medium: number; low: number }) {
  const total = critical + high + medium + low || 1;
  const maxVal = Math.max(critical, high, medium, low, 1);
  
  const bars = [
    { label: "Critical", value: critical, color: "bg-red-500", textColor: "text-red-500" },
    { label: "High", value: high, color: "bg-orange-500", textColor: "text-orange-500" },
    { label: "Medium", value: medium, color: "bg-yellow-500", textColor: "text-yellow-500" },
    { label: "Low", value: low, color: "bg-blue-500", textColor: "text-blue-500" },
  ];

  return (
    <div className="space-y-2">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-3">
          <span className="text-xs text-text-muted w-14">{bar.label}</span>
          <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
            <div
              className={`h-full ${bar.color} rounded-full transition-all duration-500`}
              style={{ width: `${(bar.value / maxVal) * 100}%` }}
            />
          </div>
          <span className={`text-xs font-medium ${bar.textColor} w-6 text-right`}>{bar.value}</span>
        </div>
      ))}
    </div>
  );
}

// Asset Type Distribution
function AssetTypeDistribution({ assets }: { assets: Asset[] }) {
  const typeCount = assets.reduce((acc, asset) => {
    acc[asset.type] = (acc[asset.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const types = Object.entries(typeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const total = assets.length || 1;

  return (
    <div className="space-y-2">
      {types.map(([type, count]) => {
        const Icon = typeIcons[type] || typeIcons.unknown;
        return (
          <div key={type} className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-secondary capitalize flex-1">{type}</span>
            <div className="flex-1 h-1.5 bg-surface-secondary rounded-full overflow-hidden max-w-[100px]">
              <div
                className="h-full bg-brand-1/60 rounded-full"
                style={{ width: `${(count / total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-text-muted w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
const SEVERITY_BADGE: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: "bg-red-500",    text: "text-white" },
  HIGH:     { bg: "bg-orange-500", text: "text-white" },
  MEDIUM:   { bg: "bg-yellow-500", text: "text-black" },
  LOW:      { bg: "bg-blue-400",   text: "text-white" },
};

// ============== Asset Card (grid item) ==============

function AssetCard({
  asset,
  onClick,
  vulnCount,
  highestSeverity,
  wasScanned,
}: {
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

  return (
    <button
      onClick={onClick}
      className={`w-full bg-surface rounded-xl border p-4 text-left hover:shadow-sm transition-all group ${
        highestSeverity === "CRITICAL" ? "border-red-500/40 hover:border-red-500/70" :
        highestSeverity === "HIGH"     ? "border-orange-500/40 hover:border-orange-500/70" :
        isSecure                       ? "border-green-500/30 hover:border-green-500/50" :
        "border-border hover:border-border-secondary"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            highestSeverity === "CRITICAL" ? "bg-red-500/10" :
            highestSeverity === "HIGH"     ? "bg-orange-500/10" :
            isSecure                       ? "bg-green-500/10" :
            "bg-surface-secondary"
          }`}>
            <Icon className={`w-5 h-5 ${
              highestSeverity === "CRITICAL" ? "text-red-500" :
              highestSeverity === "HIGH"     ? "text-orange-500" :
              isSecure                       ? "text-green-500" :
              "text-text-muted"
            }`} />
          </div>
          <div>
            <div className="font-medium text-text-primary text-sm">{asset.name}</div>
            <div className="text-xs text-text-muted capitalize">{asset.type}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: isActive ? "var(--status-active)" : "var(--status-inactive)" }}
            />
            <span className="text-[10px] text-text-muted capitalize">{asset.status || "unknown"}</span>
          </div>
          {vulnCount !== undefined && vulnCount > 0 && highestSeverity && SEVERITY_BADGE[highestSeverity] ? (
            <span className={`px-1.5 py-0.5 text-[9px] rounded font-bold ${SEVERITY_BADGE[highestSeverity].bg} ${SEVERITY_BADGE[highestSeverity].text}`}>
              {highestSeverity === "CRITICAL" ? "CRIT" : highestSeverity} · {vulnCount}
            </span>
          ) : isSecure ? (
            <span className="px-1.5 py-0.5 bg-green-500/15 text-green-600 text-[9px] rounded font-medium flex items-center gap-0.5">
              <FiCheckCircle className="w-2.5 h-2.5" /> Secure
            </span>
          ) : null}
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          asset.domain === "IT" ? "bg-info-bg text-info-text" :
          asset.domain === "OT" ? "bg-warning-bg text-warning-text" :
          "bg-surface-secondary text-text-muted"
        }`}>
          {asset.domain}
        </span>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          cpeList.length > 0 ? "bg-success-bg text-success-text" : "bg-surface-secondary text-text-muted"
        }`}>
          {cpeList.length > 0 ? `${cpeList.length} CPE${cpeList.length > 1 ? "s" : ""}` : "No CPE"}
        </span>
      </div>

      {cpeList.length > 0 && (
        <div className="text-[10px] text-text-muted font-mono truncate bg-surface-secondary rounded px-2 py-1">
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

// ============== Main Page ==============

export default function EnvironmentDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const envId = params.envId as string;

  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  
  // Security data
  const [latestScan, setLatestScan] = useState<LatestScan | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats | null>(null);
  const [allWorkflows, setAllWorkflows] = useState<WorkflowItem[]>([]);
  const [showAllAssets, setShowAllAssets] = useState(false);
  
  // Scan context for live updates
  const { isScanning, progress, scanResult: contextScanResult, environmentId: scanningEnvId, configureAndStartScan: contextStartScan } = useScan();
  const isScanningThisEnv = isScanning && scanningEnvId === envId;
  
  // User context for dev mode
  const { user } = useUser();

  const loadEnvironment = useCallback(async () => {
    try {
      setError(null);
      const [envData, assetsData, scanData, historyData, statsData, wfsData] = await Promise.all([
        getEnvironment(envId),
        getAssets(envId),
        getLatestScan(envId).catch(() => null),
        getScanHistory(envId, 5).catch(() => ({ data: [] })),
        getWorkflowStats(envId).catch(() => null),
        getWorkflows(envId).catch(() => null),          // ALL workflows for status lookup
      ]);
      setEnvironment(envData.data);
      setAssets(assetsData.data);
      setLatestScan(scanData?.data || null);
      setScanHistory(historyData.data);
      if (statsData?.data) setWorkflowStats(statsData.data);
      if (wfsData?.data) setAllWorkflows(wfsData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load environment");
    } finally {
      setIsLoading(false);
    }
  }, [envId]);

  useEffect(() => {
    loadEnvironment();
  }, [loadEnvironment]);

  // Refresh when context scan completes
  useEffect(() => {
    if (contextScanResult && scanningEnvId === envId) {
      loadEnvironment();
    }
  }, [contextScanResult, scanningEnvId, envId, loadEnvironment]);

  // Calculate stats
  const assetsWithCPEs = assets.filter((a) => Array.isArray(a.cpes) && a.cpes.length > 0).length;
  const activeAssets = assets.filter((a) => a.status === "active").length;

  // Build workflow status lookup: "vulnId-assetId-cpeName" → status
  const INACTIVE: Set<VulnStatus> = new Set(["RESOLVED", "FALSE_POSITIVE", "RISK_ACCEPTED"]);
  const wfStatusLookup = new Map<string, VulnStatus>();
  allWorkflows.forEach(w => wfStatusLookup.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w.status));

  // Per-asset vuln data filtered to ACTIVE threats only
  const assetVulnMap = latestScan?.assetScans?.reduce((acc, as) => {
    let highest: string | null = null;
    let count = 0;
    for (const v of as.vulnerabilities || []) {
      const key = `${v.vulnerability.id}-${as.asset.id}-${v.cpeName}`;
      const wfStatus = wfStatusLookup.get(key);
      if (wfStatus && INACTIVE.has(wfStatus)) continue;   // skip resolved/accepted
      count++;
      const sev = v.vulnerability.severity;
      if (!highest || (SEVERITY_ORDER[sev] ?? 0) > (SEVERITY_ORDER[highest] ?? 0)) highest = sev;
    }
    acc[as.asset.id] = { count, highestSeverity: highest };
    return acc;
  }, {} as Record<string, { count: number; highestSeverity: string | null }>) || {};

  // Active (non-resolved) vuln counts for VulnBarChart
  const activeVulnCounts = latestScan?.assetScans?.reduce((acc, as) => {
    as.vulnerabilities?.forEach(v => {
      const key = `${v.vulnerability.id}-${as.asset.id}-${v.cpeName}`;
      const wfStatus = wfStatusLookup.get(key);
      if (wfStatus && INACTIVE.has(wfStatus)) return;
      const sev = v.vulnerability.severity;
      if (sev === "CRITICAL") acc.critical++;
      else if (sev === "HIGH") acc.high++;
      else if (sev === "MEDIUM") acc.medium++;
      else if (sev === "LOW") acc.low++;
    });
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0 }) || { critical: 0, high: 0, medium: 0, low: 0 };

  const totalActiveThreats = activeVulnCounts.critical + activeVulnCounts.high + activeVulnCounts.medium + activeVulnCounts.low;

  // Derived from allWorkflows
  const openWorkflows = allWorkflows.filter(w => w.status === "OPEN");
  const overdueCount = openWorkflows.filter(w => getSlaStatus(getDaysOpen(w.firstSeenAt), w.severity) === "overdue").length;
  const unassignedCriticalHigh = openWorkflows.filter(w => !w.assigneeId && (w.severity === "CRITICAL" || w.severity === "HIGH")).length;

  // Attention items — things a SOC analyst must act on now
  const attentionItems: { icon: React.ElementType; text: string; cta: string; urgent: boolean }[] = [];
  if (!latestScan) attentionItems.push({ icon: FiShield, text: "No security scan has been run yet", cta: "Run Scan", urgent: true });
  if (overdueCount > 0) attentionItems.push({ icon: FiAlertOctagon, text: `${overdueCount} vulnerabilit${overdueCount > 1 ? "ies are" : "y is"} past SLA deadline`, cta: "View overdue", urgent: true });
  if (unassignedCriticalHigh > 0) attentionItems.push({ icon: FiUserX, text: `${unassignedCriticalHigh} Critical/High vuln${unassignedCriticalHigh > 1 ? "s" : ""} unassigned`, cta: "Assign", urgent: false });
  if (assets.length > 0 && assetsWithCPEs < assets.length) attentionItems.push({ icon: FiCpu, text: `${assets.length - assetsWithCPEs} asset${assets.length - assetsWithCPEs > 1 ? "s" : ""} missing CPE — won't be scanned`, cta: "Review", urgent: false });

  // Sort assets: most at-risk first
  const sortedAssets = [...assets].sort((a, b) => {
    const aData = assetVulnMap[a.id];
    const bData = assetVulnMap[b.id];
    const aSev = SEVERITY_ORDER[aData?.highestSeverity ?? ""] ?? -1;
    const bSev = SEVERITY_ORDER[bData?.highestSeverity ?? ""] ?? -1;
    if (bSev !== aSev) return bSev - aSev;
    return (bData?.count ?? 0) - (aData?.count ?? 0);
  });

  const filteredAssets = assetSearch
    ? sortedAssets.filter(a =>
        a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
        a.type.toLowerCase().includes(assetSearch.toLowerCase())
      )
    : sortedAssets;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !environment) {
    return (
      <div className="p-8">
        <div className="bg-error-bg border border-error-border rounded-lg p-6 text-center">
          <p className="text-error-text">{error || "Environment not found"}</p>
          <button
            onClick={loadEnvironment}
            className="mt-4 px-4 py-2 bg-surface-secondary text-text-primary rounded-lg hover:bg-surface transition-colors border border-border"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-brand-1/10 rounded-xl flex items-center justify-center">
            <FiBox className="w-6 h-6 text-brand-1" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-text-primary">{environment.name}</h1>
            {environment.description && (
              <p className="text-text-secondary text-sm mt-0.5">{environment.description}</p>
            )}
            {environment.labels && environment.labels.length > 0 && (
              <div className="flex gap-2 mt-2">
                {environment.labels.map((label) => (
                  <span
                    key={label}
                    className="px-2.5 py-0.5 bg-surface-secondary text-text-secondary text-xs rounded-full"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!user?.devMode && (
            <button
              onClick={() => setIsDevModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 rounded-lg text-sm font-medium transition-colors border border-purple-500/30"
              title="Enable Developer Mode"
            >
              <FiCode className="w-4 h-4" />
              Dev
            </button>
          )}
          <button
            onClick={() => router.push(`/environments/${envId}/map`)}
            className="flex items-center gap-2 px-3 py-2 bg-surface-secondary text-text-secondary rounded-lg text-sm font-medium hover:bg-surface transition-colors border border-border"
          >
            <FiMap className="w-4 h-4" />
            Map View
          </button>
          <button
            onClick={() => setIsAddAssetOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
          >
            <FiPlus className="w-4 h-4" />
            Add Asset
          </button>
        </div>
      </div>

      {/* Needs Attention Banner */}
      {attentionItems.length > 0 && (
        <div className={`rounded-xl border p-4 flex flex-col gap-2 ${attentionItems.some(i => i.urgent) ? "bg-error-bg border-error-border" : "bg-warning-bg border-warning-border"}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${attentionItems.some(i => i.urgent) ? "text-error-text" : "text-warning-text"}`}>
            Needs Attention
          </p>
          {attentionItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <item.icon className={`w-4 h-4 shrink-0 ${item.urgent ? "text-error-text" : "text-warning-text"}`} />
                <span className="text-sm text-text-primary">{item.text}</span>
              </div>
              <button
                onClick={() => item.cta === "Run Scan" ? contextStartScan(envId) : router.push(`/environments/${envId}/security`)}
                className={`shrink-0 text-xs font-medium px-3 py-1 rounded-lg border transition-colors ${
                  item.urgent
                    ? "bg-error-text text-white hover:opacity-90 border-transparent"
                    : "bg-surface text-text-primary hover:bg-surface-secondary border-border"
                }`}
              >
                {item.cta}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Dashboard Grid - Scrollable Sections */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Left Column - Asset Stats */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<FiServer className="w-5 h-5 text-brand-1" />}
              label="Total Assets"
              value={assets.length}
              sub={`${activeAssets} active`}
            />
            <StatCard
              icon={<FiCpu className="w-5 h-5 text-brand-1" />}
              label="CPE Coverage"
              value={`${assets.length > 0 ? Math.round((assetsWithCPEs / assets.length) * 100) : 0}%`}
              sub={`${assetsWithCPEs} of ${assets.length}`}
              trend={assetsWithCPEs === assets.length ? "up" : "neutral"}
            />
            <StatCard
              icon={<FiAlertTriangle className="w-5 h-5 text-error-text" />}
              label="Active Threats"
              value={totalActiveThreats}
              sub={totalActiveThreats === 0 ? "all clear" : `${activeVulnCounts.critical} critical`}
              colorClass={totalActiveThreats > 0 ? "text-error-text" : "text-success-text"}
              onClick={totalActiveThreats > 0 ? () => router.push(`/environments/${envId}/security`) : undefined}
            />
            <StatCard
              icon={<FiList className="w-5 h-5 text-warning-text" />}
              label="Open Workflows"
              value={workflowStats?.open ?? 0}
              sub={overdueCount > 0 ? `${overdueCount} overdue` : "on track"}
              colorClass={overdueCount > 0 ? "text-error-text" : "text-warning-text"}
              onClick={() => router.push(`/environments/${envId}/security`)}
            />
          </div>

          {/* All-clear banner when scan ran with zero active threats */}
          {latestScan && totalActiveThreats === 0 && assets.length > 0 && (
            <div className="flex items-center gap-4 bg-success-bg border border-success-border rounded-xl px-5 py-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                <FiCheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-success-text text-sm">Environment is secure</p>
                <p className="text-success-text/70 text-xs mt-0.5">
                  All {latestScan.vulnerabilitiesFound > 0 ? `${latestScan.vulnerabilitiesFound} detected` : ""} vulnerabilities are resolved or accepted.
                  Last scan {new Date(latestScan.completedAt || "").toLocaleDateString()}.
                </p>
              </div>
              <button
                onClick={() => contextStartScan(envId)}
                className="ml-auto shrink-0 text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-700 hover:bg-green-500/30 transition-colors font-medium"
              >
                Rescan
              </button>
            </div>
          )}

          {/* Asset List Section - Scrollable */}
          <div className="flex-1 bg-surface rounded-xl border border-border overflow-hidden flex flex-col min-h-0">
            <div className="p-4 border-b border-border">
              <SectionHeader
                title="Assets"
                action={
                  <div className="flex items-center gap-3">
                    {assets.length > 0 && (
                      <div className="relative">
                        <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                        <input
                          type="text"
                          placeholder="Filter assets..."
                          value={assetSearch}
                          onChange={(e) => setAssetSearch(e.target.value)}
                          className="w-48 pl-8 pr-3 py-1.5 bg-surface-secondary border-0 rounded-lg text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border"
                        />
                      </div>
                    )}
                  </div>
                }
              />
            </div>

            {/* Asset Grid - Scrollable */}
            <div className="flex-1 p-4 overflow-y-auto">
              {filteredAssets.length === 0 ? (
                assets.length === 0 ? (
                  <EmptyState
                    icon={<FiServer className="w-6 h-6 text-text-muted" />}
                    title="No assets yet"
                    description="Add assets to this environment to start monitoring them."
                    action={
                      <button
                        onClick={() => setIsAddAssetOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
                      >
                        <FiPlus className="w-4 h-4" />
                        Add Asset
                      </button>
                    }
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-text-muted text-sm">
                      No assets match &quot;{assetSearch}&quot;
                    </p>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(showAllAssets ? filteredAssets : filteredAssets.slice(0, 6)).map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onClick={() => setSelectedAsset(asset)}
                      vulnCount={assetVulnMap[asset.id]?.count}
                      highestSeverity={assetVulnMap[asset.id]?.highestSeverity}
                      wasScanned={latestScan !== null}
                    />
                  ))}
                </div>
              )}

              {filteredAssets.length > 6 && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setShowAllAssets(v => !v)}
                    className="text-sm text-brand-1 hover:underline"
                  >
                    {showAllAssets ? "Show less" : `View all ${filteredAssets.length} assets`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Security & Insights - Scrollable */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-1">
          {/* Security Status Card - Fixed */}
          <div className="bg-surface rounded-xl border border-border p-5 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-text-primary flex items-center gap-2">
                <FiShield className="w-4 h-4 text-brand-1" />
                Security Status
              </h3>
              <div className="flex items-center gap-2">
                {overdueCount > 0 && (
                  <span
                    title={`${overdueCount} vuln${overdueCount > 1 ? "s" : ""} past SLA deadline`}
                    className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold"
                  >
                    {overdueCount} overdue
                  </span>
                )}
                {isScanningThisEnv && (
                  <span className="px-2 py-0.5 bg-brand-1/10 text-brand-1 text-xs rounded-full animate-pulse">
                    Scanning...
                  </span>
                )}
              </div>
            </div>

            {isScanningThisEnv ? (
              <div className="text-center py-4">
                <FiActivity className="w-8 h-8 text-brand-1 animate-pulse mx-auto mb-2" />
                <p className="text-sm text-text-secondary">{progress}</p>
              </div>
            ) : latestScan ? (
              <div className="space-y-4">
                {/* Score Ring */}
                <div className="flex items-center gap-4">
                  <SecurityScoreRing score={latestScan.riskScore} />
                  <div className="flex-1">
                    <div className="text-sm text-text-secondary">Risk Score</div>
                    <div className={`text-lg font-semibold ${getRiskLevel(latestScan.riskScore).color}`}>
                      {getRiskLevel(latestScan.riskScore).label}
                    </div>
                    <div className="text-xs text-text-muted mt-1">
                      Last scan: {new Date(latestScan.completedAt || "").toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Vulnerability Breakdown — active threats only */}
                {(activeVulnCounts.critical + activeVulnCounts.high + activeVulnCounts.medium + activeVulnCounts.low) > 0 ? (
                  <VulnBarChart
                    critical={activeVulnCounts.critical}
                    high={activeVulnCounts.high}
                    medium={activeVulnCounts.medium}
                    low={activeVulnCounts.low}
                  />
                ) : (
                  <div className="flex items-center gap-2 text-success-text bg-success-bg rounded-lg p-3">
                    <FiCheckCircle className="w-5 h-5" />
                    <span className="text-sm">No vulnerabilities detected</span>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => router.push(`/environments/${envId}/security`)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface-secondary text-text-secondary rounded-lg text-xs font-medium hover:bg-surface transition-colors border border-border"
                  >
                    View Details
                    <FiChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => contextStartScan(envId)}
                    disabled={isScanningThisEnv}
                    className="flex items-center justify-center gap-2 px-3 py-2 bg-brand-1 text-brand-2 rounded-lg text-xs font-medium hover:bg-brand-1/90 transition-colors disabled:opacity-50"
                  >
                    <FiPlay className="w-3 h-3" />
                    Rescan
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <FiShield className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary mb-3">No security scan yet</p>
                <button
                  onClick={() => contextStartScan(envId)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
                >
                  <FiZap className="w-4 h-4" />
                  Run First Scan
                </button>
              </div>
            )}
          </div>

          {/* Asset Type Distribution - Fixed */}
          <div className="bg-surface rounded-xl border border-border p-5 flex-shrink-0">
            <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
              <FiBarChart2 className="w-4 h-4 text-brand-1" />
              Asset Types
            </h3>
            <AssetTypeDistribution assets={assets} />
          </div>

          {/* Remediation Status */}
          {workflowStats && workflowStats.total > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5 flex-shrink-0">
              <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                <FiActivity className="w-4 h-4 text-brand-1" />
                Remediation
              </h3>
              <div className="space-y-2">
                {[
                  { label: "Open",        value: workflowStats.open,       bg: "bg-error-bg",    text: "text-error-text",    bar: "bg-red-500" },
                  { label: "In Progress", value: workflowStats.inProgress, bg: "bg-warning-bg",  text: "text-warning-text",  bar: "bg-amber-500" },
                  { label: "Resolved",    value: workflowStats.resolved,   bg: "bg-success-bg",  text: "text-success-text",  bar: "bg-green-500" },
                ].map(({ label, value, bg, text, bar }) => {
                  const pct = workflowStats.total > 0 ? (value / workflowStats.total) * 100 : 0;
                  return (
                    <div key={label} className="flex items-center gap-3">
                      <span className="text-xs text-text-muted w-20">{label}</span>
                      <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${bg} ${text} w-8 text-center`}>{value}</span>
                    </div>
                  );
                })}
              </div>
              <button
                onClick={() => router.push(`/environments/${envId}/security`)}
                className="w-full mt-4 text-xs text-brand-1 hover:underline flex items-center justify-center gap-1"
              >
                Manage workflows <FiChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Recent Activity - Fixed */}
          {scanHistory.length > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5 flex-shrink-0">
              <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                <FiClock className="w-4 h-4 text-brand-1" />
                Recent Scans
              </h3>
              <div className="space-y-3">
                {scanHistory.slice(0, 4).map((scan, idx) => {
                  const prev = scanHistory[idx + 1];
                  const delta = prev ? scan.vulnerabilitiesFound - prev.vulnerabilitiesFound : null;
                  return (
                    <div key={scan.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {scan.status === "COMPLETED" ? (
                          <FiCheckCircle className={`w-4 h-4 ${scan.vulnerabilitiesFound > 0 ? "text-warning-text" : "text-success-text"}`} />
                        ) : (
                          <FiXCircle className="w-4 h-4 text-error-text" />
                        )}
                        <span className="text-text-secondary">
                          {new Date(scan.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {scan.vulnerabilitiesFound > 0 && (
                          <span className="text-xs px-1.5 py-0.5 bg-error-bg text-error-text rounded">
                            {scan.vulnerabilitiesFound} vulns
                          </span>
                        )}
                        {delta !== null && delta !== 0 && (
                          <span className={`text-xs font-medium flex items-center gap-0.5 ${delta > 0 ? "text-error-text" : "text-success-text"}`}>
                            <FiTrendingUp className={`w-3 h-3 ${delta > 0 ? "" : "rotate-180"}`} />
                            {Math.abs(delta)}
                          </span>
                        )}
                        {scan.riskScore !== null && (
                          <span className={`text-xs font-medium ${getRiskLevel(scan.riskScore).color}`}>
                            {scan.riskScore.toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {scanHistory.length > 3 && (
                <button 
                  onClick={() => router.push(`/environments/${envId}/security`)}
                  className="w-full mt-3 text-xs text-brand-1 hover:underline"
                >
                  View all scan history
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Slide overs */}
      <AddAssetSlideOver
        isOpen={isAddAssetOpen}
        onClose={() => setIsAddAssetOpen(false)}
        onSuccess={loadEnvironment}
        environmentId={envId}
      />

      <AssetDetailsSlideOver
        asset={selectedAsset}
        isOpen={selectedAsset !== null}
        onClose={() => setSelectedAsset(null)}
        onAssetDeleted={(deletedAssetId) => {
          setAssets((prev) => prev.filter((a) => a.id !== deletedAssetId));
          setSelectedAsset(null);
        }}
      />

      {/* Dev Mode Modal */}
      <DevModeModal
        isOpen={isDevModalOpen}
        onClose={() => setIsDevModalOpen(false)}
      />
    </div>
  );
}
