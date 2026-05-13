import prisma from "../../lib/prisma";
import { ScanStatus, VulnStatus } from "@prisma/client";
import type { LatestScanSummary, RecentScanSummary } from "../scan-core/public";
import { SEVERITY_WEIGHT } from "../../lib/severity";
import { isInactiveStatus } from "../vulnerability-workflows/public";

const SLA_DAYS: Record<string, number> = {
  CRITICAL: 7,
  HIGH: 14,
  MEDIUM: 30,
  LOW: 90,
};

function getSlaStatus(daysOpen: number, severity: string) {
  const limit = SLA_DAYS[severity] ?? 30;
  if (daysOpen > limit) return "overdue";
  if (daysOpen > limit * 0.8) return "at-risk";
  return "on-track";
}

function getDaysOpen(firstSeenAt: Date) {
  return Math.floor((Date.now() - firstSeenAt.getTime()) / (1000 * 60 * 60 * 24));
}

export interface DashboardOverviewData {
  openCriticalHigh: { critical: number; high: number };
  severityCounts: { critical: number; high: number; medium: number; low: number };
  overdue: number;
  unassignedCriticalHigh: number;
  resolvedThisWeek: number;
  latestScan: LatestScanSummary | null;
  assetVulnMap: Record<string, { count: number; highestSeverity: string | null }>;
  recentScans: RecentScanSummary[];
}

export async function getDashboardOverview(environmentId: string): Promise<DashboardOverviewData> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [latestScan, workflows, recentScans] = await Promise.all([
    prisma.securityScan.findFirst({
      where: {
        environmentId,
        status: ScanStatus.COMPLETED,
      },
      orderBy: { completedAt: "desc" },
      include: {
        assetScans: {
          include: {
            asset: true,
            vulnerabilities: {
              include: {
                vulnerability: true,
              },
            },
          },
        },
      },
    }),
    prisma.vulnerabilityWorkflow.findMany({
      where: { environmentId },
      include: {
        vulnerability: true,
      },
    }),
    prisma.securityScan.findMany({
      where: { environmentId },
      orderBy: { startedAt: "desc" },
      take: 4,
    }),
  ]);

  const workflowMap = new Map<string, typeof workflows[0]>();
  for (const w of workflows) {
    workflowMap.set(`${w.vulnerabilityId}-${w.assetId}-${w.cpeName}`, w);
  }



  // Latest-scan scoped stats
  let critical = 0, high = 0, medium = 0, low = 0;
  let latestOpen = 0, latestInProgress = 0, latestResolved = 0;
  const assetVulnMap: Record<string, { count: number; highestSeverity: string | null }> = {};

  if (latestScan) {
    for (const as of latestScan.assetScans) {
      let assetCount = 0;
      let assetHighest: string | null = null;
      for (const v of as.vulnerabilities) {
        const key = `${v.vulnerability.id}-${as.asset.id}-${v.cpeName}`;
        const wf = workflowMap.get(key);
        const status = wf?.status ?? VulnStatus.OPEN;

        if (isInactiveStatus(status)) {
          latestResolved++;
          continue;
        }

        assetCount++;
        const sev = v.vulnerability.severity;
        if (!assetHighest || (SEVERITY_WEIGHT[sev] ?? 0) > (SEVERITY_WEIGHT[assetHighest] ?? 0)) {
          assetHighest = sev;
        }

        if (sev === "CRITICAL") critical++;
        else if (sev === "HIGH") high++;
        else if (sev === "MEDIUM") medium++;
        else if (sev === "LOW") low++;

        if (status === VulnStatus.OPEN) latestOpen++;
        else if (status === VulnStatus.IN_PROGRESS) latestInProgress++;
      }
      if (assetCount > 0 || latestScan.assetScans.some(a => a.asset.id === as.asset.id)) {
        assetVulnMap[as.asset.id] = { count: assetCount, highestSeverity: assetHighest };
      }
    }
  }

  // Environment-level operational stats
  let overdue = 0;
  let unassignedCriticalHigh = 0;
  let resolvedThisWeek = 0;

  for (const w of workflows) {
    if (w.resolvedAt && w.resolvedAt >= sevenDaysAgo) {
      resolvedThisWeek++;
    }

    if (isInactiveStatus(w.status)) continue;

    const severity = w.vulnerability.severity;
    const days = getDaysOpen(w.firstSeenAt);
    if (getSlaStatus(days, severity) === "overdue") {
      overdue++;
    }

    if (!w.assigneeId && (severity === "CRITICAL" || severity === "HIGH")) {
      unassignedCriticalHigh++;
    }
  }

  return {
    openCriticalHigh: { critical, high },
    severityCounts: { critical, high, medium, low },
    overdue,
    unassignedCriticalHigh,
    resolvedThisWeek,
    latestScan: latestScan
      ? {
          id: latestScan.id,
          completedAt: latestScan.completedAt,
          riskScore: latestScan.riskScore,
          activeBreakdown: {
            open: latestOpen,
            inProgress: latestInProgress,
            resolved: latestResolved,
          },
        }
      : null,
    assetVulnMap,
    recentScans: recentScans.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      completedAt: s.completedAt ?? null,
      status: s.status,
    })),
  };
}
