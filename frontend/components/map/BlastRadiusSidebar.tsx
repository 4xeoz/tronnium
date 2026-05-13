"use client";

import { useState, useMemo, useRef } from "react";
import { FiX, FiLock, FiChevronDown, FiChevronRight, FiActivity, FiServer, FiDatabase, FiWifi, FiShield, FiHardDrive, FiCpu } from "react-icons/fi";
import type { Asset } from "@/lib/api";
import type { BlastRadiusResult, BlastRadiusConfig } from "@/lib/api/graph";

const typeIcons: Record<string, React.ElementType> = {
  server: FiServer,
  database: FiDatabase,
  network: FiWifi,
  firewall: FiShield,
  iot: FiHardDrive,
  unknown: FiCpu,
};

interface BlastRadiusSidebarProps {
  result: BlastRadiusResult;
  assets: Asset[];
  onClose: () => void;
  onConfigChange: (config: Partial<BlastRadiusConfig>) => void;
  onSelectAsset: (assetId: string) => void;
  isLoading?: boolean;
}

function getScoreColor(score: number): string {
  if (score > 60) return "bg-red-500";
  if (score > 30) return "bg-amber-500";
  return "bg-green-500";
}

function getScoreTextColor(score: number): string {
  if (score > 60) return "text-red-500";
  if (score > 30) return "text-amber-500";
  return "text-green-500";
}

export default function BlastRadiusSidebar({
  result,
  assets,
  onClose,
  onConfigChange,
  onSelectAsset,
  isLoading = false,
}: BlastRadiusSidebarProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [budgetValue, setBudgetValue] = useState(result.budget ?? 10);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sourceAsset = assets.find((a) => a.id === result.sourceAssetId);

  const sortedReached = useMemo(() => {
    return [...result.reached].sort((a, b) => b.compromiseScore - a.compromiseScore);
  }, [result.reached]);

  const togglePath = (assetId: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }
      return next;
    });
  };

  const handleBudgetChange = (value: number) => {
    setBudgetValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onConfigChange({ costBudget: value });
    }, 400);
  };

  return (
    <div className="w-80 bg-surface border-l border-border h-full overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <FiActivity className="w-5 h-5 text-brand-1 shrink-0" />
          <div className="min-w-0">
            <h2 className="text-[15px] font-bold text-text-primary tracking-[-0.2px] truncate">
              Blast Radius Analysis
            </h2>
            {sourceAsset && (
              <button
                onClick={() => onSelectAsset(sourceAsset.id)}
                className="text-[11px] text-brand-2 hover:underline truncate text-left"
              >
                Source: {sourceAsset.name}
              </button>
            )}
          </div>
          {isLoading && (
            <span className="ml-2 flex items-center gap-1.5 text-[10px] text-brand-2 font-medium shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-1 animate-pulse" />
              Recalculating...
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center border border-transparent text-text-secondary hover:text-text-primary hover:border-border hover:bg-surface-secondary transition-all active:scale-95 shrink-0"
        >
          <FiX className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-5 flex-1">
        {/* Source risk badge */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-text-muted uppercase tracking-wide">Base risk</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${getScoreColor(
              sortedReached[0]?.compromiseScore ?? 0
            )}`}
          >
            {Math.round(sortedReached[0]?.compromiseScore ?? 0)}%
          </span>
        </div>

        {/* Config slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] text-text-muted uppercase tracking-wide">
              Traversal budget
            </label>
            <span className="text-xs font-semibold text-text-primary">{budgetValue}</span>
          </div>
          <input
            type="range"
            min={4}
            max={20}
            step={1}
            value={budgetValue}
            onChange={(e) => handleBudgetChange(Number(e.target.value))}
            className="w-full h-1.5 bg-background-secondary rounded-full appearance-none cursor-pointer accent-brand-1"
          />
          <p className="text-[10px] text-text-muted leading-tight">
            Lower = fewer, higher-certainty paths. Higher = broader reach.
          </p>
        </div>

        {/* Results count */}
        <div className="flex items-center gap-3 text-[11px] text-text-muted">
          <span className="font-semibold text-text-primary">{sortedReached.length}</span> reachable
          <span className="text-border">|</span>
          <span className="font-semibold text-text-primary">{result.gatedEdges.length}</span> gated
        </div>

        {/* Reachable list */}
        <div className="space-y-2 relative">
          <h3 className="text-[11px] text-text-muted uppercase tracking-wide">Reachable assets</h3>

          {/* Skeleton overlay during loading */}
          {isLoading && (
            <div className="absolute inset-0 z-10 space-y-2 pt-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-background-secondary/80 rounded-[10px] animate-pulse" />
              ))}
            </div>
          )}

          <div className={`space-y-1.5 ${isLoading ? 'opacity-30' : ''}`}>
          {sortedReached.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-xs text-text-muted">No assets reachable within budget</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {sortedReached.map((node) => {
                const asset = assets.find((a) => a.id === node.assetId);
                const Icon = typeIcons[asset?.type ?? "unknown"] || typeIcons.unknown;
                const isExpanded = expandedPaths.has(node.assetId);

                return (
                  <div
                    key={node.assetId}
                    className="bg-background-secondary rounded-[10px] overflow-hidden"
                  >
                    <div className="p-2.5 space-y-2">
                      {/* Name row */}
                      <div className="flex items-center gap-2">
                        <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                        <button
                          onClick={() => onSelectAsset(node.assetId)}
                          className="text-xs font-semibold text-text-primary hover:text-brand-2 truncate text-left"
                        >
                          {asset?.name || node.assetId}
                        </button>
                        <span className={`ml-auto text-[10px] font-bold ${getScoreTextColor(node.compromiseScore)}`}>
                          {Math.round(node.compromiseScore)}%
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-text-muted">
                          {node.hops} {node.hops === 1 ? "hop" : "hops"}
                        </span>
                        <span className="text-[10px] text-text-muted">•</span>
                        <span className="text-[10px] text-text-muted">
                          cost {Math.round(node.cost)}
                        </span>
                        {node.knowledgeScore > 0 && (
                          <>
                            <span className="text-[10px] text-text-muted">•</span>
                            <span className="text-[10px] text-brand-2">
                              knowledge {Math.round(node.knowledgeScore)}
                            </span>
                          </>
                        )}
                        <button
                          onClick={() => togglePath(node.assetId)}
                          className="ml-auto flex items-center gap-0.5 text-[10px] text-text-muted hover:text-text-primary transition-colors"
                        >
                          Path
                          {isExpanded ? (
                            <FiChevronDown className="w-3 h-3" />
                          ) : (
                            <FiChevronRight className="w-3 h-3" />
                          )}
                        </button>
                      </div>

                      {/* Compromise score bar */}
                      <div className="h-1 bg-surface rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${getScoreColor(node.compromiseScore)}`}
                          style={{ width: `${Math.min(100, Math.max(0, node.compromiseScore))}%` }}
                        />
                      </div>
                    </div>

                    {/* Expanded path */}
                    {isExpanded && (
                      <div className="px-2.5 pb-2.5 pt-0">
                        <div className="flex flex-wrap items-center gap-1 text-[10px] text-text-muted bg-surface rounded-lg p-2">
                          {node.path.map((id, idx) => {
                            const pathAsset = assets.find((a) => a.id === id);
                            const isLast = idx === node.path.length - 1;
                            return (
                              <span key={id} className="flex items-center gap-1">
                                <button
                                  onClick={() => onSelectAsset(id)}
                                  className="hover:text-brand-2 transition-colors font-medium"
                                >
                                  {pathAsset?.name || id.slice(0, 8)}
                                </button>
                                {!isLast && <span className="text-border">→</span>}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>

        {/* Gated section */}
        {result.gatedEdges.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[11px] text-text-muted uppercase tracking-wide flex items-center gap-1.5">
              <FiLock className="w-3 h-3" />
              Blocked assets
            </h3>
            <div className="space-y-1">
              {result.gatedEdges.map((gated, idx) => {
                const toAsset = assets.find((a) => a.id === gated.toAssetId);
                const fromAsset = assets.find((a) => a.id === gated.fromAssetId);
                return (
                  <div
                    key={`${gated.fromAssetId}-${gated.toAssetId}-${idx}`}
                    className="flex items-center gap-2 p-2 bg-background-secondary rounded-[10px]"
                  >
                    <FiLock className="w-3 h-3 text-text-muted shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-text-primary truncate">
                        {toAsset?.name || gated.toAssetId}
                      </div>
                      <div className="text-[10px] text-text-muted truncate">
                        From {fromAsset?.name || gated.fromAssetId} • {gated.reason}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
