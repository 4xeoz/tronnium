"use client"
import { FiX, FiCpu, FiDatabase, FiServer } from 'react-icons/fi'
import React from 'react'
import { Asset } from '@/lib/api'

interface MapSidebarProps {
    asset: Asset | null;
    onClose: () => void;

}


const typeIcons: Record<string, React.ElementType> = {
  server: FiServer,
  database: FiDatabase,
  compute: FiCpu,
}

export default function MapSidebar({ asset, onClose }: MapSidebarProps) {
  if (!asset) return null

  const Icon = typeIcons[asset.type] || FiServer

  return (
    <div className="w-80 h-full bg-surface border-l border-border flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary">Asset Details</h2>
        
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Asset Icon & Name */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-brand-1/10 flex items-center justify-center">
            <Icon className="w-6 h-6 text-brand-1" />
          </div>
          <div>
            <h3 className="font-medium text-text-primary">{asset.name}</h3>
            <p className="text-sm text-text-secondary capitalize">{asset.type}</p>
          </div>
        </div>

        {/* Status Badge */}
        {asset.status && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Status:</span>
            <span
              className={`px-2 py-1 rounded text-xs font-medium ${
                asset.status === 'active'
                  ? 'bg-success-bg text-success-text'
                  : 'bg-surface-secondary text-text-secondary'
              }`}
            >
              {asset.status}
            </span>
          </div>
        )}

        {/* Details */}
        <div className="space-y-3">
          {asset.location && (
            <div>
              <p className="text-xs text-text-secondary mb-1">Location</p>
              <p className="text-sm text-text-primary">{asset.location}</p>
            </div>
          )}

          {asset.description && (
            <div>
              <p className="text-xs text-text-secondary mb-1">Description</p>
              <p className="text-sm text-text-primary">{asset.description}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-text-secondary mb-1">Asset ID</p>
            <p className="text-sm text-text-primary font-mono">{asset.id}</p>
          </div>
        </div>
      </div>
    </div>
  )
}