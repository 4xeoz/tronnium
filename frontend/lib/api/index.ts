/**
 * API Module - Central export for all API functions
 * Each function returns exactly what the backend sends, unwrapped.
 *
 * Import from here: import { fetchEnvironments, fetchCurrentUser } from "@/lib/api"
 * Or import directly from sub-modules: import { fetchAssets } from "@/lib/api/assets"
 */

export * from "./client";
export * from "./auth";
export * from "./environments";
export * from "./health";
export * from "./assets";
export * from "./scans";
export * from "./vulnerabilityWorkflow";
export * from "./dev";
export * from "./schedule";
export * from "./ai";
export * from "./dashboard";

// Re-export context hooks
export { useScan } from "../ScanContext";
export { useUser } from "../UserContext";
