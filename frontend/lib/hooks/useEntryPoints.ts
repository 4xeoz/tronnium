import { useQuery } from '@tanstack/react-query'
import { fetchEntryPoints, type EntryPoint } from '../api/graph'

export function useEntryPoints(envId: string) {
  return useQuery({
    queryKey: ['entryPoints', envId],
    queryFn: () => fetchEntryPoints(envId),
    staleTime: 5 * 60 * 1000,   // 5 min — entry points don't change during a session
    enabled: !!envId,
  })
}