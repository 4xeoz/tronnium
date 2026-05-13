"use client";

import { useEffect, useRef } from "react";

export function ScanningProgress({ progressMessages }: { progressMessages: string[] }) {
  const logRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progressMessages]);

  const latest = progressMessages[progressMessages.length - 1] ?? "Initializing...";

  return (
    <div className="bg-info-bg border border-info-border rounded-[16px] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-info-bg flex items-center justify-center shrink-0">
          <div className="w-6 h-6 border-2 border-info-text border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-info-text">Security Scan in Progress</h3>
          <p className="text-info-text/80 text-sm mt-0.5 truncate">{latest}</p>
          <div className="mt-3 h-1.5 bg-info-border rounded-full overflow-hidden">
            <div className="h-full bg-info-text rounded-full animate-pulse w-3/4" />
          </div>
        </div>
      </div>

      {/* Message log */}
      {progressMessages.length > 1 && (
        <div
          ref={logRef}
          className="max-h-48 overflow-y-auto rounded-[10px] bg-black/10 p-3 space-y-1 font-mono text-[11px] text-info-text/70"
        >
          {progressMessages.map((msg, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-info-text/40 shrink-0 select-none">{String(i + 1).padStart(2, "0")}</span>
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
