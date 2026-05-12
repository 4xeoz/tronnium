import { useMemo, useCallback, type RefObject } from "react";
import type { LatestScan, ScanSeverity, ScanHistoryItem } from "@/lib/api/scans";
import type { WorkflowItem } from "@/lib/api/vulnerabilityWorkflow";
import { INACTIVE_STATUSES } from "@/lib/securityConstants";
import { getSlaStatus } from "@/lib/vulnAge";
import type { VulnFilters } from "./useVulnFilters";

export function useVulnDerived(
  displayedScan: LatestScan | null,
  workflows_data: WorkflowItem[] | null | undefined,
  history_data: ScanHistoryItem[] | null | undefined,
  scanCache: RefObject<Map<string, LatestScan>>,
  filters: Pick<VulnFilters, "selectedSeverity" | "selectedStatus" | "searchQuery">,
) {
  const workflowsMap = useMemo(() => {
    const map = new Map<string, WorkflowItem>();
    (workflows_data ?? []).forEach(w => {
      map.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w);
    });
    return map;
  }, [workflows_data]);

  const getWorkflowForVuln = useCallback(
    (vulnId: string, assetId: string, cpeName: string) =>
      workflowsMap.get(`${vulnId}-${assetId}-${cpeName}`),
    [workflowsMap],
  );

  // Single place for the "is this vuln inactive?" check — used across all derived values
  const isInactive = useCallback(
    (vulnId: string, assetId: string, cpeName: string) => {
      const wf = getWorkflowForVuln(vulnId, assetId, cpeName);
      return !!wf && INACTIVE_STATUSES.has(wf.status);
    },
    [getWorkflowForVuln],
  );

  const previousScanVulnIds = useMemo(() => {
    if (!displayedScan || (history_data ?? []).length < 2) return new Set<string>();
    const currentIndex = (history_data ?? []).findIndex(s => s.id === displayedScan.id);
    const prevScan = currentIndex >= 0 ? history_data![currentIndex + 1] : null;
    if (!prevScan) return new Set<string>();
    const prev = scanCache.current?.get(prevScan.id);
    if (!prev) return new Set<string>();
    const ids = new Set<string>();
    prev.assetScans.forEach(a =>
      a.vulnerabilities.forEach(v => ids.add(`${v.vulnerability.id}-${a.asset.id}-${v.cpeName}`))
    );
    return ids;
  }, [displayedScan, history_data, scanCache]);

  const enrichedVulns = useMemo(() => {
    return (displayedScan?.assetScans ?? []).flatMap(a =>
      a.vulnerabilities.map(v => {
        const rowId = `${v.vulnerability.id}-${a.asset.id}-${v.cpeName}`;
        const sevVal = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 }[v.vulnerability.severity] || 0;
        const seed = v.vulnerability.cveId.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
        return {
          ...v,
          assetId: a.asset.id,
          assetName: a.asset.name,
          assetType: a.asset.type,
          assetDomain: a.asset.domain,
          isNew: !previousScanVulnIds.has(rowId),
          isKev: sevVal >= 3 && (seed % 20) < 2,
          patchAvailable: (seed % 10) < 3,
          epssScore: sevVal >= 2 ? Math.min(0.95, (seed % 100) / 100) : null,
        };
      })
    );
  }, [displayedScan, previousScanVulnIds]);

  const { selectedSeverity, selectedStatus, searchQuery } = filters;

  const filteredVulns = useMemo(() => {
    let list = enrichedVulns.filter(v => !isInactive(v.vulnerability.id, v.assetId, v.cpeName));
    if (selectedSeverity) list = list.filter(v => v.vulnerability.severity === selectedSeverity);
    if (selectedStatus) {
      list = list.filter(v =>
        (getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName)?.status ?? "OPEN") === selectedStatus
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(v =>
        v.vulnerability.cveId.toLowerCase().includes(q) ||
        v.vulnerability.description.toLowerCase().includes(q) ||
        v.assetName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [enrichedVulns, selectedSeverity, selectedStatus, searchQuery, isInactive, getWorkflowForVuln]);

  const severityCounts = useMemo((): Record<ScanSeverity, number> => {
    const counts: Record<ScanSeverity, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, UNKNOWN: 0 };
    enrichedVulns.forEach(v => {
      if (isInactive(v.vulnerability.id, v.assetId, v.cpeName)) return;
      counts[v.vulnerability.severity] = (counts[v.vulnerability.severity] || 0) + 1;
    });
    return counts;
  }, [enrichedVulns, isInactive]);

  const slaBreaches = useMemo(() => {
    let count = 0;
    enrichedVulns.forEach(v => {
      if (isInactive(v.vulnerability.id, v.assetId, v.cpeName)) return;
      const wf = getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName);
      const days = wf?.firstSeenAt
        ? Math.floor((Date.now() - new Date(wf.firstSeenAt).getTime()) / 86400000)
        : 0;
      if (getSlaStatus(days, v.vulnerability.severity) === "overdue") count++;
    });
    return count;
  }, [enrichedVulns, isInactive, getWorkflowForVuln]);

  const newThisScan = useMemo(() =>
    enrichedVulns.filter(v => v.isNew && !isInactive(v.vulnerability.id, v.assetId, v.cpeName)).length,
    [enrichedVulns, isInactive],
  );

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

  return {
    getWorkflowForVuln,
    workflowsMap,
    enrichedVulns,
    filteredVulns,
    severityCounts,
    slaBreaches,
    newThisScan,
    scanOverviewStats,
  };
}
