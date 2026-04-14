"use client";

import React from "react";
import {
  FiTrendingUp,
  FiTrendingDown,
  FiMinimize,
} from "react-icons/fi";
import { getDaysOpen, getSlaStatus, formatAge, SLA_COLORS } from "@/lib/vulnAge";
import { Card as BaseCard } from "@/components/ui/Card";
import { Badge as BaseBadge } from "@/components/ui/Badge";

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
  return <BaseCard padding={padding} className={className}>{children}</BaseCard>;
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
  variant?: "default" | "success" | "warning" | "error" | "info" | "neutral" | "accent";
  size?: "sm" | "md";
}) {
  return <BaseBadge variant={variant} size={size}>{children}</BaseBadge>;
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
    <div className="flex items-center justify-between gap-4 mb-4">
      <div>
        <h2 className="text-[22px] font-bold text-text-primary tracking-[-0.3px]">{title}</h2>
        {subtitle && <p className="text-[13px] text-text-muted mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
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
    <BaseCard className="hover:border-border-secondary transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-text-muted text-sm font-medium">{title}</p>
          <p className="text-[32px] font-bold text-text-primary mt-1 leading-none tracking-[-1px]">{value}</p>
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
    </BaseCard>
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
      className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
    >
      {formatAge(days)}
    </span>
  );
}
