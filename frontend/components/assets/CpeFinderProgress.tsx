import React, { useEffect, useState } from "react";

interface ProgressUpdate {
  message?: any;
  type: "progress" | "completed" | "error";
}

interface CpeFinderProgressProps {
  assetName: string;
  onComplete: (result: any) => void; // Callback when the process is complete
  onError: (error: string) => void; // Callback when an error occurs
}

const CpeFinderProgress: React.FC<CpeFinderProgressProps> = ({ assetName, onComplete, onError }) => {
  const [progress, setProgress] = useState<ProgressUpdate[]>([]);

  useEffect(() => {
    const eventSource = new EventSource(`/api/cpe/find?assetName=${encodeURIComponent(assetName)}`);

    // Listen for progress updates
    eventSource.onmessage = (event) => {
      const data: ProgressUpdate = JSON.parse(event.data);

      if (data.step === "Completed") {
        // If the process is complete, call the onComplete callback
        onComplete(data.data);
        eventSource.close();
      } else if (data.step === "Error") {
        // If an error occurs, call the onError callback
        onError(data.data.error);
        eventSource.close();
      } else {
        // Update progress
        setProgress((prev) => [...prev, data]);
      }
    };

    // Handle errors
    eventSource.onerror = () => {
      console.error("Error with SSE connection");
      eventSource.close();
      onError("Connection error. Please try again.");
    };

    // Cleanup on component unmount
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
            {p.data && <pre className="bg-gray-100 p-2 mt-1">{JSON.stringify(p.data, null, 2)}</pre>}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CpeFinderProgress;