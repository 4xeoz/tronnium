import { useQuery } from "@tanstack/react-query";
import { getEnvironmentDetail } from "@/lib/services/environmentService";
import { env } from "process";



export function useEnvironment(envId: string) {
  const query =  useQuery({
    queryKey: ["environment", envId],
    queryFn: () => getEnvironmentDetail(envId),
    staleTime: 5 * 60 * 1000,
  });

  console.group("[useEnvironment] query state");
  console.log("data:", query.data);
  console.log("error:", query.error);
  console.log("isLoading:", query.isLoading);
  console.groupEnd();

  return {
    environment_data: query.data?.environment?.data,
    environment_error: query.data?.environment?.error,
    asset_data: query.data?.assets?.data,
    asset_error: query.data?.assets?.error,
    overview_data: query.data?.overview?.data,
    overview_error: query.data?.overview?.error,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };

}