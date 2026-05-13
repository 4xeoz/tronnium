import { FiClock, FiCheckCircle, FiXCircle } from "react-icons/fi";

type RecentScan = {
  id: string;
  status: string;
  startedAt: string;
};

type Props = {
  scans: RecentScan[];
  onViewAll: () => void;
};

export function RecentScansCard({ scans, onViewAll }: Props) {
  if (scans.length === 0) return null;

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 flex-shrink-0">
      <h3 className="font-bold text-text-primary mb-4 flex items-center gap-2 text-[18px] tracking-[-0.2px]">
        <FiClock className="w-5 h-5 text-brand-1" />
        Recent Scans
      </h3>

      <div className="space-y-3">
        {scans.map((scan) => {
          const isCompleted = scan.status === "COMPLETED";
          const dateLabel = new Date(scan.startedAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });

          return (
            <div key={scan.id} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                {isCompleted ? (
                  <FiCheckCircle className="w-4 h-4 text-success-text shrink-0" />
                ) : (
                  <FiXCircle className="w-4 h-4 text-error-text shrink-0" />
                )}
                <span className="text-text-secondary">{dateLabel}</span>
              </div>
              <span className={`text-xs font-medium ${isCompleted ? "text-success-text" : "text-error-text"}`}>
                {isCompleted ? "Completed" : "Failed"}
              </span>
            </div>
          );
        })}
      </div>

      {scans.length >= 3 && (
        <button
          onClick={onViewAll}
          className="w-full mt-3 text-xs text-brand-2 font-semibold hover:underline"
        >
          View all scan history
        </button>
      )}
    </div>
  );
}
