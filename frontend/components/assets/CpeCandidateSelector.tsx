"use client";

import { motion } from "motion/react";
import { FiCheck } from "react-icons/fi";
import type { CpeCandidate } from "@/lib/api";

const PIPELINE_PHASES = ["Parse", "Search NVD", "Score", "Rank"] as const;

interface CpeCandidateSelectorProps {
  candidates: CpeCandidate[];
  selectedCpes: CpeCandidate[];
  onToggle: (cpe: CpeCandidate) => void;
  assetName: string;
  progressMessages?: { step: string; message: string }[];
}

export function CpeCandidateSelector({
  candidates,
  selectedCpes,
  onToggle,
  assetName,
  progressMessages,
}: CpeCandidateSelectorProps) {
  return (
    <div className="space-y-4">
      {progressMessages && progressMessages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="rounded-[16px] border border-border bg-background-secondary p-3"
        >
          <div className="flex items-center gap-1">
            {PIPELINE_PHASES.map((phase, i) => (
              <div key={phase} className="flex items-center flex-1 last:flex-initial">
                <div className="flex flex-col items-center gap-0.5">
                  <motion.div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 bg-brand-1 border-brand-1 text-brand-2"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.08, duration: 0.2 }}
                  >
                    <FiCheck className="w-3 h-3" />
                  </motion.div>
                  <span className="text-[9px] font-medium text-text-primary whitespace-nowrap">{phase}</span>
                </div>
                {i < PIPELINE_PHASES.length - 1 && (
                  <div className="flex-1 h-0.5 mx-1 mb-3.5 rounded-full bg-brand-1" />
                )}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-border space-y-1">
            {progressMessages.map((msg, i) => (
              <div key={i} className="text-xs flex items-start gap-2 text-text-muted">
                <FiCheck className="w-3 h-3 mt-0.5 shrink-0" />
                <span>{msg.message}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <p className="text-sm text-text-secondary">
        Found <span className="font-semibold text-text-primary">{candidates.length}</span> CPE candidates for &quot;{assetName}&quot;.
        Select the ones that match your asset:
      </p>

      <div className="space-y-2">
        {candidates.map((candidate) => {
          const isSelected = selectedCpes.some((c) => c.cpeName === candidate.cpeName);
          return (
            <button
              key={candidate.cpeName}
              onClick={() => onToggle(candidate)}
              className={`w-full p-4 rounded-[16px] border text-left transition-all ${
                isSelected
                  ? "border-brand-1 bg-brand-mint/50 shadow-[var(--shadow-ring-accent)]"
                  : "border-border hover:border-border-secondary hover:bg-surface-secondary"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-text-primary text-sm">{candidate.title}</div>
                  <div className="text-xs text-text-secondary mt-1">
                    {candidate.vendor} • {candidate.product} • {candidate.version}
                  </div>
                  <div className="text-xs text-text-muted font-mono mt-1 truncate">{candidate.cpeName}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                    candidate.score >= 80
                      ? "bg-success-bg text-success-text border border-success-border"
                      : candidate.score >= 50
                      ? "bg-warning-bg text-warning-text border border-warning-border"
                      : "bg-surface-secondary text-text-muted border border-border"
                  }`}>
                    {Math.round(candidate.score)}%
                  </span>
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                    isSelected ? "bg-brand-1 border-brand-1" : "border-border"
                  }`}>
                    {isSelected && <FiCheck className="w-3 h-3 text-brand-2" />}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
