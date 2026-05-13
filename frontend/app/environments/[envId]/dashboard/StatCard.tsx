import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  iconBg: string;
  label: string;
  value: ReactNode;
  subtitle: ReactNode;
  progressPercent?: number;
  onClick?: () => void;
};

export function StatCard({ icon, iconBg, label, value, subtitle, progressPercent, onClick }: Props) {
  const base = "bg-surface rounded-2xl border border-border p-4 transition-all duration-150 hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 text-left w-full";

  const inner = (
    <>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-[0.5px] text-text-muted">
          {label}
        </span>
      </div>
      <div className="text-[28px] font-bold text-text-primary leading-none tracking-[-1px]">
        {value}
      </div>
      {progressPercent !== undefined && (
        <div className="w-full h-1.5 bg-surface-secondary rounded-full mt-2 overflow-hidden">
          <div
            className="h-full bg-brand-1 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
      <div className="text-xs text-text-muted mt-1.5">{subtitle}</div>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={`${base} cursor-pointer`}>
        {inner}
      </button>
    );
  }

  return <div className={base}>{inner}</div>;
}
