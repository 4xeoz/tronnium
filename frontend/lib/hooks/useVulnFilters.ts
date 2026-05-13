import { useState } from "react";
import type { ScanSeverity } from "@/lib/api/scans";
import type { VulnStatus } from "@/lib/api/vulnerabilityWorkflow";

export type ViewMode = "overview" | "findings";

export type VulnFilters = {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedSeverity: ScanSeverity | null;
  setSelectedSeverity: (v: ScanSeverity | null) => void;
  selectedStatus: VulnStatus | null;
  setSelectedStatus: (v: VulnStatus | null) => void;
  showOnlyNew: boolean;
  setShowOnlyNew: (v: boolean) => void;
  clearFilters: () => void;
};

export function useVulnFilters(): VulnFilters {
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<ScanSeverity | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<VulnStatus | null>(null);
  const [showOnlyNew, setShowOnlyNew] = useState(false);

  function clearFilters() {
    setSelectedSeverity(null);
    setSelectedStatus(null);
  }

  return {
    viewMode, setViewMode,
    searchQuery, setSearchQuery,
    selectedSeverity, setSelectedSeverity,
    selectedStatus, setSelectedStatus,
    showOnlyNew, setShowOnlyNew,
    clearFilters,
  };
}
