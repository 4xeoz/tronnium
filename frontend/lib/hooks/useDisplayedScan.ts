import { useState, useEffect, useRef, useCallback } from "react";
import { fetchScanById, deleteScan, type LatestScan, listenForScanProgress } from "@/lib/api";

export function useDisplayedScan(
  envId: string,
  latestScan_data: LatestScan | null | undefined,
  isScanningThisEnv: boolean,
  refetch: () => void,
) {
  const [displayedScan, setDisplayedScan] = useState<LatestScan | null>(null);
  const [isLoadingHistoryScan, setIsLoadingHistoryScan] = useState(false);
  const [progressMessages, setProgressMessages] = useState<string[]>([]);
  const scanCache = useRef<Map<string, LatestScan>>(new Map());

  // Always keep the latest refetch in a ref so effects never re-run just because of it
  const refetchRef = useRef(refetch);
  useEffect(() => { refetchRef.current = refetch; }, [refetch]);

  // Keep displayedScan in sync with latest data from the query
  useEffect(() => { setDisplayedScan(latestScan_data ?? null); }, [latestScan_data]);

  useEffect(() => {
    if (latestScan_data?.status === "IN_PROGRESS") {
      setIsLoadingHistoryScan(true);
      setProgressMessages([]);
      const es = listenForScanProgress(
        envId,
        latestScan_data.id,
        (msg) => setProgressMessages(prev => [...prev, msg]),
        () => {
          setIsLoadingHistoryScan(false);
          refetchRef.current();
        },
        (err) => {
          console.error("Progress error:", err);
          setIsLoadingHistoryScan(false);
        }
      );
      return () => es.close();
    }
    // status changed away from IN_PROGRESS (e.g. COMPLETED/FAILED) — clear the flag
    setIsLoadingHistoryScan(false);
  }, [latestScan_data?.status, latestScan_data?.id, envId]);


  // Trigger a refetch the moment a scan finishes so the view updates automatically
  const wasScanningRef = useRef(false);
  useEffect(() => {
    if (wasScanningRef.current && !isScanningThisEnv) refetchRef.current();
    wasScanningRef.current = isScanningThisEnv;
  }, [isScanningThisEnv]);

  const handleScanSelect = useCallback(async (scanId: string | null) => {
    if (!scanId) { setDisplayedScan(latestScan_data ?? null); return; }
    if (scanCache.current.has(scanId)) { setDisplayedScan(scanCache.current.get(scanId)!); return; }
    setIsLoadingHistoryScan(true);
    try {
      const res = await fetchScanById(envId, scanId);
      if (res.success) {
        scanCache.current.set(scanId, res.data);
        setDisplayedScan(res.data);
      }
    } catch (err) {
      console.error("Failed to load historical scan:", err);
    } finally {
      setIsLoadingHistoryScan(false);
    }
  }, [envId, latestScan_data]);

  const handleDeleteScan = useCallback(async (scanId: string) => {
    try {
      const res = await deleteScan(envId, scanId);
      if (res.success) {
        scanCache.current.delete(scanId);
        if (displayedScan?.id === scanId) setDisplayedScan(null);
        refetch();
      }
    } catch (err) {
      console.error("Failed to delete scan:", err);
    }
  }, [envId, displayedScan, refetch]);

  return {
    displayedScan,
    isLoadingHistoryScan,
    scanCache,
    handleScanSelect,
    handleDeleteScan,
    progressMessages,
  };
}
