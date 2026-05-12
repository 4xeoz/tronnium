"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from "react";
import { startScan as apiStartScan, listenForScanProgress, type ScanResult } from "./api/scans";
import ScanSettingsModal from "@/components/scan/ScanSettingsModal";

interface ScanContextType {
  isScanning: boolean;
  progressMessages: string[];
  scanResult: ScanResult | null;
  error: string | null;
  environmentId: string | null;
  showConfigModal: boolean;

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
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [pendingEnvId, setPendingEnvId] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);

  const stopScan = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsScanning(false);
    setProgressMessages([]);
  }, []);

  const startScan = useCallback((envId: string, fromDate?: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setEnvironmentId(envId);
    setIsScanning(true);
    setProgressMessages(["Initializing scan..."]);
    setError(null);
    setScanResult(null);
    setShowConfigModal(false);

    console.log("[Scan] Starting scan for env:", envId, "fromDate:", fromDate);
    apiStartScan(envId, fromDate)
      .then((res) => {
        console.log("[Scan] POST /start response:", res);
        if (!res.success) {
          console.error("[Scan] Start failed:", res.message);
          setError(res.message || "Failed to start scan");
          setIsScanning(false);
          setProgressMessages([]);
          return;
        }

        const { scanId, alreadyRunning } = res.data;
        console.log("[Scan] Got scanId:", scanId, "alreadyRunning:", alreadyRunning);
        const eventSource = listenForScanProgress(
          envId,
          scanId,
          (message) => {
            console.log("[Scan] Progress message:", message);
            setProgressMessages((prev) => [...prev, message]);
          },
          () => {
            console.log("[Scan] Scan completed!");
            setIsScanning(false);
            setProgressMessages((prev) => [...prev, "Scan completed!"]);
            eventSourceRef.current = null;
          },
          (err) => {
            console.error("[Scan] SSE error:", err);
            setError(err);
            setIsScanning(false);
            setProgressMessages([]);
            eventSourceRef.current = null;
          }
        );
        console.log("[Scan] EventSource created, readyState:", eventSource.readyState);
        eventSourceRef.current = eventSource;
      })
      .catch((err) => {
        console.error("[Scan] POST /start threw:", err);
        setError(err instanceof Error ? err.message : "Failed to start scan");
        setIsScanning(false);
        setProgressMessages([]);
      });
  }, []);

  const configureAndStartScan = useCallback((envId: string) => {
    setPendingEnvId(envId);
    setShowConfigModal(true);
  }, []);

  const closeConfigModal = useCallback(() => {
    setShowConfigModal(false);
    setTimeout(() => setPendingEnvId(null), 300);
  }, []);

  const clearResult = useCallback(() => {
    setScanResult(null);
    setProgressMessages([]);
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <ScanContext.Provider
      value={{
        isScanning,
        progressMessages,
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
