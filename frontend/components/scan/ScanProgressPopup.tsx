"use client";

import { useRouter, useParams } from "next/navigation";
import { useScan } from "@/lib/ScanContext";
import { FiActivity, FiCheckCircle, FiXCircle, FiShield, FiArrowRight, FiX } from "react-icons/fi";

export default function ScanProgressPopup() {
  const router = useRouter();
  const params = useParams();
  const currentEnvId = params.envId as string | undefined;
  
  const { 
    isScanning, 
    progress, 
    scanResult, 
    error, 
    environmentId,
    dismissError,
    clearResult 
  } = useScan();

  // Only show if there's something to show
  const shouldShow = isScanning || scanResult || error;
  
  // Don't show on security page (it has its own detailed view)
  const isOnSecurityPage = currentEnvId && window.location.pathname.includes("/security");
  
  if (!shouldShow || isOnSecurityPage) return null;

  const handleViewResults = () => {
    if (environmentId) {
      router.push(`/environments/${environmentId}/security`);
    }
  };

  // Scanning state
  if (isScanning) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
        <div className="bg-surface border border-border rounded-xl shadow-lg p-4 min-w-[300px] max-w-[400px]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-1/10 flex items-center justify-center flex-shrink-0">
              <FiActivity className="w-5 h-5 text-brand-1 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-text-primary text-sm">Scan in Progress</div>
              <p className="text-text-secondary text-xs mt-0.5 truncate">{progress}</p>
              <div className="mt-2 h-1.5 bg-surface-secondary rounded-full overflow-hidden">
                <div className="h-full bg-brand-1 animate-pulse w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
        <div className="bg-error-bg border border-error-border rounded-xl shadow-lg p-4 min-w-[300px] max-w-[400px]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-error-bg flex items-center justify-center flex-shrink-0">
              <FiXCircle className="w-5 h-5 text-error-text" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-error-text text-sm">Scan Failed</div>
              <p className="text-error-text/80 text-xs mt-0.5">{error}</p>
            </div>
            <button 
              onClick={dismissError}
              className="text-error-text/60 hover:text-error-text transition-colors"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Completed state
  if (scanResult) {
    const hasVulnerabilities = scanResult.vulnerabilitiesFound > 0;
    const riskLevel = scanResult.riskScore !== null 
      ? scanResult.riskScore < 20 ? "Low" 
        : scanResult.riskScore < 40 ? "Moderate" 
        : scanResult.riskScore < 60 ? "High" 
        : "Critical"
      : "Unknown";

    return (
      <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
        <div className="bg-surface border border-border rounded-xl shadow-lg p-4 min-w-[320px] max-w-[400px]">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
              hasVulnerabilities ? "bg-warning-bg" : "bg-success-bg"
            }`}>
              <FiCheckCircle className={`w-5 h-5 ${
                hasVulnerabilities ? "text-warning-text" : "text-success-text"
              }`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-text-primary text-sm">Scan Complete</div>
              
              {hasVulnerabilities ? (
                <div className="mt-1 space-y-1">
                  <p className="text-text-secondary text-xs">
                    {scanResult.vulnerabilitiesFound} vulnerabilities found
                  </p>
                  <div className="flex items-center gap-2 text-[10px]">
                    {scanResult.criticalCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500">
                        {scanResult.criticalCount} Critical
                      </span>
                    )}
                    {scanResult.highCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500">
                        {scanResult.highCount} High
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted text-[10px]">
                    Risk Score: {scanResult.riskScore?.toFixed(1)} ({riskLevel})
                  </p>
                </div>
              ) : (
                <p className="text-success-text text-xs mt-0.5">
                  No vulnerabilities found
                </p>
              )}
              
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleViewResults}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-1 text-brand-2 rounded-lg text-xs font-medium hover:bg-brand-1/90 transition-colors"
                >
                  View Results
                  <FiArrowRight className="w-3 h-3" />
                </button>
                <button
                  onClick={clearResult}
                  className="px-3 py-1.5 text-text-secondary hover:text-text-primary text-xs transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
