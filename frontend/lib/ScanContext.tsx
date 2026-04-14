"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";
import { startScan as apiStartScan, type ScanResult } from "./api/scans";
import ScanSettingsModal from "@/components/scan/ScanSettingsModal";

interface ScanContextType {
  // State
  isScanning: boolean;
  progress: string;
  scanResult: ScanResult | null;
  error: string | null;
  environmentId: string | null;
  showConfigModal: boolean;
  
  // Actions
  startScan: (environmentId: string, fromDate?: string) => void;
  configureAndStartScan: (environmentId: string) => void;
  closeConfigModal: () => void;
  stopScan: () => void;
  clearResult: () => void;
  dismissError: () => void;
}

const ScanContext = createContext<ScanContextType | undefined>(undefined);

export function ScanProvider({ children }: { children: ReactNode }) {
  const [isScanning, setIsScanning] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingEnvId, setPendingEnvId] = useState<string | null>(null);
  
  // Use ref to track EventSource so it persists across renders
  const eventSourceRef = useRef<EventSource | null>(null);

  const stopScan = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsScanning(false);
    setProgress("");
  }, []);

  const startScan = useCallback((envId: string, fromDate?: string) => {
    // Close any existing scan first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setEnvironmentId(envId);
    setIsScanning(true);
    setProgress("Initializing scan...");
    setError(null);
    setScanResult(null);
    setShowConfigModal(false);

    // Start new SSE connection with optional fromDate
    const eventSource = apiStartScan(
      envId,
      fromDate,
      (message) => {
        setProgress(message);
      },
      (result) => {
        setScanResult(result);
        setIsScanning(false);
        setProgress("Scan completed!");
        eventSourceRef.current = null;
      },
      (err) => {
        setError(err);
        setIsScanning(false);
        setProgress("");
        eventSourceRef.current = null;
      }
    );

    eventSourceRef.current = eventSource;
  }, []);

  const configureAndStartScan = useCallback((envId: string) => {
    setPendingEnvId(envId);
    setShowConfigModal(true);
  }, []);

  const closeConfigModal = useCallback(() => {
    // Hide first (triggers slide-out animation), then unmount after transition completes
    setShowConfigModal(false);
    setTimeout(() => setPendingEnvId(null), 300);
  }, []);

  const clearResult = useCallback(() => {
    setScanResult(null);
    setProgress("");
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ScanContext.Provider
      value={{
        isScanning,
        progress,
        scanResult,
        error,
        environmentId,
        showConfigModal,
        startScan,
        configureAndStartScan,
        closeConfigModal,
        stopScan,
        clearResult,
        dismissError,
      }}
    >
      {children}
      {/* Keep mounted while pendingEnvId exists so the slide-out animation can play */}
      {pendingEnvId && (
        <ScanSettingsModal
          environmentId={pendingEnvId}
          isOpen={showConfigModal}
          onClose={closeConfigModal}
          onStartScan={(fromDate) => startScan(pendingEnvId, fromDate)}
        />
      )}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error("useScan must be used within a ScanProvider");
  }
  return context;
}
