"use client"

import { useEffect } from 'react'
import { FiX, FiCpu, FiDatabase, FiServer, FiWifi, FiShield, FiHardDrive, FiShieldOff } from 'react-icons/fi'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Asset } from '@/lib/api'
import { getWorkflows, type WorkflowItem, getStatusLabel, type VulnStatus } from '@/lib/api/vulnerabilityWorkflow'
import { AgeBadge, Badge } from '@/components/security/SecurityUI'
import type { SelectedVuln } from '@/components/security/VulnDetailSlideOver'

interface MapSidebarProps {
  asset: Asset | null;
  environmentId: string;
  onClose: () => void;
  onVulnClick: (vuln: SelectedVuln) => void;
  onWorkflowsLoaded?: (workflows: WorkflowItem[]) => void;
}

const typeIcons: Record<string, React.ElementType> = {
  server:   FiServer,
  database: FiDatabase,
  network:  FiWifi,
  firewall: FiShield,
  iot:      FiHardDrive,
  unknown:  FiCpu,
}

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1, UNKNOWN: 0,
}

const STATUS_COLORS: Record<VulnStatus, { bg: string; text: string }> = {
  OPEN:           { bg: "bg-error-bg",         text: "text-error-text" },
  IN_PROGRESS:    { bg: "bg-warning-bg",        text: "text-warning-text" },
  RESOLVED:       { bg: "bg-success-bg",        text: "text-success-text" },
  FALSE_POSITIVE: { bg: "bg-surface-secondary", text: "text-text-muted" },
  RISK_ACCEPTED:  { bg: "bg-info-bg",           text: "text-info-text" },
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

function getInitials(name: string | null | undefined) {
  if (!name) return "?"
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

export default function MapSidebar({ asset, environmentId, onClose, onVulnClick, onWorkflowsLoaded }: MapSidebarProps) {
  const Icon = typeIcons[asset?.type ?? 'unknown'] || typeIcons.unknown
  const cpeList = Array.isArray(asset?.cpes) ? asset!.cpes : []
  const isActive = asset?.status === 'active'

  const { data: workflowsRes, isLoading: workflowsLoading } = useQuery({
    queryKey: ['assetWorkflows', environmentId, asset?.id],
    queryFn: async () => getWorkflows(environmentId, { assetId: asset!.id }),
    enabled: !!asset,
    staleTime: 60 * 1000,
  })

  const workflows = workflowsRes?.data ?? []

  // Sort by severity descending
  const sortedWorkflows = [...workflows].sort(
    (a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0)
  )

  // Notify parent of loaded workflows (for the slide-over workflow prop)
  useEffect(() => {
    if (workflows.length > 0) {
      onWorkflowsLoaded?.(workflows)
    }
  }, [workflows, onWorkflowsLoaded])

  if (!asset) return null

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

        {/* Vulnerabilities */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">Vulnerabilities</p>
          {workflowsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-12 bg-surface-secondary rounded-lg animate-pulse" />
              ))}
            </div>
          ) : sortedWorkflows.length === 0 ? (
            <div className="flex flex-col items-center py-5 text-center">
              <FiShieldOff className="w-7 h-7 text-success-text mb-2" />
              <p className="text-xs text-text-muted">No vulnerabilities found</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedWorkflows.map(wf => {
                const statusColors = STATUS_COLORS[wf.status]
                return (
                  <button
                    key={wf.id}
                    onClick={() => onVulnClick({
                      vulnerabilityId: wf.vulnerabilityId,
                      assetId: wf.assetId,
                      cpeName: wf.cpeName,
                      cveId: wf.cveId,
                      description: wf.description,
                      severity: wf.severity,
                      cvssScore: wf.cvssScore,
                      cvssVector: null,
                      publishedDate: null,
                      lastModifiedDate: null,
                      assetName: asset.name,
                    })}
                    className="w-full text-left bg-surface-secondary hover:bg-surface rounded-lg p-2.5 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-text-primary truncate">{wf.cveId}</span>
                      <AgeBadge firstSeenAt={wf.firstSeenAt} severity={wf.severity} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant={wf.severity === 'CRITICAL' ? 'error' : wf.severity === 'HIGH' ? 'warning' : 'info'}
                        size="sm"
                      >
                        {wf.severity}
                      </Badge>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${statusColors.bg} ${statusColors.text}`}>
                        {getStatusLabel(wf.status)}
                      </span>
                      {wf.assigneeName && (
                        <span
                          title={wf.assigneeName}
                          className="w-4 h-4 rounded-full bg-brand-1/20 text-brand-1 text-[8px] font-bold flex items-center justify-center shrink-0"
                        >
                          {getInitials(wf.assigneeName)}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* CPEs */}
        {cpeList.length > 0 && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">CPE Identifiers</p>
            <div className="space-y-2">
              {cpeList.map((cpe) => (
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
