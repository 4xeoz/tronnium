"use client";


import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  FiExternalLink, FiEye, FiChevronLeft, FiChevronRight,
  FiCheck, FiFlag, FiZap, FiPackage, FiChevronRight as FiChevron,
} from "react-icons/fi";
import { Badge } from "@/components/security/SecurityUI";
import { AgeBadge } from "@/components/security/SecurityUI";
import { Button } from "@/components/ui/Button";
import { AIExplainButton } from "@/components/ui/AIExplainButton";
import { VULN_STATUSES, type WorkflowItem, type VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import { SEVERITY_CONFIG, STATUS_COLORS, INACTIVE_STATUSES, typeIcons } from "@/lib/securityConstants";
import { getStatusLabel } from "@/lib/formatters";
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

const SEVERITY_ORDER: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0 };

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

function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
}: {
  checked: boolean;
  indeterminate: boolean;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate && !checked;
    }
  }, [indeterminate, checked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="w-4 h-4 rounded border-border-secondary accent-brand-1 cursor-pointer"
    />
  );
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
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  const activeVulns = useMemo(() => {
    return vulnerabilities.filter(v => {
      const wf = getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName);
      if (wf && INACTIVE_STATUSES.has(wf.status)) return false;
      if (showOnlyNew && !v.isNew) return false;
      return true;
    });
  }, [vulnerabilities, getWorkflowForVuln, showOnlyNew]);

  const groupedAssets = useMemo(() => {
    const byAsset = new Map<string, {
      assetId: string;
      assetName: string;
      assetType: string;
      assetDomain: string;
      vulns: EnrichedVuln[];
    }>();

    for (const v of activeVulns) {
      if (!byAsset.has(v.assetId)) {
        byAsset.set(v.assetId, {
          assetId: v.assetId,
          assetName: v.assetName,
          assetType: v.assetType,
          assetDomain: v.assetDomain,
          vulns: [],
        });
      }
      byAsset.get(v.assetId)!.vulns.push(v);
    }

    const groups = Array.from(byAsset.values());

    groups.sort((a, b) => {
      if (sortKey === "asset") {
        const cmp = a.assetName.localeCompare(b.assetName);
        return sortDir === "asc" ? cmp : -cmp;
      }
      const worstA = Math.max(...a.vulns.map(v => SEVERITY_ORDER[v.vulnerability.severity] ?? 0));
      const worstB = Math.max(...b.vulns.map(v => SEVERITY_ORDER[v.vulnerability.severity] ?? 0));
      const cmp = worstA - worstB;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return groups;
  }, [activeVulns, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(groupedAssets.length / pageSize));
  const pagedGroups = groupedAssets.slice((page - 1) * pageSize, page * pageSize);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    const allIds = pagedGroups.flatMap(g =>
      g.vulns.map(v => `${v.vulnerability.id}-${v.assetId}-${v.cpeName}`)
    );
    const allSelected = allIds.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    allIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
    setSelectedIds(next);
  };

  const toggleSelectAsset = (vulns: EnrichedVuln[]) => {
    const ids = vulns.map(v => `${v.vulnerability.id}-${v.assetId}-${v.cpeName}`);
    const allSelected = ids.every(id => selectedIds.has(id));
    const next = new Set(selectedIds);
    ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
    setSelectedIds(next);
  };

  const toggleAsset = (assetId: string) => {
    const next = new Set(expandedAssets);
    if (next.has(assetId)) next.delete(assetId); else next.add(assetId);
    setExpandedAssets(next);
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

  const allPageIds = pagedGroups.flatMap(g =>
    g.vulns.map(v => `${v.vulnerability.id}-${v.assetId}-${v.cpeName}`)
  );
  const allPageSelected = allPageIds.length > 0 && allPageIds.every(id => selectedIds.has(id));
  const somePageSelected = allPageIds.some(id => selectedIds.has(id));

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
                  <IndeterminateCheckbox
                    checked={allPageSelected}
                    indeterminate={somePageSelected && !allPageSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-3 py-3 text-left"><SortHeader label="Asset / CVE" k="asset" /></th>
                <th className="px-3 py-3 text-left"><SortHeader label="CVSS" k="cvss" /></th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left"><SortHeader label="Age" k="age" /></th>
                <th className="px-3 py-3 text-left">Threat Intel</th>
                <th className="px-3 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pagedGroups.map((group) => {
                const isExpanded = expandedAssets.has(group.assetId);
                const Icon = typeIcons[group.assetType] || typeIcons.unknown;
                const groupIds = group.vulns.map(v => `${v.vulnerability.id}-${v.assetId}-${v.cpeName}`);
                const allGroupSelected = groupIds.every(id => selectedIds.has(id));
                const someGroupSelected = groupIds.some(id => selectedIds.has(id));

                const worstSevKey = group.vulns.reduce((acc, v) =>
                  (SEVERITY_ORDER[v.vulnerability.severity] ?? 0) > (SEVERITY_ORDER[acc] ?? 0)
                    ? v.vulnerability.severity : acc,
                  "UNKNOWN"
                );
                const sev = SEVERITY_CONFIG[worstSevKey as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG["UNKNOWN"];
                const hasKev = group.vulns.some(v => v.isKev);

                const byCpe = new Map<string, EnrichedVuln[]>();
                for (const v of group.vulns) {
                  if (!byCpe.has(v.cpeName)) byCpe.set(v.cpeName, []);
                  byCpe.get(v.cpeName)!.push(v);
                }

                return (
                  <Fragment key={group.assetId}>
                    {/* Asset header row */}
                    <tr
                      className="bg-background-secondary/60 hover:bg-background-secondary cursor-pointer select-none border-b border-border"
                      onClick={() => toggleAsset(group.assetId)}
                    >
                      <td className="px-3 py-3 w-10" onClick={e => e.stopPropagation()}>
                        <IndeterminateCheckbox
                          checked={allGroupSelected}
                          indeterminate={someGroupSelected && !allGroupSelected}
                          onChange={() => toggleSelectAsset(group.vulns)}
                        />
                      </td>
                      <td className="px-3 py-3" colSpan={5}>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="w-7 h-7 rounded-lg bg-surface flex items-center justify-center shrink-0">
                            <Icon className="w-3.5 h-3.5 text-text-muted" />
                          </div>
                          <span className="font-semibold text-text-primary">{group.assetName}</span>
                          <span className="text-xs text-text-muted">
                            {group.assetType}{group.assetDomain && group.assetDomain !== "UNKNOWN" ? ` · ${group.assetDomain}` : ""}
                          </span>
                          <span className={`text-[10px] text-white font-bold px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>
                            {worstSevKey}
                          </span>
                          <span className="text-xs text-text-muted border border-border px-1.5 py-0.5 rounded">
                            {byCpe.size} CPE{byCpe.size !== 1 ? "s" : ""}
                          </span>
                          <span className="text-xs text-text-muted border border-border px-1.5 py-0.5 rounded">
                            {group.vulns.length} vuln{group.vulns.length !== 1 ? "s" : ""}
                          </span>
                          {hasKev && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-error-bg text-error-text border border-error-border">
                              <FiZap className="w-3 h-3" /> KEV
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 w-10">
                        <FiChevron className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isExpanded ? "rotate-90" : ""}`} />
                      </td>
                    </tr>

                    {/* Animated expand row — always rendered, height animated via grid trick */}
                    <tr className="border-b border-border">
                      <td colSpan={7} className="p-0">
                        <div
                          className="grid transition-[grid-template-rows] duration-200 ease-out"
                          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                        >
                          <div className="overflow-hidden">
                            {Array.from(byCpe.entries()).map(([cpeName, vulns]) => (
                              <div key={cpeName}>
                                {/* CPE separator */}
                                <div className="flex items-center gap-2 px-10 py-1.5 bg-surface/60 border-t border-border/40">
                                  <span className="text-[10px] font-mono text-text-muted tracking-wide">{cpeName}</span>
                                </div>
                                {/* Vuln rows as a nested table so columns are self-contained */}
                                <table className="w-full border-collapse text-[14px]">
                                  <colgroup>
                                    <col style={{ width: "2.5rem" }} />
                                    <col />
                                    <col style={{ width: "7rem" }} />
                                    <col style={{ width: "8rem" }} />
                                    <col style={{ width: "6rem" }} />
                                    <col style={{ width: "8rem" }} />
                                    <col style={{ width: "7rem" }} />
                                  </colgroup>
                                  <tbody>
                                    {vulns.map((v) => {
                                      const wf = getWorkflowForVuln(v.vulnerability.id, v.assetId, v.cpeName);
                                      const rowId = `${v.vulnerability.id}-${v.assetId}-${v.cpeName}`;
                                      const vsev = SEVERITY_CONFIG[v.vulnerability.severity];
                                      const cvssParts = parseCvssVector(v.vulnerability.cvssVector);
                                      return (
                                        <tr key={rowId} className="hover:bg-background-secondary/40 transition-colors border-t border-border/30">
                                          <td className="px-3 py-2.5 pl-10">
                                            <input
                                              type="checkbox"
                                              checked={selectedIds.has(rowId)}
                                              onChange={() => toggleSelect(rowId)}
                                              className="w-4 h-4 rounded border-border-secondary accent-brand-1 cursor-pointer"
                                            />
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                              <div className={`w-2 h-2 rounded-full shrink-0 ${vsev.bg}`} />
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
                                            <p className="text-xs text-text-muted line-clamp-1 max-w-[16rem] mt-0.5 ml-4">
                                              {v.vulnerability.description}
                                            </p>
                                          </td>
                                          <td className="px-3 py-2.5">
                                            <div className="text-sm font-semibold text-text-primary">
                                              {v.vulnerability.cvssScore?.toFixed(1) || "N/A"}
                                            </div>
                                            {cvssParts.length > 0 && (
                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {cvssParts.map(p => (
                                                  <span key={p} className="text-[10px] px-1 py-0.5 rounded bg-surface-secondary text-text-muted border border-border">{p}</span>
                                                ))}
                                              </div>
                                            )}
                                          </td>
                                          <td className="px-3 py-2.5">
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
                                          <td className="px-3 py-2.5">
                                            <AgeBadge firstSeenAt={wf?.firstSeenAt} severity={v.vulnerability.severity} />
                                          </td>
                                          <td className="px-3 py-2.5">
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
                                          <td className="px-3 py-2.5">
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
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {pagedGroups.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-text-secondary">No active vulnerabilities match your filters.</p>
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background-secondary/30">
          <div className="flex items-center gap-2 text-sm text-text-muted">
            <span>
              {groupedAssets.length} asset{groupedAssets.length !== 1 ? "s" : ""} · {activeVulns.length} vuln{activeVulns.length !== 1 ? "s" : ""}
            </span>
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
