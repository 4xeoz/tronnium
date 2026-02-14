"use client"

import { FiX, FiCpu, FiDatabase, FiServer, FiWifi, FiShield, FiHardDrive, FiCheck } from 'react-icons/fi'
import React from 'react'
import { Asset } from '@/lib/api'

interface MapSidebarProps {
  asset: Asset | null;
  onClose: () => void;
}

const typeIcons: Record<string, React.ElementType> = {
  server: FiServer,
  database: FiDatabase,
  network: FiWifi,
  firewall: FiShield,
  iot: FiHardDrive,
  unknown: FiCpu,
}

function DetailRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[10px] text-text-muted uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-xs text-text-primary">{value}</p>
    </div>
  )
}

export default function MapSidebar({ asset, onClose }: MapSidebarProps) {
  if (!asset) return null

  const Icon = typeIcons[asset.type] || typeIcons.unknown
  const cpeList = Array.isArray(asset.cpes) ? asset.cpes : []
  const isActive = asset.status === 'active'

  return (
    <div className="w-80 h-full bg-surface border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">Asset Details</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-surface-secondary transition-colors"
        >
          <FiX className="w-4 h-4 text-text-muted" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Asset identity */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-1/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-brand-1" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-text-primary text-sm truncate">{asset.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-muted capitalize">{asset.type}</span>
              <div className="flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: isActive ? 'var(--status-active)' : 'var(--status-inactive)' }}
                />
                <span className="text-[10px] text-text-muted capitalize">{asset.status || 'unknown'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              asset.domain === 'IT'
                ? 'bg-info-bg text-info-text'
                : asset.domain === 'OT'
                ? 'bg-warning-bg text-warning-text'
                : 'bg-surface-secondary text-text-muted'
            }`}
          >
            {asset.domain}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
              cpeList.length > 0
                ? 'bg-success-bg text-success-text'
                : 'bg-surface-secondary text-text-muted'
            }`}
          >
            {cpeList.length > 0 ? `${cpeList.length} CPE${cpeList.length > 1 ? 's' : ''}` : 'No CPE'}
          </span>
        </div>

        {/* Details */}
        <div className="bg-surface-secondary rounded-lg p-3 space-y-3">
          <DetailRow label="Location" value={asset.location} />
          <DetailRow label="IP Address" value={asset.ipAddress} />
          <DetailRow label="Manufacturer" value={asset.manufacturer} />
          <DetailRow label="Description" value={asset.description} />
          <DetailRow label="Asset ID" value={asset.id} />
        </div>

        {/* CPEs */}
        {cpeList.length > 0 && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">CPE Identifiers</p>
            <div className="space-y-2">
              {cpeList.map((cpe, i) => (
                <div key={cpe.cpeName} className="bg-surface-secondary rounded-lg p-2.5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs text-text-primary font-medium truncate flex-1">
                      {cpe.title}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-medium shrink-0 ${
                        cpe.score >= 80
                          ? 'bg-success-bg text-success-text'
                          : cpe.score >= 50
                          ? 'bg-warning-bg text-warning-text'
                          : 'bg-surface text-text-muted'
                      }`}
                    >
                      {Math.round(cpe.score)}%
                    </span>
                  </div>
                  <div className="text-[9px] text-text-muted font-mono truncate">
                    {cpe.cpeName}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
