"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import {
  FiRefreshCw, FiSearch, FiXCircle, FiPieChart, FiLayers, FiZap,
} from "react-icons/fi";
import {
  getLatestScan, getScanHistory, getScanById, deleteScan, useScan,
  type LatestScan, type ScanHistoryItem,
} from "@/lib/api";
import {
  getWorkflows, updateWorkflow, getStatusLabel, VULN_STATUSES, bulkUpdateWorkflows,
  type WorkflowItem, type VulnStatus,
} from "@/lib/api/vulnerabilityWorkflow";
import { Card } from "@/components/security/SecurityUI";
import OverviewPanel from "@/components/security/OverviewPanel";
import VulnDetailSlideOver, { type SelectedVuln } from "@/components/security/VulnDetailSlideOver";
import ScanHistoryDropdown from "@/components/security/ScanHistoryDropdown";
import AIChatPanel from "@/components/security/AIChatPanel";
import FindingsTable from "@/components/security/FindingsTable";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SEVERITY_CONFIG, STATUS_COLORS, INACTIVE_STATUSES } from "@/lib/securityConstants";
import type { ScanSeverity } from "@/lib/api";
import { getSlaStatus } from "@/lib/vulnAge";

type ViewMode = "overview" | "findings";

function EmptyStateSec({ onScan }: { onScan: () => void }) {
  return (
    <Card className="p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success-bg flex items-center justify-center border border-success-border">
        <svg className="w-8 h-8 text-success-text" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      <h3 className="text-[22px] font-bold text-text-primary tracking-[-0.3px] mb-2">All Clear</h3>
      <p className="text-text-secondary mb-6 max-w-md mx-auto text-sm">No vulnerabilities found in this environment. Run a scan to check for the latest threats.</p>
      <Button onClick={onScan}>
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        Start Security Scan
      </Button>
    </Card>
  );
}

function ScanningProgress({ progress }: { progress: string }) {
  return (
    <div className="bg-info-bg border border-info-border rounded-[16px] p-5">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-info-bg flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-info-text border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-info-text">Security Scan in Progress</h3>
          <p className="text-info-text/80 text-sm mt-0.5">{progress}</p>
          <div className="mt-3 h-1.5 bg-info-border rounded-full overflow-hidden">
            <div className="h-full bg-info-text rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SeverityFilterPill({ severity, count, isActive, onClick }: { severity: ScanSeverity; count: number; isActive: boolean; onClick: () => void }) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-xs font-semibold ${
        isActive ? `${config.bgLight} ${config.border}` : "bg-surface border-border hover:border-border-secondary"
      }`}
    >
      <div className={`w-2 h-2 rounded-full ${config.bg}`} />
      <span className={config.text}>{config.label}</span>
      <span className="text-text-primary font-bold">{count}</span>
    </button>
  );
}

export default function SecurityPage() {
  const params = useParams();
  const envId = params.envId as string;

  const { isScanning, progress, scanResult: contextScanResult, environmentId: scanningEnvId, startScan: runScanDirectly, configureAndStartScan: openScanConfig } = useScan();

  const [latestScan, setLatestScan] = useState<LatestScan | null>(null);
  const [displayedScan, setDisplayedScan] = useState<LatestScan | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [isLoadingHistoryScan, setIsLoadingHistoryScan] = useState(false);
  const scanCache = useRef<Map<string, LatestScan>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [workflows, setWorkflows] = useState<Map<string, WorkflowItem>>(new Map());

  const [selectedSeverity, setSelectedSeverity] = useState<ScanSeverity | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<VulnStatus | null>(null);
  const [selectedVuln, setSelectedVuln] = useState<SelectedVuln | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [showOnlyNew, setShowOnlyNew] = useState(false);

  const selectedHistoryScanId = displayedScan && latestScan && displayedScan.id !== latestScan.id ? displayedScan.id : null;
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

      const workflowsRes = await getWorkflows(envId);
      if (workflowsRes.data) {
        const map = new Map<string, WorkflowItem>();
        workflowsRes.data.forEach(w => map.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w));
        setWorkflows(map);
      }
    } catch (err) {
      console.error("Failed to load security data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [envId]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (contextScanResult && scanningEnvId === envId) loadData(); }, [contextScanResult, scanningEnvId, envId, loadData]);

  const handleScanSelect = useCallback(async (scanId: string | null) => {
    if (!scanId) { setDisplayedScan(latestScan); return; }
    if (scanCache.current.has(scanId)) { setDisplayedScan(scanCache.current.get(scanId)!); return; }
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

  const handleDeleteScan = useCallback(async (scanId: string) => {
    await deleteScan(envId, scanId);
    scanCache.current.delete(scanId);
    setScanHistory((prev) => prev.filter((s) => s.id !== scanId));
    const deletedIsDisplayed = displayedScan?.id === scanId;
    const deletedIsLatest = latestScan?.id === scanId;
    if (deletedIsLatest) {
      setLatestScan(null);
      setDisplayedScan(null);
      loadData();
    } else if (deletedIsDisplayed) {
      setDisplayedScan(latestScan);
    }
  }, [envId, displayedScan, latestScan, loadData]);

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

  const handleBulkUpdate = async ({ ids, status }: { ids: string[]; status: VulnStatus }) => {
    try {
      const workflowIds: string[] = [];
      ids.forEach(compositeId => {
        const wf = workflows.get(compositeId);
        if (wf?.id) workflowIds.push(wf.id);
      });
      if (workflowIds.length === 0) return;
      const res = await bulkUpdateWorkflows(workflowIds, { status });
      if (res.data && res.data.updatedCount > 0) {
        // Reload workflows to reflect bulk changes
        const workflowsRes = await getWorkflows(envId);
        if (workflowsRes.data) {
          const map = new Map<string, WorkflowItem>();
          workflowsRes.data.forEach(w => map.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w));
          setWorkflows(map);
        }
      }
    } catch (err) {
      console.error("Bulk update failed:", err);
    }
  };

  const getWorkflowForVuln = useCallback((vulnId: string, assetId: string, cpeName: string) => workflows.get(`${vulnId}-${assetId}-${cpeName}`), [workflows]);

  const severityCounts = useMemo((): Record<ScanSeverity, number> => {
    const counts: Record<ScanSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
    displayedScan?.assetScans.forEach(a => a.vulnerabilities.forEach(v => {
      const wf = getWorkflowForVuln(v.vulnerability.id, a.asset.id, v.cpeName);
      if (wf && INACTIVE_STATUSES.has(wf.status)) return;
      counts[v.vulnerability.severity] = (counts[v.vulnerability.severity] || 0) + 1;
    }));
    return counts;
  }, [displayedScan, getWorkflowForVuln]);

  // Compute previous scan IDs to flag "new" vulnerabilities
  const previousScanVulnIds = useMemo(() => {
    if (!displayedScan || scanHistory.length < 2) return new Set<string>();
    const currentIndex = scanHistory.findIndex(s => s.id === displayedScan.id);
    const prevScan = currentIndex >= 0 ? scanHistory[currentIndex + 1] : null;
    if (!prevScan) return new Set<string>();
    const prev = scanCache.current.get(prevScan.id);
    if (!prev) return new Set<string>();
    const ids = new Set<string>();
    prev.assetScans.forEach(a => a.vulnerabilities.forEach(v => ids.add(`${v.vulnerability.id}-${a.asset.id}-${v.cpeName}`)));
    return ids;
  }, [displayedScan, scanHistory]);

  const enrichedVulns = useMemo(() => {
    const list = (displayedScan?.assetScans || []).flatMap(a =>
      a.vulnerabilities.map(v => {
        const rowId = `${v.vulnerability.id}-${a.asset.id}-${v.cpeName}`;
        const sevVal = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 }[v.vulnerability.severity] || 0;
        // Deterministic dummy values seeded from CVE ID char codes
        const seed = v.vulnerability.cveId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
        const isKev = sevVal >= 3 && (seed % 20) < 2; // ~10% of Critical/High
        const patchAvailable = (seed % 10) < 3; // ~30%
        const epssScore = sevVal >= 2 ? Math.min(0.95, (seed % 100) / 100) : null;
        return {
          ...v,
          assetId: a.asset.id,
          assetName: a.asset.name,
          assetType: a.asset.type,
          assetDomain: a.asset.domain,
          isNew: !previousScanVulnIds.has(rowId),
          isKev,
          patchAvailable,
          epssScore,
        };
      })
    );
    return list;
  }, [displayedScan, previousScanVulnIds]);

  const filteredVulns = useMemo(() => {
    let list = enrichedVulns;
    if (selectedSeverity) list = list.filter(v => v.vulnerability.severity === selectedSeverity);
    if (selectedStatus) {
      list = list.filter(v => {
        const wf = getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName);
        return (wf?.status ?? "OPEN") === selectedStatus;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v =>
        v.vulnerability.cveId.toLowerCase().includes(q) ||
        v.vulnerability.description.toLowerCase().includes(q) ||
        v.assetName.toLowerCase().includes(q)
      );
    }
    // Hide inactive by default
    list = list.filter(v => {
      const wf = getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName);
      return !wf || !INACTIVE_STATUSES.has(wf.status);
    });
    return list;
  }, [enrichedVulns, selectedSeverity, selectedStatus, searchQuery, getWorkflowForVuln]);

  // Overview metrics
  const slaBreaches = useMemo(() => {
    let count = 0;
    enrichedVulns.forEach(v => {
      const wf = getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName);
      if (wf && INACTIVE_STATUSES.has(wf.status)) return;
      const days = wf?.firstSeenAt ? Math.floor((Date.now() - new Date(wf.firstSeenAt).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const sla = getSlaStatus(days, v.vulnerability.severity);
      if (sla === "overdue") count++;
    });
    return count;
  }, [enrichedVulns, getWorkflowForVuln]);

  const newThisScan = useMemo(() => {
    return enrichedVulns.filter(v => {
      if (!v.isNew) return false;
      const wf = getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName);
      return !wf || !INACTIVE_STATUSES.has(wf.status);
    }).length;
  }, [enrichedVulns, getWorkflowForVuln]);


  const scanOverviewStats = useMemo(() => {
    let total = 0, critical = 0, high = 0, medium = 0, low = 0, resolved = 0;
    displayedScan?.assetScans.forEach(a => {
      a.vulnerabilities.forEach(v => {
        const wf = getWorkflowForVuln(v.vulnerability.id, a.asset.id, v.cpeName);
        if (wf && INACTIVE_STATUSES.has(wf.status)) {
          if (wf.status === "RESOLVED") resolved++;
          return;
        }
        total++;
        if (v.vulnerability.severity === "CRITICAL") critical++;
        else if (v.vulnerability.severity === "HIGH") high++;
        else if (v.vulnerability.severity === "MEDIUM") medium++;
        else if (v.vulnerability.severity === "LOW") low++;
      });
    });
    return { total, critical, high, medium, low, resolved };
  }, [displayedScan, getWorkflowForVuln]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <div className="h-24 bg-surface rounded-[16px] border border-border" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-28 bg-surface rounded-[16px] border border-border" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-surface border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[clamp(28px,3vw,36px)] font-bold text-text-primary tracking-[-1px] leading-[1.05]">Security Overview</h1>
              <p className="text-text-muted text-sm mt-1">
                {latestScan?.completedAt ? `Last scan: ${new Date(latestScan.completedAt).toLocaleString()}` : "No scans performed yet"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {scanHistory.length > 0 && (
                <ScanHistoryDropdown
                  scanHistory={scanHistory}
                  selectedScanId={selectedHistoryScanId}
                  onSelectScan={handleScanSelect}
                  isLoadingScan={isLoadingHistoryScan}
                  onDeleteScan={handleDeleteScan}
                />
              )}
              <Button variant="icon" onClick={() => openScanConfig(envId)} disabled={isScanningThisEnv} title="Configure scan settings">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </Button>
              <Button variant="secondary" onClick={() => setIsAiPanelOpen(true)}>
                <FiZap className="w-4 h-4" />
                AI Analyst
              </Button>
              <Button onClick={() => runScanDirectly(envId, "last-scan")} disabled={isScanningThisEnv} isLoading={isScanningThisEnv}>
                <FiRefreshCw className="w-4 h-4" />
                Run Scan
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {isScanningThisEnv && <ScanningProgress progress={progress} />}

        {displayedScan && (
          <div className="flex items-center gap-2 border-b border-border">
            {[
              { id: "overview", label: "Overview", icon: FiPieChart },
              { id: "findings", label: "Findings", icon: FiLayers },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id as ViewMode)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  viewMode === tab.id ? "border-text-primary text-text-primary" : "border-transparent text-text-muted hover:text-text-secondary"
                }`}
              >
                <tab.icon className="w-4 h-4" /> {tab.label}
                {tab.id === "findings" && (
                  <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-surface-secondary text-text-muted border border-border">
                    {filteredVulns.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {displayedScan ? (
          <div className="space-y-4">
            {viewMode === "findings" && (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-text-secondary">Severity:</span>
                  {(Object.keys(SEVERITY_CONFIG) as ScanSeverity[]).map(severity =>
                    severityCounts[severity] > 0 && (
                      <SeverityFilterPill
                        key={severity}
                        severity={severity}
                        count={severityCounts[severity]}
                        isActive={selectedSeverity === severity}
                        onClick={() => setSelectedSeverity(selectedSeverity === severity ? null : severity)}
                      />
                    )
                  )}
                  <span className="text-sm font-semibold text-text-secondary ml-2">Status:</span>
                  {VULN_STATUSES.map(status => {
                    const colors = STATUS_COLORS[status];
                    const isActive = selectedStatus === status;
                    return (
                      <button
                        key={status}
                        onClick={() => setSelectedStatus(isActive ? null : status)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-xs font-semibold ${
                          isActive ? `${colors.bg} ${colors.border} ${colors.text}` : "bg-surface border-border text-text-secondary hover:border-border-secondary"
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
                      className="text-sm text-text-muted hover:text-text-primary font-semibold flex items-center gap-1 transition-colors"
                    >
                      <FiXCircle className="w-4 h-4" /> Clear
                    </button>
                  )}
                  <div className="flex-1" />
                  <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOnlyNew}
                      onChange={(e) => setShowOnlyNew(e.target.checked)}
                      className="w-4 h-4 rounded border-border-secondary accent-brand-1"
                    />
                    Show only new
                  </label>
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <Input
                      type="text"
                      placeholder="Search CVEs, assets..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>
                <FindingsTable
                  vulnerabilities={filteredVulns}
                  getWorkflowForVuln={getWorkflowForVuln}
                  onStatusChange={handleStatusChange}
                  onVulnClick={setSelectedVuln}
                  onBulkUpdate={handleBulkUpdate}
                  showOnlyNew={showOnlyNew}
                />
              </>
            )}

            {viewMode === "overview" && displayedScan && (
              <OverviewPanel
                stats={scanOverviewStats}
                assetScans={displayedScan.assetScans}
                scanHistory={scanHistory}
                workflows={workflows}
                slaBreaches={slaBreaches}
                newThisScan={newThisScan}
              />
            )}
          </div>
        ) : (
          <EmptyStateSec onScan={() => runScanDirectly(envId, "last-scan")} />
        )}
      </div>

      <aside className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-border shadow-[var(--shadow-card)] z-50 flex flex-col transition-transform duration-200 ${isAiPanelOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-1/10 flex items-center justify-center">
              <FiZap className="w-4 h-4 text-brand-1" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">AI Security Analyst</p>
              <p className="text-xs text-text-muted">Environment-level analysis</p>
            </div>
          </div>
          <button
            onClick={() => setIsAiPanelOpen(false)}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-border text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-all active:scale-95"
          >
            <FiXCircle className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <AIChatPanel environmentId={envId} hasActiveScan={!!latestScan} vulnCount={latestScan?.vulnerabilitiesFound ?? 0} />
        </div>
      </aside>

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
