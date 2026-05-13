import { FiCheckCircle } from "react-icons/fi";
import { Button } from "@/components/ui/Button";

type Props = {
  lastScanDate: string;
  onRescan: () => void;
};

export function AllClearBanner({ lastScanDate, onRescan }: Props) {
  return (
    <div className="flex items-center gap-4 bg-success-bg border border-success-border rounded-2xl px-5 py-4">
      <div className="w-10 h-10 rounded-full bg-success-text/20 flex items-center justify-center shrink-0">
        <FiCheckCircle className="w-5 h-5 text-success-text" />
      </div>
      <div>
        <p className="font-semibold text-success-text text-sm">Environment is secure</p>
        <p className="text-success-text/70 text-xs mt-0.5">
          All detected vulnerabilities are resolved or accepted. Last scan{" "}
          {new Date(lastScanDate).toLocaleDateString()}.
        </p>
      </div>
      <Button size="sm" variant="secondary" onClick={onRescan} className="ml-auto shrink-0">
        Rescan
      </Button>
    </div>
  );
}
