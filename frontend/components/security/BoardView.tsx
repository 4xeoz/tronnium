"use client";

import { useState, useMemo } from "react";
import {
  FiCheckCircle,
  FiActivity,
  FiAlertTriangle,
  FiMoreHorizontal,
  FiServer,
  FiMonitor,
  FiHardDrive,
  FiCpu,
  FiLayers,
  FiMove,
  FiFileText,
} from "react-icons/fi";
import { getOrCreateWorkflow, getStatusLabel, VULN_STATUSES, type WorkflowItem, type VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import { Badge, AgeBadge } from "./SecurityUI";
import type { AssetScan as AssetScanItem, ScanSeverity } from "@/lib/api";
import type { SelectedVuln } from "./VulnDetailSlideOver";

// ============================================
// TYPES
// ============================================

type VulnerabilityCard = {
  id: string;
  vulnerabilityId: string;
  assetId: string;
  cveId: string;
  description: string;
  severity: ScanSeverity;
  cvssScore: number | null;
  cvssVector: string | null;
  publishedDate: string | null;
  lastModifiedDate: string | null;
  assetName: string;
  assetType: string;
  cpeName: string;
  workflowId?: string;
  status: VulnStatus;
  isMock?: boolean;
  assigneeName?: string | null;
  notes?: string | null;
  firstSeenAt?: string;
};

// ============================================
// CONFIG
// ============================================

const SEVERITY_CONFIG: Record<ScanSeverity, { bg: string; label: string }> = {
  CRITICAL: { bg: "bg-error-text",    label: "Critical" },
  HIGH:     { bg: "bg-warning-text", label: "High" },
  MEDIUM:   { bg: "bg-info-text",   label: "Medium" },
  LOW:      { bg: "bg-success-text",   label: "Low" },
  UNKNOWN:  { bg: "bg-text-muted",   label: "Unknown" },
};

const STATUS_COLORS: Record<VulnStatus, { bg: string; text: string; border: string; dot: string }> = {
  OPEN:           { bg: "bg-error-bg",          text: "text-error-text",    border: "border-error-border",   dot: "bg-red-500" },
  IN_PROGRESS:    { bg: "bg-warning-bg",         text: "text-warning-text",  border: "border-warning-border", dot: "bg-amber-500" },
  RESOLVED:       { bg: "bg-success-bg",         text: "text-success-text",  border: "border-success-border", dot: "bg-green-500" },
  FALSE_POSITIVE: { bg: "bg-surface-secondary",  text: "text-text-secondary",border: "border-border",         dot: "bg-text-muted" },
  RISK_ACCEPTED:  { bg: "bg-info-bg",            text: "text-info-text",     border: "border-info-border",    dot: "bg-blue-500" },
};

const typeIcons: Record<string, React.ElementType> = {
  server:      FiServer,
  workstation: FiMonitor,
  storage:     FiHardDrive,
  iot:         FiCpu,
  unknown:     FiLayers,
};

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ============================================
// BOARD CARD
// ============================================

function BoardCard({
  card,
  onMove,
  onDragStart,
  isDragging,
  isCreatingWorkflow,
  onVulnClick,
}: {
  card: VulnerabilityCard;
  onMove: (card: VulnerabilityCard, status: VulnStatus) => void;
  onDragStart: () => void;
  isDragging: boolean;
  isCreatingWorkflow?: boolean;
  onVulnClick: (card: VulnerabilityCard) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const Icon = typeIcons[card.assetType] || typeIcons.unknown;

  const handleMove = (status: VulnStatus) => {
    setIsUpdating(true);
    onMove(card, status);
    setTimeout(() => setIsUpdating(false), 500);
  };

  return (
    <div
      draggable={!isCreatingWorkflow}
      onDragStart={onDragStart}
      className={`bg-surface rounded-lg border p-3 transition-all group ${
        isCreatingWorkflow
          ? "opacity-60 border-border cursor-wait"
          : isDragging
          ? "opacity-50 rotate-2 shadow-lg cursor-grabbing"
          : isUpdating
          ? "opacity-70 border-brand-1 ring-2 ring-brand-1/20"
          : "hover:shadow-md hover:border-border-secondary border-border cursor-grab"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* CVE ID — click to open detail panel */}
          <button
            onClick={() => onVulnClick(card)}
            className="font-mono text-xs font-medium text-brand-2 hover:underline truncate text-left"
          >
            {card.cveId}
          </button>
          {card.isMock && <Badge variant="neutral" size="sm">MOCK</Badge>}
          {isCreatingWorkflow && (
            <span className="text-[10px] text-text-muted italic">Creating...</span>
          )}
        </div>
        <div className="relative shrink-0">
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={isUpdating || isCreatingWorkflow}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-surface-secondary rounded transition-colors disabled:opacity-50"
          >
            <FiMoreHorizontal className="w-4 h-4" />
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-surface rounded-lg border border-border shadow-lg z-50 py-1">
                <div className="px-3 py-1.5 text-xs font-medium text-text-muted border-b border-border">Move to...</div>
                {VULN_STATUSES.map(status => (
                  <button
                    key={status}
                    onClick={() => { handleMove(status); setShowMenu(false); }}
                    disabled={card.status === status}
                    className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-surface-secondary transition-colors disabled:opacity-50 ${
                      card.status === status ? "text-text-muted" : "text-text-primary"
                    }`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[status].dot}`} />
                    {getStatusLabel(status)}
                    {card.status === status && <FiCheckCircle className="w-3 h-3 ml-auto" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-text-secondary line-clamp-2 mb-2">{card.description}</p>

      {/* Severity + CVSS */}
      <div className="flex items-center gap-2 mb-2">
        <Badge
          variant={card.severity === "CRITICAL" ? "error" : card.severity === "HIGH" ? "warning" : "info"}
          size="sm"
        >
          {card.severity}
        </Badge>
        {card.cvssScore && (
          <span className="text-xs text-text-muted">{card.cvssScore.toFixed(1)}</span>
        )}
        {/* Age badge */}
        {card.firstSeenAt && (
          <AgeBadge firstSeenAt={card.firstSeenAt} severity={card.severity} />
        )}
        {isUpdating && (
          <div className="w-3.5 h-3.5 border-2 border-brand-1 border-t-transparent rounded-full animate-spin ml-auto" />
        )}
      </div>

      {/* Asset + Assignee row */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
          <span className="text-xs text-text-muted truncate">{card.assetName}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {card.notes && (
            <FiFileText className="w-3.5 h-3.5 text-text-muted" title="Has notes" />
          )}
          {card.assigneeName ? (
            <span
              title={card.assigneeName}
              className="w-5 h-5 rounded-full bg-brand-1/20 text-brand-1 text-[10px] font-bold flex items-center justify-center"
            >
              {getInitials(card.assigneeName)}
            </span>
          ) : (
            <span className="text-[10px] text-text-muted">—</span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-1 mt-2">
        {card.status !== "RESOLVED" && (
          <button
            onClick={() => handleMove("RESOLVED")}
            disabled={isUpdating || isCreatingWorkflow}
            className="flex-1 px-2 py-1 text-[10px] font-medium bg-success-bg text-success-text rounded hover:bg-success-bg/80 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <FiCheckCircle className="w-3 h-3" /> Resolve
          </button>
        )}
        {card.status !== "IN_PROGRESS" && card.status !== "RESOLVED" && (
          <button
            onClick={() => handleMove("IN_PROGRESS")}
            disabled={isUpdating || isCreatingWorkflow}
            className="flex-1 px-2 py-1 text-[10px] font-medium bg-warning-bg text-warning-text rounded hover:bg-warning-bg/80 transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
          >
            <FiActivity className="w-3 h-3" /> Start
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// BOARD VIEW
// ============================================

export default function BoardView({
  assetScans,
  workflows,
  onStatusChange,
  environmentId,
  onWorkflowCreated,
  onVulnClick,
  focusStatus,
}: {
  assetScans: AssetScanItem[];
  workflows: Map<string, WorkflowItem>;
  onStatusChange: (id: string, status: VulnStatus) => void;
  environmentId: string;
  onWorkflowCreated: (workflow: WorkflowItem) => void;
  onVulnClick: (vuln: SelectedVuln) => void;
  focusStatus?: VulnStatus | null;
}) {
  const [draggedCard, setDraggedCard] = useState<VulnerabilityCard | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<VulnStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreatingWorkflow, setIsCreatingWorkflow] = useState<string | null>(null);

  const allCards: VulnerabilityCard[] = useMemo(() => {
    const cards: VulnerabilityCard[] = [];
    assetScans.forEach(assetScan => {
      assetScan.vulnerabilities.forEach(vuln => {
        const workflow = workflows.get(`${vuln.vulnerability.id}-${assetScan.asset.id}-${vuln.cpeName}`);
        cards.push({
          id: `${vuln.vulnerability.id}|${assetScan.asset.id}`,
          vulnerabilityId: vuln.vulnerability.id,
          assetId: assetScan.asset.id,
          cveId: vuln.vulnerability.cveId,
          description: vuln.vulnerability.description,
          severity: vuln.vulnerability.severity,
          cvssScore: vuln.vulnerability.cvssScore,
          cvssVector: vuln.vulnerability.cvssVector ?? null,
          publishedDate: vuln.vulnerability.publishedDate ?? null,
          lastModifiedDate: vuln.vulnerability.lastModifiedDate ?? null,
          assetName: assetScan.asset.name,
          assetType: assetScan.asset.type,
          cpeName: vuln.cpeName,
          workflowId: workflow?.id,
          status: (workflow?.status || "OPEN") as VulnStatus,
          isMock: vuln.vulnerability.isMock,
          assigneeName: workflow?.assigneeName,
          notes: workflow?.notes,
          firstSeenAt: workflow?.firstSeenAt,
        });
      });
    });
    return cards;
  }, [assetScans, workflows]);

  const allColumns: { id: VulnStatus; title: string }[] = [
    { id: "OPEN",           title: "Open" },
    { id: "IN_PROGRESS",    title: "In Progress" },
    { id: "RESOLVED",       title: "Resolved" },
    { id: "FALSE_POSITIVE", title: "False Positive" },
    { id: "RISK_ACCEPTED",  title: "Risk Accepted" },
  ];

  // When focusStatus is set, only show that column
  const visibleColumns = focusStatus
    ? allColumns.filter(c => c.id === focusStatus)
    : allColumns;

  const handleMove = async (card: VulnerabilityCard, newStatus: VulnStatus) => {
    if (card.status === newStatus) return;
    let workflowId = card.workflowId;
    if (!workflowId) {
      setIsCreatingWorkflow(card.id);
      try {
        const response = await getOrCreateWorkflow(environmentId, card.assetId, card.vulnerabilityId, card.cpeName);
        if (response.data) {
          workflowId = response.data.id;
          onWorkflowCreated(response.data);
        } else {
          throw new Error("Failed to create workflow");
        }
      } catch (err) {
        console.error("Failed to create workflow:", err);
        setErrorMessage(`Cannot update ${card.cveId}: Failed to create workflow. Please try again.`);
        setTimeout(() => setErrorMessage(null), 3000);
        return;
      } finally {
        setIsCreatingWorkflow(null);
      }
    }
    onStatusChange(workflowId, newStatus);
  };

  const handleDragOver = (e: React.DragEvent, columnId: VulnStatus) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDrop = (e: React.DragEvent, columnId: VulnStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (draggedCard && draggedCard.status !== columnId) handleMove(draggedCard, columnId);
    setDraggedCard(null);
  };

  const handleVulnClick = (card: VulnerabilityCard) => {
    onVulnClick({
      vulnerabilityId: card.vulnerabilityId,
      assetId: card.assetId,
      cpeName: card.cpeName,
      cveId: card.cveId,
      description: card.description,
      severity: card.severity,
      cvssScore: card.cvssScore,
      cvssVector: card.cvssVector,
      publishedDate: card.publishedDate,
      lastModifiedDate: card.lastModifiedDate,
      assetName: card.assetName,
    });
  };

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="bg-error-bg border border-error-border text-error-text px-4 py-3 rounded-lg text-sm flex items-center gap-2">
          <FiAlertTriangle className="w-4 h-4" />
          {errorMessage}
        </div>
      )}

      <div className="flex items-center gap-2 text-text-muted text-sm">
        <FiMove className="w-4 h-4" />
        <span>Drag cards between columns · Click CVE ID for details</span>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {visibleColumns.map(column => {
          const cards = allCards.filter(c => c.status === column.id);
          return (
            <div
              key={column.id}
              className="flex-shrink-0 w-80 flex flex-col max-h-[calc(100vh-360px)]"
              onDragOver={e => handleDragOver(e, column.id)}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={e => handleDrop(e, column.id)}
            >
              <div className={`flex items-center justify-between p-3 rounded-t-lg border-t border-x transition-colors ${
                dragOverColumn === column.id
                  ? "bg-brand-1/20 border-brand-1"
                  : `${STATUS_COLORS[column.id].bg} ${STATUS_COLORS[column.id].border}`
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${STATUS_COLORS[column.id].dot}`} />
                  <span className={`font-medium text-sm ${STATUS_COLORS[column.id].text}`}>{column.title}</span>
                </div>
                <Badge variant="neutral" size="sm">{cards.length}</Badge>
              </div>

              <div className={`flex-1 overflow-y-auto border-x border-b border-border rounded-b-lg p-2 space-y-2 transition-colors ${
                dragOverColumn === column.id ? "bg-brand-1/10" : "bg-surface-secondary/50"
              }`}>
                {cards.length === 0 ? (
                  <div className="text-center py-8 text-text-muted text-sm border-2 border-dashed border-border rounded-lg">
                    Drop items here
                  </div>
                ) : (
                  cards.map(card => (
                    <BoardCard
                      key={card.id}
                      card={card}
                      onMove={handleMove}
                      onDragStart={() => setDraggedCard(card)}
                      isDragging={draggedCard?.id === card.id}
                      isCreatingWorkflow={isCreatingWorkflow === card.id}
                      onVulnClick={handleVulnClick}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
