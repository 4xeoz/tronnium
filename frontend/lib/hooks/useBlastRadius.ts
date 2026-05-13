import { useQuery } from '@tanstack/react-query'
import { fetchBlastRadius, type BlastRadiusResult, type BlastRadiusConfig } from '../api/graph'

export function useBlastRadius(
  envId: string,
  assetId: string | null,
  config?: Partial<BlastRadiusConfig>
) {
  return useQuery({
    queryKey: ['blastRadius', envId, assetId, config],
    queryFn: () => fetchBlastRadius(envId, assetId!, config),
    enabled: !!envId && !!assetId,   // only run when an asset is selected
    staleTime: 2 * 60 * 1000,
  })
}