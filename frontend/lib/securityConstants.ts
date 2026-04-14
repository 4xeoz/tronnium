import {
  FiServer, FiMonitor, FiHardDrive, FiCpu, FiLayers,
} from "react-icons/fi";
import type { VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import type { ScanSeverity } from "@/lib/api";

export const INACTIVE_STATUSES = new Set<VulnStatus>(["RESOLVED", "FALSE_POSITIVE", "RISK_ACCEPTED"]);

export const SEVERITY_CONFIG: Record<ScanSeverity, { bg: string; bgLight: string; border: string; text: string; label: string }> = {
  CRITICAL: { bg: "bg-error-text", bgLight: "bg-error-bg", border: "border-error-border", text: "text-error-text", label: "Critical" },
  HIGH:     { bg: "bg-warning-text", bgLight: "bg-warning-bg", border: "border-warning-border", text: "text-warning-text", label: "High" },
  MEDIUM:   { bg: "bg-info-text", bgLight: "bg-info-bg", border: "border-info-border", text: "text-info-text", label: "Medium" },
  LOW:      { bg: "bg-success-text", bgLight: "bg-success-bg", border: "border-success-border", text: "text-success-text", label: "Low" },
  UNKNOWN:  { bg: "bg-text-muted", bgLight: "bg-surface-secondary", border: "border-border", text: "text-text-secondary", label: "Unknown" },
};

export const STATUS_COLORS: Record<VulnStatus, { bg: string; text: string; border: string; dot: string }> = {
  OPEN:           { bg: "bg-error-bg", text: "text-error-text", border: "border-error-border", dot: "bg-error-text" },
  IN_PROGRESS:    { bg: "bg-warning-bg", text: "text-warning-text", border: "border-warning-border", dot: "bg-warning-text" },
  RESOLVED:       { bg: "bg-success-bg", text: "text-success-text", border: "border-success-border", dot: "bg-success-text" },
  FALSE_POSITIVE: { bg: "bg-surface-secondary", text: "text-text-secondary", border: "border-border", dot: "bg-text-muted" },
  RISK_ACCEPTED:  { bg: "bg-info-bg", text: "text-info-text", border: "border-info-border", dot: "bg-info-text" },
};

export const typeIcons: Record<string, React.ElementType> = {
  server: FiServer,
  workstation: FiMonitor,
  storage: FiHardDrive,
  iot: FiCpu,
  unknown: FiLayers,
};

export function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export function formatDate(date: string | Date | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
