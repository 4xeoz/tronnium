import type { VulnStatus } from "@prisma/client";

export interface UpdateWorkflowInput {
  status?: VulnStatus;
  assigneeId?: string | null;
  notes?: string | null;
  dueDate?: Date | null;
}

export interface WorkflowPublic {
  id: string;
  environmentId: string;
  assetId: string;
  assetName: string;
  assetType: string;
  vulnerabilityId: string;
  cveId: string;
  description: string;
  severity: string;
  cvssScore: number | null;
  cpeName: string;
  status: VulnStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  notes: string | null;
  dueDate: Date | null;
  resolvedAt: Date | null;
  resolvedBy: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}
