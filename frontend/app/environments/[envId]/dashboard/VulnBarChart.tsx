"use client";

export function VulnBarChart({ critical, high, medium, low }: { critical: number; high: number; medium: number; low: number }) {
  const maxVal = Math.max(critical, high, medium, low, 1);
  const bars = [
    { label: "Critical", value: critical, color: "bg-error-text", text: "text-error-text" },
    { label: "High", value: high, color: "bg-warning-text", text: "text-warning-text" },
    { label: "Medium", value: medium, color: "bg-info-text", text: "text-info-text" },
    { label: "Low", value: low, color: "bg-success-text", text: "text-success-text" },
  ];

  return (
    <div className="space-y-2">
      {bars.map((bar) => (
        <div key={bar.label} className="flex items-center gap-3">
          <span className="text-xs text-text-muted w-14">{bar.label}</span>
          <div className="flex-1 h-2 bg-surface-secondary rounded-full overflow-hidden">
            <div className={`h-full ${bar.color} rounded-full transition-all duration-500`} style={{ width: `${(bar.value / maxVal) * 100}%` }} />
          </div>
          <span className={`text-xs font-semibold ${bar.text} w-6 text-right`}>{bar.value}</span>
        </div>
      ))}
    </div>
  );
}
