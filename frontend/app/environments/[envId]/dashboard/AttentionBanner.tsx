import type { ElementType } from "react";
import { Button } from "@/components/ui/Button";

type AttentionItem = {
  icon: ElementType;
  text: string;
  cta: string;
  urgent: boolean;
};

type Props = {
  items: AttentionItem[];
  onRunScan: () => void;
  onViewSecurity: () => void;
};

export function AttentionBanner({ items, onRunScan, onViewSecurity }: Props) {
  if (items.length === 0) return null;

  const hasUrgent = items.some((item) => item.urgent);

  return (
    <div
      className={`rounded-2xl border p-4 flex flex-col gap-2 mb-6 ${
        hasUrgent ? "bg-error-bg border-error-border" : "bg-warning-bg border-warning-border"
      }`}
    >
      <p
        className={`text-[11px] font-semibold uppercase tracking-[0.5px] mb-1 ${
          hasUrgent ? "text-error-text" : "text-warning-text"
        }`}
      >
        Needs Attention
      </p>

      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={i} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  item.urgent ? "text-error-text" : "text-warning-text"
                }`}
              />
              <span className="text-sm text-text-primary">{item.text}</span>
            </div>
            <Button
              size="sm"
              variant={item.urgent ? "danger" : "secondary"}
              onClick={item.cta === "Run Scan" ? onRunScan : onViewSecurity}
            >
              {item.cta}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
