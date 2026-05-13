"use client";

import Link from "next/link";
import { FiZap, FiArrowRight } from "react-icons/fi";
import { Card } from "@/components/ui/Card";

interface RiskSummary {
  entryPointCount: number;
  highestRisk: { id: string; score: number } | null;
  highestRiskAsset: { id: string; name: string } | null | undefined;
}

interface AttackExposureCardProps {
  riskSummary: RiskSummary | null;
  envId: string;
}

function getScoreBadgeColor(score: number): string {
  if (score > 70) return "bg-error-bg text-error-text border-error-border";
  if (score >= 40) return "bg-warning-bg text-warning-text border-warning-border";
  return "bg-success-bg text-success-text border-success-border";
}

function getScoreBarColor(score: number): string {
  if (score > 70) return "bg-red-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-green-500";
}

export function AttackExposureCard({ riskSummary, envId }: AttackExposureCardProps) {
  // Skeleton state
  if (!riskSummary) {
    return (
      <Card padding="normal" hover={false}>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-background-secondary animate-pulse" />
            <div className="h-4 w-32 bg-background-secondary rounded animate-pulse" />
          </div>
          <div className="h-8 w-48 bg-background-secondary rounded animate-pulse" />
          <div className="space-y-2">
            <div className="h-3 w-24 bg-background-secondary rounded animate-pulse" />
            <div className="h-6 w-full bg-background-secondary rounded animate-pulse" />
          </div>
        </div>
      </Card>
    );
  }

  const { entryPointCount, highestRisk, highestRiskAsset } = riskSummary;

  // Zero state
  if (entryPointCount === 0) {
    return (
      <Card padding="normal">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FiZap className="w-5 h-5 text-success-text" />
            <h3 className="text-[15px] font-bold text-text-primary tracking-[-0.2px]">
              Attack Exposure
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-success-bg text-success-text border-success-border">
              0
            </span>
            <span className="text-sm text-text-secondary">
              No attack entry points detected
            </span>
          </div>
          <Link
            href={`/environments/${envId}/map`}
            className="inline-flex items-center gap-1 text-xs text-brand-2 font-semibold hover:underline"
          >
            View on map <FiArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </Card>
    );
  }

  const score = highestRisk?.score ?? 0;

  return (
    <Card padding="normal">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <FiZap className="w-5 h-5 text-error-text" />
          <h3 className="text-[15px] font-bold text-text-primary tracking-[-0.2px]">
            Attack Exposure
          </h3>
        </div>

        {/* Entry points count */}
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getScoreBadgeColor(
              score
            )}`}
          >
            {entryPointCount}
          </span>
          <span className="text-sm text-text-secondary">
            {entryPointCount === 1
              ? "entry point detected"
              : "entry points detected"}
          </span>
        </div>

        {/* Highest risk asset */}
        {highestRiskAsset && (
          <div className="space-y-2">
            <p className="text-[11px] text-text-muted uppercase tracking-wide">
              Highest risk asset
            </p>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-text-primary truncate min-w-0">
                {highestRiskAsset.name}
              </span>
              <div className="flex-1 h-2 bg-background-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${getScoreBarColor(score)}`}
                  style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                />
              </div>
              <span className="text-sm font-bold text-text-primary shrink-0">
                {Math.round(score)}%
              </span>
            </div>
          </div>
        )}

        {/* Link to map */}
        <Link
          href={`/environments/${envId}/map`}
          className="inline-flex items-center gap-1 text-xs text-brand-2 font-semibold hover:underline"
        >
          View on map <FiArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </Card>
  );
}
