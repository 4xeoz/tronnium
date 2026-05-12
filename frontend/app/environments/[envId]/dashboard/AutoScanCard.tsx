import { FiZap } from "react-icons/fi";
import type { ScanSchedule, ScheduleFrequency } from "@/lib/api/schedule";

const FREQUENCY_LABELS: Record<ScheduleFrequency, string> = {
  MINUTELY: "Every minute",
  HOURLY: "Every hour",
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
};

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const diff = new Date(dateStr).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  const hrs = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const future = diff > 0;
  if (mins < 2) return future ? "in <1 min" : "just now";
  if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
  if (hrs < 24) return future ? `in ${hrs}h` : `${hrs}h ago`;
  return future ? `in ${days}d` : `${days}d ago`;
}

type Props = {
  schedule: ScanSchedule | null;
  isLoading: boolean;
  isMutating: boolean;
  onToggle: () => void;
  onFrequencyChange: (freq: ScheduleFrequency) => void;
};

export function AutoScanCard({ schedule, isLoading, isMutating, onToggle, onFrequencyChange }: Props) {
  const enabled = schedule?.isActive ?? false;
  const frequency = schedule?.frequency ?? "DAILY";

  const labelColor = enabled ? "text-brand-2/80" : "text-text-muted";
  const valueColor = enabled ? "text-brand-2" : "text-text-primary";

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-5 flex-shrink-0 h-[190px] animate-pulse" />
    );
  }

  return (
    <div
      className={`rounded-2xl border p-5 flex-shrink-0 transition-colors ${
        enabled ? "bg-brand-1 border-brand-1" : "bg-surface border-border"
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className={`font-bold flex items-center gap-2 text-[16px] tracking-[-0.2px] ${valueColor}`}>
          <FiZap className={`w-4 h-4 ${enabled ? "text-brand-2" : "text-brand-1"}`} />
          Auto Scan
        </h3>
        <button
          onClick={onToggle}
          disabled={isMutating}
          aria-label="Toggle auto scan"
          className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-brand-2/30" : "bg-surface-secondary border border-border"
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full shadow-sm transition-transform ${
              enabled ? "bg-brand-2 -translate-x-5" : "bg-text-muted -translate-x-0.5"
            }`}
          />
        </button>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className={labelColor}>Status</span>
          <span className={`font-medium ${valueColor}`}>{enabled ? "Active" : "Paused"}</span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className={`shrink-0 ${labelColor}`}>Frequency</span>
          <select
            value={frequency}
            onChange={(e) => onFrequencyChange(e.target.value as ScheduleFrequency)}
            disabled={isMutating}
            className={`min-w-[8rem] px-2 py-1 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-2 appearance-none text-right disabled:opacity-50 ${
              enabled
                ? "bg-brand-2/10 border border-brand-2/20 text-brand-2 focus:ring-brand-2/30"
                : "bg-background-secondary border border-border text-text-primary focus:ring-brand-1/20"
            }`}
          >
            {(Object.keys(FREQUENCY_LABELS) as ScheduleFrequency[]).map((f) => (
              <option key={f} value={f}>{FREQUENCY_LABELS[f]}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className={labelColor}>Next run</span>
          <span className={`font-medium ${valueColor}`}>
            {enabled ? formatRelative(schedule?.nextRunAt) : "Paused"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className={labelColor}>Last run</span>
          <span className={`font-medium ${valueColor}`}>{formatRelative(schedule?.lastRunAt)}</span>
        </div>
      </div>
    </div>
  );
}
