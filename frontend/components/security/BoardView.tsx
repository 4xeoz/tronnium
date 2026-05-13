"use client";

import { useState, useMemo } from "react";
import { FiAlertTriangle, FiMove } from "react-icons/fi";
import { getOrCreateVulnerabilityWorkflow, type WorkflowItem, type VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import { Badge } from "./SecurityUI";
import { STATUS_COLORS } from "@/lib/securityConstants";
import type { AssetScan as AssetScanItem } from "@/lib/api";
import type { SelectedVuln } from "./VulnDetailSlideOver";
import BoardCard, { type VulnerabilityCard } from "./BoardCard";

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

  const visibleColumns = focusStatus
    ? allColumns.filter(c => c.id === focusStatus)
    : allColumns;

  const handleMove = async (card: VulnerabilityCard, newStatus: VulnStatus) => {
    if (card.status === newStatus) return;
    let workflowId = card.workflowId;
    if (!workflowId) {
      setIsCreatingWorkflow(card.id);
      try {
        const response = await getOrCreateVulnerabilityWorkflow(environmentId, card.assetId, card.vulnerabilityId, card.cpeName);
        if (response && response.data) {
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
