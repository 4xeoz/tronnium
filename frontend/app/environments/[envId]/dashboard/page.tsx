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
} from "react-icons/fi";
import { getEnvironment, getAssets, type Environment, type Asset } from "@/lib/api";
import { getLatestScan, getScanHistory, getRiskLevel, useScan, useUser, type LatestScan, type ScanHistoryItem } from "@/lib/api";
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

// ============== Asset Card (grid item) ==============

function AssetCard({
  asset,
  onClick,
  vulnCount,
}: {
  asset: Asset;
  onClick: () => void;
  vulnCount?: number;
}) {
  const cpeList = Array.isArray(asset.cpes) ? asset.cpes : [];
  const Icon = typeIcons[asset.type] || typeIcons.unknown;
  const isActive = asset.status === "active";

  return (
    <button
      onClick={onClick}
      className="w-full bg-surface rounded-xl border border-border p-4 text-left hover:border-border-secondary hover:shadow-sm transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center">
            <Icon className="w-5 h-5 text-text-muted" />
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
              style={{
                backgroundColor: isActive
                  ? "var(--status-active)"
                  : "var(--status-inactive)",
              }}
            />
            <span className="text-[10px] text-text-muted capitalize">{asset.status || "unknown"}</span>
          </div>
          {vulnCount !== undefined && vulnCount > 0 && (
            <span className="px-1.5 py-0.5 bg-error-bg text-error-text text-[9px] rounded font-medium">
              {vulnCount} vuln{vulnCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 mb-3">
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            asset.domain === "IT"
              ? "bg-info-bg text-info-text"
              : asset.domain === "OT"
              ? "bg-warning-bg text-warning-text"
              : "bg-surface-secondary text-text-muted"
          }`}
        >
          {asset.domain}
        </span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
            cpeList.length > 0
              ? "bg-success-bg text-success-text"
              : "bg-surface-secondary text-text-muted"
          }`}
        >
          {cpeList.length > 0
            ? `${cpeList.length} CPE${cpeList.length > 1 ? "s" : ""}`
            : "No CPE"}
        </span>
      </div>

      {/* CPE name preview */}
      {cpeList.length > 0 && (
        <div className="text-[10px] text-text-muted font-mono truncate bg-surface-secondary rounded px-2 py-1">
          {cpeList[0].cpeName}
        </div>
      )}

      {/* Hover indicator */}
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
  
  // Scan context for live updates
  const { isScanning, progress, scanResult: contextScanResult, environmentId: scanningEnvId, configureAndStartScan: contextStartScan } = useScan();
  const isScanningThisEnv = isScanning && scanningEnvId === envId;
  
  // User context for dev mode
  const { user } = useUser();

  const loadEnvironment = useCallback(async () => {
    try {
      setError(null);
      const [envData, assetsData, scanData, historyData] = await Promise.all([
        getEnvironment(envId),
        getAssets(envId),
        getLatestScan(envId).catch(() => null),
        getScanHistory(envId, 5).catch(() => ({ data: [] })),
      ]);
      setEnvironment(envData.data);
      setAssets(assetsData.data);
      setLatestScan(scanData?.data || null);
      setScanHistory(historyData.data);
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

  // Filter assets
  const filteredAssets = assetSearch
    ? assets.filter(
        (a) =>
          a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
          a.type.toLowerCase().includes(assetSearch.toLowerCase())
      )
    : assets;

  // Calculate stats
  const assetsWithCPEs = assets.filter((a) => Array.isArray(a.cpes) && a.cpes.length > 0).length;
  const itAssets = assets.filter((a) => a.domain === "IT").length;
  const otAssets = assets.filter((a) => a.domain === "OT").length;
  const activeAssets = assets.filter((a) => a.status === "active").length;
  
  // Get vulnerability count per asset from latest scan
  const assetVulnMap = latestScan?.assetScans?.reduce((acc, as) => {
    acc[as.asset.id] = as.vulnerabilities?.length || 0;
    return acc;
  }, {} as Record<string, number>) || {};

  // Recent scans trend
  const recentScans = scanHistory.slice(0, 3);
  const hasVulnTrend = recentScans.length >= 2 
    ? recentScans[0].vulnerabilitiesFound - recentScans[1].vulnerabilitiesFound 
    : 0;

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

      {/* Main Dashboard Grid - Scrollable Sections */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        {/* Left Column - Asset Stats */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          {/* Quick Stats Row - Fixed height */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 ">
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
              icon={<FiDatabase className="w-5 h-5 text-info-text" />}
              label="IT Assets"
              value={itAssets}
              sub={`${assets.length > 0 ? Math.round((itAssets / assets.length) * 100) : 0}%`}
            />
            <StatCard
              icon={<FiHardDrive className="w-5 h-5 text-warning-text" />}
              label="OT Assets"
              value={otAssets}
              sub={`${assets.length > 0 ? Math.round((otAssets / assets.length) * 100) : 0}%`}
            />
          </div>

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
                  {filteredAssets.slice(0, 6).map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onClick={() => setSelectedAsset(asset)}
                      vulnCount={assetVulnMap[asset.id]}
                    />
                  ))}
                </div>
              )}
              
              {filteredAssets.length > 6 && (
                <div className="mt-4 text-center">
                  <button 
                    onClick={() => {/* TODO: Show all assets in modal or expand */}}
                    className="text-sm text-brand-1 hover:underline"
                  >
                    View all {filteredAssets.length} assets
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
              {isScanningThisEnv && (
                <span className="px-2 py-0.5 bg-brand-1/10 text-brand-1 text-xs rounded-full animate-pulse">
                  Scanning...
                </span>
              )}
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

                {/* Vulnerability Breakdown */}
                {latestScan.vulnerabilitiesFound > 0 ? (
                  <VulnBarChart
                    critical={latestScan.criticalCount}
                    high={latestScan.highCount}
                    medium={latestScan.mediumCount}
                    low={latestScan.lowCount}
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

          {/* Recent Activity - Fixed */}
          {scanHistory.length > 0 && (
            <div className="bg-surface rounded-xl border border-border p-5 flex-shrink-0">
              <h3 className="font-semibold text-text-primary mb-4 flex items-center gap-2">
                <FiClock className="w-4 h-4 text-brand-1" />
                Recent Scans
              </h3>
              <div className="space-y-3">
                {scanHistory.slice(0, 3).map((scan, idx) => (
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
                      {scan.riskScore !== null && (
                        <span className={`text-xs font-medium ${getRiskLevel(scan.riskScore).color}`}>
                          {scan.riskScore.toFixed(0)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
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
