'use client'

import MapSidebar from '@/components/map/MapSidebar'
import { getAssets } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import React, { lazy, useCallback, useEffect, useMemo } from 'react'
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


const initialNodes = [
  { id: '1', position: { x: 250, y: 5 }, data: { label: 'Node 1' } },
]

const initialEdges: Edge[] = []

const Page = () => {
    const params = useParams()
    const envId = params.envId as string 
    const [selectedAsset, setSelectedAsset] = React.useState<any>(null)

    // useeffect to consolelog selected asset
    useEffect(() => {
    console.log('Selected Asset:', selectedAsset)
    }, [selectedAsset])



    // fetch assets using React Flow
    const {data: assets, isLoading, error} = useQuery({
    queryKey: ['assets', envId],
    queryFn: async () => getAssets(envId), 
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
    })



    // convert assets to React Flow Nodes and Edges
    const assetNodes = useMemo(() => {
    if (!assets) return [] as Node[]

    return assets.map((asset, idx) => ({
        id: asset.id,
        position: { 
        x: asset.x ?? 250 + (idx * 180), 
        y: asset.y ?? 100 
        },
        data: { asset, label: asset.name },
    })) as Node[]
    }, [assets])







  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])


  // update the nodes whene the assets loads
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
    <div className='h-full w-full flex '>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
      <div className="w-1/3 p-4 border-l border-gray-200">
        {/* Sidebar or details panel can go here */}

        <MapSidebar asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      </div>
    </div>
  )
}

export default Page