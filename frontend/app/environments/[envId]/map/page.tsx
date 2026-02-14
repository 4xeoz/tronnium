'use client'

import MapSidebar from '@/components/map/MapSidebar'
import AssetNode from '@/components/map/AssetNode'
import { getAssets, type Asset } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import React, { useCallback, useEffect, useMemo } from 'react'
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

const nodeTypes = { asset: AssetNode }

const Page = () => {
  const params = useParams()
  const envId = params.envId as string
  const [selectedAsset, setSelectedAsset] = React.useState<Asset | null>(null)

  const { data: assets, isLoading, error } = useQuery({
    queryKey: ['assets', envId],
    queryFn: async () => getAssets(envId),
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

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  useEffect(() => {
    if (assetNodes.length > 0) {
      setNodes(assetNodes)
    }
  }, [assetNodes, setNodes])

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedAsset(node.data.asset)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedAsset(null)
  }, [])

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center text-error-text">
        Failed to load assets
      </div>
    )
  }

  return (
    <div className="h-full w-full flex">
      {/* Canvas */}
      <div className={`flex-1 transition-all duration-200 ${selectedAsset ? '' : ''}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
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

      {/* Sidebar */}
      {selectedAsset && (
        <MapSidebar asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      )}
    </div>
  )
}

export default Page
