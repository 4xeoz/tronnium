import { FiShield, FiCheckCircle, FiPlay, FiChevronRight, FiZap } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RiskSentence } from "./RiskSentence";
import { VulnBarChart } from "./VulnBarChart";
import type { DashboardOverview } from "@/lib/api/dashboard";

type Props = {
  overview: DashboardOverview | null | undefined;
  isScanningThisEnv: boolean;
  progressMessages: string[];
  totalActiveThreats: number;
  onViewSecurity: () => void;
  onRescan: () => void;
};

export function SecurityStatusCard({
  overview,
  isScanningThisEnv,
  progressMessages,
  totalActiveThreats,
  onViewSecurity,
  onRescan,
}: Props) {
  return (
    <div className="bg-surface rounded-2xl border border-border p-5 flex-shrink-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-text-primary flex items-center gap-2 text-[18px] tracking-[-0.2px]">
          <FiShield className="w-5 h-5 text-brand-1" />
          Security Status
        </h3>
        <div className="flex items-center gap-2">
          {(overview?.overdue ?? 0) > 0 && (
            <Badge variant="error" size="sm">{overview!.overdue} overdue</Badge>
          )}
          {isScanningThisEnv && (
            <Badge variant="accent" size="sm">Scanning...</Badge>
          )}
        </div>
      </div>

      {isScanningThisEnv && (
        <div className="text-center py-4">
          <div className="w-8 h-8 border-2 border-brand-1 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-text-secondary">
            {progressMessages[progressMessages.length - 1] ?? "Initializing..."}
          </p>
        </div>
      )}

      {!isScanningThisEnv && overview?.latestScan && (
        <div className="space-y-4">
          <RiskSentence stats={overview.severityCounts} />

          {totalActiveThreats > 0 ? (
            <VulnBarChart
              critical={overview.severityCounts.critical}
              high={overview.severityCounts.high}
              medium={overview.severityCounts.medium}
              low={overview.severityCounts.low}
            />
          ) : (
            <div className="flex items-center gap-2 text-success-text bg-success-bg rounded-xl p-3 border border-success-border">
              <FiCheckCircle className="w-5 h-5" />
              <span className="text-sm font-medium">No vulnerabilities detected</span>
            </div>
          )}

          <div className="text-xs text-text-muted">
            Last scan: {new Date(overview.latestScan.completedAt).toLocaleDateString()}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="secondary" size="sm" onClick={onViewSecurity} className="flex-1">
              View Details <FiChevronRight className="w-3 h-3" />
            </Button>
            <Button size="sm" onClick={onRescan} disabled={isScanningThisEnv} className="flex-1">
              <FiPlay className="w-3 h-3" /> Rescan
            </Button>
          </div>
        </div>
      )}

      {!isScanningThisEnv && !overview?.latestScan && (
        <div className="text-center py-4">
          <FiShield className="w-12 h-12 text-text-muted mx-auto mb-3" />
          <p className="text-sm text-text-secondary mb-3">No security scan yet</p>
          <Button size="sm" onClick={onRescan}>
            <FiZap className="w-4 h-4" /> Run First Scan
          </Button>
        </div>
      )}
    </div>
  );
}
