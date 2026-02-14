"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  FiBox,
  FiServer,
  FiShield,
  FiAlertTriangle,
  FiActivity,
  FiPlus,
  FiCpu,
  FiChevronRight,
  FiDatabase,
  FiWifi,
  FiHardDrive,
  FiSearch,
  FiZap,
  FiBarChart2,
  FiMessageSquare,
} from "react-icons/fi";
import { getEnvironment, getAssets, type Environment, type Asset } from "@/lib/api";
import AddAssetSlideOver from "@/components/assets/AddAssetSlideOver";
import AssetDetailsSlideOver from "@/components/assets/AssetDetailsSlideOver";

// ============== Shared helpers ==============

type Tab = "assets" | "security";

const typeIcons: Record<string, React.ElementType> = {
  server: FiServer,
  database: FiDatabase,
  network: FiWifi,
  firewall: FiShield,
  iot: FiHardDrive,
  unknown: FiCpu,
};

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-brand-1/10 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <span className="text-text-secondary text-sm">{label}</span>
      </div>
      <span className="text-2xl font-bold text-text-primary">{value}</span>
      {sub && <span className="text-xs text-text-muted ml-2">{sub}</span>}
    </div>
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

// ============== Asset Card (grid item) ==============

function AssetCard({
  asset,
  onClick,
}: {
  asset: Asset;
  onClick: () => void;
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
        {cpeList.length > 0 && cpeList[0].score && (
          <span className="text-[10px] text-text-muted">
            {Math.round(cpeList[0].score)}% match
          </span>
        )}
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

// ============== Security Tab (placeholder) ==============

function SecurityTab() {
  const features = [
    {
      icon: <FiSearch className="w-5 h-5" />,
      title: "Vulnerability Scanning",
      description: "Scan assets for known CVEs using NVD and CPE matching.",
    },
    {
      icon: <FiBarChart2 className="w-5 h-5" />,
      title: "Risk Scoring & CVSS",
      description:
        "Calculated risk scores per asset and environment, with CVSS breakdowns and dependency analysis.",
    },
    {
      icon: <FiMessageSquare className="w-5 h-5" />,
      title: "AI-Powered Analysis",
      description:
        "LLM explains vulnerabilities in plain language, suggests remediation steps, and prioritizes for SOC analysts.",
    },
    {
      icon: <FiZap className="w-5 h-5" />,
      title: "Continuous Monitoring",
      description:
        "Scheduled scans with alerting, trend tracking, and compliance reporting.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview cards - placeholder stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FiAlertTriangle className="w-5 h-5 text-brand-1" />}
          label="Vulnerabilities"
          value="--"
          sub="Not scanned"
        />
        <StatCard
          icon={<FiShield className="w-5 h-5 text-brand-1" />}
          label="Risk Score"
          value="--"
        />
        <StatCard
          icon={<FiActivity className="w-5 h-5 text-brand-1" />}
          label="Last Scan"
          value="Never"
        />
        <StatCard
          icon={<FiBarChart2 className="w-5 h-5 text-brand-1" />}
          label="Compliance"
          value="--"
        />
      </div>

      {/* Feature cards */}
      <div>
        <SectionHeader title="Coming Soon" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-surface rounded-xl border border-border p-5 flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-1/10 flex items-center justify-center shrink-0 text-brand-1">
                {f.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  {f.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state CTA */}
      <EmptyState
        icon={<FiShield className="w-6 h-6 text-text-muted" />}
        title="Security analysis not configured"
        description="Once vulnerability scanning is enabled, risk scores, CVE details, and AI-powered remediation advice will appear here."
      />
    </div>
  );
}

// ============== Main Page ==============

export default function EnvironmentDashboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const envId = params.envId as string;

  const initialTab = (searchParams.get("tab") as Tab) || "assets";

  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const [assetSearch, setAssetSearch] = useState("");

  const loadEnvironment = useCallback(async () => {
    try {
      setError(null);
      const [envData, assetsData] = await Promise.all([
        getEnvironment(envId),
        getAssets(envId),
      ]);
      setEnvironment(envData);
      setAssets(assetsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load environment");
    } finally {
      setIsLoading(false);
    }
  }, [envId]);

  useEffect(() => {
    loadEnvironment();
  }, [loadEnvironment]);

  // Filter assets
  const filteredAssets = assetSearch
    ? assets.filter(
        (a) =>
          a.name.toLowerCase().includes(assetSearch.toLowerCase()) ||
          a.type.toLowerCase().includes(assetSearch.toLowerCase())
      )
    : assets;

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

  const tabs: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: "assets", label: "Assets", icon: FiServer, count: assets.length },
    { id: "security", label: "Security", icon: FiShield },
  ];

  return (
    <div className="p-8 h-full overflow-auto space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
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

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? "border-brand-1 text-text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  activeTab === tab.id
                    ? "bg-brand-1/15 text-text-primary"
                    : "bg-surface-secondary text-text-muted"
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "assets" && (
        <div className="space-y-6">
          {/* Quick stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={<FiServer className="w-5 h-5 text-brand-1" />}
              label="Total Assets"
              value={assets.length}
            />
            <StatCard
              icon={<FiCpu className="w-5 h-5 text-brand-1" />}
              label="With CPEs"
              value={assets.filter((a) => Array.isArray(a.cpes) && a.cpes.length > 0).length}
              sub={`of ${assets.length}`}
            />
            <StatCard
              icon={<FiDatabase className="w-5 h-5 text-brand-1" />}
              label="IT Assets"
              value={assets.filter((a) => a.domain === "IT").length}
            />
            <StatCard
              icon={<FiHardDrive className="w-5 h-5 text-brand-1" />}
              label="OT Assets"
              value={assets.filter((a) => a.domain === "OT").length}
            />
          </div>

          {/* Asset list header */}
          <SectionHeader
            title="All Assets"
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
                <button
                  onClick={() => setIsAddAssetOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Add Asset
                </button>
              </div>
            }
          />

          {/* Asset grid */}
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
              <div className="bg-surface rounded-xl border border-border p-8 text-center">
                <p className="text-text-muted text-sm">
                  No assets match &quot;{assetSearch}&quot;
                </p>
              </div>
            )
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onClick={() => setSelectedAsset(asset)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "security" && <SecurityTab />}

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
    </div>
  );
}
