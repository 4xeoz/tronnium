'use client'

import MapSidebar from '@/components/map/MapSidebar'
import AssetNode from '@/components/map/AssetNode'
import DependencyEdge from '@/components/map/DependencyEdge'
import RelationshipSidebar from '@/components/map/RelationshipSidebar'
import {
  getAllRelationships,
  getAssets,
  createRelationship,
  updateRelationship,
  deleteRelationship,
  type Asset,
  type Relationship,
  type RelationType,
  type CriticalityLevel,
} from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
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
} from 'reactflow'
import 'reactflow/dist/style.css'

const nodeTypes = { asset: AssetNode }
const edgeTypes = { dependency: DependencyEdge }

const Page = () => {
  const params = useParams()
  const envId = params.envId as string
  const queryClient = useQueryClient()

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null)

  // ===== QUERIES =====

  const { data: assets, isLoading: assetsLoading } = useQuery({
    queryKey: ['assets', envId],
    queryFn: async () => getAssets(envId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const { data: relationships, isLoading: relationshipsLoading } = useQuery({
    queryKey: ['relationships', envId],
    queryFn: async () => getAllRelationships(envId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // ===== MUTATIONS =====

  const createMutation = useMutation({
    mutationFn: (data: {
      fromAssetId: string
      toAssetId: string
      type: RelationType
      criticality: CriticalityLevel
    }) => createRelationship(envId, data.fromAssetId, data.toAssetId, data.type, data.criticality),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships', envId] })
      setError(null)
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Failed to create relationship'
      setError(msg)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: {
      relationshipId: string
      type?: RelationType
      criticality?: CriticalityLevel
    }) =>
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

  // ===== NODE/EDGE CONVERSION =====

  const assetNodes = useMemo(() => {
    if (!assets) return [] as Node[]
    const cols = 3
    const xGap = 240
    const yGap = 120

    return assets.map((asset, idx) => ({
      id: asset.id,
      type: 'asset',
      position: {
        x: asset.x ?? 60 + (idx % cols) * xGap,
        y: asset.y ?? 60 + Math.floor(idx / cols) * yGap,
      },
      data: { asset, label: asset.name },
    })) as Node[]
  }, [assets])

  const relationshipEdges = useMemo(() => {
    if (!relationships) return [] as Edge[]

    return relationships.map((rel) => ({
      id: rel.id,
      source: rel.fromAssetId,
      target: rel.toAssetId,
      type: 'dependency',
      data: { relationship: rel },
    })) as Edge[]
  }, [relationships])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Sync nodes and edges
  useEffect(() => {
    if (assetNodes.length > 0) setNodes(assetNodes)
  }, [assetNodes, setNodes])

  useEffect(() => {
    setEdges(relationshipEdges)
  }, [relationshipEdges, setEdges])

  // ===== EVENT HANDLERS =====

  /**
   * FIX #2: Don't immediately add edge
   * Instead validate and show confirmation modal
   */
  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return

    // Validation
    if (connection.source === connection.target) {
      setError('Cannot create a relationship with the same asset')
      setTimeout(() => setError(null), 3000)
      return
    }

    // Check if relationship already exists
    const exists = relationships?.some(
      (rel) =>
        rel.fromAssetId === connection.source &&
        rel.toAssetId === connection.target
    )

    if (exists) {
      setError('This relationship already exists')
      setTimeout(() => setError(null), 3000)
      return
    }

    // Store for modal confirmation
    setPendingConnection(connection)
  }, [relationships])

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

  // ===== RENDER =====

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
      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
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
            className="!bg-surface !border-border !rounded-lg !shadow-md [&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-text-secondary [&>button:hover]:!bg-surface-secondary"
          />
          <MiniMap
            className="!bg-surface !border-border !rounded-lg"
            nodeColor="var(--brand-color-1)"
            maskColor="var(--background-secondary)"
          />
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
        </ReactFlow>

        {/* Error toast */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 max-w-sm bg-error-bg border border-error-border rounded-lg p-3 text-error-text text-sm animate-slideUp">
            {error}
          </div>
        )}

        {/* Pending connection modal - FIX #2 */}
        {pendingConnection && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-50">
            <div className="bg-surface border border-border rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
              <h2 className="text-lg font-semibold text-text-primary mb-4">Create Relationship</h2>

              <div className="mb-4 p-3 bg-surface-secondary rounded-lg">
                <div className="text-xs text-text-muted mb-1">FROM → TO</div>
                <div className="text-sm font-medium text-text-primary">
                  {assets?.find((a) => a.id === pendingConnection.source)?.name || 'Asset'} →{' '}
                  {assets?.find((a) => a.id === pendingConnection.target)?.name || 'Asset'}
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-2 uppercase">
                    Type
                  </label>
                  <div className="space-y-1">
                    {(['DEPENDS_ON', 'CONTROLS', 'PROVIDES_SERVICE', 'SHARES_DATA_WITH'] as const).map(
                      (t) => (
                        <label key={t} className="flex items-center gap-2 p-2 hover:bg-surface-secondary rounded cursor-pointer">
                          <input type="radio" name="type" value={t} defaultChecked={t === 'DEPENDS_ON'} />
                          <span className="text-sm text-text-primary">
                            {t.replace(/_/g, ' ')}
                          </span>
                        </label>
                      )
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-primary mb-2 uppercase">
                    Criticality
                  </label>
                  <div className="space-y-1">
                    {(['low', 'medium', 'high'] as const).map((c) => (
                      <label key={c} className="flex items-center gap-2 p-2 hover:bg-surface-secondary rounded cursor-pointer">
                        <input type="radio" name="criticality" value={c} defaultChecked={c === 'medium'} />
                        <span className="text-sm text-text-primary capitalize">{c}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setPendingConnection(null)}
                  className="flex-1 px-4 py-2 bg-surface-secondary text-text-secondary rounded-lg hover:bg-surface transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const type = (document.querySelector('input[name="type"]:checked') as HTMLInputElement)
                      ?.value as RelationType
                    const criticality = (
                      document.querySelector('input[name="criticality"]:checked') as HTMLInputElement
                    )?.value as CriticalityLevel
                    handleCreateRelationship(type, criticality)
                  }}
                  disabled={createMutation.isPending}
                  className="flex-1 px-4 py-2 bg-brand-1 text-brand-2 rounded-lg hover:bg-brand-1/90 transition disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Asset sidebar */}
      {selectedAsset && !selectedEdge && (
        <MapSidebar asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}

      {/* Relationship sidebar */}
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
          onDelete={() => {
            deleteMutation.mutate(selectedEdge.id)
          }}
          isLoading={updateMutation.isPending || deleteMutation.isPending}
          error={error}
        />
      )}
    </div>
  )
}

export default Page
