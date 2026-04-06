"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  FiX,
  FiExternalLink,
  FiZap,
  FiUser,
  FiCalendar,
  FiFileText,
  FiClock,
  FiCheckCircle,
  FiAlertCircle,
} from "react-icons/fi";
import {
  updateWorkflow,
  getOrCreateWorkflow,
  getStatusLabel,
  VULN_STATUSES,
  type WorkflowItem,
  type VulnStatus,
} from "@/lib/api/vulnerabilityWorkflow";
import { explainCve, type CveExplanation, type ScanSeverity } from "@/lib/api";
import { useUser } from "@/lib/UserContext";
import { AgeBadge } from "./SecurityUI";
import { getDaysOpen } from "@/lib/vulnAge";

// ============================================
// TYPES
// ============================================

export type SelectedVuln = {
  vulnerabilityId: string;
  assetId: string;
  cpeName: string;
  cveId: string;
  description: string;
  severity: ScanSeverity;
  cvssScore: number | null;
  cvssVector: string | null;
  publishedDate: string | null;
  lastModifiedDate: string | null;
  assetName: string;
};

// ============================================
// HELPERS
// ============================================

const STATUS_COLORS: Record<VulnStatus, { bg: string; text: string; border: string }> = {
  OPEN:           { bg: "bg-error-bg",         text: "text-error-text",    border: "border-error-border" },
  IN_PROGRESS:    { bg: "bg-warning-bg",        text: "text-warning-text",  border: "border-warning-border" },
  RESOLVED:       { bg: "bg-success-bg",        text: "text-success-text",  border: "border-success-border" },
  FALSE_POSITIVE: { bg: "bg-surface-secondary", text: "text-text-secondary",border: "border-border" },
  RISK_ACCEPTED:  { bg: "bg-info-bg",           text: "text-info-text",     border: "border-info-border" },
};

const SEVERITY_TEXT: Record<string, string> = {
  CRITICAL: "text-error-text",
  HIGH:     "text-warning-text",
  MEDIUM:   "text-yellow-500",
  LOW:      "text-info-text",
  UNKNOWN:  "text-text-muted",
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase();
}

// ============================================
// AI EXPLAIN INLINE SECTION
// ============================================

function AIExplainSection({ vuln }: { vuln: SelectedVuln }) {
  const [explanation, setExplanation] = useState<CveExplanation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await explainCve({
        cveId: vuln.cveId,
        description: vuln.description,
        cvssScore: vuln.cvssScore,
        severity: vuln.severity,
      });
      if (res.success && res.data) {
        setExplanation(res.data);
      } else {
        setError(res.error || "Failed to generate explanation");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setIsLoading(false);
    }
  }, [vuln.cveId, vuln.description, vuln.cvssScore, vuln.severity]);

  if (!explanation && !isLoading && !error) {
    return (
      <button
        onClick={fetch}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 hover:border-indigo-500/50 rounded-lg transition-all"
      >
        <FiZap className="w-3.5 h-3.5" />
        Generate AI Explanation
      </button>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-text-muted text-sm">
        <div className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
        Generating explanation...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-error-text text-sm">
        <FiAlertCircle className="w-4 h-4" />
        {error}
        <button onClick={fetch} className="underline ml-1">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Summary</h4>
        <p className="text-sm text-text-secondary leading-relaxed">{explanation!.summary}</p>
      </div>
      <div>
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Business Impact</h4>
        <p className="text-sm text-text-secondary leading-relaxed">{explanation!.impact}</p>
      </div>
      <div>
        <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Remediation Steps</h4>
        <ol className="space-y-1.5">
          {explanation!.remediationSteps.map((step, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
              <span className="w-5 h-5 rounded-full bg-brand-1/10 text-brand-1 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ============================================
// MAIN SLIDE-OVER
// ============================================

export default function VulnDetailSlideOver({
  vuln,
  workflow: initialWorkflow,
  environmentId,
  onClose,
  onWorkflowSaved,
}: {
  vuln: SelectedVuln | null;
  workflow: WorkflowItem | undefined;
  environmentId: string;
  onClose: () => void;
  onWorkflowSaved: (workflow: WorkflowItem) => void;
}) {
  const { user } = useUser();
  const [workflow, setWorkflow] = useState<WorkflowItem | undefined>(initialWorkflow);
  const [isSaving, setIsSaving] = useState(false);
  const [notes, setNotes] = useState(initialWorkflow?.notes || "");
  const [dueDate, setDueDate] = useState(
    initialWorkflow?.dueDate ? initialWorkflow.dueDate.split("T")[0] : ""
  );
  const notesDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state when the selected vuln changes
  useEffect(() => {
    setWorkflow(initialWorkflow);
    setNotes(initialWorkflow?.notes || "");
    setDueDate(initialWorkflow?.dueDate ? initialWorkflow.dueDate.split("T")[0] : "");
  }, [initialWorkflow, vuln?.vulnerabilityId]);

  if (!vuln) return null;

  // Ensure a workflow record exists before saving
  const ensureWorkflow = async (): Promise<WorkflowItem | null> => {
    if (workflow) return workflow;
    const res = await getOrCreateWorkflow(
      environmentId,
      vuln.assetId,
      vuln.vulnerabilityId,
      vuln.cpeName
    );
    if (res.data) {
      setWorkflow(res.data);
      onWorkflowSaved(res.data);
      return res.data;
    }
    return null;
  };

  const save = async (patch: { status?: VulnStatus; assigneeId?: string | null; notes?: string | null; dueDate?: string | null }) => {
    setIsSaving(true);
    try {
      const wf = await ensureWorkflow();
      if (!wf) return;
      const res = await updateWorkflow(wf.id, patch);
      if (res.data) {
        setWorkflow(res.data);
        setNotes(res.data.notes || "");
        onWorkflowSaved(res.data);
      }
    } catch (e) {
      console.error("Failed to save workflow:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = (newStatus: VulnStatus) => {
    // Optimistic update
    if (workflow) setWorkflow(prev => prev ? { ...prev, status: newStatus } : prev);
    save({ status: newStatus });
  };

  const handleAssignToMe = () => {
    if (!user?.id) return;
    const newAssigneeId = workflow?.assigneeId === user.id ? null : user.id;
    if (workflow) setWorkflow(prev => prev ? { ...prev, assigneeId: newAssigneeId, assigneeName: newAssigneeId ? (user.name || null) : null } : prev);
    save({ assigneeId: newAssigneeId });
  };

  const handleNotesChange = (value: string) => {
    setNotes(value);
    if (notesDebounceRef.current) clearTimeout(notesDebounceRef.current);
    notesDebounceRef.current = setTimeout(() => {
      save({ notes: value || null });
    }, 1000);
  };

  const handleDueDateChange = (value: string) => {
    setDueDate(value);
    save({ dueDate: value ? new Date(value).toISOString() : null });
  };

  const status = (workflow?.status || "OPEN") as VulnStatus;
  const statusColors = STATUS_COLORS[status];
  const daysOpen = workflow?.firstSeenAt ? getDaysOpen(workflow.firstSeenAt) : null;
  const isOverdue = workflow?.dueDate && new Date(workflow.dueDate) < new Date() && status !== "RESOLVED";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-[520px] max-w-full bg-surface border-l border-border shadow-2xl z-50 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <a
                href={`https://nvd.nist.gov/vuln/detail/${vuln.cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-base font-bold text-text-primary hover:text-blue-500 transition-colors flex items-center gap-1"
              >
                {vuln.cveId}
                <FiExternalLink className="w-3.5 h-3.5" />
              </a>
              <span className={`text-xs font-semibold uppercase ${SEVERITY_TEXT[vuln.severity]}`}>
                {vuln.severity}
              </span>
              {vuln.cvssScore != null && (
                <span className="text-xs text-text-muted">CVSS {vuln.cvssScore.toFixed(1)}</span>
              )}
              {workflow?.firstSeenAt && (
                <AgeBadge firstSeenAt={workflow.firstSeenAt} severity={vuln.severity} />
              )}
            </div>
            <p className="text-xs text-text-muted mt-1">
              Asset: <span className="text-text-secondary">{vuln.assetName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-secondary rounded-lg transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* CVE Details */}
          <section>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">CVE Details</h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-4">{vuln.description}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-muted uppercase tracking-wide block mb-0.5">Published</span>
                <span className="text-text-primary">{formatDate(vuln.publishedDate)}</span>
              </div>
              <div>
                <span className="text-text-muted uppercase tracking-wide block mb-0.5">Last Modified</span>
                <span className="text-text-primary">{formatDate(vuln.lastModifiedDate)}</span>
              </div>
              {vuln.cvssVector && (
                <div className="col-span-2">
                  <span className="text-text-muted uppercase tracking-wide block mb-0.5">CVSS Vector</span>
                  <code className="text-[11px] text-text-secondary font-mono bg-background px-2 py-1 rounded border border-border break-all block">
                    {vuln.cvssVector}
                  </code>
                </div>
              )}
              <div className="col-span-2">
                <span className="text-text-muted uppercase tracking-wide block mb-0.5">CPE</span>
                <code className="text-[11px] text-text-muted font-mono break-all">{vuln.cpeName}</code>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <a
                href={`https://nvd.nist.gov/vuln/detail/${vuln.cveId}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary hover:bg-surface-tertiary border border-border rounded-md text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <FiExternalLink className="w-3 h-3" /> NVD
              </a>
              <a
                href={`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vuln.cveId}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary hover:bg-surface-tertiary border border-border rounded-md text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <FiExternalLink className="w-3 h-3" /> MITRE
              </a>
            </div>
          </section>

          <div className="border-t border-border" />

          {/* Workflow */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider">Workflow</h3>
              {isSaving && (
                <span className="text-[10px] text-text-muted flex items-center gap-1">
                  <div className="w-3 h-3 border border-text-muted border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              )}
            </div>

            {/* Status */}
            <div className="mb-4">
              <label className="text-xs text-text-muted block mb-1.5">Status</label>
              <div className="flex flex-wrap gap-2">
                {VULN_STATUSES.map(s => {
                  const c = STATUS_COLORS[s];
                  const isActive = status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        isActive
                          ? `${c.bg} ${c.text} ${c.border} ring-2 ring-offset-1 ring-current`
                          : "bg-surface border-border text-text-muted hover:border-border-secondary"
                      }`}
                    >
                      {getStatusLabel(s)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Assignee */}
            <div className="mb-4">
              <label className="text-xs text-text-muted block mb-1.5 flex items-center gap-1">
                <FiUser className="w-3 h-3" /> Assignee
              </label>
              <div className="flex items-center gap-3">
                {workflow?.assigneeName ? (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-1/20 text-brand-1 text-xs font-bold flex items-center justify-center">
                      {getInitials(workflow.assigneeName)}
                    </div>
                    <span className="text-sm text-text-primary">{workflow.assigneeName}</span>
                  </div>
                ) : (
                  <span className="text-sm text-text-muted italic">Unassigned</span>
                )}
                {user?.id && (
                  <button
                    onClick={handleAssignToMe}
                    className="text-xs text-brand-1 hover:underline ml-auto"
                  >
                    {workflow?.assigneeId === user.id ? "Unassign me" : "Assign to me"}
                  </button>
                )}
              </div>
            </div>

            {/* Due Date */}
            <div className="mb-4">
              <label className="text-xs text-text-muted flex items-center gap-1 mb-1.5">
                <FiCalendar className="w-3 h-3" /> Due Date
                {isOverdue && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-error-bg text-error-text text-[10px] font-medium border border-error-border">
                    Overdue
                  </span>
                )}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => handleDueDateChange(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-1/20 focus:border-brand-1 transition-all"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-text-muted flex items-center gap-1 mb-1.5">
                <FiFileText className="w-3 h-3" /> Notes
              </label>
              <textarea
                value={notes}
                onChange={e => handleNotesChange(e.target.value)}
                placeholder="Add remediation notes, context, or links..."
                rows={4}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1/20 focus:border-brand-1 transition-all resize-none"
              />
              <p className="text-[10px] text-text-muted mt-1">Auto-saves after 1 second</p>
            </div>
          </section>

          <div className="border-t border-border" />

          {/* Timeline */}
          <section>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1">
              <FiClock className="w-3.5 h-3.5" /> Timeline
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-text-muted">First seen</span>
                <span className="text-text-primary">{formatDate(workflow?.firstSeenAt)}</span>
              </div>
              {daysOpen !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Days open</span>
                  <AgeBadge firstSeenAt={workflow!.firstSeenAt} severity={vuln.severity} />
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-text-muted">Last seen</span>
                <span className="text-text-primary">{formatDate(workflow?.lastSeenAt)}</span>
              </div>
              {workflow?.resolvedAt && (
                <div className="flex items-center justify-between">
                  <span className="text-text-muted">Resolved</span>
                  <span className="text-success-text flex items-center gap-1">
                    <FiCheckCircle className="w-3 h-3" />
                    {formatDate(workflow.resolvedAt)}
                  </span>
                </div>
              )}
            </div>
          </section>

          <div className="border-t border-border" />

          {/* AI Explanation */}
          <section>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1">
              <FiZap className="w-3.5 h-3.5 text-indigo-400" /> AI Explanation
            </h3>
            <AIExplainSection vuln={vuln} />
          </section>

          {/* Bottom padding */}
          <div className="h-4" />
        </div>
      </div>
    </>
  );
}
