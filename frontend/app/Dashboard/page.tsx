"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";
import {
  FiPlus, FiBox, FiTrash2, FiShield, FiAlertTriangle, FiActivity, FiServer,
  FiClock, FiSettings, FiCheckCircle, FiXCircle, FiRefreshCw, FiX,
} from "react-icons/fi";
import { getEnvironments, deleteEnvironment, type Environment } from "@/lib/api";
import CreateEnvironmentSlideOver from "@/components/environments/CreateEnvironmentSlideOver";

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

// ============== Auto Scanner ==============

const DUMMY_RUN_HISTORY = [
  { id: 1, hoursAgo: 8,  duration: "2m 34s", status: "COMPLETED" as const, vulnsFound: 3 },
  { id: 2, hoursAgo: 32, duration: "2m 18s", status: "COMPLETED" as const, vulnsFound: 3 },
  { id: 3, hoursAgo: 56, duration: "45s",    status: "FAILED"    as const, vulnsFound: 0 },
  { id: 4, hoursAgo: 80, duration: "2m 51s", status: "COMPLETED" as const, vulnsFound: 5 },
];

function AutoScannerConfigSlideOver({ onClose }: { onClose: () => void }) {
  const [frequency, setFrequency] = useState("24");
  const [timeOfDay, setTimeOfDay] = useState("02:00");
  const [scope, setScope] = useState("all");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => { setIsSaving(false); onClose(); }, 900);
  };

  const SCOPE_OPTIONS = [
    { value: "all",        label: "All environments" },
    { value: "production", label: "Production only" },
    { value: "staging",    label: "Staging only" },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/45 z-40" onClick={onClose} />
      <aside className="fixed top-0 right-0 h-full w-[480px] bg-surface border-l border-border shadow-2xl z-50 flex flex-col">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Auto Scan Configuration</h3>
            <p className="text-sm text-text-muted mt-0.5">Scheduled scanning engine settings</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Frequency */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Scan Frequency</label>
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-1/20 focus:border-brand-1 transition-all"
            >
              <option value="6">Every 6 hours</option>
              <option value="12">Every 12 hours</option>
              <option value="24">Every 24 hours (Daily)</option>
              <option value="48">Every 48 hours</option>
              <option value="168">Every 7 days (Weekly)</option>
            </select>
          </div>

          {/* Time of day */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Start Time (UTC)</label>
            <input
              type="time"
              value={timeOfDay}
              onChange={e => setTimeOfDay(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-1/20 focus:border-brand-1 transition-all"
            />
            <p className="text-xs text-text-muted mt-1.5">Scans will be triggered at this time in UTC.</p>
          </div>

          {/* Environment scope */}
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Environment Scope</label>
            <div className="space-y-2">
              {SCOPE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScope(opt.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors ${
                    scope === opt.value
                      ? "border-brand-1/40 bg-brand-1/5"
                      : "border-border hover:border-border-secondary"
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    scope === opt.value ? "border-brand-1" : "border-border"
                  }`}>
                    {scope === opt.value && (
                      <div className="w-2 h-2 rounded-full bg-brand-1" />
                    )}
                  </div>
                  <span className="text-sm text-text-primary">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Info note */}
          <div className="bg-info-bg border border-info-border rounded-lg px-4 py-3">
            <p className="text-xs text-info-text leading-relaxed">
              Configuration changes take effect at the next scheduled run. Any scan currently in progress will complete normally.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border flex gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 bg-text-primary text-surface rounded-lg text-sm font-medium hover:bg-text-primary/90 disabled:opacity-60 transition-colors inline-flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-surface border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : "Save Configuration"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors"
          >
            Cancel
          </button>
        </div>
      </aside>
    </>
  );
}

function AutoScannerCard() {
  const [enabled, setEnabled] = useState(true);
  const [showConfig, setShowConfig] = useState(false);

  const frequency = 24; // hours (dummy)
  const lastRunHoursAgo = DUMMY_RUN_HISTORY[0].hoursAgo;
  const nextRunHoursFromNow = frequency - (lastRunHoursAgo % frequency);

  return (
    <section>
      <SectionHeader
        title="Auto Scan Engine"
        action={
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors"
          >
            <FiSettings className="w-4 h-4" />
            Configure
          </button>
        }
      />

      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        {/* Status bar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              enabled ? "bg-emerald-400 animate-pulse" : "bg-gray-400"
            }`} />
            <span className="font-medium text-text-primary text-sm">
              {enabled ? "Engine Active" : "Engine Paused"}
            </span>
            <span className="text-text-muted text-sm hidden sm:inline">
              · Every {frequency} hours · 02:00 UTC
            </span>
          </div>

          {/* Toggle switch */}
          <button
            onClick={() => setEnabled(prev => !prev)}
            title={enabled ? "Pause auto-scanner" : "Enable auto-scanner"}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              enabled ? "bg-emerald-500" : "bg-surface-secondary border border-border"
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`} />
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
          <div className="px-5 py-3">
            <p className="text-xs text-text-muted mb-0.5">Last Run</p>
            <p className="text-sm font-medium text-text-primary">{lastRunHoursAgo}h ago</p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-text-muted mb-0.5">Next Run</p>
            <p className={`text-sm font-medium ${enabled ? "text-text-primary" : "text-text-muted"}`}>
              {enabled ? `in ${nextRunHoursFromNow}h` : "Paused"}
            </p>
          </div>
          <div className="px-5 py-3">
            <p className="text-xs text-text-muted mb-0.5">Coverage</p>
            <p className="text-sm font-medium text-text-primary">All environments</p>
          </div>
        </div>

        {/* Recent runs */}
        <div>
          <div className="px-5 py-2.5 bg-surface-secondary/30">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Recent Runs</p>
          </div>
          <div className="divide-y divide-border">
            {DUMMY_RUN_HISTORY.map(run => (
              <div key={run.id} className="flex items-center justify-between px-5 py-3 text-sm">
                <div className="flex items-center gap-2.5">
                  {run.status === "COMPLETED" ? (
                    <FiCheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <FiXCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className="text-text-secondary">{run.hoursAgo}h ago</span>
                  <span className="text-text-muted text-xs">· {run.duration}</span>
                </div>
                <span className={`text-xs font-medium ${
                  run.vulnsFound > 0 ? "text-orange-400" : "text-text-muted"
                }`}>
                  {run.vulnsFound > 0 ? `${run.vulnsFound} vulns found` : "No new vulns"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showConfig && <AutoScannerConfigSlideOver onClose={() => setShowConfig(false)} />}
    </section>
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

      {/* Auto Scan Engine */}
      <AutoScannerCard />

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
