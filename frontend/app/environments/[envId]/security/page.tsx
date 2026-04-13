"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  FiPlay,
  FiCheckCircle,
  FiRefreshCw,
  FiChevronDown,
  FiChevronUp,
  FiSearch,
  FiExternalLink,
  FiXCircle,
  FiPieChart,
  FiLayers,
  FiServer,
  FiMonitor,
  FiHardDrive,
  FiCpu,
  FiLayout,
  FiClock,
  FiX,
  FiShield,
  FiAlertTriangle,
  FiZap,
  FiChevronRight,
} from "react-icons/fi";
import {
  requestEnvironmentBriefing,
  type EnvironmentBriefing,
  type CriticalFinding,
} from "@/lib/api/ai";
import {
  getLatestScan,
  getScanHistory,
  getScanById,
  useScan,
  type LatestScan,
  type ScanHistoryItem,
} from "@/lib/api";
import { AIExplainButton } from "@/components/ui/AIExplainButton";
import {
  getWorkflows,
  updateWorkflow,
  getWorkflowStats,
  getStatusLabel,
  VULN_STATUSES,
  type WorkflowItem,
  type VulnStatus,
  type WorkflowStats,
} from "@/lib/api/vulnerabilityWorkflow";
import { Card, Badge, AgeBadge } from "@/components/security/SecurityUI";
import BoardView from "@/components/security/BoardView";
import OverviewPanel from "@/components/security/OverviewPanel";
import VulnDetailSlideOver, { type SelectedVuln } from "@/components/security/VulnDetailSlideOver";
import type { AssetScan as AssetScanItem, ScanSeverity } from "@/lib/api";

// ============================================
// CONFIG
// ============================================

type ViewMode = "board" | "assets" | "list" | "overview" | "history";

const SEVERITY_CONFIG = {
  CRITICAL: { bg: "bg-red-500",    bgLight: "bg-error-bg",    border: "border-error-border",   text: "text-error-text",   label: "Critical" },
  HIGH:     { bg: "bg-orange-500", bgLight: "bg-warning-bg",  border: "border-warning-border", text: "text-warning-text", label: "High" },
  MEDIUM:   { bg: "bg-yellow-500", bgLight: "bg-warning-bg",  border: "border-warning-border", text: "text-warning-text", label: "Medium" },
  LOW:      { bg: "bg-blue-500",   bgLight: "bg-info-bg",     border: "border-info-border",    text: "text-info-text",    label: "Low" },
  UNKNOWN:  { bg: "bg-gray-500",   bgLight: "bg-surface-secondary", border: "border-border",   text: "text-text-secondary", label: "Unknown" },
};

const STATUS_COLORS: Record<VulnStatus, { bg: string; text: string; border: string; dot: string }> = {
  OPEN:           { bg: "bg-error-bg",         text: "text-error-text",    border: "border-error-border",   dot: "bg-red-500" },
  IN_PROGRESS:    { bg: "bg-warning-bg",        text: "text-warning-text",  border: "border-warning-border", dot: "bg-amber-500" },
  RESOLVED:       { bg: "bg-success-bg",        text: "text-success-text",  border: "border-success-border", dot: "bg-green-500" },
  FALSE_POSITIVE: { bg: "bg-surface-secondary", text: "text-text-secondary",border: "border-border",         dot: "bg-gray-400" },
  RISK_ACCEPTED:  { bg: "bg-info-bg",           text: "text-info-text",     border: "border-info-border",    dot: "bg-blue-500" },
};

const typeIcons: Record<string, React.ElementType> = {
  server:      FiServer,
  workstation: FiMonitor,
  storage:     FiHardDrive,
  iot:         FiCpu,
  unknown:     FiLayers,
};

// ============================================
// SEVERITY FILTER BADGE
// ============================================

function SeverityBadge({
  severity,
  count,
  onClick,
  isActive,
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
          ? `${config.bgLight} ${config.border}`
          : "bg-surface border-border hover:border-border-secondary"
      }`}
    >
      <div className={`w-2.5 h-2.5 rounded-full ${config.bg}`} />
      <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
      <span className="text-text-primary font-bold">{count}</span>
    </button>
  );
}

// ============================================
// STATUS DROPDOWN
// ============================================

function StatusDropdown({
  status,
  workflowId,
  onChange,
}: {
  status: VulnStatus;
  workflowId?: string;
  onChange: (id: string, status: VulnStatus) => void;
}) {
  const colors = STATUS_COLORS[status];

  if (!workflowId) {
    return (
      <Badge
        variant={status === "RESOLVED" ? "success" : status === "OPEN" ? "error" : status === "IN_PROGRESS" ? "warning" : "neutral"}
        size="sm"
      >
        <div className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
        {getStatusLabel(status)}
      </Badge>
    );
  }

  return (
    <select
      value={status}
      onChange={e => onChange(workflowId, e.target.value as VulnStatus)}
      className={`px-2 py-1 rounded-md text-xs font-medium border cursor-pointer hover:opacity-80 transition-opacity bg-transparent ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {VULN_STATUSES.map(s => (
        <option key={s} value={s}>{getStatusLabel(s)}</option>
      ))}
    </select>
  );
}

// ============================================
// VULNERABILITY TABLE
// ============================================

function VulnerabilityTable({
  vulnerabilities,
  getWorkflowForVuln,
  onStatusChange,
  onVulnClick,
}: {
  vulnerabilities: (AssetScanItem["vulnerabilities"][0] & { assetId: string; assetName?: string })[];
  getWorkflowForVuln: (vulnId: string, assetId: string, cpeName: string) => WorkflowItem | undefined;
  onStatusChange: (id: string, status: VulnStatus) => void;
  onVulnClick?: (vuln: SelectedVuln) => void;
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
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Age</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {vulnerabilities.map((vuln, idx) => {
            const workflow = getWorkflowForVuln(vuln.vulnerability.id, vuln.assetId, vuln.cpeName);
            return (
              <tr key={idx} className="hover:bg-surface-secondary/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {onVulnClick ? (
                      <button
                        onClick={() => onVulnClick({
                          vulnerabilityId: vuln.vulnerability.id,
                          assetId: vuln.assetId,
                          cpeName: vuln.cpeName,
                          cveId: vuln.vulnerability.cveId,
                          description: vuln.vulnerability.description,
                          severity: vuln.vulnerability.severity,
                          cvssScore: vuln.vulnerability.cvssScore ?? null,
                          cvssVector: (vuln.vulnerability as any).cvssVector ?? null,
                          publishedDate: (vuln.vulnerability as any).publishedDate ?? null,
                          lastModifiedDate: (vuln.vulnerability as any).lastModifiedDate ?? null,
                          assetName: vuln.assetName ?? "",
                        })}
                        className="font-mono text-sm font-medium text-text-primary hover:text-brand-1 hover:underline text-left"
                      >
                        {vuln.vulnerability.cveId}
                      </button>
                    ) : (
                      <span className="font-mono text-sm font-medium text-text-primary">{vuln.vulnerability.cveId}</span>
                    )}
                    {vuln.vulnerability.isMock && <Badge variant="neutral" size="sm">MOCK</Badge>}
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
                  <AgeBadge
                    firstSeenAt={workflow?.firstSeenAt}
                    severity={vuln.vulnerability.severity}
                  />
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

// ============================================
// ASSET ACCORDION
// ============================================

function AssetAccordion({
  assetScan,
  getWorkflowForVuln,
  onStatusChange,
  onVulnClick,
}: {
  assetScan: AssetScanItem;
  getWorkflowForVuln: (vulnId: string, assetId: string, cpeName: string) => WorkflowItem | undefined;
  onStatusChange: (id: string, status: VulnStatus) => void;
  onVulnClick?: (vuln: SelectedVuln) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const vulnCount = assetScan.vulnerabilities?.length || 0;

  const highestSeverity = assetScan.vulnerabilities.reduce((highest, v) => {
    const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
    return order[v.vulnerability.severity] > order[highest] ? v.vulnerability.severity : highest;
  }, "UNKNOWN" as ScanSeverity);

  const config = SEVERITY_CONFIG[highestSeverity];
  const Icon = typeIcons[assetScan.asset.type] || typeIcons.unknown;

  if (vulnCount === 0) return null;

  // Attach assetId to each vuln for the table
  const vulnsWithAsset = assetScan.vulnerabilities.map(v => ({ ...v, assetId: assetScan.asset.id }));

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
          {isExpanded ? <FiChevronUp className="w-5 h-5 text-text-muted" /> : <FiChevronDown className="w-5 h-5 text-text-muted" />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          <VulnerabilityTable
            vulnerabilities={vulnsWithAsset}
            getWorkflowForVuln={getWorkflowForVuln}
            onStatusChange={onStatusChange}
            onVulnClick={onVulnClick}
          />
        </div>
      )}
    </Card>
  );
}

// ============================================
// EMPTY STATE + SCANNING PROGRESS
// ============================================

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

function formatScanDate(value: string | null) {
  if (!value) return "In progress";
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatScanDuration(startedAt: string, completedAt: string | null) {
  if (!completedAt) return "-";
  const diffMs = Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime());
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (mins < 60) return `${mins}m ${remSeconds}s`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

function ScanHistoryView({
  scanHistory,
  onOpenScan,
}: {
  scanHistory: ScanHistoryItem[];
  onOpenScan: (scanId: string) => void;
}) {
  if (scanHistory.length === 0) {
    return (
      <Card className="p-10 text-center">
        <FiClock className="w-10 h-10 text-text-muted mx-auto mb-3" />
        <h3 className="text-text-primary font-semibold mb-1">No Scan History Yet</h3>
        <p className="text-sm text-text-secondary">Run your first scan to start building history.</p>
      </Card>
    );
  }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border bg-surface-secondary/30">
        <h3 className="text-sm font-semibold text-text-primary">Scan History</h3>
        <p className="text-xs text-text-muted mt-0.5">Most recent scans first</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-secondary border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Completed</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Assets</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Vulnerabilities</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Severity Mix</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Risk Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase tracking-wide">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {scanHistory.map(scan => {
              const statusVariant =
                scan.status === "COMPLETED"
                  ? "success"
                  : scan.status === "FAILED"
                  ? "error"
                  : scan.status === "IN_PROGRESS"
                  ? "warning"
                  : "neutral";

              return (
                <tr
                  key={scan.id}
                  className="hover:bg-surface-secondary/40 transition-colors cursor-pointer"
                  onClick={() => onOpenScan(scan.id)}
                >
                  <td className="px-4 py-3 text-sm text-text-primary">{formatScanDate(scan.completedAt)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant} size="sm">{scan.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {scan.scannedAssets}/{scan.totalAssets}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary font-medium">{scan.vulnerabilitiesFound}</td>
                  <td className="px-4 py-3 text-xs text-text-secondary">
                    C:{scan.criticalCount} H:{scan.highCount} M:{scan.mediumCount} L:{scan.lowCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-primary">
                    {scan.riskScore != null ? scan.riskScore.toFixed(1) : "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {formatScanDuration(scan.startedAt, scan.completedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ScanHistorySlideOver({
  environmentId,
  scanId,
  onClose,
}: {
  environmentId: string;
  scanId: string | null;
  onClose: () => void;
}) {
  const [activeScanId, setActiveScanId] = useState<string | null>(scanId);
  const [scan, setScan] = useState<LatestScan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  const isOpen = Boolean(scanId);

  useEffect(() => {
    if (scanId) {
      setActiveScanId(scanId);
    }
  }, [scanId]);

  useEffect(() => {
    if (scanId) return;
    const timeout = setTimeout(() => {
      setActiveScanId(null);
      setScan(null);
      setExpandedAssets(new Set());
      setError(null);
    }, 300);
    return () => clearTimeout(timeout);
  }, [scanId]);

  useEffect(() => {
    if (!activeScanId) return;

    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      setScan(null);

      try {
        const response = await getScanById(environmentId, activeScanId);
        if (!isMounted) return;

        if (response.data) {
          setScan(response.data);
          setExpandedAssets(new Set(response.data.assetScans.slice(0, 1).map(a => a.id)));
        } else {
          setError(response.message || "Failed to load scan details");
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load scan details");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [environmentId, activeScanId]);

  const toggleAsset = (assetScanId: string) => {
    setExpandedAssets(prev => {
      const next = new Set(prev);
      if (next.has(assetScanId)) {
        next.delete(assetScanId);
      } else {
        next.add(assetScanId);
      }
      return next;
    });
  };

  if (!activeScanId) return null;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/45 z-40 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        className={`fixed top-0 right-0 h-full w-[620px] max-w-full bg-surface border-l border-border shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-text-primary">Scan Details</h3>
            <p className="text-sm text-text-muted mt-0.5 font-mono">{activeScanId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-secondary transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {isLoading && <div className="text-sm text-text-secondary">Loading scan details...</div>}

          {!isLoading && error && (
            <div className="bg-error-bg border border-error-border text-error-text px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {!isLoading && !error && scan && (
            <>
              <Card className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-text-muted">Completed</p>
                    <p className="text-text-primary font-medium">{formatScanDate(scan.completedAt)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Duration</p>
                    <p className="text-text-primary font-medium">{formatScanDuration(scan.startedAt, scan.completedAt)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Assets Scanned</p>
                    <p className="text-text-primary font-medium">{scan.scannedAssets}/{scan.totalAssets}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Vulnerabilities</p>
                    <p className="text-text-primary font-medium">{scan.vulnerabilitiesFound}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Risk Score</p>
                    <p className="text-text-primary font-medium">{scan.riskScore != null ? scan.riskScore.toFixed(1) : "-"}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Status</p>
                    <p className="text-text-primary font-medium">{scan.status}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-border text-xs text-text-secondary">
                  <span className="mr-3">Critical: {scan.criticalCount}</span>
                  <span className="mr-3">High: {scan.highCount}</span>
                  <span className="mr-3">Medium: {scan.mediumCount}</span>
                  <span>Low: {scan.lowCount}</span>
                </div>
              </Card>

              <Card padding="none" className="overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-surface-secondary/30">
                  <h4 className="text-sm font-semibold text-text-primary">Scanned Assets</h4>
                </div>
                <div className="divide-y divide-border">
                  {scan.assetScans.map(assetScan => (
                    <div key={assetScan.id} className="px-4 py-3">
                      <button
                        onClick={() => toggleAsset(assetScan.id)}
                        className="w-full flex items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <p className="text-sm font-medium text-text-primary">{assetScan.asset.name}</p>
                          <p className="text-xs text-text-muted">{assetScan.asset.type} · {assetScan.asset.domain}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral" size="sm">
                            {assetScan.vulnerabilities.length} CVE{assetScan.vulnerabilities.length !== 1 ? "s" : ""}
                          </Badge>
                          {expandedAssets.has(assetScan.id) ? (
                            <FiChevronUp className="w-4 h-4 text-text-muted" />
                          ) : (
                            <FiChevronDown className="w-4 h-4 text-text-muted" />
                          )}
                        </div>
                      </button>

                      {expandedAssets.has(assetScan.id) && (
                        <div className="mt-3 space-y-3 animate-in fade-in duration-200">
                          <div className="text-xs text-text-secondary bg-surface-secondary rounded-lg px-3 py-2">
                            <span className="mr-3">Critical: {assetScan.vulnerabilities.filter(v => v.vulnerability.severity === "CRITICAL").length}</span>
                            <span className="mr-3">High: {assetScan.vulnerabilities.filter(v => v.vulnerability.severity === "HIGH").length}</span>
                            <span className="mr-3">Medium: {assetScan.vulnerabilities.filter(v => v.vulnerability.severity === "MEDIUM").length}</span>
                            <span>Low: {assetScan.vulnerabilities.filter(v => v.vulnerability.severity === "LOW").length}</span>
                          </div>

                          {assetScan.vulnerabilities.length === 0 && (
                            <p className="text-xs text-text-muted">No vulnerabilities for this asset in this scan.</p>
                          )}

                          {assetScan.vulnerabilities.map(v => (
                            <div key={`${assetScan.id}-${v.vulnerability.id}`} className="rounded-lg border border-border bg-surface-secondary/30 p-3">
                              <div className="flex items-start justify-between gap-3 mb-1.5">
                                <a
                                  href={`https://nvd.nist.gov/vuln/detail/${v.vulnerability.cveId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-mono text-xs text-blue-500 hover:text-blue-400 hover:underline"
                                >
                                  {v.vulnerability.cveId}
                                </a>
                                <div className="flex items-center gap-2">
                                  <Badge
                                    variant={
                                      v.vulnerability.severity === "CRITICAL"
                                        ? "error"
                                        : v.vulnerability.severity === "HIGH"
                                        ? "warning"
                                        : "info"
                                    }
                                    size="sm"
                                  >
                                    {v.vulnerability.severity}
                                  </Badge>
                                  <span className="text-xs text-text-muted">
                                    {v.vulnerability.cvssScore != null ? `CVSS ${v.vulnerability.cvssScore.toFixed(1)}` : "CVSS N/A"}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-text-secondary line-clamp-2 mb-2">{v.vulnerability.description}</p>

                              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted">
                                <span>Published: {v.vulnerability.publishedDate ? new Date(v.vulnerability.publishedDate).toLocaleDateString("en-US") : "-"}</span>
                                <span>Last Modified: {v.vulnerability.lastModifiedDate ? new Date(v.vulnerability.lastModifiedDate).toLocaleDateString("en-US") : "-"}</span>
                                <span className="font-mono truncate max-w-[260px]">CPE: {v.cpeName}</span>
                                {v.vulnerability.isMock && <span>Mock CVE</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

// ============================================
// AI ENVIRONMENT BRIEFING PANEL
// ============================================

const RISK_STYLES: Record<EnvironmentBriefing["overallRisk"], { border: string; bg: string; text: string; badge: string }> = {
  CRITICAL: { border: "border-red-500/40",   bg: "bg-red-500/5",    text: "text-red-400",    badge: "bg-red-500/15 text-red-400 border-red-500/30" },
  HIGH:     { border: "border-orange-500/40", bg: "bg-orange-500/5", text: "text-orange-400", badge: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  MEDIUM:   { border: "border-yellow-500/40", bg: "bg-yellow-500/5", text: "text-yellow-400", badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30" },
  LOW:      { border: "border-green-500/40",  bg: "bg-green-500/5",  text: "text-green-400",  badge: "bg-green-500/15 text-green-400 border-green-500/30" },
};

const URGENCY_DOT: Record<CriticalFinding["urgency"], string> = {
  IMMEDIATE: "bg-red-500",
  HIGH:      "bg-orange-500",
  MEDIUM:    "bg-yellow-500",
  LOW:       "bg-blue-500",
};

function EnvironmentBriefingPanel({
  briefing,
  isLoading,
  error,
  onRun,
}: {
  briefing: EnvironmentBriefing | null;
  isLoading: boolean;
  error: string | null;
  onRun: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Show the trigger card when there's no briefing yet
  if (!briefing && !isLoading && !error) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center">
            <FiShield className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">AI Environment Briefing</p>
            <p className="text-xs text-text-muted">Analyze all assets and CVEs together for a holistic threat assessment</p>
          </div>
        </div>
        <button
          onClick={onRun}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all shrink-0"
        >
          <FiZap className="w-3.5 h-3.5" />
          Generate Briefing
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4 flex items-center gap-3">
        <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
        <p className="text-sm text-text-muted">Analyzing all assets and vulnerabilities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-bg border border-error-border rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-error-text text-sm">
          <FiAlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
        <button onClick={onRun} className="text-xs text-error-text underline shrink-0">Retry</button>
      </div>
    );
  }

  if (!briefing) return null;

  const riskStyle = RISK_STYLES[briefing.overallRisk];

  return (
    <div className={`bg-surface border rounded-xl overflow-hidden ${riskStyle.border}`}>
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-secondary/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${riskStyle.bg} flex items-center justify-center`}>
            <FiShield className={`w-4 h-4 ${riskStyle.text}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary flex items-center gap-2">
              AI SOC Briefing
              <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${riskStyle.badge}`}>
                {briefing.overallRisk} RISK
              </span>
            </p>
            <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{briefing.threatSummary}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onRun(); }}
            className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition-colors"
          >
            Refresh
          </button>
          {expanded ? <FiChevronDown className="w-4 h-4 text-text-muted" /> : <FiChevronRight className="w-4 h-4 text-text-muted" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-border">
          {/* Threat Summary */}
          <div className="pt-4">
            <p className="text-sm text-text-secondary leading-relaxed">{briefing.threatSummary}</p>
          </div>

          {/* Critical Findings */}
          {briefing.criticalFindings.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
                Critical Findings
              </h4>
              <div className="space-y-3">
                {briefing.criticalFindings.map((finding, i) => (
                  <div key={i} className="bg-surface-secondary rounded-lg p-3 border border-border">
                    <div className="flex items-start gap-2 mb-1.5">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${URGENCY_DOT[finding.urgency]}`} />
                      <p className="text-sm font-medium text-text-primary">{finding.title}</p>
                    </div>
                    <p className="text-xs text-text-secondary leading-relaxed ml-4 mb-2">{finding.description}</p>
                    <div className="ml-4 flex flex-wrap gap-2 items-center">
                      <div className="flex flex-wrap gap-1">
                        {finding.affectedAssets.map((asset) => (
                          <span key={asset} className="text-xs bg-surface border border-border text-text-muted px-1.5 py-0.5 rounded">
                            {asset}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-indigo-400 font-medium">→ {finding.recommendedAction}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Systemic Risks */}
          {briefing.systemicRisks.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Systemic Risks
              </h4>
              <ul className="space-y-1.5">
                {briefing.systemicRisks.map((risk, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <FiAlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0 mt-0.5" />
                    {risk}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Prioritized Actions */}
          {briefing.prioritizedActions.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Prioritized Actions
              </h4>
              <ol className="space-y-1.5">
                {briefing.prioritizedActions.map((action, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    {action}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Industry Guidance */}
          <div>
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
              Industry Guidance
            </h4>
            <p className="text-sm text-text-secondary leading-relaxed">{briefing.industryGuidance}</p>
          </div>

          {/* Footer */}
          {briefing.model !== "stub" && (
            <p className="text-xs text-text-muted">Powered by {briefing.model}</p>
          )}
        </div>
      )}
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
  const [selectedStatus, setSelectedStatus] = useState<VulnStatus | null>(null);
  const [selectedVuln, setSelectedVuln] = useState<SelectedVuln | null>(null);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [searchQuery, setSearchQuery] = useState("");

  // AI Environment Briefing state
  const [briefing, setBriefing] = useState<EnvironmentBriefing | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingError, setBriefingError] = useState<string | null>(null);

  const runEnvironmentBriefing = useCallback(async () => {
    setIsBriefingLoading(true);
    setBriefingError(null);
    try {
      const res = await requestEnvironmentBriefing(envId);
      if (res.success && res.data) {
        setBriefing(res.data);
      } else {
        setBriefingError(res.error || "Failed to generate briefing");
      }
    } catch (e) {
      setBriefingError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setIsBriefingLoading(false);
    }
  }, [envId]);

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
        workflowsRes.data.forEach(w => map.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w));
        setWorkflows(map);
      }

      if (statsRes.data) {
        setWorkflowStats(statsRes.data);
      }
    } catch (err) {
      console.error("Failed to load security data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [envId]);

  useEffect(() => { loadData(); }, [loadData]);

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
      console.error("Failed to update workflow status:", err);
    }
  };

  const getWorkflowForVuln = useCallback(
    (vulnId: string, assetId: string, cpeName: string) =>
      workflows.get(`${vulnId}-${assetId}-${cpeName}`),
    [workflows]
  );

  const INACTIVE_STATUSES = new Set<VulnStatus>(["RESOLVED", "FALSE_POSITIVE", "RISK_ACCEPTED"]);

  // Only count active (OPEN / IN_PROGRESS) threats — resolved/accepted don't show as danger
  const severityCounts = useMemo((): Record<ScanSeverity, number> => {
    const counts: Record<ScanSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
    latestScan?.assetScans.forEach(a =>
      a.vulnerabilities.forEach(v => {
        const wf = getWorkflowForVuln(v.vulnerability.id, a.asset.id, v.cpeName);
        if (wf && INACTIVE_STATUSES.has(wf.status)) return;
        counts[v.vulnerability.severity] = (counts[v.vulnerability.severity] || 0) + 1;
      })
    );
    return counts;
  }, [latestScan, getWorkflowForVuln]);

  const filteredAssetScans = useMemo(() => {
    let filtered = latestScan?.assetScans || [];
    if (selectedSeverity) {
      filtered = filtered.filter(a =>
        a.vulnerabilities.some(v => v.vulnerability.severity === selectedSeverity)
      );
    }
    if (selectedStatus) {
      filtered = filtered.filter(a =>
        a.vulnerabilities.some(v => {
          const wf = getWorkflowForVuln(v.vulnerability.id, a.asset.id, v.cpeName);
          return (wf?.status ?? "OPEN") === selectedStatus;
        })
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(a =>
        a.asset.name.toLowerCase().includes(q) ||
        a.vulnerabilities.some(v =>
          v.vulnerability.cveId.toLowerCase().includes(q) ||
          v.vulnerability.description.toLowerCase().includes(q)
        )
      );
    }
    return filtered;
  }, [latestScan?.assetScans, selectedSeverity, selectedStatus, searchQuery, getWorkflowForVuln]);

  // Convert risk score (0–100 = risk) to security score (0–100 = safe)
  const securityScore = latestScan?.riskScore != null ? Math.round(100 - latestScan.riskScore) : null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <div className="h-32 bg-surface rounded-xl border border-border" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-surface rounded-xl border border-border" />)}
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
                  : "No scans performed yet"}
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
        {isScanningThisEnv && <ScanningProgress progress={progress} />}

        {/* AI Environment Briefing */}
        {latestScan && (
          <EnvironmentBriefingPanel
            briefing={briefing}
            isLoading={isBriefingLoading}
            error={briefingError}
            onRun={runEnvironmentBriefing}
          />
        )}

        {/* View Tabs */}
        {latestScan && (
          <div className="flex items-center gap-2 border-b border-border">
            {[
              { id: "board",    label: "Board",    icon: FiLayout },
              { id: "assets",   label: "By Asset", icon: FiServer },
              { id: "list",     label: "List",     icon: FiLayers },
              { id: "history",  label: "History",  icon: FiClock },
              { id: "overview", label: "Overview", icon: FiPieChart },
            ].map(tab => (
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

        {latestScan ? (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-text-secondary">Severity:</span>
              {(Object.keys(SEVERITY_CONFIG) as ScanSeverity[]).map(severity =>
                severityCounts[severity] > 0 && (
                  <SeverityBadge
                    key={severity}
                    severity={severity}
                    count={severityCounts[severity]}
                    onClick={() => setSelectedSeverity(selectedSeverity === severity ? null : severity)}
                    isActive={selectedSeverity === severity}
                  />
                )
              )}
              <span className="text-sm font-medium text-text-secondary ml-2">Status:</span>
              {VULN_STATUSES.map(status => {
                const colors = STATUS_COLORS[status];
                const isActive = selectedStatus === status;
                return (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(isActive ? null : status)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs font-medium ${
                      isActive
                        ? `${colors.bg} ${colors.border} ${colors.text}`
                        : "bg-surface border-border text-text-secondary hover:border-border-secondary"
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    {getStatusLabel(status)}
                  </button>
                );
              })}
              {(selectedSeverity || selectedStatus) && (
                <button
                  onClick={() => { setSelectedSeverity(null); setSelectedStatus(null); }}
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
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1/20 focus:border-brand-1 transition-all w-64"
                />
              </div>
            </div>

            {/* Content by view mode */}
            {viewMode === "assets" && (
              filteredAssetScans.length > 0 ? (
                <div className="space-y-3">
                  {filteredAssetScans.map(assetScan => (
                    <AssetAccordion
                      key={assetScan.id}
                      assetScan={assetScan}
                      getWorkflowForVuln={getWorkflowForVuln}
                      onStatusChange={handleStatusChange}
                      onVulnClick={setSelectedVuln}
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
                    a.vulnerabilities.map(v => ({ ...v, assetId: a.asset.id, assetName: a.asset.name }))
                  )}
                  getWorkflowForVuln={getWorkflowForVuln}
                  onStatusChange={handleStatusChange}
                  onVulnClick={setSelectedVuln}
                />
              </Card>
            )}

            {viewMode === "board" && (
              <BoardView
                assetScans={filteredAssetScans}
                workflows={workflows}
                onStatusChange={handleStatusChange}
                environmentId={envId}
                onWorkflowCreated={workflow => {
                  setWorkflows(prev => new Map(prev.set(`${workflow.vulnerabilityId}-${workflow.assetId}-${workflow.cpeName}`, workflow)));
                }}
                onVulnClick={setSelectedVuln}
                focusStatus={selectedStatus}
              />
            )}

            {viewMode === "overview" && (
              <OverviewPanel
                latestScan={latestScan}
                scanHistory={scanHistory}
                workflows={workflows}
                workflowStats={workflowStats}
                securityScore={securityScore}
              />
            )}

            {viewMode === "history" && (
              <ScanHistoryView
                scanHistory={scanHistory}
                onOpenScan={scanId => setSelectedScanId(scanId)}
              />
            )}
          </div>
        ) : (
          <EmptyState onScan={() => contextStartScan(envId)} />
        )}
      </div>

      {selectedVuln && (
        <VulnDetailSlideOver
          vuln={selectedVuln}
          workflow={getWorkflowForVuln(selectedVuln.vulnerabilityId, selectedVuln.assetId, selectedVuln.cpeName)}
          environmentId={envId}
          onClose={() => setSelectedVuln(null)}
          onWorkflowSaved={updated => {
            setWorkflows(prev => new Map(prev.set(`${updated.vulnerabilityId}-${updated.assetId}-${updated.cpeName}`, updated)));
          }}
        />
      )}

      <ScanHistorySlideOver
        environmentId={envId}
        scanId={selectedScanId}
        onClose={() => setSelectedScanId(null)}
      />
    </div>
  );
}
