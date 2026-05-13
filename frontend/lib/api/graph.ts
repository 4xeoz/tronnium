import { apiFetch } from "./client"

export interface VulnProfile {
  maxCvss: number
  maxEpss: number
  hasNetworkPivot: boolean
  hasCredentialTheft: boolean
  isPhysicalAccessOnly: boolean
}

export interface EntryPoint {
  id: string
  name: string
  type: string
  domain: string
  isExternallyFacing: boolean
  vulnProfile: VulnProfile
  baseRisk: number      // 0–100, source node's initial risk score
}

export interface ReachableNode {
  assetId: string
  cost: number          // accumulated traversal cost from source
  hops: number
  compromiseScore: number  // 0–100
  knowledgeScore: number   // 0–100
  path: string[]        // assetId chain from source to this node
}

export interface GatedNode {
  fromAssetId: string
  toAssetId: string
  edgeType: string
  reason: string        // which gate condition failed
}

export interface BlastRadiusConfig {
  costBudget: number
  epssThreshold: number
  cvssThreshold: number
}

export interface BlastRadiusResult {
  sourceAssetId: string
  budget: number
  nodesVisited: number
  edgesGated: number
  reached: ReachableNode[]
  gatedEdges: GatedNode[]
}

export interface EnvironmentRiskMap {
  environmentId: string
  entryPoints: EntryPoint[]
  runs: number
  totalAssetsReached: number
  assetRisks: Array<{
    assetId: string
    maxCompromiseScore: number
    maxKnowledgeScore: number
    reachableFromEntryPoints: string[]
  }>
}




export async function fetchEntryPoints(envId: string): Promise<EntryPoint[]> {
  const res = await apiFetch<EntryPoint[]>(
    `/relationships/${envId}/entry-points`
  )
  return res.data
}




export async function fetchBlastRadius(
  envId: string,
  assetId: string,
  config?: Partial<BlastRadiusConfig>
): Promise<BlastRadiusResult> {
  const params = new URLSearchParams()
  if (config?.costBudget)    params.set('costBudget',    String(config.costBudget))
  if (config?.epssThreshold) params.set('epssThreshold', String(config.epssThreshold))
  if (config?.cvssThreshold) params.set('cvssThreshold', String(config.cvssThreshold))

  const query = params.toString() ? `?${params}` : ''
  const res = await apiFetch<BlastRadiusResult>(
    `/relationships/${envId}/blast-radius/${assetId}${query}`
  )
  return res.data
}





export async function fetchEnvironmentRiskMap(
  envId: string
): Promise<EnvironmentRiskMap> {
  const res = await apiFetch<EnvironmentRiskMap>(
    `/relationships/${envId}/blast-radius`
  )
  return res.data
}


