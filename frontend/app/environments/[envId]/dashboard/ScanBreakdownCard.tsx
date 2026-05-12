import { FiList, FiChevronRight } from "react-icons/fi";

type Breakdown = {
  open: number;
  inProgress: number;
  resolved: number;
};

type BreakdownRow = {
  label: string;
  value: number;
  barColor: string;
  textColor: string;
};

type Props = {
  breakdown: Breakdown;
  onManageWorkflows: () => void;
};

export function ScanBreakdownCard({ breakdown, onManageWorkflows }: Props) {
  const total = breakdown.open + breakdown.inProgress + breakdown.resolved || 1;

  const rows: BreakdownRow[] = [
    { label: "Open", value: breakdown.open, barColor: "bg-error-text", textColor: "text-error-text" },
    { label: "In Progress", value: breakdown.inProgress, barColor: "bg-warning-text", textColor: "text-warning-text" },
    { label: "Resolved", value: breakdown.resolved, barColor: "bg-success-text", textColor: "text-success-text" },
  ];

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 flex-shrink-0">
      <h3 className="font-bold text-text-primary flex items-center gap-2 text-[16px] tracking-[-0.2px] mb-3">
        <FiList className="w-4 h-4 text-brand-1" />
        Latest Scan Breakdown
      </h3>

      <div className="space-y-3">
        {rows.map((row) => {
          const percent = (row.value / total) * 100;
          return (
            <div key={row.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-text-muted">{row.label}</span>
                <span className={`font-semibold ${row.textColor}`}>{row.value}</span>
              </div>
              <div className="h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full ${row.barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onManageWorkflows}
        className="w-full mt-4 text-xs text-brand-2 font-semibold hover:underline flex items-center justify-center gap-1"
      >
        Manage workflows <FiChevronRight className="w-3 h-3" />
      </button>
    </div>
  );
}
