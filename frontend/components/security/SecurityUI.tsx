"use client";

import React from "react";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiMinimize,
} from "react-icons/fi";
import { getDaysOpen, getSlaStatus, formatAge, SLA_COLORS } from "@/lib/vulnAge";

// ============================================
// CARD
// ============================================

export function Card({
  children,
  className = "",
  padding = "normal",
}: {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "normal" | "large";
}) {
  const paddingClasses = { none: "", normal: "p-5", large: "p-6" };
  return (
    <div className={`bg-surface rounded-xl border border-border ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}

// ============================================
// BADGE
// ============================================

export function Badge({
  children,
  variant = "default",
  size = "md",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "info" | "neutral";
  size?: "sm" | "md";
}) {
  const variants = {
    default: "bg-surface-secondary text-text-secondary border-border",
    success: "bg-success-bg text-success-text border-success-border",
    warning: "bg-warning-bg text-warning-text border-warning-border",
    error:   "bg-error-bg text-error-text border-error-border",
    info:    "bg-info-bg text-info-text border-info-border",
    neutral: "bg-surface-tertiary text-text-muted border-border",
  };
  const sizes = { sm: "px-1.5 py-0.5 text-[10px]", md: "px-2 py-1 text-xs" };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-medium ${variants[variant]} ${sizes[size]}`}>
      {children}
    </span>
  );
}

// ============================================
// SECTION HEADER
// ============================================

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {subtitle && <p className="text-sm text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ============================================
// STAT CARD
// ============================================

export function StatCard({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  icon: Icon,
  colorClass,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: "up" | "down" | "stable" | "neutral";
  trendValue?: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  const getTrendColor = () => {
    if (trend === "up") return "text-error-text";
    if (trend === "down") return "text-success-text";
    if (trend === "stable") return "text-text-muted";
    return "text-text-secondary";
  };

  const getTrendIcon = () => {
    if (trend === "up") return <FiTrendingUp className="w-3.5 h-3.5" />;
    if (trend === "down") return <FiTrendingDown className="w-3.5 h-3.5" />;
    if (trend === "stable") return <FiMinimize className="w-3.5 h-3.5" />;
    return null;
  };

  return (
    <Card className="hover:border-border-secondary transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-text-muted text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-text-primary mt-1">{value}</p>
          {subtitle && <p className="text-text-muted text-xs mt-1">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${getTrendColor()}`}>
              {getTrendIcon()}
              <span>{trendValue || (trend === "up" ? "Increased" : trend === "down" ? "Decreased" : "Stable")}</span>
            </div>
          )}
        </div>
        <div className={`p-2.5 rounded-lg ${colorClass} shrink-0 ml-3`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

// ============================================
// AGE BADGE
// ============================================

export function AgeBadge({
  firstSeenAt,
  severity,
}: {
  firstSeenAt: string | undefined | null;
  severity: string;
}) {
  if (!firstSeenAt) return null;
  const days = getDaysOpen(firstSeenAt);
  const sla = getSlaStatus(days, severity);
  const colors = SLA_COLORS[sla];
  return (
    <span
      title={`Open for ${days} day${days !== 1 ? "s" : ""} · SLA: ${sla}`}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {formatAge(days)}
    </span>
  );
}
