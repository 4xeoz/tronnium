"use client";

import type { Asset } from "@/lib/api";
import { typeIcons } from "./dashboard-constants";

export function AssetTypeDistribution({ assets }: { assets: Asset[] }) {
  const typeCount = assets.reduce((acc, asset) => {
    acc[asset.type] = (acc[asset.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const types = Object.entries(typeCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = assets.length || 1;

  return (
    <div className="space-y-2">
      {types.map(([type, count]) => {
        const Icon = typeIcons[type] || typeIcons.unknown;
        return (
          <div key={type} className="flex items-center gap-3">
            <Icon className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-secondary capitalize flex-1">{type}</span>
            <div className="flex-1 h-1.5 bg-surface-secondary rounded-full overflow-hidden max-w-[100px]">
              <div className="h-full bg-brand-1/60 rounded-full" style={{ width: `${(count / total) * 100}%` }} />
            </div>
            <span className="text-xs text-text-muted w-6 text-right">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
