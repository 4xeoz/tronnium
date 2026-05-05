'use client'

import MapSidebar from '@/components/map/MapSidebar'
import AssetNode from '@/components/map/AssetNode'
import DependencyEdge from '@/components/map/DependencyEdge'
import RelationshipSidebar from '@/components/map/RelationshipSidebar'
import VulnDetailSlideOver, { type SelectedVuln } from '@/components/security/VulnDetailSlideOver'
import {
  getAllRelationships,
  getAssets,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  getLatestScan,
  type Asset,
  type RelationType,
  type CriticalityLevel,
  type ScanSeverity,
} from '@/lib/api'
import { getWorkflows, type WorkflowItem } from '@/lib/api/vulnerabilityWorkflow'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Connection,
  Edge,
  Node,
  type NodeChange,
  type XYPosition,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { updateAseetPosition } from '@/lib/api/assets'
import { Button } from '@/components/ui/Button'
import { INACTIVE_STATUSES } from '@/lib/securityConstants'

export type VulnSummary = {
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  highestSeverity: ScanSeverity | null;
}

const EMPTY_VULN_SUMMARY: VulnSummary = { critical: 0, high: 0, medium: 0, low: 0, total: 0, highestSeverity: null }

const nodeTypes = { asset: AssetNode }
const edgeTypes = { dependency: DependencyEdge }

const Page = () => {
  const params = useParams()
  const envId = params.envId as string
  const queryClient = useQueryClient()

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [selectedVuln, setSelectedVuln] = useState<SelectedVuln | null>(null)
  const [workflowsForAsset, setWorkflowsForAsset] = useState<Map<string, WorkflowItem>>(new Map())
  const [error, setError] = useState<string | null>(null)
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)
  const positionUpdateTimeouts = useRef<{ [id: string]: NodeJS.Timeout }>({})

  const { data: ResponseOfAssets, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', envId],
    queryFn: async () => getAssets(envId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: ResponseOfrelationships, isLoading: relationshipsLoading } = useQuery({
    queryKey: ['relationships', envId],
    queryFn: async () => getAllRelationships(envId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: latestScanRes } = useQuery({
    queryKey: ['latestScan', envId],
    queryFn: async () => getLatestScan(envId),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: workflowsRes } = useQuery({
    queryKey: ['workflows', envId],
    queryFn: async () => getWorkflows(envId),
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const createMutation = useMutation({
    mutationFn: (data: { fromAssetId: string; toAssetId: string; type: RelationType; criticality: CriticalityLevel }) =>
      createRelationship(envId, data.fromAssetId, data.toAssetId, data.type, data.criticality),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships', envId] })
      setError(null)
    },
    onError: (err: Error) => {
      const msg = err.message || 'Failed to create relationship'
      console.error(msg)
      setError(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { relationshipId: string; type?: RelationType; criticality?: CriticalityLevel }) =>
      updateRelationship(envId, data.relationshipId, data.type, data.criticality),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships', envId] })
      setError(null)
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to update relationship'
      setError(msg)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (relationshipId: string) => deleteRelationship(envId, relationshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships', envId] })
      setSelectedEdge(null)
      setError(null)
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to delete relationship'
      setError(msg)
    },
  })

  const updatePositionMutation = useMutation({
    mutationFn: ({assetId, x, y}: {assetId: string, x: number, y: number}) => updateAseetPosition(envId, assetId, x, y),
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to update asset position'
      setError(msg)
    },
  })

  const assets = ResponseOfAssets?.data || [];
  const workflowLookup = useMemo(() => {
    const map = new Map<string, string>()
    workflowsRes?.data?.forEach(w => map.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w.status))
    return map
  }, [workflowsRes])

  const assetVulnMap = useMemo(() => {
    const map = new Map<string, VulnSummary>()
    const assetScans = latestScanRes?.data?.assetScans
    if (!assetScans) return map
    const severityOrder: ScanSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']
    for (const assetScan of assetScans) {
      const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 }
      for (const v of assetScan.vulnerabilities) {
        const wfStatus = workflowLookup.get(`${v.vulnerability.id}-${assetScan.asset.id}-${v.cpeName}`)
        if (wfStatus && INACTIVE_STATUSES.has(wfStatus)) continue
        const sev = v.vulnerability.severity
        counts.total++
        if (sev === 'CRITICAL') counts.critical++
        else if (sev === 'HIGH') counts.high++
        else if (sev === 'MEDIUM') counts.medium++
        else if (sev === 'LOW') counts.low++
      }
      const highestSeverity = severityOrder.find(s =>
        s === 'CRITICAL' ? counts.critical > 0 :
        s === 'HIGH'     ? counts.high > 0 :
        s === 'MEDIUM'   ? counts.medium > 0 :
        s === 'LOW'      ? counts.low > 0 : false
      ) ?? null
      map.set(assetScan.asset.id, { ...counts, highestSeverity })
    }
    return map
  }, [latestScanRes, workflowLookup])

  const assetNodes = useMemo(() => {
    if (!ResponseOfAssets || ResponseOfAssets.success === false) return [] as Node[]
    const cols = 3
    const xGap = 240
    const yGap = 120
    const assetList = ResponseOfAssets.data || []
    return assetList.map((asset, idx) => ({
      id: asset.id,
      type: 'asset',
      position: {
        x: asset.x ?? 60 + (idx % cols) * xGap,
        y: asset.y ?? 60 + Math.floor(idx / cols) * yGap,
      },
      data: { asset, label: asset.name, vulnSummary: assetVulnMap.get(asset.id) ?? EMPTY_VULN_SUMMARY },
    })) as Node[]
  }, [ResponseOfAssets, assetVulnMap])

  const relationshipEdges = useMemo(() => {
    if (!ResponseOfrelationships || ResponseOfrelationships.success === false) return [] as Edge[]
    const relationships = ResponseOfrelationships.data
    return relationships.map((rel) => ({
      id: rel.id,
      source: rel.fromAssetId,
      target: rel.toAssetId,
      type: 'dependency',
      data: { relationship: rel },
    })) as Edge[]
  }, [ResponseOfrelationships])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => { if (assetNodes.length > 0) setNodes(assetNodes) }, [assetNodes, setNodes])
  useEffect(() => { setEdges(relationshipEdges) }, [relationshipEdges, setEdges])

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    if (connection.source === connection.target) {
      setError('Cannot create a relationship with the same asset')
      setTimeout(() => setError(null), 3000)
      return
    }
    const exists = relationshipEdges?.some(
      (rel) => rel.source === connection.source && rel.target === connection.target
    )
    if (exists) {
      setError('This relationship already exists')
      setTimeout(() => setError(null), 3000)
      return
    }
    setPendingConnection(connection)
  }, [relationshipEdges])

  const handleCreateRelationship = (type: RelationType, criticality: CriticalityLevel) => {
    if (!pendingConnection?.source || !pendingConnection?.target) return
    createMutation.mutate({
      fromAssetId: pendingConnection.source,
      toAssetId: pendingConnection.target,
      type,
      criticality,
    })
    setPendingConnection(null)
  }

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedAsset(node.data.asset)
    setSelectedEdge(null)
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge)
    setSelectedAsset(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedAsset(null)
    setSelectedEdge(null)
  }, [])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes)
    changes.forEach((change) => {
      if (change.type === 'position' && !change.dragging && change.id) {
        const pos = (change as NodeChange & { position?: XYPosition }).position
        if (!pos) return
        if (positionUpdateTimeouts.current[change.id]) {
          clearTimeout(positionUpdateTimeouts.current[change.id])
        }
        positionUpdateTimeouts.current[change.id] = setTimeout(() => {
          updatePositionMutation.mutate({ assetId: change.id, x: pos.x, y: pos.y })
        }, 500)
      }
    })
  }, [onNodesChange, updatePositionMutation])

  const handleWorkflowsLoaded = useCallback((wfs: WorkflowItem[]) => {
    const map = new Map<string, WorkflowItem>()
    wfs.forEach(w => map.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w))
    setWorkflowsForAsset(map)
  }, [])

  const isLoading = assetsLoading || relationshipsLoading

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="h-full w-full flex relative group">
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'dependency' }}
        >
          <Controls
            className="!bg-surface !border-border !rounded-[10px] !shadow-[var(--shadow-ring)] [&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-text-secondary [&>button:hover]:!bg-surface-secondary"
          />
          <MiniMap
            className="!bg-surface !border-border !rounded-[10px]"
            nodeColor="var(--brand-color-1)"
            maskColor="var(--background-secondary)"
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        </ReactFlow>

        {error && (
          <div className="absolute bottom-4 left-4 right-4 max-w-sm mx-auto bg-error-bg border border-error-border rounded-[16px] p-3 text-error-text text-sm animate-[slideUp_200ms_ease]">
            {error}
          </div>
        )}

        {pendingConnection && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-50">
            <div className="bg-surface border border-border rounded-[24px] shadow-[var(--shadow-card)] p-6 max-w-sm w-full mx-4 animate-[slideUp_200ms_ease]">
              <h2 className="text-[22px] font-bold text-text-primary tracking-[-0.3px] mb-4">Create Relationship</h2>
              <div className="mb-4 p-3 bg-background-secondary rounded-[10px]">
                <div className="text-[11px] text-text-muted uppercase tracking-wide mb-1">FROM → TO</div>
                <div className="text-sm font-semibold text-text-primary">
                  {assets?.find((a) => a.id === pendingConnection.source)?.name || 'Asset'} →{' '}
                  {assets?.find((a) => a.id === pendingConnection.target)?.name || 'Asset'}
                </div>
              </div>
              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Type</label>
                  <div className="space-y-1">
                    {(['DEPENDS_ON', 'CONTROLS', 'PROVIDES_SERVICE', 'SHARES_DATA_WITH'] as const).map((t) => (
                      <label key={t} className="flex items-center gap-2 p-2 hover:bg-background-secondary rounded-[10px] cursor-pointer transition-colors">
                        <input type="radio" name="type" value={t} defaultChecked={t === 'DEPENDS_ON'} className="accent-brand-1" />
                        <span className="text-sm text-text-primary">{t.replace(/_/g, ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Criticality</label>
                  <div className="space-y-1">
                    {(['low', 'medium', 'high'] as const).map((c) => (
                      <label key={c} className="flex items-center gap-2 p-2 hover:bg-background-secondary rounded-[10px] cursor-pointer transition-colors">
                        <input type="radio" name="criticality" value={c} defaultChecked={c === 'medium'} className="accent-brand-1" />
                        <span className="text-sm text-text-primary capitalize">{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPendingConnection(null)} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => {
                    const type = (document.querySelector('input[name="type"]:checked') as HTMLInputElement)?.value as RelationType
                    const criticality = (document.querySelector('input[name="criticality"]:checked') as HTMLInputElement)?.value as CriticalityLevel
                    handleCreateRelationship(type, criticality)
                  }}
                  disabled={createMutation.isPending}
                  isLoading={createMutation.isPending}
                  className="flex-1"
                >
                  Create
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedAsset && !selectedEdge && (
        <MapSidebar
          asset={selectedAsset}
          environmentId={envId}
          onClose={() => setSelectedAsset(null)}
          onVulnClick={setSelectedVuln}
          onWorkflowsLoaded={handleWorkflowsLoaded}
        />
      )}

      {selectedEdge && !selectedAsset && (
        <RelationshipSidebar
          edge={selectedEdge}
          assets={assets || []}
          onClose={() => setSelectedEdge(null)}
          onUpdate={(type, criticality) => {
            updateMutation.mutate({
              relationshipId: selectedEdge.id,
              type: type as RelationType,
              criticality: criticality as CriticalityLevel,
            })
          }}
          onDelete={() => deleteMutation.mutate(selectedEdge.id)}
          isLoading={updateMutation.isPending || deleteMutation.isPending}
          error={error}
        />
      )}

      {selectedVuln && (
        <VulnDetailSlideOver
          vuln={selectedVuln}
          workflow={workflowsForAsset.get(`${selectedVuln.vulnerabilityId}-${selectedVuln.assetId}-${selectedVuln.cpeName}`)}
          environmentId={envId}
          onClose={() => setSelectedVuln(null)}
          onWorkflowSaved={updated => {
            setWorkflowsForAsset(prev => new Map(prev.set(`${updated.vulnerabilityId}-${updated.assetId}-${updated.cpeName}`, updated)))
          }}
        />
      )}
    </div>
  )
}

export default Page
