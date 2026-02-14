"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { FiCpu, FiServer, FiDatabase, FiWifi, FiShield, FiHardDrive } from "react-icons/fi";
import type { Asset } from "@/lib/api";

const typeConfig: Record<string, { icon: React.ElementType; accent: string }> = {
  server:   { icon: FiServer,    accent: "var(--info-text)" },
  database: { icon: FiDatabase,  accent: "var(--warning-text)" },
  network:  { icon: FiWifi,      accent: "var(--success-text)" },
  firewall: { icon: FiShield,    accent: "var(--error-text)" },
  iot:      { icon: FiHardDrive, accent: "var(--warning-text)" },
  unknown:  { icon: FiCpu,       accent: "var(--text-muted)" },
};

function AssetNode({ data, selected }: NodeProps<{ asset: Asset; label: string }>) {
  const asset = data.asset;
  const cpeCount = Array.isArray(asset.cpes) ? asset.cpes.length : 0;
  const config = typeConfig[asset.type] || typeConfig.unknown;
  const Icon = config.icon;
  const isActive = asset.status === "active";

  return (
    <>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-border !border-surface" />

      <div
        className="relative group"
        style={{ filter: selected ? `drop-shadow(0 0 8px ${config.accent})` : undefined }}
      >
        {/* Card */}
        <div
          className={`
            w-48 rounded-xl border bg-surface px-3 py-3 transition-all duration-200
            ${selected ? "border-brand-1 shadow-lg" : "border-border hover:border-border-secondary"}
          `}
        >
          {/* Top row: icon + name + status dot */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `color-mix(in srgb, ${config.accent} 15%, transparent)` }}
            >
              <Icon className="w-4 h-4" style={{ color: config.accent }} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-text-primary truncate">{asset.name}</div>
              <div className="text-[10px] text-text-muted capitalize">{asset.type}</div>
            </div>
            {/* Status dot */}
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: isActive ? "var(--status-active)" : "var(--status-inactive)" }}
            />
          </div>

          {/* Bottom row: badges */}
          <div className="flex items-center gap-1.5 mt-2.5">
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${
                asset.domain === "IT"
                  ? "bg-info-bg text-info-text"
                  : asset.domain === "OT"
                  ? "bg-warning-bg text-warning-text"
                  : "bg-surface-secondary text-text-muted"
              }`}
            >
              {asset.domain}
            </span>
            {cpeCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-success-bg text-success-text text-[9px] font-medium">
                {cpeCount} CPE{cpeCount > 1 ? "s" : ""}
              </span>
            )}
            {asset.ipAddress && (
              <span className="px-1.5 py-0.5 rounded bg-surface-secondary text-text-muted text-[9px] font-mono truncate max-w-[72px]">
                {asset.ipAddress}
              </span>
            )}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-border !border-surface" />
    </>
  );
}

export default memo(AssetNode);
