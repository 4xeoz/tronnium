"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  FiSettings,
} from "react-icons/fi";
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
import ScanHistoryDropdown from "@/components/security/ScanHistoryDropdown";
import AIChatPanel from "@/components/security/AIChatPanel";
import type { AssetScan as AssetScanItem, ScanSeverity } from "@/lib/api";

// ============================================
// CONFIG
// ============================================

type ViewMode = "board" | "assets" | "list" | "overview";

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
    startScan: runScanDirectly,
    configureAndStartScan: openScanConfig,
  } = useScan();

  // Core scan data
  const [latestScan, setLatestScan] = useState<LatestScan | null>(null);
  const [displayedScan, setDisplayedScan] = useState<LatestScan | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [isLoadingHistoryScan, setIsLoadingHistoryScan] = useState(false);
  const scanCache = useRef<Map<string, LatestScan>>(new Map());

  // Page state
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [searchQuery, setSearchQuery] = useState("");

  // Workflow state
  const [workflows, setWorkflows] = useState<Map<string, WorkflowItem>>(new Map());
  const [workflowStats, setWorkflowStats] = useState<WorkflowStats | null>(null);

  // Filter state
  const [selectedSeverity, setSelectedSeverity] = useState<ScanSeverity | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<VulnStatus | null>(null);

  // Selected vulnerability slide-over
  const [selectedVuln, setSelectedVuln] = useState<SelectedVuln | null>(null);

  // Derived: null = showing latest, non-null = showing a historical scan
  const selectedHistoryScanId =
    displayedScan && latestScan && displayedScan.id !== latestScan.id
      ? displayedScan.id
      : null;

  const isScanningThisEnv = isScanning && scanningEnvId === envId;

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [latest, history] = await Promise.all([
        getLatestScan(envId).catch(() => null),
        getScanHistory(envId, 10),
      ]);

      const latestData = latest?.data || null;
      setLatestScan(latestData);
      setDisplayedScan(latestData);
      if (latestData) scanCache.current.set(latestData.id, latestData);
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

  // Select a historical scan from the dropdown; null = revert to latest
  const handleScanSelect = useCallback(async (scanId: string | null) => {
    if (!scanId) {
      setDisplayedScan(latestScan);
      return;
    }
    if (scanCache.current.has(scanId)) {
      setDisplayedScan(scanCache.current.get(scanId)!);
      return;
    }
    setIsLoadingHistoryScan(true);
    try {
      const res = await getScanById(envId, scanId);
      if (res.success && res.data) {
        scanCache.current.set(scanId, res.data);
        setDisplayedScan(res.data);
      }
    } catch (err) {
      console.error("Failed to load historical scan:", err);
    } finally {
      setIsLoadingHistoryScan(false);
    }
  }, [envId, latestScan]);

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

  // Severity counts reflect the displayed scan's active threats
  const severityCounts = useMemo((): Record<ScanSeverity, number> => {
    const counts: Record<ScanSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
    displayedScan?.assetScans.forEach(a =>
      a.vulnerabilities.forEach(v => {
        const wf = getWorkflowForVuln(v.vulnerability.id, a.asset.id, v.cpeName);
        if (wf && INACTIVE_STATUSES.has(wf.status)) return;
        counts[v.vulnerability.severity] = (counts[v.vulnerability.severity] || 0) + 1;
      })
    );
    return counts;
  }, [displayedScan, getWorkflowForVuln]);

  const filteredAssetScans = useMemo(() => {
    let filtered = displayedScan?.assetScans || [];
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
  }, [displayedScan?.assetScans, selectedSeverity, selectedStatus, searchQuery, getWorkflowForVuln]);

  // Security score derived from the displayed scan
  const securityScore = displayedScan?.riskScore != null ? Math.round(100 - displayedScan.riskScore) : null;

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
            <div className="flex items-center gap-2">
              {scanHistory.length > 0 && (
                <ScanHistoryDropdown
                  scanHistory={scanHistory}
                  selectedScanId={selectedHistoryScanId}
                  onSelectScan={handleScanSelect}
                  isLoadingScan={isLoadingHistoryScan}
                />
              )}
              {/* Gear button — opens scan configuration modal */}
              <button
                onClick={() => openScanConfig(envId)}
                disabled={isScanningThisEnv}
                title="Configure scan settings"
                className="p-2 border border-border rounded-lg text-text-muted hover:text-text-primary hover:border-border-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <FiSettings className="w-4 h-4" />
              </button>
              {/* Run Scan — starts immediately with default configuration */}
              <button
                onClick={() => runScanDirectly(envId)}
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
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {isScanningThisEnv && <ScanningProgress progress={progress} />}

        {/* AI Security Analyst chat panel */}
        <AIChatPanel
          environmentId={envId}
          hasActiveScan={!!latestScan}
          vulnCount={latestScan?.vulnerabilitiesFound ?? 0}
        />

        {/* View Tabs — only shown when there is scan data to display */}
        {displayedScan && (
          <div className="flex items-center gap-2 border-b border-border">
            {[
              { id: "board",    label: "Board",    icon: FiLayout },
              { id: "assets",   label: "By Asset", icon: FiServer },
              { id: "list",     label: "List",     icon: FiLayers },
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

        {displayedScan ? (
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
                latestScan={displayedScan}
                scanHistory={scanHistory}
                workflows={workflows}
                workflowStats={workflowStats}
                securityScore={securityScore}
              />
            )}
          </div>
        ) : (
          <EmptyState onScan={() => runScanDirectly(envId)} />
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
    </div>
  );
}
