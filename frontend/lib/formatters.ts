/**
 * UI Formatters - Pure helper functions for colors, labels, and display formatting.
 * These do NOT make API calls. Keep them separate from API modules.
 */

import type { ScanSeverity } from "./api/scans";
import type { VulnStatus } from "./api/vulnerabilityWorkflow";

// ─── Risk Level ──────────────────────────────────────────────

export function getRiskLevel(score: number | null | undefined): {
  label: string;
  color: string;
} {
  if (score === null || score === undefined) {
    return { label: "Unknown", color: "text-text-muted" };
  }
  if (score < 20) return { label: "Low", color: "text-success-text" };
  if (score < 40) return { label: "Moderate", color: "text-warning-text" };
  if (score < 60) return { label: "High", color: "text-orange-500" };
  return { label: "Critical", color: "text-error-text" };
}

// ─── Severity Colors ─────────────────────────────────────────

export function getSeverityColor(severity: ScanSeverity): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500/10 text-red-500 border-red-500/20";
    case "HIGH":
      return "bg-orange-500/10 text-orange-500 border-orange-500/20";
    case "MEDIUM":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "LOW":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    default:
      return "bg-surface-secondary text-text-muted border-border";
  }
}

export function getMockSeverityColor(severity: string): string {
  switch (severity) {
    case "CRITICAL":
      return "bg-red-500 text-white";
    case "HIGH":
      return "bg-orange-500 text-white";
    case "MEDIUM":
      return "bg-yellow-500 text-black";
    case "LOW":
      return "bg-blue-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
}

// ─── Status Colors & Labels ──────────────────────────────────

export function getStatusColor(status: VulnStatus): string {
  switch (status) {
    case "OPEN":
      return "bg-red-500 text-white";
    case "IN_PROGRESS":
      return "bg-yellow-500 text-black";
    case "RESOLVED":
      return "bg-green-500 text-white";
    case "FALSE_POSITIVE":
      return "bg-gray-500 text-white";
    case "RISK_ACCEPTED":
      return "bg-blue-500 text-white";
    default:
      return "bg-gray-400 text-white";
  }
}

export function getStatusLabel(status: VulnStatus): string {
  switch (status) {
    case "OPEN":
      return "Open";
    case "IN_PROGRESS":
      return "In Progress";
    case "RESOLVED":
      return "Resolved";
    case "FALSE_POSITIVE":
      return "False Positive";
    case "RISK_ACCEPTED":
      return "Risk Accepted";
    default:
      return status;
  }
}

// ─── CVE Formatting ──────────────────────────────────────────

export function formatCveId(cveId: string): string {
  // If it's a mock CVE, make it clear
  if (cveId.startsWith("CVE-DEV-")) {
    return cveId.replace("CVE-DEV-", "DEV-");
  }
  return cveId;
}
