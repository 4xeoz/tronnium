import prisma from "../../lib/prisma";
import { fetchCvesForCpe, getMaxLookbackDate, isValidLookbackDate } from "../scan-nvd/public";
import { AssetCpe, ScanStatus } from "@prisma/client";
import { getOrCreateWorkflow, shouldHideVulnerability } from "../vulnerability-workflows/public";
import type { ScanProgress, ScanResult, ScanOptions } from "./scan.types";
import { countSeverities, calculateRiskScore, whereNotMock } from "../../lib/severity";
import { fetchEpssForCves }       from "../../lib/epss.service";
import { calculateEpssRiskScore } from "../../lib/severity";

const SCAN_WITH_ASSETS_INCLUDE = {
  assetScans: {
    include: {
      asset: {
        include: {
          cpes: true,
        },
      },
      vulnerabilities: {
        include: {
          vulnerability: true,
        },
      },
    },
  },
} as const;

interface SeverityCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

async function resolveScanFromDate(
  environmentId: string,
  fromDate: ScanOptions["fromDate"]
): Promise<Date | undefined> {
  if (fromDate === "last-scan") {
    const lastScan = await prisma.securityScan.findFirst({
      where: {
        environmentId,
        status: ScanStatus.COMPLETED,
        ...whereNotMock,
      },
      orderBy: { completedAt: "desc" },
    });

    if (lastScan?.completedAt) {
      console.log(`[Scan] Using last real scan date: ${lastScan.completedAt.toISOString()}`);
      return lastScan.completedAt;
    } else {
      console.log(`[Scan] No previous real scan found, will scan all CVEs`);
      return undefined;
    }
  }

  if (fromDate instanceof Date) {
    if (!isValidLookbackDate(fromDate)) {
      const maxLookback = getMaxLookbackDate();
      throw new Error(
        `Invalid fromDate. Must be between ${maxLookback.toISOString()} and now.`
      );
    }
    return fromDate;
  }

  return undefined;
}

async function fetchScannableAssets(environmentId: string) {
  return prisma.asset.findMany({
    where: {
      environmentId,
      cpes: {
        some: {},
      },
    },
    include: {
      cpes: true,
    },
  });
}

async function processAssetScan(
  scanId: string,
  asset: any,
  environmentId: string,
  pubStartDate: Date | undefined,
  pubEndDate: Date | undefined,
  onProgress?: (progress: ScanProgress) => void
): 
Promise<{
  vulnerabilityCount: number;
  severityCounts:     SeverityCounts;
  mockCount:          number;
  epssVulns:          Array<{ cvssScore: number | null; epssScore: number | null }>;
}> 

{
  const assetScan = await prisma.assetScan.create({
    data: {
      scanId,
      assetId: asset.id,
      scannedAt: new Date(),
    },
  });

  const cpes = Array.isArray(asset.cpes) ? asset.cpes : [];
  const assetVulnerabilities = new Map<string, string>();
  const severityCounts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  const upsertedVulns: Array<{ id: string; cveId: string; cvssScore: number | null }> = [];

  for (const cpeItem of cpes) {
    const cpeName = typeof cpeItem === "string" ? cpeItem : cpeItem.cpeName;

    try {
      const cves = await fetchCvesForCpe(cpeName, pubStartDate, pubEndDate, onProgress);

      for (const cve of cves) {
        const vulnerability = await prisma.vulnerability.upsert({
          where: { cveId: cve.cveId },
          create: {
            cveId: cve.cveId,
            description: cve.description,
            cvssScore: cve.cvssScore,
            cvssVector: cve.cvssVector,
            severity: cve.severity,
            publishedDate: cve.publishedDate,
            lastModifiedDate: cve.lastModifiedDate,
          },
          update: {
            description: cve.description,
            cvssScore: cve.cvssScore,
            cvssVector: cve.cvssVector,
            severity: cve.severity,
            lastModifiedDate: cve.lastModifiedDate,
          },
        });

        assetVulnerabilities.set(vulnerability.id, cpeName);
        upsertedVulns.push({ id: vulnerability.id, cveId: vulnerability.cveId, cvssScore: vulnerability.cvssScore });

        const sev = vulnerability.severity.toLowerCase();
        if (sev in severityCounts) {
          severityCounts[sev as keyof SeverityCounts]++;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch CVEs for CPE ${cpeName}:`, error);
      continue;
    }
  }

  const mockVulnerabilities = await prisma.assetVulnerability.findMany({
    where: {
      assetScan: {
        assetId: asset.id,
        scan: { isMock: true },
      },
      vulnerability: { isMock: true },
      cpeName: {
        in: cpes.map((cpe : AssetCpe) => (typeof cpe === "string" ? cpe : cpe.cpeName)),
      },
    },
    include: { vulnerability: true },
    distinct: ["vulnerabilityId"],
  });

  if (mockVulnerabilities.length > 0) {
    console.log(`[Scan] Found ${mockVulnerabilities.length} mock vulnerabilities for asset ${asset.name} matching CPEs`);
  }

  for (const mockAv of mockVulnerabilities) {
    const vuln = mockAv.vulnerability;

    if (!assetVulnerabilities.has(vuln.id)) {
      assetVulnerabilities.set(vuln.id, mockAv.cpeName);

      const sev = vuln.severity.toLowerCase();
      if (sev in severityCounts) {
        severityCounts[sev as keyof SeverityCounts]++;
      }

      console.log(`[Scan] Including mock CVE ${vuln.cveId} for ${asset.name}`);
    }
  }

const epssVulns: Array<{ cvssScore: number | null; epssScore: number | null }> = [];
try {
  const cveIds = upsertedVulns.map(v => v.cveId);
  if (cveIds.length > 0) {
    onProgress?.({ stage: "scanning", message: `Fetching EPSS risk scores for ${cveIds.length} CVEs...` });  // ← add
    const epssMap = await fetchEpssForCves(cveIds);
    onProgress?.({ stage: "scanning", message: `EPSS enrichment complete` });  // ← add
    await Promise.all(upsertedVulns.map(async (v) => {
      const epss = epssMap.get(v.cveId);
      if (epss) {
        await prisma.vulnerability.update({
          where: { id: v.id },
          data: {
            epssScore:       epss.epssScore,
            epssPercentile:  epss.percentile,
            epssLastFetched: new Date(),
          },
        });
        epssVulns.push({ cvssScore: v.cvssScore, epssScore: epss.epssScore });
      } else {
        epssVulns.push({ cvssScore: v.cvssScore, epssScore: null });
      }
    }));
  }
} catch (error) {
  console.error("[EPSS] Enrichment failed, scan continues:", error);
}

  const visibleVulnerabilities = new Map<string, string>();

  for (const [vulnerabilityId, cpeName] of assetVulnerabilities) {
    await getOrCreateWorkflow(environmentId, asset.id, vulnerabilityId, cpeName);

    const shouldHide = await shouldHideVulnerability(environmentId, asset.id, vulnerabilityId, cpeName);

    if (shouldHide) {
      console.log(`[Scan] Hiding resolved/false-positive vulnerability ${vulnerabilityId} for ${asset.name}`);
      const vuln = await prisma.vulnerability.findUnique({ where: { id: vulnerabilityId } });
      if (vuln) {
        const sev = vuln.severity.toLowerCase();
        if (sev in severityCounts) {
          severityCounts[sev as keyof SeverityCounts]--;
        }
      }
    } else {
      visibleVulnerabilities.set(vulnerabilityId, cpeName);
    }
  }

  for (const [vulnerabilityId, cpeName] of visibleVulnerabilities) {
    await prisma.assetVulnerability.upsert({
      where: {
        assetScanId_vulnerabilityId: {
          assetScanId: assetScan.id,
          vulnerabilityId,
        },
      },
      create: {
        assetScanId: assetScan.id,
        vulnerabilityId,
        cpeName,
      },
      update: {
        cpeName,
      },
    });
  }

  const mockCount = mockVulnerabilities.length;
  const message = mockCount > 0
    ? `Found ${visibleVulnerabilities.size} CVEs for ${asset.name} (${mockCount} mock)`
    : `Found ${visibleVulnerabilities.size} CVEs for ${asset.name}`;

  onProgress?.({
    stage: "scanning",
    message,
  });

  return { vulnerabilityCount: visibleVulnerabilities.size, severityCounts, mockCount, epssVulns };
}

async function finalizeScan(
  scanId: string,
  assetsLength: number,
  scannedAssets: number,
  vulnerabilitiesFound: number,
  severityCounts: SeverityCounts,
  allEpssVulns:         Array<{ cvssScore: number | null; epssScore: number | null }>,
  onProgress?: (progress: ScanProgress) => void
): Promise<ScanResult> {
  const riskScore = calculateRiskScore(severityCounts, assetsLength);
  const epssRiskScore = calculateEpssRiskScore(allEpssVulns, assetsLength);


  const completedScan = await prisma.securityScan.update({
    where: { id: scanId },
    data: {
      status: ScanStatus.COMPLETED,
      completedAt: new Date(),
      scannedAssets,
      vulnerabilitiesFound,
      criticalCount: severityCounts.critical,
      highCount: severityCounts.high,
      mediumCount: severityCounts.medium,
      lowCount: severityCounts.low,
      riskScore,
      epssRiskScore
    },
  });

  onProgress?.({
    stage: "completed",
    message: `Scan complete. Found ${vulnerabilitiesFound} vulnerabilities across ${scannedAssets} assets.`,
  });

  return completedScan;
}

export async function runScan(
  environmentId: string,
  scanId: string,
  options: ScanOptions = {},
  onProgress?: (progress: ScanProgress) => void
): Promise<ScanResult> {
  const pubStartDate = await resolveScanFromDate(environmentId, options.fromDate);

  try {
    const assets = await fetchScannableAssets(environmentId);

    await prisma.securityScan.update({
      where: { id: scanId },
      data: { totalAssets: assets.length },
    });

    let scannedAssets = 0;
    let vulnerabilitiesFound = 0;
    const totalSeverityCounts: SeverityCounts = { critical: 0, high: 0, medium: 0, low: 0 };

    const allEpssVulns: Array<{ cvssScore: number | null; epssScore: number | null }> = [];


    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];

      onProgress?.({
        stage: "scanning",
        message: `Scanning ${asset.name} (${i + 1}/${assets.length})...`,
      });

      const result = await processAssetScan(scanId, asset, environmentId, pubStartDate, undefined , onProgress);

      allEpssVulns.push(...result.epssVulns);

      scannedAssets++;
      vulnerabilitiesFound += result.vulnerabilityCount;
      totalSeverityCounts.critical += result.severityCounts.critical;
      totalSeverityCounts.high += result.severityCounts.high;
      totalSeverityCounts.medium += result.severityCounts.medium;
      totalSeverityCounts.low += result.severityCounts.low;
    }

    return await finalizeScan(
      scanId,
      assets.length,
      scannedAssets,
      vulnerabilitiesFound,
      totalSeverityCounts,
      allEpssVulns,
      onProgress
    );
  } catch (error) {
    await prisma.securityScan.update({
      where: { id: scanId },
      data: {
        status: ScanStatus.FAILED,
        completedAt: new Date(),
      },
    });

    console.error(`Scan ${scanId} failed:`, error);
    throw error;
  }
}

export async function getLatestScan(environmentId: string) {
  return await prisma.securityScan.findFirst({
    where: {
      environmentId,
      status: { in: [ScanStatus.COMPLETED, ScanStatus.IN_PROGRESS] },
      ...whereNotMock,
    },
    orderBy: { createdAt: "desc" },
    include: SCAN_WITH_ASSETS_INCLUDE,
  });
}

export async function getScanHistory(environmentId: string, limit: number = 10) {
  return await prisma.securityScan.findMany({
    where: {
      environmentId,
      ...whereNotMock,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getScanById(scanId: string, environmentId: string) {
  return await prisma.securityScan.findFirst({
    where: {
      id: scanId,
      environmentId,
    },
    include: SCAN_WITH_ASSETS_INCLUDE,
  });
}
