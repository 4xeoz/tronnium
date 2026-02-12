"use client";

import { useState, useEffect } from "react";
import { FiX, FiCpu, FiTag, FiCalendar, FiCheck, FiBox } from "react-icons/fi";
import type { Asset, CpeCandidate } from "@/lib/api";
import { deleteAsset } from "@/lib/api/assets";

interface AssetDetailsSlideOverProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
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

export default function AssetDetailsSlideOver({
  asset,
  isOpen,
  onClose,
}: AssetDetailsSlideOverProps) {
  // Keep the asset data while animating out
  const [displayedAsset, setDisplayedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    if (asset) {
      setDisplayedAsset(asset);
    }
    // Don't clear displayedAsset when asset becomes null - let the animation play first
  }, [asset]);

  // Clear displayed asset after close animation completes
  useEffect(() => {
    if (!isOpen) {
      const timer = setTimeout(() => {
        setDisplayedAsset(null);
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
    })
    .catch((error) => {
      console.error("Failed to delete asset:", error);
      console.error("Error response:", error.response?.data);
      console.error("Error status:", error.response?.status);
      alert("Failed to delete asset. Please try again.");
    });
};

  const currentAsset = displayedAsset;
  const cpeList = currentAsset && Array.isArray(currentAsset.cpes) ? currentAsset.cpes : [];

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

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
