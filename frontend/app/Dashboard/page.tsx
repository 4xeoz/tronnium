"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";
import { FiPlus, FiBox, FiTrash2, FiShield, FiAlertTriangle, FiActivity, FiServer } from "react-icons/fi";
import { getEnvironments, deleteEnvironment, type Environment } from "@/lib/api";
import CreateEnvironmentSlideOver from "@/components/dashboard/CreateEnvironmentSlideOver";

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

function EnvironmentCard({ env, onDelete, isDeleting }: {
  env: Environment;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 hover:shadow-lg transition-shadow group">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 bg-brand-1/10 rounded-lg flex items-center justify-center">
          <FiBox className="w-5 h-5 text-brand-1" />
        </div>
        <button
          onClick={() => onDelete(env.id)}
          disabled={isDeleting}
          className="p-2 text-text-muted hover:text-error-text hover:bg-error-bg rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          {isDeleting ? (
            <div className="w-4 h-4 border-2 border-error-text border-t-transparent rounded-full animate-spin" />
          ) : (
            <FiTrash2 className="w-4 h-4" />
          )}
        </button>
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">{env.name}</h3>
      {env.description && (
        <p className="text-text-secondary text-sm mb-3 line-clamp-2">{env.description}</p>
      )}
      <div className="flex items-center justify-between pt-3 border-t border-border">
        <span className="text-sm text-text-muted">{env.assetCount ?? 0} assets</span>
        {env.labels && env.labels.length > 0 && (
          <div className="flex gap-1">
            {env.labels.slice(0, 2).map((label) => (
              <span key={label} className="px-2 py-0.5 bg-surface-secondary text-text-secondary text-xs rounded-full">
                {label}
              </span>
            ))}
            {env.labels.length > 2 && (
              <span className="px-2 py-0.5 bg-surface-secondary text-text-secondary text-xs rounded-full">
                +{env.labels.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============== Main Dashboard ==============

export default function DashboardPage() {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEnvironments = useCallback(async () => {
    try {
      setError(null);
      const data = await getEnvironments();
      setEnvironments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load environments");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this environment?")) return;
    setDeletingId(id);
    try {
      await deleteEnvironment(id);
      setEnvironments((prev) => prev.filter((env) => env.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete environment");
    } finally {
      setDeletingId(null);
    }
  };

  // Demo data for stats
  const totalAssets = environments.reduce((sum, env) => sum + (env.assetCount ?? 0), 0);

  return (
    <div className="p-8 h-full overflow-auto space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary mt-1">Overview of your security posture</p>
      </div>

      {/* Stats Overview */}
      <section>
        <SectionHeader title="Overview" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FiBox className="w-5 h-5 text-brand-1" />}
            label="Environments"
            value={environments.length}
          />
          <StatCard
            icon={<FiServer className="w-5 h-5 text-brand-1" />}
            label="Total Assets"
            value={totalAssets}
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
        </div>
      </section>

      {/* Environments Section */}
      <section>
        <SectionHeader
          title="Environments"
          action={
            <button
              onClick={() => setIsSlideOverOpen(true)}
              className="flex items-center gap-2 px-3 py-2 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              New
            </button>
          }
        />
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-3 border-brand-1 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="bg-error-bg border border-error-border rounded-lg p-4 text-center">
            <p className="text-error-text text-sm">{error}</p>
            <button onClick={loadEnvironments} className="mt-2 text-sm text-error-text underline">
              Retry
            </button>
          </div>
        ) : environments.length === 0 ? (
          <EmptyState
            icon={<FiBox className="w-6 h-6 text-text-muted" />}
            title="No environments yet"
            description="Create your first environment to start organizing your security assets."
            action={
              <button
                onClick={() => setIsSlideOverOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
              >
                <FiPlus className="w-4 h-4" />
                Create Environment
              </button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {environments.map((env) => (
              <EnvironmentCard
                key={env.id}
                env={env}
                onDelete={handleDelete}
                isDeleting={deletingId === env.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Activity Section */}
      <section>
        <SectionHeader title="Recent Activity" />
        <EmptyState
          icon={<FiActivity className="w-6 h-6 text-text-muted" />}
          title="No recent activity"
          description="Activity from scans and asset changes will appear here."
        />
      </section>

      {/* Slide-over */}
      <CreateEnvironmentSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onSuccess={loadEnvironments}
      />
    </div>
  );
}
