export type UrgencyLevel = "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW";

export const whereNotMock = { isMock: false } as const;

export const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  UNKNOWN: 4,
};

export const SEVERITY_WEIGHT: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
  UNKNOWN: 0,
};

export interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export function countSeverities(
  items: Array<{ severity: string }>
): SeverityCounts {
  const counts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const item of items) {
    const sev = item.severity.toLowerCase();
    if (sev === "critical") counts.critical++;
    else if (sev === "high") counts.high++;
    else if (sev === "medium") counts.medium++;
    else if (sev === "low") counts.low++;
  }
  return counts;
}

export function calculateRiskScore(
  counts: SeverityCounts,
  totalAssets: number
): number {
  const score =
    (counts.critical * 10 +
      counts.high * 7 +
      counts.medium * 4 +
      counts.low * 1) /
    (totalAssets || 1);
  return Math.min(100, score);
}


export function epssAdjustedCvss(
  cvssScore: number | null,
  epssScore: number | null
): number {
  return (cvssScore ?? 5.0) * (1 + (epssScore ?? 0));
}

export function calculateEpssRiskScore(
  vulnerabilities: Array<{ cvssScore: number | null; epssScore: number | null }>,
  totalAssets: number
): number {
  if (vulnerabilities.length === 0) return 0;
  const total = vulnerabilities.reduce(
    (sum, v) => sum + epssAdjustedCvss(v.cvssScore, v.epssScore), 0
  );
  return Math.min(100, total / (totalAssets || 1));
}
