import { useState, useRef, useEffect } from "react";
import { fetchCpeSemanticSearchProgress, listenForCpeFindProgress, type CpeCandidate, type CpeFindResponse } from "@/lib/api/assets";

type ProgressMessage = { step: string; message: string };

export function useCpeNameSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [candidates, setCandidates] = useState<CpeCandidate[]>([]);
  const [semanticCandidates, setSemanticCandidates] = useState<{ cpeName: string; title: string; similarity: number }[]>([]);
  const [progressMessages, setProgressMessages] = useState<ProgressMessage[]>([]);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    return () => { eventSourceRef.current?.close(); };
  }, []);

  function search(name: string, topN: number = 10) {
    if (name.length < 4) { setError("Please enter at least 4 characters"); return; }
    eventSourceRef.current?.close();
    setError(null);
    setIsSearching(true);
    setProgressMessages([]);
    setPipelineComplete(false);

    eventSourceRef.current = listenForCpeFindProgress(
      name.trim(),
      topN,
      (update) => setProgressMessages((prev) => [...prev, update]),
      (result: CpeFindResponse) => {
        setIsSearching(false);
        setPipelineComplete(true);
        eventSourceRef.current = null;
        if (result?.candidates.length > 0) {
          setCandidates(result.candidates);
        } else {
          setError("No CPE candidates found. Try a different search term.");
          setProgressMessages([]);
          setPipelineComplete(false);
        }
      },
      (err: string) => {
        setError(err);
        setIsSearching(false);
        setProgressMessages([]);
        setPipelineComplete(false);
        eventSourceRef.current = null;
      }
    );
  }


  function semanticSearch(name: string, topN: number = 10) {
    if (name.length < 4) { setError("Please enter at least 4 characters"); return; }
    setError(null);
    setIsSearching(true);
    setProgressMessages([]);
    setPipelineComplete(false);

    const result = fetchCpeSemanticSearchProgress(name.trim(), topN)
      .then((response) => {
        if (response.success && response.data.results.length > 0) {
            setSemanticCandidates(response.data.results);
        } else {
            setError(response.message || "No semantic search results found. Try a different search term.");
            setSemanticCandidates([]);
        }
        })
        .catch((err) => {
            setError(err.message || "Semantic search failed. Please try again.");
            setSemanticCandidates([]);
        })
        .finally(() => {
            setIsSearching(false);
            setPipelineComplete(true);
        });
  }



  function reset() {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsSearching(false);
    setCandidates([]);
    setSemanticCandidates([]);
    setProgressMessages([]);
    setPipelineComplete(false);
    setError(null);
  }





  return { isSearching, candidates, semanticCandidates, progressMessages, pipelineComplete, error, search, semanticSearch, reset };
}
