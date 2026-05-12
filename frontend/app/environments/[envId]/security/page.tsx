"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { FiPieChart, FiLayers } from "react-icons/fi";
import { useScan } from "@/lib/api";
import { fetchSchedule } from "@/lib/api/schedule";
import type { VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import OverviewPanel from "@/components/security/OverviewPanel";
import VulnDetailSlideOver, {
  type SelectedVuln,
} from "@/components/security/VulnDetailSlideOver";
import FindingsTable from "@/components/security/FindingsTable";
import { Button } from "@/components/ui/Button";
import { useSecurityBoard } from "@/lib/hooks/useSecurityBoard";
import { useDisplayedScan } from "@/lib/hooks/useDisplayedScan";
import { useVulnFilters } from "@/lib/hooks/useVulnFilters";
import { useVulnDerived } from "@/lib/hooks/useVulnDerived";
import { EmptyStateSec } from "./EmptyStateSec";
import { ScanningProgress } from "./ScanningProgress";
import { SecurityPageHeader } from "./SecurityPageHeader";
import { WorkflowMutationFeedback } from "./WorkflowMutationFeedback";
import { FindingsFilterBar } from "./FindingsFilterBar";
import { AISidePanel } from "./AISidePanel";

export default function SecurityPage() {
  const params = useParams();
  const envId = params.envId as string;

  const {
    isScanning,
    progressMessages,
    environmentId: scanningEnvId,
    startScan: runScanDirectly,
    configureAndStartScan: openScanConfig,
  } = useScan();

  const isScanningThisEnv = isScanning && scanningEnvId === envId;

  const [scheduleNextRun, setScheduleNextRun] = useState<string | null>(null);
  useEffect(() => {
    fetchSchedule(envId).then((res) => {
      if (res?.data?.isActive && res.data.nextRunAt) setScheduleNextRun(res.data.nextRunAt);
    }).catch(() => {});
  }, [envId]);

  const {
    latestScan_data,
    latestScan_error,
    history_data,
    history_error,
    workflows_data,
    workflows_error,
    isLoading,
    updateWorkflowStatus_function,
    updateWorkflowStatus_error,
    updateWorkflowStatus_isSuccess,
    updateWorkflowStatus_reset,
    bulkUpdateWorkflowStatus_function,
    bulkUpdateWorkflowStatus_error,
    bulkUpdateWorkflowStatus_reset,
    refetch,
  } = useSecurityBoard(envId);

  const {
    displayedScan,
    isLoadingHistoryScan,
    scanCache,
    handleScanSelect,
    handleDeleteScan,
    progressMessages: reconnectProgressMessages,
  } = useDisplayedScan(envId, latestScan_data, isScanningThisEnv, refetch);

  const filters = useVulnFilters();
  const {
    viewMode,
    setViewMode,
    searchQuery,
    setSearchQuery,
    selectedSeverity,
    setSelectedSeverity,
    selectedStatus,
    setSelectedStatus,
    showOnlyNew,
    setShowOnlyNew,
    clearFilters,
  } = filters;

  const {
    getWorkflowForVuln,
    workflowsMap,
    filteredVulns,
    severityCounts,
    slaBreaches,
    newThisScan,
    scanOverviewStats,
  } = useVulnDerived(
    displayedScan,
    workflows_data,
    history_data,
    scanCache,
    filters,
  );

  const [selectedVuln, setSelectedVuln] = useState<SelectedVuln | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);

  const handleStatusChange = async (
    workflowId: string,
    newStatus: VulnStatus,
  ) => {
    updateWorkflowStatus_reset();
    try {
      await updateWorkflowStatus_function({ workflowId, status: newStatus });
    } catch {}
  };

  const handleBulkUpdate = async ({
    ids,
    status,
  }: {
    ids: string[];
    status: VulnStatus;
  }) => {
    const workflowIds = ids
      .map((id) => workflowsMap.get(id)?.id)
      .filter(Boolean) as string[];
    if (workflowIds.length === 0) return;
    bulkUpdateWorkflowStatus_reset();
    try {
      await bulkUpdateWorkflowStatus_function({ ids: workflowIds, status });
    } catch {}
  };

  // ── Guards ────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto animate-pulse space-y-6">
          <div className="h-24 bg-surface rounded-2xl border border-border" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 bg-surface rounded-2xl border border-border"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (latestScan_error && history_error && workflows_error) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-text-primary mb-4">
            Security Overview
          </h2>
          {latestScan_error && (
            <div className="text-error-text mb-2">
              Latest scan: {latestScan_error}
            </div>
          )}
          {history_error && (
            <div className="text-error-text mb-2">
              Scan history: {history_error}
            </div>
          )}
          {workflows_error && (
            <div className="text-error-text mb-2">
              Workflows: {workflows_error}
            </div>
          )}
          <Button onClick={() => refetch()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <SecurityPageHeader
        envId={envId}
        lastScanCompletedAt={latestScan_data?.completedAt}
        historyData={history_data}
        selectedScanId={displayedScan?.id}
        isLoadingHistoryScan={isLoadingHistoryScan}
        isScanningThisEnv={isScanningThisEnv}
        onSelectScan={handleScanSelect}
        onDeleteScan={handleDeleteScan}
        scheduleNextRun={scheduleNextRun}
        onOpenScanConfig={() => openScanConfig(envId)}
        onRunScan={() => runScanDirectly(envId, "last-scan")}
        onOpenAiPanel={() => setIsAiPanelOpen(true)}
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {(isScanningThisEnv || isLoadingHistoryScan) && (
          <ScanningProgress progressMessages={isScanningThisEnv ? progressMessages : reconnectProgressMessages} />
        )}

        <WorkflowMutationFeedback
          updateError={updateWorkflowStatus_error}
          bulkError={bulkUpdateWorkflowStatus_error}
          isSuccess={updateWorkflowStatus_isSuccess}
        />

        {displayedScan && (
          <div className="flex items-center gap-2 border-b border-border">
            {(
              [
                { id: "overview", label: "Overview", icon: FiPieChart },
                { id: "findings", label: "Findings", icon: FiLayers },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setViewMode(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                  viewMode === tab.id
                    ? "border-text-primary text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-secondary"
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
                <FindingsFilterBar
                  severityCounts={severityCounts}
                  selectedSeverity={selectedSeverity}
                  onSeverityChange={setSelectedSeverity}
                  selectedStatus={selectedStatus}
                  onStatusChange={setSelectedStatus}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  showOnlyNew={showOnlyNew}
                  onShowOnlyNewChange={setShowOnlyNew}
                  onClearFilters={clearFilters}
                />
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
            {viewMode === "overview" && (
              <OverviewPanel
                stats={scanOverviewStats}
                assetScans={displayedScan.assetScans}
                scanHistory={history_data ?? []}
                workflows={workflowsMap}
                slaBreaches={slaBreaches}
                newThisScan={newThisScan}
              />
            )}
          </div>
        ) : (
          <EmptyStateSec onScan={() => runScanDirectly(envId, "last-scan")} />
        )}
      </div>

      <AISidePanel
        isOpen={isAiPanelOpen}
        onClose={() => setIsAiPanelOpen(false)}
        environmentId={envId}
        hasActiveScan={!!latestScan_data}
        vulnCount={latestScan_data?.vulnerabilitiesFound ?? 0}
      />

      {selectedVuln && (
        <VulnDetailSlideOver
          vuln={selectedVuln}
          workflow={getWorkflowForVuln(
            selectedVuln.vulnerabilityId,
            selectedVuln.assetId,
            selectedVuln.cpeName,
          )}
          environmentId={envId}
          onClose={() => setSelectedVuln(null)}
          onWorkflowSaved={() => {}}
        />
      )}
    </div>
  );
}
