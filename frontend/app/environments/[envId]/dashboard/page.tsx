"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FiBox, FiServer, FiPlus, FiCpu, FiChevronRight, FiDatabase, FiWifi, FiHardDrive,
  FiSearch, FiShield, FiAlertTriangle, FiBarChart2, FiClock, FiPlay,
  FiMap, FiZap, FiCheckCircle, FiXCircle, FiCode, FiAlertOctagon,
  FiUserX, FiList,
} from "react-icons/fi";
import { getEnvironment, getAssets, type Environment, type Asset } from "@/lib/api";
import { useScan, useUser } from "@/lib/api";
import { getDashboardOverview, type DashboardOverview } from "@/lib/api/dashboard";
import AddAssetSlideOver from "@/components/assets/AddAssetSlideOver";
import AssetDetailsSlideOver from "@/components/assets/AssetDetailsSlideOver";
import DevModeModal from "@/components/dev/DevModeModal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";

const typeIcons: Record<string, React.ElementType> = {
  server: FiServer,
  database: FiDatabase,
  network: FiWifi,
  iot: FiHardDrive,
  unknown: FiCpu,
};

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
const SEVERITY_BADGE: Record<string, { variant: "error" | "warning" | "info" | "success"; text: string }> = {
  CRITICAL: { variant: "error", text: "CRIT" },
  HIGH:     { variant: "warning", text: "HIGH" },
  MEDIUM:   { variant: "info", text: "MED" },
  LOW:      { variant: "success", text: "LOW" },
};

function RiskSentence({ stats }: { stats: DashboardOverview["severityCounts"] }) {
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

function VulnBarChart({ critical, high, medium, low }: { critical: number; high: number; medium: number; low: number }) {
  const maxVal = Math.max(critical, high, medium, low, 1);
  const bars = [
    { label: "Critical", value: critical, color: "bg-error-text", text: "text-error-text" },
    { label: "High", value: high, color: "bg-warning-text", text: "text-warning-text" },
    { label: "Medium", value: medium, color: "bg-info-text", text: "text-info-text" },
    { label: "Low", value: low, color: "bg-success-text", text: "text-success-text" },
  ];

  return (
    <div className="space-y-2">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-3">
          <span className="text-xs text-text-muted w-14">{bar.label}</span>
          <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
            <div className={`h-full ${bar.color} rounded-full transition-all duration-500`} style={{ width: `${(bar.value / maxVal) * 100}%` }} />
          </div>
          <span className={`text-xs font-semibold ${bar.text} w-6 text-right`}>{bar.value}</span>
        </div>
      ))}
    </div>
  );
}

function AssetTypeDistribution({ assets }: { assets: Asset[] }) {
  const typeCount = assets.reduce((acc, asset) => {
    acc[asset.type] = (acc[asset.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const types = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
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
              <div className="h-full bg-brand-1/60 rounded-full" style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <span className="text-xs text-text-muted w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function AssetCard({ asset, onClick, vulnCount, highestSeverity, wasScanned }: {
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
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [autoScanFrequency, setAutoScanFrequency] = useState("24");

  const { isScanning, progress, scanResult: contextScanResult, environmentId: scanningEnvId, configureAndStartScan: contextStartScan } = useScan();
  const isScanningThisEnv = isScanning && scanningEnvId === envId;
  const { user } = useUser();

  const loadEnvironment = useCallback(async () => {
    try {
      setError(null);
      const [envData, assetsData, overviewData] = await Promise.all([
        getEnvironment(envId),
        getAssets(envId),
        getDashboardOverview(envId).catch(() => null),
      ]);
      setEnvironment(envData.data);
      setAssets(assetsData.data);
      if (overviewData?.data) setOverview(overviewData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load environment");
    } finally {
      setIsLoading(false);
    }
  }, [envId]);

  useEffect(() => { loadEnvironment(); }, [loadEnvironment]);
  useEffect(() => { if (contextScanResult && scanningEnvId === envId) loadEnvironment(); }, [contextScanResult, scanningEnvId, envId, loadEnvironment]);

  const assetsWithCPEs = assets.filter((a) => Array.isArray(a.cpes) && a.cpes.length > 0).length;
  const activeAssets = assets.filter((a) => a.status === "active").length;

  const attentionItems: { icon: React.ElementType; text: string; cta: string; urgent: boolean }[] = [];
  if (!overview?.latestScan) attentionItems.push({ icon: FiShield, text: "No security scan has been run yet", cta: "Run Scan", urgent: true });
  if ((overview?.overdue ?? 0) > 0) attentionItems.push({ icon: FiAlertOctagon, text: `${overview!.overdue} vulnerabilit${overview!.overdue > 1 ? "ies are" : "y is"} past SLA deadline`, cta: "View overdue", urgent: true });
  if ((overview?.unassignedCriticalHigh ?? 0) > 0) attentionItems.push({ icon: FiUserX, text: `${overview!.unassignedCriticalHigh} Critical/High vuln${overview!.unassignedCriticalHigh > 1 ? "s" : ""} unassigned`, cta: "Assign", urgent: false });
  if (assets.length > 0 && assetsWithCPEs < assets.length) attentionItems.push({ icon: FiCpu, text: `${assets.length - assetsWithCPEs} asset${assets.length - assetsWithCPEs > 1 ? "s" : ""} missing CPE — won't be scanned`, cta: "Review", urgent: false });

  const sortedAssets = [...assets].sort((a, b) => {
    const aData = overview?.assetVulnMap[a.id];
    const bData = overview?.assetVulnMap[b.id];
    const aSev = SEVERITY_ORDER[aData?.highestSeverity ?? ""] ?? -1;
    const bSev = SEVERITY_ORDER[bData?.highestSeverity ?? ""] ?? -1;
    if (bSev !== aSev) return bSev - aSev;
    return (bData?.count ?? 0) - (aData?.count ?? 0);
  });

  const filteredAssets = assetSearch
    ? sortedAssets.filter(a => a.name.toLowerCase().includes(assetSearch.toLowerCase()) || a.type.toLowerCase().includes(assetSearch.toLowerCase()))
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
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-error-bg border border-error-border rounded-[16px] p-6 text-center">
          <p className="text-error-text">{error || "Environment not found"}</p>
          <Button onClick={loadEnvironment} className="mt-4">Retry</Button>
        </div>
      </div>
    );
  }

  const totalActiveThreats = overview ? overview.severityCounts.critical + overview.severityCounts.high + overview.severityCounts.medium + overview.severityCounts.low : 0;

  return (
    <div className="p-8 h-full flex flex-col max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-brand-1/10 rounded-[16px] flex items-center justify-center text-brand-1">
            <FiBox className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-[clamp(28px,3vw,36px)] font-bold text-text-primary tracking-[-1px] leading-[1.05]">{environment.name}</h1>
            {environment.description && <p className="text-text-secondary text-sm mt-1">{environment.description}</p>}
            {environment.labels && environment.labels.length > 0 && (
              <div className="flex gap-2 mt-2">
                {environment.labels.map((label) => (
                  <Badge key={label} variant="neutral" size="sm">{label}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!user?.devMode && (
            <Button variant="secondary" size="sm" onClick={() => setIsDevModalOpen(true)}>
              <FiCode className="w-4 h-4" />
              Dev
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={() => router.push(`/environments/${envId}/map`)}>
            <FiMap className="w-4 h-4" />
            Map View
          </Button>
          <Button size="sm" onClick={() => setIsAddAssetOpen(true)}>
            <FiPlus className="w-4 h-4" />
            Add Asset
          </Button>
        </div>
      </div>

      {attentionItems.length > 0 && (
        <div className={`rounded-[16px] border p-4 flex flex-col gap-2 mb-6 ${attentionItems.some(i => i.urgent) ? "bg-error-bg border-error-border" : "bg-warning-bg border-warning-border"}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.5px] mb-1 ${attentionItems.some(i => i.urgent) ? "text-error-text" : "text-warning-text"}`}>Needs Attention</p>
          {attentionItems.map((item, i) => (
            <div key={i} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <item.icon className={`w-4 h-4 shrink-0 ${item.urgent ? "text-error-text" : "text-warning-text"}`} />
                <span className="text-sm text-text-primary">{item.text}</span>
              </div>
              <Button
                size="sm"
                variant={item.urgent ? "danger" : "secondary"}
                onClick={() => item.cta === "Run Scan" ? contextStartScan(envId) : router.push(`/environments/${envId}/security`)}
              >
                {item.cta}
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Total Assets */}
            <div className="bg-surface rounded-[16px] border border-border p-4 transition-all duration-150 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-brand-1/10 flex items-center justify-center text-brand-1">
                  <FiServer className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-text-muted">Total Assets</span>
              </div>
              <div className="text-[28px] font-bold text-text-primary leading-none tracking-[-1px]">{assets.length}</div>
              <div className="text-xs text-text-muted mt-1.5">{activeAssets} active</div>
            </div>

            {/* CPE Coverage */}
            <div className="bg-surface rounded-[16px] border border-border p-4 transition-all duration-150 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-brand-1/10 flex items-center justify-center text-brand-1">
                  <FiCpu className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-text-muted">CPE Coverage</span>
              </div>
              <div className="text-[28px] font-bold text-text-primary leading-none tracking-[-1px]">
                {assets.length > 0 ? Math.round((assetsWithCPEs / assets.length) * 100) : 0}%
              </div>
              <div className="w-full h-1.5 bg-surface-secondary rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-brand-1 rounded-full transition-all duration-500"
                  style={{ width: `${assets.length > 0 ? Math.round((assetsWithCPEs / assets.length) * 100) : 0}%` }}
                />
              </div>
              <div className="text-xs text-text-muted mt-1.5">{assetsWithCPEs} of {assets.length}</div>
            </div>

            {/* Critical / High */}
            <button
              onClick={overview && overview.openCriticalHigh.critical + overview.openCriticalHigh.high > 0 ? () => router.push(`/environments/${envId}/security`) : undefined}
              className={`bg-surface rounded-[16px] border border-border p-4 text-left transition-all duration-150 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 ${overview && overview.openCriticalHigh.critical + overview.openCriticalHigh.high > 0 ? "cursor-pointer" : ""}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-error-bg flex items-center justify-center text-error-text">
                  <FiAlertTriangle className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-text-muted">Critical / High</span>
              </div>
              <div className="text-[28px] font-bold text-text-primary leading-none tracking-[-1px]">
                {overview ? `${overview.openCriticalHigh.critical} / ${overview.openCriticalHigh.high}` : "—"}
              </div>
              <div className="text-xs text-text-muted mt-1.5">Need immediate review</div>
            </button>

            {/* Resolved This Week */}
            <button
              onClick={() => router.push(`/environments/${envId}/security`)}
              className="bg-surface rounded-[16px] border border-border p-4 text-left transition-all duration-150 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 cursor-pointer"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-success-bg flex items-center justify-center text-success-text">
                  <FiCheckCircle className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-text-muted">Resolved This Week</span>
              </div>
              <div className="text-[28px] font-bold text-text-primary leading-none tracking-[-1px]">{overview?.resolvedThisWeek ?? 0}</div>
              <div className="text-xs text-text-muted mt-1.5">
                {totalActiveThreats > 0 ? `${totalActiveThreats} still open` : "All clear"}
              </div>
            </button>
          </div>

          {overview?.latestScan && totalActiveThreats === 0 && assets.length > 0 && (
            <div className="flex items-center gap-4 bg-success-bg border border-success-border rounded-[16px] px-5 py-4">
              <div className="w-10 h-10 rounded-full bg-success-text/20 flex items-center justify-center shrink-0">
                <FiCheckCircle className="w-5 h-5 text-success-text" />
              </div>
              <div>
                <p className="font-semibold text-success-text text-sm">Environment is secure</p>
                <p className="text-success-text/70 text-xs mt-0.5">
                  All detected vulnerabilities are resolved or accepted. Last scan {new Date(overview.latestScan.completedAt).toLocaleDateString()}.
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => contextStartScan(envId)} className="ml-auto shrink-0">
                Rescan
              </Button>
            </div>
          )}

          <div className="flex-1 bg-surface rounded-[16px] border border-border overflow-hidden flex flex-col min-h-0">
            <div className="p-4 border-b border-border">
              <SectionHeader
                title="Assets"
                action={
                  assets.length > 0 && (
                    <div className="relative">
                      <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                      <Input
                        type="text"
                        placeholder="Filter assets..."
                        value={assetSearch}
                        onChange={(e) => setAssetSearch(e.target.value)}
                        className="w-48 pl-8 text-xs py-1.5"
                      />
                    </div>
                  )
                }
              />
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              {filteredAssets.length === 0 ? (
                assets.length === 0 ? (
                  <EmptyState
                    icon={<FiServer className="w-7 h-7" />}
                    title="No assets yet"
                    description="Add assets to this environment to start monitoring them."
                    action={<Button size="sm" onClick={() => setIsAddAssetOpen(true)}><FiPlus className="w-4 h-4" /> Add Asset</Button>}
                  />
                ) : (
                  <div className="text-center py-8">
                    <p className="text-text-muted text-sm">No assets match &quot;{assetSearch}&quot;</p>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(showAllAssets ? filteredAssets : filteredAssets.slice(0, 6)).map((asset) => (
                    <AssetCard
                      key={asset.id}
                      asset={asset}
                      onClick={() => setSelectedAsset(asset)}
                      vulnCount={overview?.assetVulnMap[asset.id]?.count}
                      highestSeverity={overview?.assetVulnMap[asset.id]?.highestSeverity}
                      wasScanned={overview?.latestScan !== null}
                    />
                  ))}
                </div>
              )}
              {filteredAssets.length > 6 && (
                <div className="mt-4 text-center">
                  <button onClick={() => setShowAllAssets(v => !v)} className="text-sm text-brand-2 font-semibold hover:underline">
                    {showAllAssets ? "Show less" : `View all ${filteredAssets.length} assets`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto pr-1">
          <div className={`rounded-[16px] border p-5 flex-shrink-0 transition-colors ${autoScanEnabled ? "bg-brand-1 border-brand-1" : "bg-surface border-border"}`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold flex items-center gap-2 text-[16px] tracking-[-0.2px] ${autoScanEnabled ? "text-brand-2" : "text-text-primary"}`}>
                <FiZap className={`w-4 h-4 ${autoScanEnabled ? "text-brand-2" : "text-brand-1"}`} />
                Auto Scan
              </h3>
              <button
                onClick={() => setAutoScanEnabled(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${autoScanEnabled ? "bg-brand-2/30" : "bg-surface-secondary border border-border"}`}
                aria-label="Toggle auto scan"
              >
                <span className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-transform ${autoScanEnabled ? "bg-brand-2 -translate-x-5" : "bg-text-muted -translate-x-0.5"}`} />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className={autoScanEnabled ? "text-brand-2/80" : "text-text-muted"}>Status</span>
                <span className={`font-medium ${autoScanEnabled ? "text-brand-2" : "text-text-primary"}`}>{autoScanEnabled ? "Active" : "Paused"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className={`shrink-0 ${autoScanEnabled ? "text-brand-2/80" : "text-text-muted"}`}>Frequency</span>
                <select
                  value={autoScanFrequency}
                  onChange={(e) => setAutoScanFrequency(e.target.value)}
                  className={`min-w-[6rem] px-2 py-1 rounded-[8px] text-[13px] font-medium focus:outline-none focus:ring-2 appearance-none text-right ${autoScanEnabled ? "bg-brand-2/10 border border-brand-2/20 text-brand-2 focus:ring-brand-2/30" : "bg-background-secondary border border-border text-text-primary focus:ring-brand-1/20"}`}
                >
                  <option value="6">Every 6h</option>
                  <option value="12">Every 12h</option>
                  <option value="24">Every 24h</option>
                  <option value="48">Every 48h</option>
                  <option value="168">Every 7d</option>
                </select>
              </div>
              <div className="flex items-center justify-between">
                <span className={autoScanEnabled ? "text-brand-2/80" : "text-text-muted"}>Next run</span>
                <span className={`font-medium ${autoScanEnabled ? "text-brand-2" : "text-text-primary"}`}>{autoScanEnabled ? `in ${Math.max(1, parseInt(autoScanFrequency, 10) - 8)}h` : "Paused"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={autoScanEnabled ? "text-brand-2/80" : "text-text-muted"}>Scope</span>
                <span className={`font-medium ${autoScanEnabled ? "text-brand-2" : "text-text-primary"}`}>All assets</span>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-[16px] border border-border p-5 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-text-primary flex items-center gap-2 text-[18px] tracking-[-0.2px]">
                <FiShield className="w-5 h-5 text-brand-1" />
                Security Status
              </h3>
              <div className="flex items-center gap-2">
                {(overview?.overdue ?? 0) > 0 && <Badge variant="error" size="sm">{overview!.overdue} overdue</Badge>}
                {isScanningThisEnv && <Badge variant="accent" size="sm">Scanning...</Badge>}
              </div>
            </div>

            {isScanningThisEnv ? (
              <div className="text-center py-4">
                <div className="w-8 h-8 border-2 border-brand-1 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-sm text-text-secondary">{progress}</p>
              </div>
            ) : overview?.latestScan ? (
              <div className="space-y-4">
                <RiskSentence stats={overview.severityCounts} />
                {totalActiveThreats > 0 ? (
                  <VulnBarChart critical={overview.severityCounts.critical} high={overview.severityCounts.high} medium={overview.severityCounts.medium} low={overview.severityCounts.low} />
                ) : (
                  <div className="flex items-center gap-2 text-success-text bg-success-bg rounded-[10px] p-3 border border-success-border">
                    <FiCheckCircle className="w-5 h-5" />
                    <span className="text-sm font-medium">No vulnerabilities detected</span>
                  </div>
                )}
                <div className="text-xs text-text-muted">
                  Last scan: {new Date(overview.latestScan.completedAt).toLocaleDateString()}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/environments/${envId}/security`)} className="flex-1">
                    View Details <FiChevronRight className="w-3 h-3" />
                  </Button>
                  <Button size="sm" onClick={() => contextStartScan(envId)} disabled={isScanningThisEnv} className="flex-1">
                    <FiPlay className="w-3 h-3" /> Rescan
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <FiShield className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-sm text-text-secondary mb-3">No security scan yet</p>
                <Button size="sm" onClick={() => contextStartScan(envId)}>
                  <FiZap className="w-4 h-4" /> Run First Scan
                </Button>
              </div>
            )}
          </div>

          <div className="bg-surface rounded-[16px] border border-border p-5 flex-shrink-0">
            <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2 text-[18px] tracking-[-0.2px]">
              <FiBarChart2 className="w-5 h-5 text-brand-1" />
              Asset Types
            </h3>
            <AssetTypeDistribution assets={assets} />
          </div>

          {overview?.latestScan && (
            <div className="bg-surface rounded-[16px] border border-border p-5 flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-text-primary flex items-center gap-2 text-[16px] tracking-[-0.2px]">
                  <FiList className="w-4 h-4 text-brand-1" />
                  Latest Scan Breakdown
                </h3>
              </div>
              <div className="space-y-3">
                {(() => {
                  const breakdown = overview.latestScan.activeBreakdown;
                  const total = breakdown.open + breakdown.inProgress + breakdown.resolved || 1;
                  return [
                    { label: "Open", value: breakdown.open, bar: "bg-error-text", text: "text-error-text" },
                    { label: "In Progress", value: breakdown.inProgress, bar: "bg-warning-text", text: "text-warning-text" },
                    { label: "Resolved", value: breakdown.resolved, bar: "bg-success-text", text: "text-success-text" },
                  ].map(({ label, value, bar, text }) => {
                    const pct = (value / total) * 100;
                    return (
                      <div key={label}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-text-muted">{label}</span>
                          <span className={`font-semibold ${text}`}>{value}</span>
                        </div>
                        <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                          <div className={`h-full ${bar} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
              <button onClick={() => router.push(`/environments/${envId}/security`)} className="w-full mt-4 text-xs text-brand-2 font-semibold hover:underline flex items-center justify-center gap-1">
                Manage workflows <FiChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {overview && overview.recentScans.length > 0 && (
            <div className="bg-surface rounded-[16px] border border-border p-5 flex-shrink-0">
              <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2 text-[18px] tracking-[-0.2px]">
                <FiClock className="w-5 h-5 text-brand-1" />
                Recent Scans
              </h3>
              <div className="space-y-3">
                {overview.recentScans.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {scan.status === "COMPLETED" ? (
                        <FiCheckCircle className="w-4 h-4 text-success-text shrink-0" />
                      ) : (
                        <FiXCircle className="w-4 h-4 text-error-text shrink-0" />
                      )}
                      <span className="text-text-secondary">{new Date(scan.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                    </div>
                    <span className={`text-xs font-medium ${scan.status === "COMPLETED" ? "text-success-text" : "text-error-text"}`}>
                      {scan.status === "COMPLETED" ? "Completed" : "Failed"}
                    </span>
                  </div>
                ))}
              </div>
              {overview.recentScans.length >= 3 && (
                <button onClick={() => router.push(`/environments/${envId}/security`)} className="w-full mt-3 text-xs text-brand-2 font-semibold hover:underline">
                  View all scan history
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <AddAssetSlideOver isOpen={isAddAssetOpen} onClose={() => setIsAddAssetOpen(false)} onSuccess={loadEnvironment} environmentId={envId} />
      <AssetDetailsSlideOver asset={selectedAsset} isOpen={selectedAsset !== null} onClose={() => setSelectedAsset(null)} onAssetDeleted={(deletedAssetId) => { setAssets((prev) => prev.filter((a) => a.id !== deletedAssetId)); setSelectedAsset(null); }} />
      <DevModeModal isOpen={isDevModalOpen} onClose={() => setIsDevModalOpen(false)} />
    </div>
  );
}
