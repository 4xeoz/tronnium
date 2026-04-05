import prisma from "../lib/prisma";
import { fetchCvesFroCpe, getMaxLookbackDate, isValidLookbackDate } from "./nvdCve";
import { ScanStatus, VulnSeverity } from "@prisma/client";
import { getOrCreateWorkflow, shouldHideVulnerability } from "./vulnerabilityWorkflow.service";

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

export interface ScanOptions {
  /** 
   * Scan from this date onwards. 
   * If not provided, scans all CVEs.
   * If "last-scan", uses the date of the previous completed scan.
   * Max lookback: 5 years
   */
  fromDate?: Date | "last-scan";
}

/**
 * Run a vulnerability scan for an environment
 * @param environmentId - The environment to scan
 * @param options - Optional scan configuration
 * @param onProgress - Optional callback for progress updates (useful for SSE)
 * @returns The completed scan result
 */
export async function runScan(
  environmentId: string,
  options: ScanOptions = {},
  onProgress?: (progress: ScanProgress) => void
): Promise<ScanResult> {
  // Resolve fromDate if set to "last-scan"
  let pubStartDate: Date | undefined;
  
  if (options.fromDate === "last-scan") {
    // Find the most recent completed REAL scan (not mock scans from dev mode)
    const lastScan = await prisma.securityScan.findFirst({
      where: {
        environmentId,
        status: ScanStatus.COMPLETED,
        isMock: false, // ⚠️ CRITICAL: Only consider real scans, not mock scans
      },
      orderBy: { completedAt: "desc" },
    });
    
    if (lastScan?.completedAt) {
      pubStartDate = lastScan.completedAt;
      console.log(`[Scan] Using last real scan date: ${pubStartDate.toISOString()}`);
    } else {
      console.log(`[Scan] No previous real scan found, will scan all CVEs`);
    }
  } else if (options.fromDate instanceof Date) {
    // Validate the date is within allowed range
    if (!isValidLookbackDate(options.fromDate)) {
      const maxLookback = getMaxLookbackDate();
      throw new Error(
        `Invalid fromDate. Must be between ${maxLookback.toISOString()} and now.`
      );
    }
    pubStartDate = options.fromDate;
  }

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
      const assetVulnerabilities = new Map<string, string>(); // vulnerabilityId -> cpeName

      // Step 4b-d: Fetch CVEs for each CPE and upsert Vulnerability records
      for (const cpeItem of cpes) {
        const cpeName = typeof cpeItem === "string" ? cpeItem : cpeItem.cpeName;

        try {
          // Pass pubStartDate to only get CVEs from the specified date onwards
          const cves = await fetchCvesFroCpe(cpeName, pubStartDate);

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

      // Step 4b-e: Include mock vulnerabilities from dev mode
      // Find mock vulnerabilities that were explicitly generated for this asset
      // Only include mocks that match this asset's CPEs to avoid cross-contamination
      const mockVulnerabilities = await prisma.assetVulnerability.findMany({
        where: {
          assetScan: {
            assetId: asset.id,
            scan: {
              isMock: true, // Only from mock scans created in dev mode
            },
          },
          vulnerability: {
            isMock: true, // Only mock vulnerabilities
          },
          // Only include if the CPE matches one of this asset's CPEs
          // This prevents mock CVEs from being applied to wrong assets
          cpeName: {
            in: cpes.map(cpe => typeof cpe === "string" ? cpe : cpe.cpeName),
          },
        },
        include: {
          vulnerability: true,
        },
        distinct: ["vulnerabilityId"], // Deduplicate
      });

      if (mockVulnerabilities.length > 0) {
        console.log(`[Scan] Found ${mockVulnerabilities.length} mock vulnerabilities for asset ${asset.name} matching CPEs`);
      }

      for (const mockAv of mockVulnerabilities) {
        const vuln = mockAv.vulnerability;
        
        // Only add if not already found from NVD (avoid duplicates)
        if (!assetVulnerabilities.has(vuln.id)) {
          assetVulnerabilities.set(vuln.id, mockAv.cpeName);
          
          // Count by severity
          if (vuln.severity in severityCounts) {
            severityCounts[vuln.severity as keyof typeof severityCounts]++;
          }
          
          console.log(`[Scan] Including mock CVE ${vuln.cveId} for ${asset.name}`);
        }
      }

      // Step 4b-f: Create/update workflow records and filter out resolved vulnerabilities
      // This ensures CVEs persist and can be managed through the workflow
      const visibleVulnerabilities = new Map<string, string>(); // vulnerabilityId -> cpeName
      
      for (const [vulnerabilityId, cpeName] of assetVulnerabilities) {
        // Get or create workflow record (updates lastSeenAt)
        await getOrCreateWorkflow(environmentId, asset.id, vulnerabilityId, cpeName);
        
        // Check if this vulnerability should be hidden (RESOLVED or FALSE_POSITIVE)
        const shouldHide = await shouldHideVulnerability(environmentId, asset.id, vulnerabilityId, cpeName);
        
        if (shouldHide) {
          console.log(`[Scan] Hiding resolved/false-positive vulnerability ${vulnerabilityId} for ${asset.name}`);
          // Remove from severity counts since we're not showing it
          const vuln = await prisma.vulnerability.findUnique({ where: { id: vulnerabilityId } });
          if (vuln && vuln.severity in severityCounts) {
            severityCounts[vuln.severity as keyof typeof severityCounts]--;
          }
        } else {
          // Include in visible vulnerabilities
          visibleVulnerabilities.set(vulnerabilityId, cpeName);
        }
      }

      // Step 4e: Create AssetVulnerability links (deduplicated per asset)
      // Only for visible (non-resolved) vulnerabilities
      for (const [vulnerabilityId, cpeName] of visibleVulnerabilities) {
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
      
      // Replace assetVulnerabilities with filtered list for counting
      assetVulnerabilities.clear();
      for (const [id, cpe] of visibleVulnerabilities) {
        assetVulnerabilities.set(id, cpe);
      }

      scannedAssets++;
      vulnerabilitiesFound += assetVulnerabilities.size;

      // Step 4f: Notify progress with CVE count (including mocks)
      const mockCount = mockVulnerabilities.length;
      const message = mockCount > 0 
        ? `Found ${assetVulnerabilities.size} CVEs for ${asset.name} (${mockCount} mock)`
        : `Found ${assetVulnerabilities.size} CVEs for ${asset.name}`;
      
      onProgress?.({
        stage: "scanning",
        message,
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
      isMock: false, // Only return real scans, not mock scans from dev mode
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
                  id: true,
                  cveId: true,
                  description: true,
                  cvssScore: true,
                  severity: true,
                  publishedDate: true,
                  isMock: true,
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
    where: { 
      environmentId,
      isMock: false, // Only return real scans
    },
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
 * Get a single scan by ID with full details
 * Includes all asset scans and vulnerabilities
 */
export async function getScanById(scanId: string, environmentId: string) {
  return await prisma.securityScan.findFirst({
    where: {
      id: scanId,
      environmentId,
    },
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
                  id: true,
                  cveId: true,
                  description: true,
                  cvssScore: true,
                  cvssVector: true,
                  severity: true,
                  publishedDate: true,
                  lastModifiedDate: true,
                  isMock: true,
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