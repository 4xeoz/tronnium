import { useQuery } from "@tanstack/react-query";
import { fetchEnvironmentRiskMap } from "../api/graph";

export function useEnvironmentRiskMap(envId: string) {
  return useQuery({
    queryKey: ['environmentRiskMap', envId],
    queryFn: () => fetchEnvironmentRiskMap(envId),
    staleTime: 5 * 60 * 1000,
    enabled: !!envId,
  })
}