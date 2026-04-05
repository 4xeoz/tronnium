"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  FiArrowLeft,
  FiCalendar,
  FiClock,
  FiShield,
  FiAlertTriangle,
  FiCheckCircle,
  FiXCircle,
  FiActivity,
  FiBarChart2,
  FiServer,
  FiExternalLink,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiHash,
  FiRefreshCw,
} from "react-icons/fi";
import { getScanById, getSeverityColor, type LatestScan, type ScanSeverity } from "@/lib/api";

// ============== Types ==============

type AssetScanItem = {
  id: string;
  scannedAt: string;
  asset: {
    id: string;
    name: string;
    type: string;
    domain: string;
  };
  vulnerabilities: {
    vulnerability: {
      id: string;
      cveId: string;
      description: string;
      cvssScore: number | null;
      cvssVector: string | null;
      severity: ScanSeverity;
      publishedDate: string | null;
      lastModifiedDate: string | null;
      isMock?: boolean;
    };
    cpeName: string;
  }[];
};

// ============== Helper Functions ==============

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return "In progress";
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffMs = end - start;
  const diffMins = Math.floor(diffMs / 60000);
  const diffSecs = Math.floor((diffMs % 60000) / 1000);
  
  if (diffMins > 0) {
    return `${diffMins}m ${diffSecs}s`;
  }
  return `${diffSecs}s`;
}

function getRiskLevel(score: number | null | undefined): { label: string; color: string; bgColor: string } {
  if (score === null || score === undefined) {
    return { label: "Unknown", color: "text-text-muted", bgColor: "bg-surface-secondary" };
  }
  if (score < 20) return { label: "Low", color: "text-blue-500", bgColor: "bg-blue-500/10" };
  if (score < 40) return { label: "Moderate", color: "text-yellow-500", bgColor: "bg-yellow-500/10" };
  if (score < 60) return { label: "High", color: "text-orange-500", bgColor: "bg-orange-500/10" };
  return { label: "Critical", color: "text-red-500", bgColor: "bg-red-500/10" };
}

// ============== Components ==============

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-surface rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-text-muted">{icon}</span>
        <span className="text-text-secondary text-sm">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
      {sub && <div className="text-xs text-text-muted mt-1">{sub}</div>}
    </div>
  );
}

function SeverityBadge({ count, severity }: { count: number; severity: string }) {
  const colors: Record<string, string> = {
    Critical: "bg-red-500/10 text-red-500 border-red-500/20",
    High: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    Low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  };

  return (
    <div className={`rounded-lg border p-3 text-center ${colors[severity] || colors.Low}`}>
      <div className="text-xl font-bold">{count}</div>
      <div className="text-xs font-medium uppercase tracking-wide mt-0.5">{severity}</div>
    </div>
  );
}

function VulnerabilityRow({ vuln, index }: { vuln: AssetScanItem["vulnerabilities"][0]; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const severityColors = getSeverityColor(vuln.vulnerability.severity);

  const copyCveId = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(vuln.vulnerability.cveId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Unknown";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-start justify-between hover:bg-surface-secondary/50 transition-colors text-left"
      >
        <div className="flex items-start gap-3 flex-1">
          <span className="w-6 h-6 rounded bg-text-muted/10 text-text-muted text-xs font-medium flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* CVE ID - Clickable */}
              <a
                href={`https://nvd.nist.gov/vuln/detail/${vuln.vulnerability.cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-semibold text-blue-500 hover:text-blue-600 hover:underline flex items-center gap-1 transition-colors"
              >
                {vuln.vulnerability.cveId}
                <FiExternalLink className="w-3 h-3" />
              </a>
              
              {/* Copy button */}
              <button
                onClick={copyCveId}
                className="p-1 rounded hover:bg-surface-tertiary text-text-muted hover:text-text-secondary transition-colors"
                title="Copy CVE ID"
              >
                <FiCopy className="w-3 h-3" />
              </button>
              
              {copied && (
                <span className="text-xs text-success-text">Copied!</span>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${severityColors}`}>
                {vuln.vulnerability.severity}
              </span>
              {vuln.vulnerability.isMock && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-500 border border-purple-500/20">
                  MOCK
                </span>
              )}
              {vuln.vulnerability.cvssScore !== null && (
                <span className="text-xs text-text-secondary">
                  CVSS: <span className="font-medium">{vuln.vulnerability.cvssScore.toFixed(1)}</span>
                </span>
              )}
              <span className="text-xs text-text-muted font-mono">{vuln.cpeName}</span>
            </div>
          </div>
        </div>
        
        {isExpanded ? (
          <FiChevronUp className="w-4 h-4 text-text-muted shrink-0" />
        ) : (
          <FiChevronDown className="w-4 h-4 text-text-muted shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 bg-surface-secondary/30">
          <div className="pl-9">
            {/* Description */}
            <div className="mb-3">
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Description</h4>
              <p className="text-sm text-text-secondary leading-relaxed">
                {vuln.vulnerability.description}
              </p>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Published</h4>
                <p className="text-sm text-text-secondary">{formatDate(vuln.vulnerability.publishedDate)}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">Last Modified</h4>
                <p className="text-sm text-text-secondary">{formatDate(vuln.vulnerability.lastModifiedDate)}</p>
              </div>
            </div>

            {vuln.vulnerability.cvssVector && (
              <div className="mb-3">
                <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-1">CVSS Vector</h4>
                <code className="text-xs text-text-secondary font-mono bg-background px-2 py-1 rounded border border-border">
                  {vuln.vulnerability.cvssVector}
                </code>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <a
                href={`https://nvd.nist.gov/vuln/detail/${vuln.vulnerability.cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background hover:bg-surface-tertiary border border-border rounded-md text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <FiExternalLink className="w-3 h-3" />
                View on NVD
              </a>
              <a
                href={`https://cve.mitre.org/cgi-bin/cvename.cgi?name=${vuln.vulnerability.cveId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-background hover:bg-surface-tertiary border border-border rounded-md text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <FiExternalLink className="w-3 h-3" />
                MITRE
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetScanSection({ assetScan }: { assetScan: AssetScanItem }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const vulnCount = assetScan.vulnerabilities?.length || 0;

  if (vulnCount === 0) return null;

  return (
    <div className="border border-border rounded-lg overflow-hidden mb-4">
      {/* Asset Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 bg-surface-secondary flex items-center justify-between hover:bg-surface-tertiary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center border border-border">
            <FiServer className="w-4 h-4 text-text-muted" />
          </div>
          <div className="text-left">
            <div className="font-medium text-text-primary text-sm">{assetScan.asset.name}</div>
            <div className="text-xs text-text-muted capitalize">{assetScan.asset.type}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${
              vulnCount > 0 ? "bg-error-bg text-error-text border border-error-border" : "bg-success-bg text-success-text border border-success-border"
            }`}
          >
            {vulnCount} {vulnCount === 1 ? "vulnerability" : "vulnerabilities"}
          </span>
          {isExpanded ? (
            <FiChevronUp className="w-4 h-4 text-text-muted" />
          ) : (
            <FiChevronDown className="w-4 h-4 text-text-muted" />
          )}
        </div>
      </button>

      {/* Vulnerabilities List */}
      {isExpanded && (
        <div className="divide-y divide-border">
          {assetScan.vulnerabilities.map((vuln, idx) => (
            <VulnerabilityRow key={vuln.vulnerability.id} vuln={vuln} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============== Main Page ==============

export default function ScanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const envId = params.envId as string;
  const scanId = params.scanId as string;

  const [scan, setScan] = useState<LatestScan | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadScan = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await getScanById(envId, scanId);
      if (response.data) {
        setScan(response.data);
      } else {
        setError("Failed to load scan details");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scan");
    } finally {
      setIsLoading(false);
    }
  }, [envId, scanId]);

  useEffect(() => {
    loadScan();
  }, [loadScan]);

  const riskLevel = getRiskLevel(scan?.riskScore);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-text-muted border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !scan) {
    return (
      <div className="p-8">
        <div className="bg-error-bg border border-error-border rounded-lg p-6 text-center">
          <FiXCircle className="w-10 h-10 text-error-text mx-auto mb-3" />
          <h2 className="text-lg font-semibold text-error-text mb-2">Failed to Load Scan</h2>
          <p className="text-error-text/80 text-sm mb-4">{error || "Scan not found"}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={loadScan}
              className="inline-flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg text-sm font-medium text-text-secondary hover:bg-surface-secondary transition-colors"
            >
              <FiRefreshCw className="w-4 h-4" />
              Retry
            </button>
            <Link
              href={`/environments/${envId}/security`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-text-primary text-surface rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <FiArrowLeft className="w-4 h-4" />
              Back to Security
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Calculate stats
  const assetsWithVulns = scan.assetScans?.filter((a) => (a.vulnerabilities?.length || 0) > 0).length || 0;
  const totalVulns = scan.vulnerabilitiesFound || 0;

  return (
    <div className="p-8 h-full overflow-auto">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/environments/${envId}/security`}
              className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-secondary transition-colors mb-2"
            >
              <FiArrowLeft className="w-4 h-4" />
              Back to Security
            </Link>
            <h1 className="text-2xl font-bold text-text-primary">Scan Details</h1>
            <p className="text-text-secondary text-sm mt-1">
              {formatDate(scan.startedAt)}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
                scan.status === "COMPLETED"
                  ? "bg-success-bg text-success-text border-success-border"
                  : scan.status === "FAILED"
                  ? "bg-error-bg text-error-text border-error-border"
                  : "bg-warning-bg text-warning-text border-warning-border"
              }`}
            >
              {scan.status}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<FiBarChart2 className="w-4 h-4" />}
            label="Risk Score"
            value={scan.riskScore?.toFixed(1) ?? "--"}
            sub={riskLevel.label}
          />
          <StatCard
            icon={<FiAlertTriangle className="w-4 h-4" />}
            label="Vulnerabilities"
            value={totalVulns}
            sub={`${scan.criticalCount} critical`}
          />
          <StatCard
            icon={<FiServer className="w-4 h-4" />}
            label="Assets Scanned"
            value={scan.scannedAssets}
            sub={`of ${scan.totalAssets}`}
          />
          <StatCard
            icon={<FiClock className="w-4 h-4" />}
            label="Duration"
            value={formatDuration(scan.startedAt, scan.completedAt)}
            sub={scan.completedAt ? "Completed" : "In progress"}
          />
        </div>

        {/* Timeline */}
        <div className="bg-surface rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-4">Timeline</h3>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-surface-secondary border border-border flex items-center justify-center">
                <FiCalendar className="w-4 h-4 text-text-muted" />
              </div>
              <div>
                <div className="text-xs text-text-muted">Started</div>
                <div className="text-sm text-text-primary">{formatDate(scan.startedAt)}</div>
              </div>
            </div>
            
            <div className="flex-1 h-px bg-border" />
            
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${
                scan.completedAt 
                  ? "bg-success-bg border-success-border" 
                  : "bg-surface-secondary border-border"
              }`}>
                {scan.completedAt ? (
                  <FiCheckCircle className="w-4 h-4 text-success-text" />
                ) : (
                  <FiClock className="w-4 h-4 text-text-muted" />
                )}
              </div>
              <div>
                <div className="text-xs text-text-muted">Completed</div>
                <div className="text-sm text-text-primary">
                  {scan.completedAt ? formatDate(scan.completedAt) : "--"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Severity Breakdown */}
        {totalVulns > 0 && (
          <div className="bg-surface rounded-lg border border-border p-6">
            <h3 className="text-sm font-medium text-text-muted uppercase tracking-wide mb-4">
              Vulnerabilities by Severity
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <SeverityBadge count={scan.criticalCount} severity="Critical" />
              <SeverityBadge count={scan.highCount} severity="High" />
              <SeverityBadge count={scan.mediumCount} severity="Medium" />
              <SeverityBadge count={scan.lowCount} severity="Low" />
            </div>
          </div>
        )}

        {/* Asset Vulnerabilities */}
        {scan.assetScans && scan.assetScans.length > 0 && totalVulns > 0 && (
          <div className="bg-surface rounded-lg border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-muted uppercase tracking-wide">
                Asset Vulnerabilities
              </h3>
              <span className="text-sm text-text-secondary">
                {assetsWithVulns} assets affected
              </span>
            </div>
            
            <div className="space-y-3">
              {scan.assetScans
                .filter((a) => (a.vulnerabilities?.length || 0) > 0)
                .map((assetScan) => (
                  <AssetScanSection key={assetScan.id} assetScan={assetScan} />
                ))}
            </div>
          </div>
        )}

        {/* Empty State - No Vulnerabilities */}
        {totalVulns === 0 && scan.status === "COMPLETED" && (
          <div className="bg-surface rounded-lg border border-border p-8 text-center">
            <div className="w-14 h-14 bg-success-bg rounded-xl flex items-center justify-center mx-auto mb-3 border border-success-border">
              <FiShield className="w-7 h-7 text-success-text" />
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-1">No Vulnerabilities Found</h3>
            <p className="text-text-secondary text-sm">
              This scan completed successfully and found no known vulnerabilities.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
