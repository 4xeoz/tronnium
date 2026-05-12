import { FiRefreshCw, FiZap, FiCalendar } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import ScanHistoryDropdown from "@/components/security/ScanHistoryDropdown";
import type { ScanHistoryItem } from "@/lib/api/scans";

type Props = {
  envId: string;
  lastScanCompletedAt: string | null | undefined;
  scheduleNextRun: string | null;
  historyData: ScanHistoryItem[] | null | undefined;
  selectedScanId: string | null | undefined;
  isLoadingHistoryScan: boolean;
  isScanningThisEnv: boolean;
  onSelectScan: (scanId: string | null) => void;
  onDeleteScan: (scanId: string) => Promise<void>;
  onOpenScanConfig: () => void;
  onRunScan: () => void;
  onOpenAiPanel: () => void;
};

function formatNextRun(date: string): string {
  const d = new Date(date);
  const diffH = Math.round((d.getTime() - Date.now()) / 3600000);
  if (diffH < 1) return "in less than an hour";
  if (diffH < 24) return `in ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return diffD === 1 ? "tomorrow" : `in ${diffD} days`;
}

export function SecurityPageHeader({
  lastScanCompletedAt,
  scheduleNextRun,
  historyData,
  selectedScanId,
  isLoadingHistoryScan,
  isScanningThisEnv,
  onSelectScan,
  onDeleteScan,
  onOpenScanConfig,
  onRunScan,
  onOpenAiPanel,
}: Props) {
  return (
    <div className="bg-surface border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[clamp(28px,3vw,36px)] font-bold text-text-primary tracking-[-1px] leading-[1.05]">
              Security Overview
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <p className="text-text-muted text-sm">
                {lastScanCompletedAt
                  ? `Last scan: ${new Date(lastScanCompletedAt).toLocaleString()}`
                  : "No scans performed yet"}
              </p>
              {scheduleNextRun && (
                <span className="flex items-center gap-1 text-xs text-brand-1 font-medium bg-brand-1/10 px-2 py-0.5 rounded-full">
                  <FiCalendar className="w-3 h-3" />
                  Next: {formatNextRun(scheduleNextRun)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(historyData ?? []).length > 0 && (
              <ScanHistoryDropdown
                scanHistory={historyData ?? []}
                selectedScanId={selectedScanId ?? null}
                onSelectScan={onSelectScan}
                isLoadingScan={isLoadingHistoryScan}
                onDeleteScan={onDeleteScan}
              />
            )}
            <Button variant="icon" onClick={onOpenScanConfig} disabled={isScanningThisEnv} title="Configure scan settings">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Button>
            <Button variant="secondary" onClick={onOpenAiPanel}>
              <FiZap className="w-4 h-4" />
              AI Analyst
            </Button>
            <Button onClick={onRunScan} disabled={isScanningThisEnv} isLoading={isScanningThisEnv}>
              <FiRefreshCw className="w-4 h-4" />
              Run Scan
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
