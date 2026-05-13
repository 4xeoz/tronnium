import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { VulnStatus } from "@/lib/api/vulnerabilityWorkflow";

import { getSecurityOverview } from "@/lib/services/scanService";
import {
  updateWorkflowStatus,
  bulkUpdateWorkflowStatus,
} from "../services/workflowService";

export function useSecurityBoard(envId: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["security-overview", envId],
    queryFn: async () => {
      const result = await getSecurityOverview(envId);
      console.group("[useSecurityBoard] raw response");
      console.log("latestScan:", result.latestScan);
      console.log("history:", result.history);
      console.log("settings:", result.settings);
      console.log("workflows:", result.workflows);
      console.groupEnd();
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── MUTATION 1: Update single workflow status ──
  const updateWorkflowStatusMutation = useMutation({
    mutationFn: ({
      workflowId,
      status,
    }: {
      workflowId: string;
      status: VulnStatus;
    }) => updateWorkflowStatus(workflowId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-overview", envId] });
    },
  });

  // ── MUTATION 2: Bulk update workflow statuses ──
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: VulnStatus }) =>
      bulkUpdateWorkflowStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-overview", envId] });
    },
  });

  useEffect(() => {
    if (!query.data) return;
    console.group("[useSecurityBoard] derived values");
    console.log("isLoading:", query.isLoading);
    console.log("latestScan_data:", query.data.latestScan.data);
    console.log("latestScan_error:", query.data.latestScan.error);
    console.log("history_data:", query.data.history?.data);
    console.log("history_error:", query.data.history?.error);
    console.log("workflows_data:", query.data.workflows?.data);
    console.log("workflows_error:", query.data.workflows?.error);
    console.groupEnd();
  }, [query.data, query.isLoading]);

  return {
    latestScan_data: query.data?.latestScan.data,
    latestScan_error: query.data?.latestScan.error,
    history_data: query.data?.history?.data,
    history_error: query.data?.history?.error,
    settings_data: query.data?.settings?.data,
    settings_error: query.data?.settings?.error,
    workflows_data: query.data?.workflows?.data,
    workflows_error: query.data?.workflows?.error,

    isLoading: query.isLoading,

    // muataion 1 
    updateWorkflowStatus_function: updateWorkflowStatusMutation.mutateAsync,
    updateWorkflowStatus_isLoading: updateWorkflowStatusMutation.isPending,
    updateWorkflowStatus_error: updateWorkflowStatusMutation.error instanceof Error ? updateWorkflowStatusMutation.error.message : null,
    updateWorkflowStatus_isSuccess: updateWorkflowStatusMutation.isSuccess,
    updateWorkflowStatus_reset: updateWorkflowStatusMutation.reset,

    // mutation 2
    bulkUpdateWorkflowStatus_function: bulkUpdateMutation.mutateAsync,
    bulkUpdateWorkflowStatus_isLoading: bulkUpdateMutation.isPending,
    bulkUpdateWorkflowStatus_error: bulkUpdateMutation.error instanceof Error ? bulkUpdateMutation.error.message : null,
    bulkUpdateWorkflowStatus_isSuccess: bulkUpdateMutation.isSuccess,
    bulkUpdateWorkflowStatus_reset: bulkUpdateMutation.reset,

    refetch: query.refetch,
  }
}
