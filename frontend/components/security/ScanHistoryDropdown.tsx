"use client";

import { useRef, useEffect, useState } from "react";
import { FiChevronDown, FiCheck, FiClock } from "react-icons/fi";
import type { ScanHistoryItem } from "@/lib/api";

type Props = {
  scanHistory: ScanHistoryItem[];
  selectedScanId: string | null; // null = "Latest" is selected
  onSelectScan: (id: string | null) => void;
  isLoadingScan: boolean;
};

function formatDropdownDate(value: string | null): string {
  if (!value) return "In progress";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ScanHistoryDropdown({
  scanHistory,
  selectedScanId,
  onSelectScan,
  isLoadingScan,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedScan = selectedScanId
    ? scanHistory.find((s) => s.id === selectedScanId)
    : null;

  const triggerLabel = selectedScan ? formatDropdownDate(selectedScan.completedAt) : "Latest";

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-border-secondary transition-colors"
      >
        <FiClock className="w-3.5 h-3.5 shrink-0" />
        <span className="max-w-[160px] truncate">{triggerLabel}</span>
        {isLoadingScan ? (
          <div className="w-3.5 h-3.5 border-2 border-text-muted border-t-transparent rounded-full animate-spin shrink-0" />
        ) : (
          <FiChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-surface border border-border rounded-xl shadow-lg z-30 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-surface-secondary/30">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Scan History
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* Latest option — always first */}
            <button
              onClick={() => {
                onSelectScan(null);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface-secondary/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">Latest Scan</p>
                <p className="text-xs text-text-muted mt-0.5">Always shows the most recent results</p>
              </div>
              {selectedScanId === null && (
                <FiCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
            </button>

            {scanHistory.length === 0 ? (
              <div className="px-3 py-5 text-center border-t border-border">
                <p className="text-sm text-text-muted">No previous scans available</p>
              </div>
            ) : (
              <div className="border-t border-border divide-y divide-border">
                {scanHistory.map((scan) => {
                  const statusDot =
                    scan.status === "COMPLETED"
                      ? "bg-emerald-400"
                      : scan.status === "FAILED"
                      ? "bg-red-400"
                      : "bg-blue-400";

                  return (
                    <button
                      key={scan.id}
                      onClick={() => {
                        onSelectScan(scan.id);
                        setIsOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface-secondary/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                          <p className="text-sm text-text-primary truncate">
                            {formatDropdownDate(scan.completedAt)}
                          </p>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5 ml-3.5">
                          C:{scan.criticalCount} H:{scan.highCount} M:{scan.mediumCount} L:{scan.lowCount}
                          {" · "}
                          {scan.vulnerabilitiesFound} vuln{scan.vulnerabilitiesFound !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {selectedScanId === scan.id && (
                        <FiCheck className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
