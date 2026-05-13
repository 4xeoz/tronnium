import { FiSearch, FiXCircle } from "react-icons/fi";
import { Input } from "@/components/ui/Input";
import { SEVERITY_CONFIG, STATUS_COLORS } from "@/lib/securityConstants";
import { VULN_STATUSES, type VulnStatus } from "@/lib/api/vulnerabilityWorkflow";
import type { ScanSeverity } from "@/lib/api/scans";
import { SeverityFilterPill } from "./SeverityFilterPill";
import { getStatusLabel } from "@/lib/formatters";

type Props = {
  severityCounts: Record<ScanSeverity, number>;
  selectedSeverity: ScanSeverity | null;
  onSeverityChange: (severity: ScanSeverity | null) => void;
  selectedStatus: VulnStatus | null;
  onStatusChange: (status: VulnStatus | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  showOnlyNew: boolean;
  onShowOnlyNewChange: (value: boolean) => void;
  onClearFilters: () => void;
};

export function FindingsFilterBar({
  severityCounts,
  selectedSeverity,
  onSeverityChange,
  selectedStatus,
  onStatusChange,
  searchQuery,
  onSearchChange,
  showOnlyNew,
  onShowOnlyNewChange,
  onClearFilters,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-semibold text-text-secondary">Severity:</span>
      {(Object.keys(SEVERITY_CONFIG) as ScanSeverity[]).map(severity =>
        severityCounts[severity] > 0 && (
          <SeverityFilterPill
            key={severity}
            severity={severity}
            count={severityCounts[severity]}
            isActive={selectedSeverity === severity}
            onClick={() => onSeverityChange(selectedSeverity === severity ? null : severity)}
          />
        )
      )}
      <span className="text-sm font-semibold text-text-secondary ml-2">Status:</span>
      {VULN_STATUSES.map(status => {
        const colors = STATUS_COLORS[status];
        const isActive = selectedStatus === status;
        return (
          <button
            key={status}
            onClick={() => onStatusChange(isActive ? null : status)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all text-xs font-semibold ${
              isActive
                ? `${colors.bg} ${colors.border} ${colors.text}`
                : "bg-surface border-border text-text-secondary hover:border-border-secondary"
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${colors.dot}`} />
            {getStatusLabel(status)}
          </button>
        );
      })}
      {(selectedSeverity || selectedStatus) && (
        <button
          onClick={onClearFilters}
          className="text-sm text-text-muted hover:text-text-primary font-semibold flex items-center gap-1 transition-colors"
        >
          <FiXCircle className="w-4 h-4" /> Clear
        </button>
      )}
      <div className="flex-1" />
      <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
        <input
          type="checkbox"
          checked={showOnlyNew}
          onChange={(e) => onShowOnlyNewChange(e.target.checked)}
          className="w-4 h-4 rounded border-border-secondary accent-brand-1"
        />
        Show only new
      </label>
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <Input
          type="text"
          placeholder="Search CVEs, assets..."
          value={searchQuery}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-9 w-64"
        />
      </div>
    </div>
  );
}
