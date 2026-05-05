import { apiFetch } from "./client";

export interface DashboardOverview {
  openCriticalHigh: { critical: number; high: number };
  severityCounts: { critical: number; high: number; medium: number; low: number };
  overdue: number;
  unassignedCriticalHigh: number;
  resolvedThisWeek: number;
  latestScan: {
    id: string;
    completedAt: string;
    riskScore: number | null;
    activeBreakdown: { open: number; inProgress: number; resolved: number };
  } | null;
  assetVulnMap: Record<string, { count: number; highestSeverity: string | null }>;
  recentScans: {
    id: string;
    startedAt: string;
    completedAt: string | null;
    status: string;
  }[];
}

export async function getDashboardOverview(environmentId: string) {
  return apiFetch<DashboardOverview>(`/dashboard/${environmentId}/overview`);
}
