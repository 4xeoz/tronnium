"use client";


import { useState } from "react";
import {
  FiCheckCircle,
  FiActivity,
  FiMoreHorizontal,
  FiServer,
  FiMonitor,
  FiHardDrive,
  FiCpu,
  FiLayers,
  FiFileText,
} from "react-icons/fi";
import { VULN_STATUSES, type VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import { Badge, AgeBadge } from "./SecurityUI";
import { STATUS_COLORS, getInitials } from "@/lib/securityConstants";
import { getStatusLabel } from "@/lib/formatters";
import type { ScanSeverity } from "@/lib/api";

// ============================================
// TYPES
// ============================================

export type VulnerabilityCard = {
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

const typeIcons: Record<string, React.ElementType> = {
  server:      FiServer,
  workstation: FiMonitor,
  storage:     FiHardDrive,
  iot:         FiCpu,
  unknown:     FiLayers,
};

// ============================================
// BOARD CARD
// ============================================

export default function BoardCard({
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
