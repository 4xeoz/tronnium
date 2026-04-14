"use client";

import { useState } from "react";
import { FiCode, FiX, FiAlertTriangle, FiZap, FiTerminal, FiShield } from "react-icons/fi";
import { useUser } from "@/lib/UserContext";
import { Button } from "@/components/ui/Button";

interface DevModeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DevModeModal({ isOpen, onClose }: DevModeModalProps) {
  const { toggleDevMode } = useUser();
  const [isEnabling, setIsEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEnable = async () => {
    setIsEnabling(true);
    setError(null);
    try {
      await toggleDevMode();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable dev mode");
    } finally {
      setIsEnabling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-surface rounded-[24px] border border-border shadow-[var(--shadow-card)] w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-brand-mint flex items-center justify-center">
              <FiCode className="w-5 h-5 text-brand-2" />
            </div>
            <div>
              <h2 className="text-[18px] font-bold text-text-primary tracking-[-0.2px]">Developer Mode</h2>
              <p className="text-xs text-text-muted">Enable experimental features</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-secondary flex items-center justify-center transition-colors"
          >
            <FiX className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-warning-bg border border-warning-border rounded-[10px] p-4">
            <div className="flex gap-3">
              <FiAlertTriangle className="w-5 h-5 text-warning-text flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-warning-text">Testing Only</p>
                <p className="text-xs text-warning-text/80 mt-1 leading-relaxed">
                  Dev mode enables experimental features for testing and development.
                  Generated data is simulated and not saved to the database.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.5px] text-text-muted">Features</p>
            <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-[10px] border border-border">
              <div className="w-8 h-8 rounded-md bg-brand-mint flex items-center justify-center">
                <FiZap className="w-4 h-4 text-brand-2" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">AI Vuln Generator</p>
                <p className="text-xs text-text-muted">Create fake CVEs with AI prompts</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-[10px] border border-border">
              <div className="w-8 h-8 rounded-md bg-info-bg flex items-center justify-center">
                <FiTerminal className="w-4 h-4 text-info-text" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Debug Tools</p>
                <p className="text-xs text-text-muted">Access diagnostic information</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-background-secondary rounded-[10px] border border-border">
              <div className="w-8 h-8 rounded-md bg-success-bg flex items-center justify-center">
                <FiShield className="w-4 h-4 text-success-text" />
              </div>
              <div>
                <p className="text-sm font-semibold text-text-primary">Security Playground</p>
                <p className="text-xs text-text-muted">Test scenarios safely</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-error-bg border border-error-border rounded-[10px] p-3 text-sm text-error-text">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
            Cancel
          </button>
          <Button onClick={handleEnable} disabled={isEnabling} isLoading={isEnabling}>
            <FiCode className="w-4 h-4" /> Enable Dev Mode
          </Button>
        </div>
      </div>
    </div>
  );
}
