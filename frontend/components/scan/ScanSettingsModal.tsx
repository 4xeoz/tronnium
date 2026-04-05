"use client";

import { useState, useEffect } from "react";
import {
  FiX,
  FiCalendar,
  FiClock,
  FiRefreshCw,
  FiAlertCircle,
  FiCheck,
  FiChevronRight,
} from "react-icons/fi";
import { getScanSettings, type ScanSettings, type ScanFromDateOption } from "@/lib/api/scans";

interface ScanSettingsModalProps {
  environmentId: string;
  isOpen: boolean;
  onClose: () => void;
  onStartScan: (fromDate?: string) => void;
}

export default function ScanSettingsModal({
  environmentId,
  isOpen,
  onClose,
  onStartScan,
}: ScanSettingsModalProps) {
  const [settings, setSettings] = useState<ScanSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selected options
  const [fromDateOption, setFromDateOption] = useState<ScanFromDateOption>("last-scan");
  const [customDate, setCustomDate] = useState<string>("");
  
  // Validation
  const [dateError, setDateError] = useState<string | null>(null);

  // Fetch settings when modal opens
  useEffect(() => {
    if (isOpen && environmentId) {
      fetchSettings();
    }
  }, [isOpen, environmentId]);

  // Update custom date default when settings load
  useEffect(() => {
    if (settings?.maxLookbackDate) {
      // Default to 1 year ago or max lookback, whichever is closer
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      
      const maxLookback = new Date(settings.maxLookbackDate);
      const defaultDate = oneYearAgo > maxLookback ? oneYearAgo : maxLookback;
      
      setCustomDate(defaultDate.toISOString().split("T")[0]);
    }
  }, [settings]);

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getScanSettings(environmentId);
      if (response.data) {
        setSettings(response.data);
        // Default to "last-scan" if available, otherwise "all"
        setFromDateOption(response.data.hasPreviousScan ? "last-scan" : "all");
      } else {
        setError("Failed to load scan settings");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const validateCustomDate = (date: string): boolean => {
    if (!date) {
      setDateError("Please select a date");
      return false;
    }

    const selectedDate = new Date(date);
    const now = new Date();
    
    if (isNaN(selectedDate.getTime())) {
      setDateError("Invalid date");
      return false;
    }

    if (selectedDate > now) {
      setDateError("Date cannot be in the future");
      return false;
    }

    if (settings?.maxLookbackDate) {
      const maxLookback = new Date(settings.maxLookbackDate);
      if (selectedDate < maxLookback) {
        setDateError(`Date cannot be more than 5 years ago (before ${maxLookback.toLocaleDateString()})`);
        return false;
      }
    }

    setDateError(null);
    return true;
  };

  const handleStartScan = () => {
    let fromDate: string | undefined;

    switch (fromDateOption) {
      case "last-scan":
        fromDate = "last-scan";
        break;
      case "custom":
        if (!validateCustomDate(customDate)) {
          return;
        }
        // Convert to ISO string for API
        fromDate = new Date(customDate).toISOString();
        break;
      case "all":
      default:
        fromDate = undefined;
        break;
    }

    onStartScan(fromDate);
    onClose();
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Calculate days since last scan
  const getDaysSinceLastScan = (): number | null => {
    if (!settings?.lastScanDate) return null;
    const lastScan = new Date(settings.lastScanDate);
    const now = new Date();
    const diffTime = now.getTime() - lastScan.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysSince = getDaysSinceLastScan();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity z-50 h-screen"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-surface rounded-2xl shadow-2xl z-50 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-1/10 rounded-xl flex items-center justify-center">
                <FiRefreshCw className="w-5 h-5 text-brand-1" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-text-primary">Scan Settings</h2>
                <p className="text-sm text-text-secondary">Configure your vulnerability scan</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-surface-secondary transition-colors"
            >
              <FiX className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-2 border-brand-1 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-text-secondary text-sm">Loading settings...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-error-bg rounded-xl flex items-center justify-center mb-3">
                <FiAlertCircle className="w-6 h-6 text-error-text" />
              </div>
              <p className="text-error-text text-sm mb-2">{error}</p>
              <button
                onClick={fetchSettings}
                className="text-brand-1 text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Last Scan Info */}
              {settings?.hasPreviousScan && (
                <div className="bg-surface-secondary rounded-xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <FiClock className="w-4 h-4 text-text-muted" />
                    <span className="text-sm font-medium text-text-primary">Last Scan</span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    {formatDate(settings.lastScanDate)}
                    {daysSince !== null && (
                      <span className="text-text-muted">
                        {" "}(" +
                        {daysSince === 0
                          ? "today"
                          : daysSince === 1
                          ? "yesterday"
                          : `${daysSince} days ago`}
                        )
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Scan From Options */}
              <div>
                <label className="text-sm font-semibold text-text-primary mb-3 block">
                  Scan For CVEs Published
                </label>
                <div className="space-y-2">
                  {/* Option: From Last Scan */}
                  {settings?.hasPreviousScan && (
                    <button
                      onClick={() => setFromDateOption("last-scan")}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        fromDateOption === "last-scan"
                          ? "border-brand-1 bg-brand-1/5"
                          : "border-border hover:border-border-secondary"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                            fromDateOption === "last-scan"
                              ? "border-brand-1 bg-brand-1"
                              : "border-border"
                          }`}
                        >
                          {fromDateOption === "last-scan" && (
                            <FiCheck className="w-3 h-3 text-brand-2" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-text-primary">
                            Since Last Scan
                          </div>
                          <div className="text-sm text-text-secondary mt-0.5">
                            Only check for new CVEs published since{" "}
                            {formatDate(settings.lastScanDate)}
                          </div>
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Option: All CVEs */}
                  <button
                    onClick={() => setFromDateOption("all")}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      fromDateOption === "all"
                        ? "border-brand-1 bg-brand-1/5"
                        : "border-border hover:border-border-secondary"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          fromDateOption === "all"
                            ? "border-brand-1 bg-brand-1"
                            : "border-border"
                        }`}
                      >
                        {fromDateOption === "all" && (
                          <FiCheck className="w-3 h-3 text-brand-2" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-text-primary">All CVEs</div>
                        <div className="text-sm text-text-secondary mt-0.5">
                          Full scan - check for all known CVEs
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Option: Custom Date */}
                  <button
                    onClick={() => setFromDateOption("custom")}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                      fromDateOption === "custom"
                        ? "border-brand-1 bg-brand-1/5"
                        : "border-border hover:border-border-secondary"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                          fromDateOption === "custom"
                            ? "border-brand-1 bg-brand-1"
                            : "border-border"
                        }`}
                      >
                        {fromDateOption === "custom" && (
                          <FiCheck className="w-3 h-3 text-brand-2" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-text-primary">
                          From Specific Date
                        </div>
                        <div className="text-sm text-text-secondary mt-0.5">
                          Only check for CVEs published after a specific date
                        </div>
                        
                        {fromDateOption === "custom" && (
                          <div className="mt-3">
                            <input
                              type="date"
                              value={customDate}
                              onChange={(e) => {
                                setCustomDate(e.target.value);
                                setDateError(null);
                              }}
                              max={new Date().toISOString().split("T")[0]}
                              min={settings?.maxLookbackDate.split("T")[0]}
                              className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text-primary text-sm focus:outline-none focus:border-brand-1"
                            />
                            {dateError && (
                              <p className="text-error-text text-xs mt-1.5 flex items-center gap-1">
                                <FiAlertCircle className="w-3 h-3" />
                                {dateError}
                              </p>
                            )}
                            <p className="text-xs text-text-muted mt-1.5">
                              Maximum lookback: {formatDate(settings?.maxLookbackDate)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Info Box */}
              <div className="bg-info-bg border border-info-border rounded-xl p-4">
                <div className="flex gap-3">
                  <FiAlertCircle className="w-5 h-5 text-info-text shrink-0 mt-0.5" />
                  <div className="text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">Tip:</span> Scanning from a
                    recent date is faster and focuses on newly discovered vulnerabilities. A full
                    scan checks the entire CVE database.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-surface-secondary/50">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-text-secondary hover:bg-surface-secondary transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleStartScan}
              disabled={loading || !!error || !!dateError}
              className="flex-1 px-4 py-2.5 rounded-xl bg-brand-1 text-brand-2 font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              Start Scan
              <FiChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
