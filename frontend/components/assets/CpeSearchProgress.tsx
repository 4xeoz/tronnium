"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { FiCheck, FiLoader } from "react-icons/fi";

const PIPELINE_PHASES = ["Parse", "Search NVD", "Score", "Rank"] as const;

function stepToPhaseIndex(step: string): number {
  switch (step) {
    case "parsing": return 0;
    case "searching":
    case "waiting":
    case "narrowing": return 1;
    case "scoring": return 2;
    case "ranking": return 3;
    default: return 0;
  }
}

interface CpeSearchProgressProps {
  progressMessages: { step: string; message: string }[];
}

export function CpeSearchProgress({ progressMessages }: CpeSearchProgressProps) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressMessages]);

  const currentPhase = progressMessages.length > 0
    ? stepToPhaseIndex(progressMessages[progressMessages.length - 1].step)
    : -1;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div className="rounded-[16px] border border-border bg-background-secondary p-4 space-y-4">
          <div className="flex items-center gap-1">
            {PIPELINE_PHASES.map((phase, i) => {
              const isDone = i < currentPhase;
              const isActive = i === currentPhase;
              return (
                <div key={phase} className="flex items-center flex-1 last:flex-initial">
                  <div className="flex flex-col items-center gap-1">
                    <motion.div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors ${
                        isDone
                          ? "bg-brand-1 border-brand-1 text-brand-2"
                          : isActive
                          ? "border-brand-1 text-brand-1 bg-brand-1/10"
                          : "border-border text-text-muted bg-surface"
                      }`}
                      animate={isActive ? { scale: [1, 1.15, 1] } : {}}
                      transition={isActive ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
                    >
                      {isDone ? <FiCheck className="w-3.5 h-3.5" /> : <span>{i + 1}</span>}
                    </motion.div>
                    <span className={`text-[10px] font-medium whitespace-nowrap ${isDone || isActive ? "text-text-primary" : "text-text-muted"}`}>
                      {phase}
                    </span>
                  </div>
                  {i < PIPELINE_PHASES.length - 1 && (
                    <div className="flex-1 h-0.5 mx-1 mb-4 rounded-full overflow-hidden bg-border">
                      <motion.div
                        className="h-full bg-brand-1"
                        initial={{ width: "0%" }}
                        animate={{ width: isDone ? "100%" : isActive ? "50%" : "0%" }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto">
            <AnimatePresence initial={false}>
              {progressMessages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: i === progressMessages.length - 1 ? 1 : 0.5, x: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="text-xs flex items-start gap-2 text-text-secondary"
                >
                  {i === progressMessages.length - 1 ? (
                    <FiLoader className="w-3 h-3 mt-0.5 shrink-0 animate-spin text-brand-1" />
                  ) : (
                    <FiCheck className="w-3 h-3 mt-0.5 shrink-0 text-text-muted" />
                  )}
                  <span>{msg.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={endRef} />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
