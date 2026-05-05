"use client";

import { FiAlertTriangle } from "react-icons/fi";
import type { SocAnalysis } from "@/lib/api";

const URGENCY_STYLES: Record<SocAnalysis["urgencyLevel"], string> = {
  IMMEDIATE: "bg-error-bg text-error-text border-error-border",
  HIGH:      "bg-warning-bg text-warning-text border-warning-border",
  MEDIUM:    "bg-info-bg text-info-text border-info-border",
  LOW:       "bg-success-bg text-success-text border-success-border",
};

export function UrgencyBadge({ level }: { level: SocAnalysis["urgencyLevel"] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${URGENCY_STYLES[level]}`}>
      <FiAlertTriangle className="w-3 h-3" />
      {level}
    </span>
  );
}
