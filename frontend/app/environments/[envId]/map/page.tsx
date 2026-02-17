'use client'

import MapSidebar from '@/components/map/MapSidebar'
import AssetNode from '@/components/map/AssetNode'
import { getAllRelationships, getAssets, createRelationship, updateRelationship, deleteRelationship, type Asset, type Relationship } from '@/lib/api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  BackgroundVariant,
  Connection,
  Edge,
  Node,
} from 'reactflow'
import 'reactflow/dist/style.css'
import RelationshipSidebar from '@/components/map/RelationshipSidebar'

const nodeTypes = { asset: AssetNode }

const Page = () => {
  const params = useParams()
  const envId = params.envId as string
  const queryClient = useQueryClient()
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null)

  const { data: assets, isLoading: assetsLoading, error: assetsError } = useQuery({
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

  // Convert assets to custom nodes with auto-layout
  const assetNodes = useMemo(() => {
    if (!assets) return [] as Node[]

    const cols = 3
    const xGap = 240
    const yGap = 120

    return assets.map((asset, idx) => ({
      id: asset.id,
      type: 'asset',
      position: {
        x: asset.x ?? (60 + (idx % cols) * xGap),
        y: asset.y ?? (60 + Math.floor(idx / cols) * yGap),
      },
      data: { asset, label: asset.name },
    })) as Node[]
  }, [assets])

  // Convert relationships to edges
  const relationshipEdges = useMemo(() => {
    if (!relationships) return [] as Edge[]

    return relationships.map((rel) => ({
      id: rel.id,
      source: rel.fromAssetId,
      target: rel.toAssetId,
      label: rel.type,
      animated: rel.criticality === 'high', 
      style: { 
        stroke: rel.criticality === 'high'  ? 'var(--color-error)' : 'var(--border)',
        strokeWidth: 2,
      },
      labelStyle: { fill: 'var(--text-secondary)', fontWeight: 500 },
      data: { relationship: rel }, // Store relationship data for editing
    })) as Edge[]
  }, [relationships])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Update nodes and edges when data changes
  useEffect(() => {
    if (assetNodes.length > 0) {
      setNodes(assetNodes)
    }
  }, [assetNodes, setNodes])

  useEffect(() => {
    if (relationshipEdges.length >= 0) { // >= 0 to handle empty arrays
      setEdges(relationshipEdges)
    }
  }, [relationshipEdges, setEdges])

  // Mutations for relationship CRUD
  const createRelationshipMutation = useMutation({
    mutationFn: ({ fromAssetId, toAssetId, type, criticality }: {
      fromAssetId: string
      toAssetId: string
      type: string
      criticality: string
    }) => createRelationship(envId, fromAssetId, toAssetId, type, criticality),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships', envId] })
    },
  })

  const updateRelationshipMutation = useMutation({
    mutationFn: ({ relationshipId, type, criticality }: {
      relationshipId: string
      type?: string
      criticality?: string
    }) => updateRelationship(envId, relationshipId, type, criticality),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships', envId] })
    },
  })

  const deleteRelationshipMutation = useMutation({
    mutationFn: (relationshipId: string) => deleteRelationship(envId,relationshipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships', envId] })
    },
  })

  // Handle creating new relationships by connecting nodes
  const onConnect = useCallback(
    (params: Connection) => {
      if (params.source && params.target && params.source !== params.target) {
        // Default values for new relationship
        createRelationshipMutation.mutate({
          fromAssetId: params.source,
          toAssetId: params.target,
          type: 'DEPENDS_ON',
          criticality: 'MEDIUM',
        })
      }
    },
    [createRelationshipMutation]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedAsset(node.data.asset)
    setSelectedEdge(null) // Clear edge selection
  }, [])

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdge(edge)
    setSelectedAsset(null) // Clear asset selection
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedAsset(null)
    setSelectedEdge(null)
  }, [])

  const isLoading = assetsLoading || relationshipsLoading

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (assetsError) {
    return (
      <div className="h-full w-full flex items-center justify-center text-error-text">
        Failed to load assets
      </div>
    )
  }

  return (
    <div className="h-full w-full flex">
      {/* Canvas */}
      <div className={`flex-1 transition-all duration-200`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
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
      </div>

      {/* Sidebar for Asset or Relationship */}
      {selectedAsset && (
        <MapSidebar 
          asset={selectedAsset} 
          onClose={() => setSelectedAsset(null)} 
        />
      )}
      
      {selectedEdge && (
        <RelationshipSidebar
          edge={selectedEdge}
          assets={assets || []}
          onClose={() => setSelectedEdge(null)}
          onUpdate={(type, criticality) => {
            updateRelationshipMutation.mutate({
              relationshipId: selectedEdge.id,
              type,
              criticality,
            })
          }}
          onDelete={() => {
            deleteRelationshipMutation.mutate(selectedEdge.id)
            setSelectedEdge(null)
          }}
        />
      )}
    </div>
  )
}

export default Page