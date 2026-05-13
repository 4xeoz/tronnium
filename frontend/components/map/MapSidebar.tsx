"use client"


import { useEffect } from 'react'
import { FiX, FiCpu, FiDatabase, FiServer, FiWifi, FiShield, FiHardDrive, FiShieldOff, FiActivity } from 'react-icons/fi'
import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Asset } from '@/lib/api'
import { fetchVulnerabilityWorkflows, type WorkflowItem, type VulnStatus } from '@/lib/api/vulnerabilityWorkflow'
import { AgeBadge, Badge } from '@/components/security/SecurityUI'
import type { SelectedVuln } from '@/components/security/VulnDetailSlideOver'
import { SEVERITY_ORDER, STATUS_COLORS, getInitials } from '@/lib/securityConstants'
import { getStatusLabel } from '@/lib/formatters'

interface MapSidebarProps {
  asset: Asset | null;
  environmentId: string;
  onClose: () => void;
  onVulnClick: (vuln: SelectedVuln) => void;
  onWorkflowsLoaded?: (workflows: WorkflowItem[]) => void;
  analysisAssetId?: string | null;
  setAnalysisAssetId?: (id: string | null) => void;
  isAnalyzing?: boolean;
}

const typeIcons: Record<string, React.ElementType> = {
  server:   FiServer,
  database: FiDatabase,
  network:  FiWifi,
  firewall: FiShield,
  iot:      FiHardDrive,
  unknown:  FiCpu,
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

export default function MapSidebar({ asset, environmentId, onClose, onVulnClick, onWorkflowsLoaded, analysisAssetId, setAnalysisAssetId, isAnalyzing }: MapSidebarProps) {
  const Icon = typeIcons[asset?.type ?? 'unknown'] || typeIcons.unknown
  const cpeList = Array.isArray(asset?.cpes) ? asset!.cpes : []
  const isActive = asset?.status === 'active'

  const { data: workflowsRes, isLoading: workflowsLoading } = useQuery({
    queryKey: ['assetWorkflows', environmentId, asset?.id],
    queryFn: async () => (await fetchVulnerabilityWorkflows(environmentId, { assetId: asset!.id })).data,
    enabled: !!asset,
    staleTime: 60 * 1000,
  })

  const workflows = workflowsRes ?? []
  const sortedWorkflows = [...workflows].sort((a, b) => (SEVERITY_ORDER[b.severity] ?? 0) - (SEVERITY_ORDER[a.severity] ?? 0))

  useEffect(() => {
    if (workflowsRes && workflowsRes.length > 0) onWorkflowsLoaded?.(workflowsRes)
  }, [workflowsRes, onWorkflowsLoaded])

  if (!asset) return null

  return (
    <div className="w-80 h-screen bg-surface border-l border-border flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-text-primary">Asset Details</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center border border-transparent text-text-muted hover:text-text-primary hover:border-border hover:bg-surface-secondary transition-all active:scale-95"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4 ">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-1/10 flex items-center justify-center text-brand-1">
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-text-primary text-sm truncate">{asset.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-text-muted capitalize">{asset.type}</span>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isActive ? 'var(--status-active)' : 'var(--status-inactive)' }} />
                <span className="text-[10px] text-text-muted capitalize">{asset.status || 'unknown'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Badge variant={asset.domain === 'IT' ? 'info' : asset.domain === 'OT' ? 'warning' : 'neutral'} size="sm">{asset.domain}</Badge>
          <Badge variant={cpeList.length > 0 ? 'success' : 'neutral'} size="sm">
            {cpeList.length > 0 ? `${cpeList.length} CPE${cpeList.length > 1 ? 's' : ''}` : 'No CPE'}
          </Badge>
        </div>

        <div className="bg-background-secondary rounded-[10px] p-3 space-y-3">
          <DetailRow label="Location" value={asset.location} />
          <DetailRow label="IP Address" value={asset.ipAddress} />
          <DetailRow label="Manufacturer" value={asset.manufacturer} />
          <DetailRow label="Description" value={asset.description} />
          <DetailRow label="Externally Facing" value={asset.isExternallyFacing ? 'Yes — exposed to public internet' : 'No'} />
          <DetailRow label="Asset ID" value={asset.id} />
        </div>

        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">Vulnerabilities</p>
          {workflowsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-background-secondary rounded-[10px] animate-pulse" />)}
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
                      cvssVector: wf.cvssVector,
                      publishedDate: wf.publishedDate,
                      lastModifiedDate: wf.lastModifiedDate,
                      assetName: asset.name,
                    })}
                    className="w-full text-left bg-background-secondary hover:bg-surface rounded-[10px] p-2.5 transition-colors border border-transparent hover:border-border"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs font-semibold text-text-primary truncate">{wf.cveId}</span>
                      <AgeBadge firstSeenAt={wf.firstSeenAt} severity={wf.severity} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={wf.severity === 'CRITICAL' ? 'error' : wf.severity === 'HIGH' ? 'warning' : 'info'} size="sm">{wf.severity}</Badge>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${statusColors.bg} ${statusColors.text}`}>
                        {getStatusLabel(wf.status)}
                      </span>
                      {wf.assigneeName && (
                        <span title={wf.assigneeName} className="w-4 h-4 rounded-full bg-brand-mint text-brand-2 text-[8px] font-bold flex items-center justify-center shrink-0">
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

        {cpeList.length > 0 && (
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wide mb-2">CPE Identifiers</p>
            <div className="space-y-2">
              {cpeList.map((cpe) => (
                <div key={cpe.cpeName} className="bg-background-secondary rounded-[10px] p-2.5">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-xs text-text-primary font-medium truncate flex-1">{cpe.title}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0 border ${
                      cpe.score >= 80 ? 'bg-success-bg text-success-text border-success-border' :
                      cpe.score >= 50 ? 'bg-warning-bg text-warning-text border-warning-border' :
                      'bg-surface text-text-muted border-border'
                    }`}>
                      {Math.round(cpe.score)}%
                    </span>
                  </div>
                  <div className="text-[9px] text-text-muted font-mono truncate">{cpe.cpeName}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {setAnalysisAssetId && (
          <div className="pt-2">
            <button
              onClick={() => setAnalysisAssetId(analysisAssetId === asset.id ? null : asset.id)}
              disabled={isAnalyzing}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                analysisAssetId === asset.id
                  ? 'bg-brand-1 text-white hover:bg-brand-1/90'
                  : 'bg-background-secondary text-text-primary hover:bg-surface-secondary border border-border'
              }`}
            >
              {isAnalyzing ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiActivity className="w-4 h-4" />
              )}
              {isAnalyzing ? 'Analyzing...' : analysisAssetId === asset.id ? 'Clear Analysis' : 'Analyze Blast Radius'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
