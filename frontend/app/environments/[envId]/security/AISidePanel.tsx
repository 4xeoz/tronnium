import { FiXCircle, FiZap } from "react-icons/fi";
import AIChatPanel from "@/components/security/AIChatPanel";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  environmentId: string;
  hasActiveScan: boolean;
  vulnCount: number;
};

export function AISidePanel({ isOpen, onClose, environmentId, hasActiveScan, vulnCount }: Props) {
  return (
    <aside className={`fixed top-0 right-0 h-full w-full max-w-md bg-surface border-l border-border shadow-[var(--shadow-card)] z-50 flex flex-col transition-transform duration-200 ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-brand-1/10 flex items-center justify-center">
            <FiZap className="w-4 h-4 text-brand-1" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">AI Security Analyst</p>
            <p className="text-xs text-text-muted">Environment-level analysis</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full flex items-center justify-center border border-border text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-all active:scale-95"
        >
          <FiXCircle className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <AIChatPanel
          environmentId={environmentId}
          hasActiveScan={hasActiveScan}
          vulnCount={vulnCount}
        />
      </div>
    </aside>
  );
}
