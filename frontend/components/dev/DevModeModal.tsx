"use client";

import { useState } from "react";
import { FiCode, FiX, FiAlertTriangle, FiZap, FiTerminal, FiShield } from "react-icons/fi";
import { useUser } from "@/lib/UserContext";

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
      <div className="bg-surface rounded-xl border border-border shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <FiCode className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Developer Mode</h2>
              <p className="text-xs text-text-muted">Enable experimental features</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-surface-secondary flex items-center justify-center transition-colors"
          >
            <FiX className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Warning Box */}
          <div className="bg-warning-bg border border-warning-border rounded-lg p-4">
            <div className="flex gap-3">
              <FiAlertTriangle className="w-5 h-5 text-warning-text flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning-text">Testing Only</p>
                <p className="text-xs text-warning-text/80 mt-1 leading-relaxed">
                  Dev mode enables experimental features for testing and development. 
                  Generated data is simulated and not saved to the database.
                </p>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Features</p>
            
            <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg border border-border">
              <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center">
                <FiZap className="w-4 h-4 text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">AI Vuln Generator</p>
                <p className="text-xs text-text-muted">Create fake CVEs with AI prompts</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg border border-border">
              <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center">
                <FiTerminal className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Debug Tools</p>
                <p className="text-xs text-text-muted">Access diagnostic information</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-surface-secondary rounded-lg border border-border">
              <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center">
                <FiShield className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-text-primary">Security Playground</p>
                <p className="text-xs text-text-muted">Test scenarios safely</p>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-error-bg border border-error-border rounded-lg p-3 text-sm text-error-text">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleEnable}
            disabled={isEnabling}
            className="px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isEnabling ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Enabling...
              </>
            ) : (
              <>
                <FiCode className="w-4 h-4" />
                Enable Dev Mode
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
