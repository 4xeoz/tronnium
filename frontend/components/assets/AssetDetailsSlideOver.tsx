"use client";


import { useState, useEffect } from "react";
import Link from "next/link";
import { FiX, FiCpu, FiTag, FiCalendar, FiCheck, FiBox, FiShield, FiAlertTriangle } from "react-icons/fi";
import type { Asset, CpeCandidate } from "@/lib/api";
import { deleteAsset, fetchAssetVulnerabilities, type AssetVulnerabilityItem } from "@/lib/api/assets";
import { getSeverityColor } from "@/lib/formatters";

interface AssetDetailsSlideOverProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onAssetDeleted: (assetId: string) => void;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text-muted uppercase tracking-wide">{label}</span>
      <span className="text-sm text-text-primary">{value}</span>
    </div>
  );
}

function CpeCard({ cpe, index }: { cpe: CpeCandidate; index: number }) {
  return (
    <div className="p-4 bg-surface-secondary rounded-lg border border-border">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-brand-1/10 text-brand-1 text-xs font-medium flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-text-primary">{cpe.title}</span>
        </div>
        <span
          className={`px-2 py-1 rounded text-xs font-medium shrink-0 ${
            cpe.score >= 80
              ? "bg-success-bg text-success-text"
              : cpe.score >= 50
              ? "bg-warning-bg text-warning-text"
              : "bg-surface text-text-muted"
          }`}
        >
          {Math.round(cpe.score)}% match
        </span>
      </div>
      
      <div className="text-xs text-text-muted font-mono bg-background p-2 rounded mb-3 break-all">
        {cpe.cpeName}
      </div>

      {/* Score Breakdown */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Vendor", value: cpe.breakdown.vendor },
          { label: "Product", value: cpe.breakdown.product },
          { label: "Version", value: cpe.breakdown.version },
          { label: "Overlap", value: cpe.breakdown.tokenOverlap },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-xs text-text-muted mb-1">{item.label}</div>
            <div className="w-full bg-background rounded-full h-1.5 mb-1">
              <div
                className={`h-1.5 rounded-full ${
                  item.value >= 80
                    ? "bg-success-text"
                    : item.value >= 50
                    ? "bg-warning-text"
                    : "bg-text-muted"
                }`}
                style={{ width: `${item.value}%` }}
              />
            </div>
            <div className="text-xs font-medium text-text-secondary">{item.value}%</div>
          </div>
        ))}
      </div>

      {cpe.cpeNameId && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-xs text-text-muted">NVD ID: </span>
          <span className="text-xs text-text-secondary font-mono">{cpe.cpeNameId}</span>
        </div>
      )}
    </div>
  );
}

function VulnerabilityCard({ vuln }: { vuln: AssetVulnerabilityItem }) {
  const severityColors = getSeverityColor(vuln.severity);
  
  return (
    <div className="p-4 bg-surface-secondary rounded-lg border border-border">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium text-text-primary">{vuln.cveId}</span>
          <span className={`px-2 py-0.5 rounded text-xs font-medium border ${severityColors}`}>
            {vuln.severity}
          </span>
        </div>
        {vuln.cvssScore && (
          <span className="text-sm font-medium text-text-secondary">
            {vuln.cvssScore.toFixed(1)}
          </span>
        )}
      </div>
      
      <p className="text-sm text-text-secondary mb-2 line-clamp-3">{vuln.description}</p>
      
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span className="font-mono truncate">{vuln.cpeName}</span>
        <Link
          href={`https://nvd.nist.gov/vuln/detail/${vuln.cveId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-1 hover:underline shrink-0 ml-2"
        >
          View NVD
        </Link>
      </div>
    </div>
  );
}

export default function AssetDetailsSlideOver({
  asset,
  isOpen,
  onClose,
  onAssetDeleted,
}: AssetDetailsSlideOverProps) {
  // Keep the asset data while animating out
  const [displayedAsset, setDisplayedAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "vulnerabilities">("details");
  
  // Vulnerabilities state
  const [vulnerabilities, setVulnerabilities] = useState<AssetVulnerabilityItem[]>([]);
  const [vulnLoading, setVulnLoading] = useState(false);
  const [vulnError, setVulnError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setDisplayedAsset(asset);
      setActiveTab("details"); // Reset to details tab when opening new asset
    }
    // Don't clear displayedAsset when asset becomes null - let the animation play first
  }, [asset]);

  // Load vulnerabilities when switching to vulnerabilities tab
  useEffect(() => {
    if (activeTab === "vulnerabilities" && displayedAsset && isOpen) {
      loadVulnerabilities();
    }
  }, [activeTab, displayedAsset, isOpen]);

  const loadVulnerabilities = async () => {
    if (!displayedAsset) return;
    
    setVulnLoading(true);
    setVulnError(null);
    
    try {
      const response = await fetchAssetVulnerabilities(
        displayedAsset.environmentId,
        displayedAsset.id
      );
      
      if (response) {
        setVulnerabilities(response.data.vulnerabilities);
      } else {
        setVulnError("Failed to load vulnerabilities");
      }
    } catch (err) {
      setVulnError(err instanceof Error ? err.message : "Failed to load vulnerabilities");
    } finally {
      setVulnLoading(false);
    }
  };

  // Clear displayed asset after close animation completes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setDisplayedAsset(null);
        setVulnerabilities([]);
        setActiveTab("details");
      }, 300); // Match transition duration
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle asset deletion
  const handleAssetDelete = () => {
    if (!displayedAsset) return;

    deleteAsset(displayedAsset.id, displayedAsset.environmentId)
      .then(() => {
        onClose();
        onAssetDeleted(displayedAsset.id);
      })
      .catch((error) => {
        console.error("Failed to delete asset:", error);
        const msg = error instanceof Error ? error.message : "Failed to delete asset. Please try again.";
        alert(msg);
      });
  };

  const currentAsset = displayedAsset;
  const cpeList = currentAsset && Array.isArray(currentAsset.cpes) ? currentAsset.cpes : [];

  // Count vulnerabilities by severity for the badge
  const criticalCount = vulnerabilities.filter(v => v.severity === "CRITICAL").length;
  const highCount = vulnerabilities.filter(v => v.severity === "HIGH").length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ease-in-out z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-xl bg-surface shadow-xl transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {currentAsset && (
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-brand-1/10 rounded-xl flex items-center justify-center shrink-0">
                <FiCpu className="w-6 h-6 text-brand-1" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary">
                  {currentAsset.name}
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      currentAsset.domain === "IT"
                        ? "bg-info-bg text-info-text"
                        : currentAsset.domain === "OT"
                        ? "bg-warning-bg text-warning-text"
                        : "bg-surface-secondary text-text-muted"
                    }`}
                  >
                    {currentAsset.domain}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      cpeList.length > 0
                        ? "bg-success-bg text-success-text"
                        : "bg-surface-secondary text-text-muted"
                    }`}
                  >
                    {cpeList.length} CPE{cpeList.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-surface-secondary transition-colors"
            >
              <FiX className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === "details"
                  ? "text-brand-1"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FiBox className="w-4 h-4" />
                Details
              </div>
              {activeTab === "details" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-1" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("vulnerabilities")}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === "vulnerabilities"
                  ? "text-brand-1"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <FiShield className="w-4 h-4" />
                Vulnerabilities
                {(criticalCount > 0 || highCount > 0) && (
                  <span className="px-1.5 py-0.5 bg-error-bg text-error-text text-xs rounded-full">
                    {criticalCount + highCount}
                  </span>
                )}
              </div>
              {activeTab === "vulnerabilities" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-1" />
              )}
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === "details" ? (
              <div className="space-y-6">
                {/* Basic Info */}
                <section>
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <FiBox className="w-4 h-4" />
                    Details
                  </h3>
                  <div className="bg-surface-secondary rounded-lg p-4 space-y-4">
                    <InfoRow label="Name" value={currentAsset.name} />
                    <InfoRow label="Description" value={currentAsset.description} />
                    <InfoRow label="Domain" value={currentAsset.domain} />
                    <div className="flex gap-8">
                      <InfoRow 
                        label="Created" 
                        value={new Date(currentAsset.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} 
                      />
                      <InfoRow 
                        label="Updated" 
                        value={new Date(currentAsset.updatedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })} 
                      />
                    </div>
                  </div>
                </section>

                {/* Tags */}
                {currentAsset.tags && currentAsset.tags.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                      <FiTag className="w-4 h-4" />
                      Tags
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {currentAsset.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-surface-secondary text-text-secondary text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {/* CPEs */}
                <section>
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <FiCheck className="w-4 h-4" />
                    CPE Identifiers ({cpeList.length})
                  </h3>
                  {cpeList.length === 0 ? (
                    <div className="bg-surface-secondary rounded-lg p-6 text-center">
                      <p className="text-text-muted text-sm">No CPEs assigned to this asset.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cpeList.map((cpe, index) => (
                        <CpeCard key={cpe.cpeName} cpe={cpe} index={index} />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Vulnerabilities Tab */}
                {vulnLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-8 h-8 border-2 border-brand-1 border-t-transparent rounded-full animate-spin mb-3" />
                    <p className="text-text-secondary text-sm">Loading vulnerabilities...</p>
                  </div>
                ) : vulnError ? (
                  <div className="bg-error-bg border border-error-border rounded-lg p-6 text-center">
                    <FiAlertTriangle className="w-8 h-8 text-error-text mx-auto mb-2" />
                    <p className="text-error-text text-sm">{vulnError}</p>
                    <button
                      onClick={loadVulnerabilities}
                      className="mt-3 text-brand-1 text-sm hover:underline"
                    >
                      Try again
                    </button>
                  </div>
                ) : vulnerabilities.length === 0 ? (
                  <div className="bg-surface-secondary rounded-lg p-8 text-center">
                    <div className="w-12 h-12 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-3">
                      <FiShield className="w-6 h-6 text-success-text" />
                    </div>
                    <h3 className="text-base font-semibold text-text-primary mb-1">
                      No Vulnerabilities Found
                    </h3>
                    <p className="text-text-secondary text-sm">
                      This asset has no known vulnerabilities in the latest scan.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="bg-surface-secondary rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text-secondary">
                          {vulnerabilities.length} vulnerability{vulnerabilities.length !== 1 ? "ies" : "y"} found
                        </span>
                        <div className="flex gap-2">
                          {criticalCount > 0 && (
                            <span className="px-2 py-1 bg-red-500/10 text-red-500 text-xs rounded-full font-medium">
                              {criticalCount} Critical
                            </span>
                          )}
                          {highCount > 0 && (
                            <span className="px-2 py-1 bg-orange-500/10 text-orange-500 text-xs rounded-full font-medium">
                              {highCount} High
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Vulnerability List */}
                    <div className="space-y-3">
                      {vulnerabilities.map((vuln) => (
                        <VulnerabilityCard key={vuln.id} vuln={vuln} />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border">
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-lg border border-border text-text-secondary hover:bg-surface-secondary transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleAssetDelete}
                className="flex-1 px-4 py-3 rounded-lg bg-[var(--warning-text)] font-medium transition-colors text-[var(--warning-bg)]"
              >
                Delete Asset
              </button>
            </div>
          </div>
        </div>
        )}
      </div>
    </>
  );
}
