import prisma from "../lib/prisma";
import { fetchCvesFroCpe } from "./nvdCve";
import { ScanStatus, VulnSeverity } from "@prisma/client";

interface ScanProgress {
  stage: "scanning" | "processing" | "completed";
  message: string;
}

interface ScanResult {
  scanId: string;
  status: ScanStatus;
  totalAssets: number;
  scannedAssets: number;
  vulnerabilitiesFound: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  riskScore: number | null;
}

/**
 * Run a vulnerability scan for an environment
 * @param environmentId - The environment to scan
 * @param onProgress - Optional callback for progress updates (useful for SSE)
 * @returns The completed scan result
 */
export async function runScan(
  environmentId: string,
  onProgress?: (progress: ScanProgress) => void
): Promise<ScanResult> {
  // Step 1: Create SecurityScan record
  const scan = await prisma.securityScan.create({
    data: {
      environmentId,
      status: ScanStatus.IN_PROGRESS,
      startedAt: new Date(),
    },
  });

  try {
    // Step 2: Fetch assets with CPEs
    const assets = await prisma.asset.findMany({
      where: {
        environmentId,
        cpes: {
          // Filter assets that have non-empty CPEs array
          not: "[]",
        },
      },
    });

    // Step 3: Update total assets count
    await prisma.securityScan.update({
      where: { id: scan.id },
      data: { totalAssets: assets.length },
    });

    let scannedAssets = 0;
    let vulnerabilitiesFound = 0;
    const severityCounts = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    // Step 4: Process each asset
    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];

      // Notify progress
      onProgress?.({
        stage: "scanning",
        message: `Scanning ${asset.name} (${i + 1}/${assets.length})...`,
      });

      // Step 4a: Create AssetScan record
      const assetScan = await prisma.assetScan.create({
        data: {
          scanId: scan.id,
          assetId: asset.id,
          scannedAt: new Date(),
        },
      });

      // Parse CPEs from JSON
      const cpes = Array.isArray(asset.cpes) ? asset.cpes : [];
      const assetVulnerabilities = new Map<string, string>(); // cveId -> cpeName

      // Step 4b-d: Fetch CVEs for each CPE and upsert Vulnerability records
      for (const cpeItem of cpes) {
        const cpeName = typeof cpeItem === "string" ? cpeItem : cpeItem.cpeName;

        try {
          const cves = await fetchCvesFroCpe(cpeName);

          for (const cve of cves) {
            // Upsert Vulnerability (deduplicated by cveId)
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
                // Update if CVE already exists (in case severity changed)
                description: cve.description,
                cvssScore: cve.cvssScore,
                cvssVector: cve.cvssVector,
                severity: cve.severity,
                lastModifiedDate: cve.lastModifiedDate,
              },
            });

            // Track this CVE for asset (deduplicated per asset)
            // Store the UUID id, not the cveId string
            assetVulnerabilities.set(vulnerability.id, cpeName);

            // Count by severity
            if (vulnerability.severity in severityCounts) {
              severityCounts[vulnerability.severity as keyof typeof severityCounts]++;
            }
          }
        } catch (error) {
          console.error(`Failed to fetch CVEs for CPE ${cpeName}:`, error);
          // Continue with next CPE if one fails
          continue;
        }
      }

      // Step 4e: Create AssetVulnerability links (deduplicated per asset)
      // Now using the correct UUID vulnerabilityId
      for (const [vulnerabilityId, cpeName] of assetVulnerabilities) {
        await prisma.assetVulnerability.upsert({
          where: {
            assetScanId_vulnerabilityId: {
              assetScanId: assetScan.id,
              vulnerabilityId, // Now this is a UUID
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

      scannedAssets++;
      vulnerabilitiesFound += assetVulnerabilities.size;

      // Step 4f: Notify progress with CVE count
      onProgress?.({
        stage: "scanning",
        message: `Found ${assetVulnerabilities.size} CVEs for ${asset.name}`,
      });
    }

    // Step 5: Calculate risk score
    // riskScore = min(100, (critical*10 + high*7 + medium*4 + low*1) / totalAssets)
    const totalAssets = assets.length || 1;
    const riskScore = Math.min(
      100,
      (severityCounts.CRITICAL * 10 +
        severityCounts.HIGH * 7 +
        severityCounts.MEDIUM * 4 +
        severityCounts.LOW * 1) /
        totalAssets
    );

    // Step 6: Update SecurityScan with completion data
    const completedScan = await prisma.securityScan.update({
      where: { id: scan.id },
      data: {
        status: ScanStatus.COMPLETED,
        completedAt: new Date(),
        scannedAssets,
        vulnerabilitiesFound,
        criticalCount: severityCounts.CRITICAL,
        highCount: severityCounts.HIGH,
        mediumCount: severityCounts.MEDIUM,
        lowCount: severityCounts.LOW,
        riskScore,
      },
    });

    onProgress?.({
      stage: "completed",
      message: `Scan complete. Found ${vulnerabilitiesFound} vulnerabilities across ${scannedAssets} assets.`,
    });

    return mapScanToResult(completedScan);
  } catch (error) {
    // Mark scan as failed
    await prisma.securityScan.update({
      where: { id: scan.id },
      data: {
        status: ScanStatus.FAILED,
        completedAt: new Date(),
      },
    });

    console.error(`Scan ${scan.id} failed:`, error);
    throw error;
  }
}

/**
 * Get the most recent COMPLETED scan for an environment
 * Fully nested with asset scans and vulnerabilities
 */
export async function getLatestScan(environmentId: string) {
  return await prisma.securityScan.findFirst({
    where: {
      environmentId,
      status: ScanStatus.COMPLETED,
    },
    orderBy: { completedAt: "desc" },
    include: {
      assetScans: {
        include: {
          asset: {
            select: {
              id: true,
              name: true,
              type: true,
              domain: true,
            },
          },
          vulnerabilities: {
            include: {
              vulnerability: {
                select: {
                  cveId: true,
                  description: true,
                  cvssScore: true,
                  severity: true,
                  publishedDate: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

/**
 * Get scan history for an environment
 * Returns last 10 scans with metadata only (no full nested data)
 */
export async function getScanHistory(environmentId: string, limit: number = 10) {
  return await prisma.securityScan.findMany({
    where: { environmentId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      totalAssets: true,
      scannedAssets: true,
      vulnerabilitiesFound: true,
      criticalCount: true,
      highCount: true,
      mediumCount: true,
      lowCount: true,
      riskScore: true,
    },
  });
}

/**
 * Helper: Map SecurityScan to ScanResult
 */
function mapScanToResult(scan: any): ScanResult {
  return {
    scanId: scan.id,
    status: scan.status,
    totalAssets: scan.totalAssets,
    scannedAssets: scan.scannedAssets,
    vulnerabilitiesFound: scan.vulnerabilitiesFound,
    criticalCount: scan.criticalCount,
    highCount: scan.highCount,
    mediumCount: scan.mediumCount,
    lowCount: scan.lowCount,
    riskScore: scan.riskScore,
  };
}