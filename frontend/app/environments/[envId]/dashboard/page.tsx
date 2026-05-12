"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FiBox, FiServer, FiPlus, FiCpu,
  FiSearch, FiShield, FiAlertTriangle,
  FiBarChart2, FiMap, FiCheckCircle,
  FiCode, FiAlertOctagon, FiUserX,
} from "react-icons/fi";
import { useScan, useUser, type Asset } from "@/lib/api";
import AddAssetSlideOver from "@/components/assets/AddAssetSlideOver";
import AssetDetailsSlideOver from "@/components/assets/AssetDetailsSlideOver";
import DevModeModal from "@/components/dev/DevModeModal";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { SEVERITY_ORDER } from "@/lib/securityConstants";
import { AssetTypeDistribution } from "./AssetTypeDistribution";
import { AssetCard } from "./AssetCard";
import { StatCard } from "./StatCard";
import { AttentionBanner } from "./AttentionBanner";
import { AllClearBanner } from "./AllClearBanner";
import { ScanBreakdownCard } from "./ScanBreakdownCard";
import { RecentScansCard } from "./RecentScansCard";
import { SecurityStatusCard } from "./SecurityStatusCard";
import { AutoScanCard } from "./AutoScanCard";
import { useEnvironment } from "@/lib/hooks/useEnvironment";
import { useSchedule } from "@/lib/hooks/useSchedule";

export default function EnvironmentDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const envId = params.envId as string;

  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [assetSearch, setAssetSearch] = useState("");
  const [isDevModalOpen, setIsDevModalOpen] = useState(false);
  const [showAllAssets, setShowAllAssets] = useState(false);
  const { schedule, isLoading: scheduleLoading, isMutating: scheduleMutating, toggle: toggleSchedule, setFrequency: setScheduleFrequency } = useSchedule(envId);

  const {
    isScanning,
    progressMessages,
    environmentId: scanningEnvId,
    configureAndStartScan: contextStartScan,
  } = useScan();

  const isScanningThisEnv = isScanning && scanningEnvId === envId;

  const { user } = useUser();

  const {
    environment_data: environment,
    environment_error,
    asset_data,
    overview_data: overview,
    isLoading,
    refetch,
  } = useEnvironment(envId);

  const assets = asset_data ?? [];

  const assetsWithCPEs = useMemo(() => {
    return assets.filter((a) => Array.isArray(a.cpes) && a.cpes.length > 0).length;
  }, [assets]);

  const activeAssets = useMemo(() => {
    return assets.filter((a) => a.status === "active").length;
  }, [assets]);

  const totalActiveThreats = useMemo(() => {
    if (!overview) return 0;
    const s = overview.severityCounts;
    return s.critical + s.high + s.medium + s.low;
  }, [overview]);

  const attentionItems = () => {
    const items: { icon: React.ElementType; text: string; cta: string; urgent: boolean }[] = [];

    if (!overview?.latestScan) {
      items.push({ icon: FiShield, text: "No security scan has been run yet", cta: "Run Scan", urgent: true });
    }

    if ((overview?.overdue ?? 0) > 0) {
      const count = overview!.overdue;
      const plural = count > 1 ? "ies are" : "y is";
      items.push({ icon: FiAlertOctagon, text: `${count} vulnerabilit${plural} past SLA deadline`, cta: "View overdue", urgent: true });
    }

    if ((overview?.unassignedCriticalHigh ?? 0) > 0) {
      const count = overview!.unassignedCriticalHigh;
      const plural = count > 1 ? "s" : "";
      items.push({ icon: FiUserX, text: `${count} Critical/High vuln${plural} unassigned`, cta: "Assign", urgent: false });
    }

    if (assets.length > 0 && assetsWithCPEs < assets.length) {
      const missing = assets.length - assetsWithCPEs;
      const plural = missing > 1 ? "s" : "";
      items.push({ icon: FiCpu, text: `${missing} asset${plural} missing CPE — won't be scanned`, cta: "Review", urgent: false });
    }

    return items;
  };

  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => {
      const aData = overview?.assetVulnMap[a.id];
      const bData = overview?.assetVulnMap[b.id];
      const aSev = SEVERITY_ORDER[aData?.highestSeverity ?? ""] ?? -1;
      const bSev = SEVERITY_ORDER[bData?.highestSeverity ?? ""] ?? -1;
      if (bSev !== aSev) return bSev - aSev;
      return (bData?.count ?? 0) - (aData?.count ?? 0);
    });
  }, [assets, overview]);

  const filteredAssets = useMemo(() => {
    if (!assetSearch) return sortedAssets;
    const q = assetSearch.toLowerCase();
    return sortedAssets.filter(
      (a) => a.name.toLowerCase().includes(q) || a.type.toLowerCase().includes(q)
    );
  }, [sortedAssets, assetSearch]);

  // ── Guards ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (environment_error || !environment) {
    return (
      <div className="p-8 max-w-7xl mx-auto">
        <div className="bg-error-bg border border-error-border rounded-2xl p-6 text-center">
          <p className="text-error-text">{environment_error || "Environment not found"}</p>
          <Button onClick={() => refetch()} className="mt-4">Retry</Button>
        </div>
      </div>
    );
  }

  const cpeCoverage = assets.length > 0 ? Math.round((assetsWithCPEs / assets.length) * 100) : 0;
  const hasClickableCriticalHigh = overview
    ? overview.openCriticalHigh.critical + overview.openCriticalHigh.high > 0
    : false;

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="p-8 h-full flex flex-col max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-brand-1/10 rounded-2xl flex items-center justify-center text-brand-1">
            <FiBox className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-[clamp(28px,3vw,36px)] font-bold text-text-primary tracking-[-1px] leading-[1.05]">
              {environment.name}
            </h1>
            {environment.description && (
              <p className="text-text-secondary text-sm mt-1">{environment.description}</p>
            )}
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

      <AttentionBanner
        items={attentionItems()}
        onRunScan={() => contextStartScan(envId)}
        onViewSecurity={() => router.push(`/environments/${envId}/security`)}
      />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">

        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-6 min-h-0">

          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<FiServer className="w-4 h-4" />}
              iconBg="bg-brand-1/10 text-brand-1"
              label="Total Assets"
              value={assets.length}
              subtitle={`${activeAssets} active`}
            />
            <StatCard
              icon={<FiCpu className="w-4 h-4" />}
              iconBg="bg-brand-1/10 text-brand-1"
              label="CPE Coverage"
              value={`${cpeCoverage}%`}
              progressPercent={cpeCoverage}
              subtitle={`${assetsWithCPEs} of ${assets.length}`}
            />
            <StatCard
              icon={<FiAlertTriangle className="w-4 h-4" />}
              iconBg="bg-error-bg text-error-text"
              label="Critical / High"
              value={overview ? `${overview.openCriticalHigh.critical} / ${overview.openCriticalHigh.high}` : "—"}
              subtitle="Need immediate review"
              onClick={hasClickableCriticalHigh ? () => router.push(`/environments/${envId}/security`) : undefined}
            />
            <StatCard
              icon={<FiCheckCircle className="w-4 h-4" />}
              iconBg="bg-success-bg text-success-text"
              label="Resolved This Week"
              value={overview?.resolvedThisWeek ?? 0}
              subtitle={totalActiveThreats > 0 ? `${totalActiveThreats} still open` : "All clear"}
              onClick={() => router.push(`/environments/${envId}/security`)}
            />
          </div>

          {/* All-clear banner */}
          {overview?.latestScan && totalActiveThreats === 0 && assets.length > 0 && (
            <AllClearBanner
              lastScanDate={overview.latestScan.completedAt}
              onRescan={() => contextStartScan(envId)}
            />
          )}

          {/* Assets list */}
          <div className="flex-1 bg-surface rounded-2xl border border-border overflow-hidden flex flex-col min-h-0">
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
              {filteredAssets.length === 0 && assets.length === 0 && (
                <EmptyState
                  icon={<FiServer className="w-7 h-7" />}
                  title="No assets yet"
                  description="Add assets to this environment to start monitoring them."
                  action={
                    <Button size="sm" onClick={() => setIsAddAssetOpen(true)}>
                      <FiPlus className="w-4 h-4" /> Add Asset
                    </Button>
                  }
                />
              )}
              {filteredAssets.length === 0 && assets.length > 0 && (
                <div className="text-center py-8">
                  <p className="text-text-muted text-sm">No assets match &quot;{assetSearch}&quot;</p>
                </div>
              )}
              {filteredAssets.length > 0 && (
                <>
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
                  {filteredAssets.length > 6 && (
                    <div className="mt-4 text-center">
                      <button
                        onClick={() => setShowAllAssets((v) => !v)}
                        className="text-sm text-brand-2 font-semibold hover:underline"
                      >
                        {showAllAssets ? "Show less" : `View all ${filteredAssets.length} assets`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-1">
          <AutoScanCard
            schedule={schedule}
            isLoading={scheduleLoading}
            isMutating={scheduleMutating}
            onToggle={toggleSchedule}
            onFrequencyChange={setScheduleFrequency}
          />

          <SecurityStatusCard
            overview={overview}
            isScanningThisEnv={isScanningThisEnv}
            progressMessages={progressMessages}
            totalActiveThreats={totalActiveThreats}
            onViewSecurity={() => router.push(`/environments/${envId}/security`)}
            onRescan={() => contextStartScan(envId)}
          />

          <div className="bg-surface rounded-2xl border border-border p-5 shrink-0">
            <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2 text-[18px] tracking-[-0.2px]">
              <FiBarChart2 className="w-5 h-5 text-brand-1" />
              Asset Types
            </h3>
            <AssetTypeDistribution assets={assets} />
          </div>

          {overview?.latestScan && (
            <ScanBreakdownCard
              breakdown={overview.latestScan.activeBreakdown}
              onManageWorkflows={() => router.push(`/environments/${envId}/security`)}
            />
          )}

          <RecentScansCard
            scans={overview?.recentScans ?? []}
            onViewAll={() => router.push(`/environments/${envId}/security`)}
          />
        </div>
      </div>

      <AddAssetSlideOver
        isOpen={isAddAssetOpen}
        onClose={() => setIsAddAssetOpen(false)}
        onSuccess={() => refetch()}
        environmentId={envId}
      />
      <AssetDetailsSlideOver
        asset={selectedAsset}
        isOpen={selectedAsset !== null}
        onClose={() => setSelectedAsset(null)}
        onAssetDeleted={() => { setSelectedAsset(null); refetch(); }}
      />
      <DevModeModal isOpen={isDevModalOpen} onClose={() => setIsDevModalOpen(false)} />
    </div>
  );
}
