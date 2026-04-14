import React, { useEffect, useState } from "react";

interface ProgressUpdate {
  step?: string;
  status?: string;
  data?: unknown;
  type: "progress" | "completed" | "error";
}

interface CpeFinderProgressProps {
  assetName: string;
  onComplete: (result: unknown) => void;
  onError: (error: string) => void;
}

const CpeFinderProgress: React.FC<CpeFinderProgressProps> = ({ assetName, onComplete, onError }) => {
  const [progress, setProgress] = useState<ProgressUpdate[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/cpe/find?assetName=${encodeURIComponent(assetName)}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as ProgressUpdate & { step?: string; status?: string; data?: unknown };

      if (data.step === "Completed") {
        onComplete(data.data);
        eventSource.close();
      } else if (data.step === "Error") {
        onError((data.data as { error?: string })?.error || "Unknown error");
        eventSource.close();
      } else {
        setProgress((prev) => [...prev, data]);
      }
    };

    eventSource.onerror = () => {
      console.error("Error with SSE connection");
      eventSource.close();
      onError("Connection error. Please try again.");
    };

    return () => {
      eventSource.close();
    };
  }, [assetName, onComplete, onError]);

  return (
    <div>
      <h2 className="text-lg font-bold">CPE Finder Progress</h2>
      <ul>
        {progress.map((p, index) => (
          <li key={index} className="mb-2">
            <strong>{p.step}:</strong> {p.status}
            {p.data ? <pre className="bg-surface-secondary p-2 mt-1 rounded-[10px]">{JSON.stringify(p.data, null, 2)}</pre> : null}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CpeFinderProgress;
