"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  FiShield,
  FiAlertTriangle,
  FiActivity,
  FiBarChart2,
  FiPlay,
  FiClock,
  FiCheckCircle,
  FiXCircle,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiZap,
  FiMessageSquare,
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

// ============== Shared helpers ==============

function StatCard({
  icon,
  label,
  value,
  sub,
  colorClass = "text-brand-1",
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-brand-1/10 rounded-lg flex items-center justify-center">
          <span className={colorClass}>{icon}</span>
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

function SeverityBadge({ count, severity }: { count: number; severity: string }) {
  const colors: Record<string, string> = {
    Critical: "bg-red-500/10 text-red-500 border-red-500/20",
    High: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };

  return (
    <div className={`rounded-lg border p-4 text-center ${colors[severity] || colors.Low}`}>
      <div className="text-2xl font-bold">{count}</div>
      <div className="text-xs font-medium uppercase tracking-wide">{severity}</div>
    </div>
  );
}

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
      cveId: string;
      description: string;
      cvssScore: number | null;
      cvssVector: string | null;
      severity: ScanSeverity;
      publishedDate: string | null;
      lastModifiedDate: string | null;
    };
    cpeName: string;
  }[];
};

function AssetVulnerabilityRow({ assetScan }: { assetScan: AssetScanItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const vulnCount = assetScan.vulnerabilities?.length || 0;

  if (vulnCount === 0) return null;

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface-secondary flex items-center justify-center">
            <FiShield className="w-4 h-4 text-text-muted" />
          </div>
          <div className="text-left">
            <div className="font-medium text-text-primary text-sm">{assetScan.asset.name}</div>
            <div className="text-xs text-text-muted capitalize">{assetScan.asset.type}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              vulnCount > 0 ? "bg-error-bg text-error-text" : "bg-success-bg text-success-text"
            }`}
          >
            {vulnCount} {vulnCount === 1 ? "vulnerability" : "vulnerabilities"}
          </span>
          {isExpanded ? (
            <FiChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <FiChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-3 space-y-2">
          {assetScan.vulnerabilities.map((av, idx) => (
            <div
              key={idx}
              className="bg-surface-secondary rounded-lg p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-medium text-text-primary">
                      {av.vulnerability.cveId}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${getSeverityColor(
                        av.vulnerability.severity
                      )}`}
                    >
                      {av.vulnerability.severity}
                    </span>
                  </div>
                  {av.vulnerability.cvssScore && (
                    <div className="text-xs text-text-muted mb-1">
                      CVSS Score: {av.vulnerability.cvssScore.toFixed(1)}
                    </div>
                  )}
                  <p className="text-text-secondary text-xs line-clamp-2">
                    {av.vulnerability.description}
                  </p>
                  <div className="mt-1 text-[10px] text-text-muted font-mono">
                    CPE: {av.cpeName}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRelativeTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

// ============== Main Page ==============

export default function SecurityPage() {
  const params = useParams();
  const envId = params.envId as string;

  // Use global scan context for scan state that persists across navigation
  const { 
    isScanning, 
    progress, 
    scanResult: contextScanResult, 
    error: contextError,
    environmentId: scanningEnvId,
    startScan: contextStartScan,
    clearResult 
  } = useScan();

  // Local state for scan history and latest scan data
  const [latestScan, setLatestScan] = useState<LatestScan | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Check if we're scanning this specific environment
  const isScanningThisEnv = isScanning && scanningEnvId === envId;
  const hasCompletedResult = contextScanResult && scanningEnvId === envId;

  // Load scan data from API
  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const [latest, history] = await Promise.all([
        getLatestScan(envId).catch(() => null),
        getScanHistory(envId, 5),
      ]);
      setLatestScan(latest?.data || null);
      setScanHistory(history.data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load security data");
    } finally {
      setIsLoading(false);
    }
  }, [envId]);

  // Initial load
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Refresh data when a scan completes in context
  useEffect(() => {
    if (contextScanResult && scanningEnvId === envId) {
      loadData();
    }
  }, [contextScanResult, scanningEnvId, envId, loadData]);

  // Start scan using context
  const handleStartScan = () => {
    setLoadError(null);
    contextStartScan(envId);
  };

  // Clear context result when leaving page
  useEffect(() => {
    return () => {
      // Optional: clear result after a delay when unmounting
      // clearResult();
    };
  }, []);

  const riskLevel = getRiskLevel(latestScan?.riskScore);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8 h-full overflow-auto space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-brand-1/10 rounded-xl flex items-center justify-center">
            <FiShield className="w-6 h-6 text-brand-1" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">Security</h1>
            <p className="text-text-secondary text-sm mt-0.5">
              Vulnerability scanning, risk scoring, and compliance monitoring for this environment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={isLoading || isScanningThisEnv}
            className="flex items-center gap-2 px-3 py-2 bg-surface-secondary text-text-secondary rounded-lg text-sm font-medium hover:bg-surface transition-colors border border-border"
          >
            <FiRefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleStartScan}
            disabled={isScanningThisEnv}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isScanningThisEnv
                ? "bg-surface-secondary text-text-muted cursor-not-allowed border border-border"
                : "bg-brand-1 text-brand-2 hover:bg-brand-1/90"
            }`}
          >
            {isScanningThisEnv ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <FiPlay className="w-4 h-4" />
                Start Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Context Error Banner (from scan) */}
      {contextError && scanningEnvId === envId && (
        <div className="bg-error-bg border border-error-border rounded-lg p-4 flex items-center gap-3">
          <FiXCircle className="w-5 h-5 text-error-text flex-shrink-0" />
          <p className="text-error-text text-sm">{contextError}</p>
          <button
            onClick={() => window.location.reload()}
            className="ml-auto text-xs text-error-text underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Load Error Banner */}
      {loadError && (
        <div className="bg-error-bg border border-error-border rounded-lg p-4 flex items-center gap-3">
          <FiXCircle className="w-5 h-5 text-error-text flex-shrink-0" />
          <p className="text-error-text text-sm">{loadError}</p>
          <button
            onClick={loadData}
            className="ml-auto text-xs text-error-text underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Progress Bar (when scanning this env) */}
      {isScanningThisEnv && (
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 bg-brand-1/10 rounded-lg flex items-center justify-center">
              <FiActivity className="w-5 h-5 text-brand-1 animate-pulse" />
            </div>
            <div>
              <div className="font-medium text-text-primary">Scan in Progress</div>
              <p className="text-text-secondary text-sm">{progress}</p>
            </div>
          </div>
          <div className="h-2 bg-surface-secondary rounded-full overflow-hidden">
            <div className="h-full bg-brand-1 animate-pulse w-full" />
          </div>
        </div>
      )}

      {/* Just Completed Banner - show fresh result from context */}
      {hasCompletedResult && (
        <div className="bg-success-bg border border-success-border rounded-lg p-4 flex items-center gap-3">
          <FiCheckCircle className="w-5 h-5 text-success-text flex-shrink-0" />
          <div className="flex-1">
            <p className="text-success-text text-sm font-medium">
              Scan completed successfully!
            </p>
            <p className="text-success-text/80 text-xs">
              Found {contextScanResult.vulnerabilitiesFound} vulnerabilities across {contextScanResult.scannedAssets} assets
              {contextScanResult.riskScore !== null && ` • Risk Score: ${contextScanResult.riskScore.toFixed(1)}`}
            </p>
          </div>
          <button
            onClick={clearResult}
            className="text-success-text/60 hover:text-success-text transition-colors"
          >
            <FiXCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FiAlertTriangle className="w-5 h-5 text-brand-1" />}
          label="Vulnerabilities"
          value={latestScan?.vulnerabilitiesFound ?? "--"}
          sub={latestScan ? `${latestScan.criticalCount} critical` : "Not scanned"}
        />
        <StatCard
          icon={<FiBarChart2 className="w-5 h-5 text-brand-1" />}
          label="Risk Score"
          value={latestScan?.riskScore?.toFixed(1) ?? "--"}
          sub={riskLevel.label}
          colorClass={riskLevel.color}
        />
        <StatCard
          icon={<FiClock className="w-5 h-5 text-brand-1" />}
          label="Last Scan"
          value={formatRelativeTime(latestScan?.completedAt)}
          sub={latestScan ? formatDate(latestScan.completedAt) : undefined}
        />
        <StatCard
          icon={<FiCheckCircle className="w-5 h-5 text-brand-1" />}
          label="Assets Scanned"
          value={latestScan?.scannedAssets ?? "--"}
          sub={latestScan ? `of ${latestScan.totalAssets}` : undefined}
        />
      </div>

      {/* Severity Breakdown */}
      {latestScan && latestScan.vulnerabilitiesFound > 0 && (
        <div className="bg-surface rounded-xl border border-border p-6">
          <SectionHeader title="Vulnerabilities by Severity" />
          <div className="grid grid-cols-4 gap-4">
            <SeverityBadge count={latestScan.criticalCount} severity="Critical" />
            <SeverityBadge count={latestScan.highCount} severity="High" />
            <SeverityBadge count={latestScan.mediumCount} severity="Medium" />
            <SeverityBadge count={latestScan.lowCount} severity="Low" />
          </div>
        </div>
      )}

      {/* Asset Vulnerability List */}
      {latestScan && latestScan.assetScans && latestScan.assetScans.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <SectionHeader
              title="Asset Vulnerabilities"
              action={
                <span className="text-sm text-text-muted">
                  {latestScan.assetScans.filter((a) => (a.vulnerabilities?.length || 0) > 0).length} assets affected
                </span>
              }
            />
          </div>
          <div className="divide-y divide-border">
            {latestScan.assetScans
              .filter((a) => (a.vulnerabilities?.length || 0) > 0)
              .map((assetScan) => (
                <AssetVulnerabilityRow key={assetScan.id} assetScan={assetScan} />
              ))}
          </div>
        </div>
      )}

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="p-4 border-b border-border">
            <SectionHeader title="Scan History" />
          </div>
          <div className="divide-y divide-border">
            {scanHistory.map((scan) => (
              <div
                key={scan.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-surface-secondary/50"
              >
                <div className="flex items-center gap-3">
                  {scan.status === "COMPLETED" ? (
                    <FiCheckCircle className="w-4 h-4 text-success-text" />
                  ) : scan.status === "FAILED" ? (
                    <FiXCircle className="w-4 h-4 text-error-text" />
                  ) : (
                    <FiActivity className="w-4 h-4 text-warning-text" />
                  )}
                  <div>
                    <div className="text-sm text-text-primary">
                      {formatDate(scan.startedAt)}
                    </div>
                    <div className="text-xs text-text-muted">
                      {scan.vulnerabilitiesFound} vulnerabilities found
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-text-primary">
                    {scan.scannedAssets}/{scan.totalAssets} assets
                  </div>
                  {scan.riskScore !== null && (
                    <div className={`text-xs ${getRiskLevel(scan.riskScore).color}`}>
                      Risk: {scan.riskScore.toFixed(1)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isScanningThisEnv && !latestScan && !loadError && (
        <EmptyState
          icon={<FiShield className="w-6 h-6 text-text-muted" />}
          title="No scans yet"
          description="Start your first vulnerability scan to see security insights for this environment."
          action={
            <button
              onClick={handleStartScan}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
            >
              <FiPlay className="w-4 h-4" />
              Start First Scan
            </button>
          }
        />
      )}

      {/* Features Coming Soon */}
      {!isScanningThisEnv && !latestScan && (
        <div className="pt-4 border-t border-border">
          <h3 className="text-sm font-medium text-text-muted mb-4">Coming Soon</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: <FiZap className="w-4 h-4" />,
                title: "Continuous Monitoring",
                description: "Scheduled scans with alerting and trend tracking.",
              },
              {
                icon: <FiMessageSquare className="w-4 h-4" />,
                title: "AI-Powered Analysis",
                description: "LLM explanations and remediation suggestions.",
              },
              {
                icon: <FiSearch className="w-4 h-4" />,
                title: "Compliance Reporting",
                description: "Generate compliance reports for audits.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="bg-surface-secondary/50 rounded-lg p-4 flex items-start gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center text-text-muted">
                  {f.icon}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-text-secondary">{f.title}</h4>
                  <p className="text-xs text-text-muted mt-0.5">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
