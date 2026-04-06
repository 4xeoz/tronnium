/**
 * Vulnerability age and SLA utility functions.
 * SLA thresholds follow industry-standard remediation targets.
 */

export type SlaStatus = "overdue" | "warning" | "ok";

const SLA_THRESHOLDS: Record<string, { overdue: number; warning: number }> = {
  CRITICAL: { overdue: 7,   warning: 4   },
  HIGH:     { overdue: 30,  warning: 14  },
  MEDIUM:   { overdue: 90,  warning: 60  },
  LOW:      { overdue: 180, warning: 120 },
  UNKNOWN:  { overdue: 180, warning: 120 },
};

/** Number of whole days since firstSeenAt. */
export function getDaysOpen(firstSeenAt: string): number {
  const ms = Date.now() - new Date(firstSeenAt).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/** SLA status based on days open and severity. */
export function getSlaStatus(days: number, severity: string): SlaStatus {
  const thresholds = SLA_THRESHOLDS[severity] ?? SLA_THRESHOLDS.UNKNOWN;
  if (days >= thresholds.overdue) return "overdue";
  if (days >= thresholds.warning) return "warning";
  return "ok";
}

/** Compact human-readable age: "3d", "2w", "4mo". */
export function formatAge(days: number): string {
  if (days < 1)  return "<1d";
  if (days < 7)  return `${days}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/** Tailwind classes for each SLA status. */
export const SLA_COLORS: Record<SlaStatus, { bg: string; text: string; border: string }> = {
  overdue: { bg: "bg-error-bg",   text: "text-error-text",   border: "border-error-border" },
  warning: { bg: "bg-warning-bg", text: "text-warning-text", border: "border-warning-border" },
  ok:      { bg: "bg-success-bg", text: "text-success-text", border: "border-success-border" },
};
