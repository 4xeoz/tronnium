"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";
import { startScan as apiStartScan, type ScanResult } from "./api/scans";

interface ScanContextType {
  // State
  isScanning: boolean;
  progress: string;
  scanResult: ScanResult | null;
  error: string | null;
  environmentId: string | null;
  
  // Actions
  startScan: (environmentId: string) => void;
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

  const startScan = useCallback((envId: string) => {
    // Close any existing scan first
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setEnvironmentId(envId);
    setIsScanning(true);
    setProgress("Initializing scan...");
    setError(null);
    setScanResult(null);

    // Start new SSE connection
    const eventSource = apiStartScan(
      envId,
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
        startScan,
        stopScan,
        clearResult,
        dismissError,
      }}
    >
      {children}
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
