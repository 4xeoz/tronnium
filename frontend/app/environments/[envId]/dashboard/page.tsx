"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";
import { useParams } from "next/navigation";
import { FiBox, FiServer, FiShield, FiAlertTriangle, FiActivity, FiPlus, FiCpu, FiChevronRight } from "react-icons/fi";
import { getEnvironment, getAssets, type Environment, type Asset } from "@/lib/api";
import AddAssetSlideOver from "@/components/assets/AddAssetSlideOver";
import AssetDetailsSlideOver from "@/components/assets/AssetDetailsSlideOver";

// ============== Reusable Components ==============

function StatCard({ icon, label, value, trend }: { 
  icon: ReactNode; 
  label: string; 
  value: string | number;
  trend?: { value: string; positive: boolean };
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-brand-1/10 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <span className="text-text-secondary text-sm">{label}</span>
      </div>
      <div className="flex items-end justify-between">
        <span className="text-2xl font-bold text-text-primary">{value}</span>
        {trend && (
          <span className={`text-sm ${trend.positive ? "text-success-text" : "text-error-text"}`}>
            {trend.value}
          </span>
        )}
      </div>
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

function EmptyState({ icon, title, description, action }: {
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

// ============== Environment Dashboard ==============

export default function EnvironmentDashboardPage() {
  const params = useParams();
  const envId = params.envId as string;
  
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAddAssetOpen, setIsAddAssetOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

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
    <div className="p-8 h-full overflow-auto space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-brand-1/10 rounded-xl flex items-center justify-center">
          <FiBox className="w-7 h-7 text-brand-1" />
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-text-primary">{environment.name}</h1>
          {environment.description && (
            <p className="text-text-secondary mt-1">{environment.description}</p>
          )}
          {environment.labels && environment.labels.length > 0 && (
            <div className="flex gap-2 mt-3">
              {environment.labels.map((label) => (
                <span
                  key={label}
                  className="px-3 py-1 bg-surface-secondary text-text-secondary text-sm rounded-full"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats Overview */}
      <section>
        <SectionHeader title="Overview" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FiServer className="w-5 h-5 text-brand-1" />}
            label="Assets"
            value={assets.length}
          />
          <StatCard
            icon={<FiAlertTriangle className="w-5 h-5 text-brand-1" />}
            label="Vulnerabilities"
            value={0}
            trend={{ value: "—", positive: true }}
          />
          <StatCard
            icon={<FiShield className="w-5 h-5 text-brand-1" />}
            label="Security Score"
            value="—"
          />
          <StatCard
            icon={<FiActivity className="w-5 h-5 text-brand-1" />}
            label="Last Scan"
            value="Never"
          />
        </div>
      </section>

      {/* Assets Section */}
      <section>
        <SectionHeader 
          title="Assets" 
          action={
            <button
              onClick={() => setIsAddAssetOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              Add Asset
            </button>
          }
        />
        {assets.length === 0 ? (
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
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {assets.map((asset) => {
              const cpeList = Array.isArray(asset.cpes) ? asset.cpes : [];
              return (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAsset(asset)}
                  className="w-full flex items-center justify-between px-4 py-3 border-b border-border last:border-b-0 hover:bg-surface-secondary/50 transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-surface-secondary flex items-center justify-center">
                      <FiCpu className="w-4 h-4 text-text-muted" />
                    </div>
                    <div>
                      <div className="font-medium text-text-primary text-sm">
                        {asset.name}
                      </div>
                      {cpeList.length > 0 && (
                        <div className="text-xs text-text-muted font-mono truncate max-w-md">
                          {cpeList[0].cpeName}
                          {cpeList.length > 1 && (
                            <span className="text-text-secondary ml-1">
                              +{cpeList.length - 1} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {cpeList.length > 0 && cpeList[0].score && (
                      <span className="text-xs text-text-muted">
                        {Math.round(cpeList[0].score)}% match
                      </span>
                    )}
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        cpeList.length > 0
                          ? "bg-success-bg text-success-text"
                          : "bg-surface-secondary text-text-muted"
                      }`}
                    >
                      {cpeList.length > 0 ? `${cpeList.length} CPE${cpeList.length > 1 ? 's' : ''}` : "No CPE"}
                    </span>
                    <span className="text-xs text-text-muted">{asset.domain}</span>
                    <FiChevronRight className="w-4 h-4 text-text-muted" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Activity Section */}
      <section>
        <SectionHeader title="Recent Activity" />
        <EmptyState
          icon={<FiActivity className="w-6 h-6 text-text-muted" />}
          title="No recent activity"
          description="Activity from scans and changes will appear here."
        />
      </section>

      {/* Add Asset Slide Over */}
      <AddAssetSlideOver
        isOpen={isAddAssetOpen}
        onClose={() => setIsAddAssetOpen(false)}
        onSuccess={loadEnvironment}
        environmentId={envId}
      />

      {/* Asset Details Slide Over */}
      <AssetDetailsSlideOver
        asset={selectedAsset}
        isOpen={selectedAsset !== null}
        onClose={() => setSelectedAsset(null)}
        onAssetDeleted={(deletedAssetId) => {
          setAssets((prevAssets) => prevAssets.filter(asset => asset.id !== deletedAssetId));
          setSelectedAsset(null);
        }}
      />
    </div>
  );
}
