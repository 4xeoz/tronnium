"use client";

import { useMemo, useState } from "react";
import {
  FiExternalLink, FiEye, FiChevronLeft, FiChevronRight,
  FiCheck, FiFlag, FiZap, FiPackage,
} from "react-icons/fi";
import { Badge } from "@/components/security/SecurityUI";
import { AgeBadge } from "@/components/security/SecurityUI";
import { Button } from "@/components/ui/Button";
import { AIExplainButton } from "@/components/ui/AIExplainButton";
import { getStatusLabel, VULN_STATUSES, type WorkflowItem, type VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import { SEVERITY_CONFIG, STATUS_COLORS, INACTIVE_STATUSES, typeIcons } from "@/lib/securityConstants";
import type { AssetScan as AssetScanItem } from "@/lib/api";
import type { SelectedVuln } from "@/components/security/VulnDetailSlideOver";


type SortKey = "cvss" | "age" | "asset" | "severity";
type SortDir = "asc" | "desc";

type EnrichedVuln = AssetScanItem["vulnerabilities"][0] & {
  assetId: string;
  assetName: string;
  assetType: string;
  assetDomain: string;
  isNew: boolean;
  isKev: boolean;
  patchAvailable: boolean;
  epssScore: number | null;
};

interface FindingsTableProps {
  vulnerabilities: EnrichedVuln[];
  getWorkflowForVuln: (vulnId: string, assetId: string, cpeName: string) => WorkflowItem | undefined;
  onStatusChange: (id: string, status: VulnStatus) => void;
  onVulnClick: (vuln: SelectedVuln) => void;
  onBulkUpdate?: (updates: { ids: string[]; status: VulnStatus }) => void;
  showOnlyNew?: boolean;
}

function parseCvssVector(vector: string | null | undefined) {
  if (!vector) return [] as string[];
  const parts: string[] = [];
  if (vector.includes("AV:N")) parts.push("Network");
  if (vector.includes("AV:L")) parts.push("Local");
  if (vector.includes("AV:A")) parts.push("Adjacent");
  if (vector.includes("PR:N")) parts.push("No Priv");
  if (vector.includes("UI:N")) parts.push("No User");
  return parts.slice(0, 2);
}

export default function FindingsTable({
  vulnerabilities,
  getWorkflowForVuln,
  onStatusChange,
  onVulnClick,
  onBulkUpdate,
  showOnlyNew,
}: FindingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("severity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const activeVulns = useMemo(() => {
    return vulnerabilities.filter(v => {
      const wf = getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName);
      if (wf && INACTIVE_STATUSES.has(wf.status)) return false;
      if (showOnlyNew && !v.isNew) return false;
      return true;
    });
  }, [vulnerabilities, getWorkflowForVuln, showOnlyNew]);

  const sorted = useMemo(() => {
    const arr = [...activeVulns];
    arr.sort((a, b) => {
      const wfA = getWorkflowForVuln(a.vulnerability.id, a.assetId, a.cpeName);
      const wfB = getWorkflowForVuln(b.vulnerability.id, b.assetId, b.cpeName);
      let cmp = 0;
      if (sortKey === "severity") {
        const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };
        cmp = (order[a.vulnerability.severity] || 0) - (order[b.vulnerability.severity] || 0);
      } else if (sortKey === "cvss") {
        cmp = (a.vulnerability.cvssScore ?? 0) - (b.vulnerability.cvssScore ?? 0);
      } else if (sortKey === "age") {
        const daysA = wfA?.firstSeenAt ? new Date(wfA.firstSeenAt).getTime() : Date.now();
        const daysB = wfB?.firstSeenAt ? new Date(wfB.firstSeenAt).getTime() : Date.now();
        cmp = daysA - daysB;
      } else if (sortKey === "asset") {
        cmp = a.assetName.localeCompare(b.assetName);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [activeVulns, sortKey, sortDir, getWorkflowForVuln]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const pageIds = paged.map(v => `${v.vulnerability.id}-${v.assetId}-${v.cpeName}`);
    const allSelected = pageIds.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
    setSelectedIds(next);
  };

  const handleBulk = async (status: VulnStatus) => {
    if (selectedIds.size === 0 || !onBulkUpdate) return;
    setIsBulkUpdating(true);
    try {
      await onBulkUpdate({ ids: Array.from(selectedIds), status });
      setSelectedIds(new Set());
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const SortHeader = ({ label, k }: { label: string; k: SortKey }) => {
    const active = sortKey === k;
    return (
      <button
        onClick={() => {
          if (active) { setSortDir(d => d === "asc" ? "desc" : "asc"); }
          else { setSortKey(k); setSortDir("desc"); setPage(1); }
        }}
        className={`flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.5px] ${active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
      >
        {label}
        <span className="text-[10px]">{active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    );
  };

  return (
    <div className="space-y-3">
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-brand-1/10 border border-brand-1/20 rounded-[10px] px-3 py-2">
          <span className="text-sm font-medium text-text-primary">{selectedIds.size} selected</span>
          <div className="flex-1" />
          <Button variant="secondary" size="sm" onClick={() => handleBulk("RESOLVED")} disabled={isBulkUpdating}>
            <FiCheck className="w-3.5 h-3.5" /> Resolve
          </Button>
          <Button variant="secondary" size="sm" onClick={() => handleBulk("FALSE_POSITIVE")} disabled={isBulkUpdating}>
            <FiFlag className="w-3.5 h-3.5" /> False Positive
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <div className="bg-surface rounded-[16px] border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <thead className="bg-background-secondary border-b border-border">
              <tr>
                <th className="px-3 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={paged.length > 0 && paged.every(v => selectedIds.has(`${v.vulnerability.id}-${v.assetId}-${v.cpeName}`))}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-border-secondary accent-brand-1 cursor-pointer"
                  />
                </th>
                <th className="px-3 py-3 text-left"><SortHeader label="CVE" k="severity" /></th>
                <th className="px-3 py-3 text-left"><SortHeader label="CVSS" k="cvss" /></th>
                <th className="px-3 py-3 text-left"><SortHeader label="Asset" k="asset" /></th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left"><SortHeader label="Age" k="age" /></th>
                <th className="px-3 py-3 text-left">Threat Intel</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.map((v) => {
                const wf = getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName);
                const rowId = `${v.vulnerability.id}-${v.assetId}-${v.cpeName}`;
                const sev = SEVERITY_CONFIG[v.vulnerability.severity];
                const Icon = typeIcons[v.assetType] || typeIcons.unknown;
                const cvssParts = parseCvssVector(v.vulnerability.cvssVector);
                return (
                  <tr key={rowId} className="hover:bg-background-secondary/40 transition-colors">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rowId)}
                        onChange={() => toggleSelect(rowId)}
                        className="w-4 h-4 rounded border-border-secondary accent-brand-1 cursor-pointer"
                      />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${sev.bg}`} />
                        <button
                          onClick={() => onVulnClick({
                            vulnerabilityId: v.vulnerability.id,
                            assetId: v.assetId,
                            cpeName: v.cpeName,
                            cveId: v.vulnerability.cveId,
                            description: v.vulnerability.description,
                            severity: v.vulnerability.severity,
                            cvssScore: v.vulnerability.cvssScore ?? null,
                            cvssVector: v.vulnerability.cvssVector ?? null,
                            publishedDate: v.vulnerability.publishedDate ?? null,
                            lastModifiedDate: v.vulnerability.lastModifiedDate ?? null,
                            assetName: v.assetName,
                          })}
                          className="font-mono text-sm font-semibold text-text-primary hover:text-brand-2 hover:underline text-left"
                        >
                          {v.vulnerability.cveId}
                        </button>
                        {v.isNew && <Badge variant="accent" size="sm">NEW</Badge>}
                        {v.vulnerability.isMock && <Badge variant="neutral" size="sm">MOCK</Badge>}
                      </div>
                      <p className="text-xs text-text-muted line-clamp-1 max-w-[16rem] mt-0.5">{v.vulnerability.description}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-sm font-semibold text-text-primary">{v.vulnerability.cvssScore?.toFixed(1) || "N/A"}</div>
                      {cvssParts.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {cvssParts.map(p => (
                            <span key={p} className="text-[10px] px-1 py-0.5 rounded bg-surface-secondary text-text-muted border border-border">{p}</span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-background-secondary flex items-center justify-center shrink-0">
                          <Icon className="w-3.5 h-3.5 text-text-muted" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-text-primary">{v.assetName}</div>
                          <div className="text-xs text-text-muted">{v.assetType}{v.assetDomain && v.assetDomain !== "UNKNOWN" ? ` · ${v.assetDomain}` : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {wf?.id ? (
                        <select
                          value={wf.status}
                          onChange={e => onStatusChange(wf.id!, e.target.value as VulnStatus)}
                          className={`px-2 py-1 rounded-full text-[11px] font-semibold border cursor-pointer hover:opacity-80 transition-opacity bg-transparent ${STATUS_COLORS[wf.status].bg} ${STATUS_COLORS[wf.status].text} ${STATUS_COLORS[wf.status].border}`}
                        >
                          {VULN_STATUSES.map(s => <option key={s} value={s}>{getStatusLabel(s)}</option>)}
                        </select>
                      ) : (
                        <Badge variant="error" size="sm">OPEN</Badge>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <AgeBadge firstSeenAt={wf?.firstSeenAt} severity={v.vulnerability.severity} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {v.isKev && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-error-bg text-error-text border border-error-border">
                            <FiZap className="w-3 h-3" /> KEV
                          </span>
                        )}
                        {v.patchAvailable && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-success-bg text-success-text border border-success-border">
                            <FiPackage className="w-3 h-3" /> Patch
                          </span>
                        )}
                        {v.epssScore && v.epssScore > 0.2 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-warning-bg text-warning-text border border-warning-border">
                            EPSS {(v.epssScore * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <a
                          href={`https://nvd.nist.gov/vuln/detail/${v.vulnerability.cveId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-secondary rounded-lg transition-colors"
                          title="View on NVD"
                        >
                          <FiExternalLink className="w-4 h-4" />
                        </a>
                        <button
                          onClick={() => onVulnClick({
                            vulnerabilityId: v.vulnerability.id,
                            assetId: v.assetId,
                            cpeName: v.cpeName,
                            cveId: v.vulnerability.cveId,
                            description: v.vulnerability.description,
                            severity: v.vulnerability.severity,
                            cvssScore: v.vulnerability.cvssScore ?? null,
                            cvssVector: v.vulnerability.cvssVector ?? null,
                            publishedDate: v.vulnerability.publishedDate ?? null,
                            lastModifiedDate: v.vulnerability.lastModifiedDate ?? null,
                            assetName: v.assetName,
                          })}
                          className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-secondary rounded-lg transition-colors"
                          title="View details"
                        >
                          <FiEye className="w-4 h-4" />
                        </button>
                        <AIExplainButton
                          cveId={v.vulnerability.cveId}
                          description={v.vulnerability.description}
                          cvssScore={v.vulnerability.cvssScore}
                          severity={v.vulnerability.severity}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {paged.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-text-secondary">No active vulnerabilities match your filters.</p>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background-secondary/30">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>Showing {sorted.length > 0 ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 bg-surface border border-border rounded-[8px] text-xs focus:outline-none focus:ring-2 focus:ring-brand-1/20"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-[10px] border border-border text-text-secondary hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-text-muted">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-[10px] border border-border text-text-secondary hover:bg-surface-secondary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
