"use client";

import { useRef, useEffect, useState } from "react";
import { FiChevronDown, FiCheck, FiClock, FiTrash2, FiX } from "react-icons/fi";
import type { ScanHistoryItem } from "@/lib/api";
import { formatDateTime } from "@/lib/utils/format";

type Props = {
  scanHistory: ScanHistoryItem[];
  selectedScanId: string | null; // null = "Latest" is selected
  onSelectScan: (id: string | null) => void;
  isLoadingScan: boolean;
  onDeleteScan: (scanId: string) => Promise<void>;
};

function formatDropdownDate(value: string | null): string {
  return value ? formatDateTime(value) : "In progress";
}

export default function ScanHistoryDropdown({
  scanHistory,
  selectedScanId,
  onSelectScan,
  isLoadingScan,
  onDeleteScan,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  // Which scan ID is waiting for "are you sure?" confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Which scan ID is currently being deleted (shows spinner)
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setConfirmDeleteId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedScan = selectedScanId
    ? scanHistory.find((s) => s.id === selectedScanId)
    : null;

  const triggerLabel = selectedScan
    ? formatDropdownDate(selectedScan.completedAt)
    : "Latest";

  const handleDeleteClick = (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(scanId);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const handleConfirmDelete = async (e: React.MouseEvent, scanId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
    setDeletingId(scanId);
    try {
      await onDeleteScan(scanId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        onClick={() => {
          setIsOpen((prev) => !prev);
          setConfirmDeleteId(null);
        }}
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

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-surface border border-border rounded-xl shadow-lg z-30 overflow-hidden">
          <div className="px-3 py-2 border-b border-border bg-surface-secondary/30">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
              Scan History
            </p>
          </div>

          <div className="max-h-72 overflow-y-auto">
            {/* "Latest" option — always first, no delete */}
            <button
              onClick={() => {
                onSelectScan(null);
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface-secondary/50 transition-colors"
            >
              <div>
                <p className="text-sm font-medium text-text-primary">Latest Scan</p>
                <p className="text-xs text-text-muted mt-0.5">
                  Always shows the most recent results
                </p>
              </div>
              {selectedScanId === null && (
                <FiCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
            </button>

            {/* History items */}
            {scanHistory.length === 0 ? (
              <div className="px-3 py-5 text-center border-t border-border">
                <p className="text-sm text-text-muted">No previous scans available</p>
              </div>
            ) : (
              <div className="border-t border-border divide-y divide-border">
                {scanHistory.map((scan) => {
                  const isDeleting = deletingId === scan.id;
                  const isConfirming = confirmDeleteId === scan.id;
                  const canDelete = scan.status !== "IN_PROGRESS";

                  const statusDot =
                    scan.status === "COMPLETED"
                      ? "bg-emerald-400"
                      : scan.status === "FAILED"
                      ? "bg-red-400"
                      : "bg-blue-400";

                  return (
                    <div key={scan.id} className="group relative">
                      {/* Inline confirmation row */}
                      {isConfirming ? (
                        <div className="flex items-center justify-between px-3 py-2.5 bg-error-bg border-l-2 border-error-border">
                          <p className="text-xs text-error-text font-medium">
                            Delete this scan?
                          </p>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => handleConfirmDelete(e, scan.id)}
                              className="px-2.5 py-1 rounded-md bg-error-text text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                            >
                              Delete
                            </button>
                            <button
                              onClick={handleCancelDelete}
                              className="p-1 rounded-md hover:bg-surface-secondary transition-colors"
                              title="Cancel"
                            >
                              <FiX className="w-3.5 h-3.5 text-text-muted" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            onSelectScan(scan.id);
                            setIsOpen(false);
                          }}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-surface-secondary/50 transition-colors"
                        >
                          {/* Left: date + severity counts */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
                              <p className="text-sm text-text-primary truncate">
                                {formatDropdownDate(scan.completedAt)}
                              </p>
                            </div>
                            <p className="text-xs text-text-muted mt-0.5 ml-3.5">
                              C:{scan.criticalCount} H:{scan.highCount} M:{scan.mediumCount} L:
                              {scan.lowCount}
                              {" · "}
                              {scan.vulnerabilitiesFound} vuln
                              {scan.vulnerabilitiesFound !== 1 ? "s" : ""}
                            </p>
                          </div>

                          {/* Right: selected check + delete */}
                          <div className="flex items-center gap-1.5 ml-2 shrink-0">
                            {selectedScanId === scan.id && !isDeleting && (
                              <FiCheck className="w-4 h-4 text-emerald-400" />
                            )}

                            {isDeleting ? (
                              <div className="w-4 h-4 border-2 border-text-muted border-t-transparent rounded-full animate-spin" />
                            ) : (
                              canDelete && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => handleDeleteClick(e, scan.id)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setConfirmDeleteId(scan.id);
                                    }
                                  }}
                                  className="p-1 rounded-md text-text-muted hover:text-error-text hover:bg-error-bg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                  title="Delete scan"
                                >
                                  <FiTrash2 className="w-3.5 h-3.5" />
                                </span>
                              )
                            )}
                          </div>
                        </button>
                      )}
                    </div>
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
