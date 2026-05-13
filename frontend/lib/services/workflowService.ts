import { updateVulnerabilityWorkflow, bulkUpdateVulnerabilityWorkflows } from "@/lib/api/vulnerabilityWorkflow";
import type { VulnStatus, WorkflowItem } from "@/lib/api/vulnerabilityWorkflow";

// ── Single status change ──
export async function updateWorkflowStatus(
  workflowId: string,
  status: VulnStatus
): Promise<WorkflowItem> {
  const response = await updateVulnerabilityWorkflow(workflowId, { status });

  if (!response.success) {
    // Throw so useMutation sees this as a failure
    throw new Error(response.message);
  }

  return response.data; // Clean WorkflowItem, no wrapper
}

// ── Bulk status change ──
export async function bulkUpdateWorkflowStatus(
  workflowIds: string[],
  status: VulnStatus
): Promise<number> {
  const response = await bulkUpdateVulnerabilityWorkflows(workflowIds, { status });

  if (!response.success) {
    throw new Error(response.message);
  }

  return response.data.updatedCount;
}