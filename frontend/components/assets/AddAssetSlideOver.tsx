"use client";

import { useState, useRef, useEffect } from "react";
import { FiX, FiSearch, FiCheck, FiAlertCircle, FiLoader } from "react-icons/fi";
import { motion, AnimatePresence } from "motion/react";
import {
  findCpe,
  validateCpe,
  createAsset,
  listenForCpeFindProgress,
  type CpeCandidate,
  type CreateAssetInput,
} from "@/lib/api";

// Pipeline phases for the step indicator
const PIPELINE_PHASES = ["Parse", "Search NVD", "Score", "Rank"] as const;

function stepToPhaseIndex(step: string): number {
  switch (step) {
    case "parsing":
      return 0;
    case "searching":
    case "waiting":
    case "narrowing":
      return 1;
    case "scoring":
      return 2;
    case "ranking":
      return 3;
    default:
      return 0;
  }
}

interface AddAssetSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  environmentId: string;
}

type SearchMode = "name" | "cpe";
type Step = "input" | "select" | "confirm";

export default function AddAssetSlideOver({
  isOpen,
  onClose,
  onSuccess,
  environmentId,
}: AddAssetSlideOverProps) {
  // Form state
  const [searchMode, setSearchMode] = useState<SearchMode>("name");
  const [step, setStep] = useState<Step>("input");
  const [assetName, setAssetName] = useState("");
  const [cpeInput, setCpeInput] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("unknown");
  const [status, setStatus] = useState("active");
  const [location, setLocation] = useState("");
  const [ipAddress, setIpAddress] = useState("");

  // Search results state
  const [candidates, setCandidates] = useState<CpeCandidate[]>([]);
  const [selectedCpes, setSelectedCpes] = useState<CpeCandidate[]>([]);

  // Loading/error states
  const [isSearching, setIsSearching] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{
    isValid: boolean;
    message: string;
  } | null>(null);

  // Progress feed
  const [progressMessages, setProgressMessages] = useState<
    { step: string; message: string }[]
  >([]);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const [showPipelineLog, setShowPipelineLog] = useState(false);

  const resetForm = () => {
    setSearchMode("name");
    setStep("input");
    setAssetName("");
    setCpeInput("");
    setDescription("");
    setType("unknown");
    setStatus("active");
    setLocation("");
    setIpAddress("");
    setCandidates([]);
    setSelectedCpes([]);
    setError(null);
    setValidationResult(null);
    setProgressMessages([]);
    setPipelineComplete(false);
    setShowPipelineLog(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // // Search by asset name
  // const handleSearchByName = async () => {
  //   if (!assetName.trim()) return;

  //   setError(null);
  //   setIsSearching(true);

  //   try {
  //     const result = await findCpe(assetName.trim(), 10);
  //     if (result.success && result.candidates.length > 0) {
  //       setCandidates(result.candidates);
  //       setStep("select");
  //     } else {
  //       setError("No CPE candidates found. Try a different search term.");
  //     }
  //   } catch (err) {
  //     setError(err instanceof Error ? err.message : "Failed to search CPEs");
  //   } finally {
  //     setIsSearching(false);
  //   }
  // };

  // Add ref to track EventSource
  const eventSourceRef = useRef<EventSource | null>(null);
  const progressEndRef = useRef<HTMLDivElement | null>(null);

  // Cleanup EventSource when component unmounts or closes
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Auto-scroll progress feed
  useEffect(() => {
    progressEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [progressMessages]);

  // Also cleanup when slide-over closes
  useEffect(() => {
    if (!isOpen && eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [isOpen]);

  const handleSearchByName = () => {
    if (!assetName.trim()) return;

    // Close any existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setError(null);
    setIsSearching(true);
    setProgressMessages([]);
    setPipelineComplete(false);
    setShowPipelineLog(false);

    eventSourceRef.current = listenForCpeFindProgress(
      assetName.trim(),
      10,
      (update) => {
        setProgressMessages((prev) => [...prev, update]);
      },
      (result) => {
        setIsSearching(false);
        setPipelineComplete(true);
        if (result.success && result.candidates.length > 0) {
          setCandidates(result.candidates);
          setStep("select");
        } else {
          setError("No CPE candidates found. Try a different search term.");
          // Clear on failure — nothing useful to show
          setProgressMessages([]);
          setPipelineComplete(false);
        }
        eventSourceRef.current = null;
      },
      (err) => {
        setError(err);
        setIsSearching(false);
        setProgressMessages([]);
        setPipelineComplete(false);
        eventSourceRef.current = null;
      }
    );
  };


  // Validate CPE string
  const handleValidateCpe = async () => {
    if (!cpeInput.trim()) return;

    setError(null);
    setValidationResult(null);
    setIsValidating(true);

    try {
      const result = await validateCpe(cpeInput.trim());
      setValidationResult({
        isValid: result.isValid,
        message: result.message,
      });

      if (result.isValid) {
        // Create a CpeCandidate object for manually entered CPE
        const manualCpe: CpeCandidate = {
          cpeName: cpeInput.trim(),
          cpeNameId: "",  // Not available for manual entry
          title: cpeInput.trim(),
          score: 100,  // Manual entry assumed to be exact match
          vendor: result.parsed?.vendor || "",
          product: result.parsed?.product || "",
          version: result.parsed?.version || "",
          breakdown: { vendor: 100, product: 100, version: 100, tokenOverlap: 100 },
        };
        setSelectedCpes([manualCpe]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate CPE");
    } finally {
      setIsValidating(false);
    }
  };

  // Toggle CPE selection
  const toggleCpeSelection = (cpe: CpeCandidate) => {
    setSelectedCpes((prev) =>
      prev.some((c) => c.cpeName === cpe.cpeName)
        ? prev.filter((c) => c.cpeName !== cpe.cpeName)
        : [...prev, cpe]
    );
  };

  // Create asset
  const handleCreateAsset = async () => {
    if (!assetName.trim() && searchMode === "name") {
      setError("Asset name is required");
      return;
    }

    setError(null);
    setIsCreating(true);

    try {
      // Extract vendor/product/model from first CPE if available
      const firstCpe = selectedCpes[0];
      
      const data: CreateAssetInput = {
        name: assetName.trim() || cpeInput.trim(),
        description: description.trim() || undefined,
        type: type || undefined,
        status: status || undefined,
        location: location.trim() || undefined,
        ipAddress: ipAddress.trim() || undefined,
        manufacturer: firstCpe?.vendor || undefined,
        model: firstCpe?.product || undefined,
        cpes: selectedCpes.length > 0 ? selectedCpes : undefined,
      };

      await createAsset(environmentId, data);
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/50 transition-opacity duration-300 z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      {/* Slide-over panel */}
      <div
        className={`fixed inset-y-0 right-0 w-full max-w-lg bg-surface shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-text-primary">
                Add Asset
              </h2>
              <p className="text-sm text-text-muted mt-0.5">
                {step === "input" && "Search for an asset or enter a CPE directly"}
                {step === "select" && "Select CPEs to associate with this asset"}
                {step === "confirm" && "Review and confirm"}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-surface-secondary transition-colors"
            >
              <FiX className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-error-bg border border-error-border rounded-lg text-error-text text-sm flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {/* Step 1: Input */}
            {step === "input" && (
              <div className="space-y-6">
                {/* Search Mode Toggle */}
                <div className="flex gap-2 p-1 bg-surface-secondary rounded-lg">
                  <button
                    onClick={() => setSearchMode("name")}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      searchMode === "name"
                        ? "bg-surface text-text-primary shadow-sm"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    Search by Name
                  </button>
                  <button
                    onClick={() => setSearchMode("cpe")}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      searchMode === "cpe"
                        ? "bg-surface text-text-primary shadow-sm"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    Enter CPE
                  </button>
                </div>

                {searchMode === "name" ? (
                  <>
                    {/* Asset Name Search */}
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        Asset Name
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={assetName}
                          onChange={(e) => setAssetName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && !isSearching && handleSearchByName()}
                          placeholder="e.g., OpenSSL 1.1.1, Apache HTTP Server 2.4"
                          disabled={isSearching}
                          className="w-full px-4 py-3 pr-12 rounded-lg border border-border bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1 focus:border-transparent disabled:opacity-60"
                        />
                        <button
                          onClick={handleSearchByName}
                          disabled={!assetName.trim() || isSearching}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-text-primary disabled:opacity-50"
                        >
                          {isSearching ? (
                            <FiLoader className="w-5 h-5 animate-spin" />
                          ) : (
                            <FiSearch className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-text-muted">
                        Enter a software/hardware name to find matching CPEs
                      </p>
                    </div>

                    {/* Progress Feed — shown while searching */}
                    <AnimatePresence>
                      {isSearching && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-lg border border-border bg-surface-secondary p-4 space-y-4">
                            {/* Pipeline stepper */}
                            <div className="flex items-center gap-1">
                              {PIPELINE_PHASES.map((phase, i) => {
                                const currentPhase = progressMessages.length > 0
                                  ? stepToPhaseIndex(progressMessages[progressMessages.length - 1].step)
                                  : -1;
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
                                        {isDone ? (
                                          <FiCheck className="w-3.5 h-3.5" />
                                        ) : (
                                          <span>{i + 1}</span>
                                        )}
                                      </motion.div>
                                      <span className={`text-[10px] font-medium whitespace-nowrap ${
                                        isDone || isActive ? "text-text-primary" : "text-text-muted"
                                      }`}>
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

                            {/* Message log */}
                            <div className="space-y-1 max-h-36 overflow-y-auto">
                              <AnimatePresence initial={false}>
                                {progressMessages.map((msg, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{
                                      opacity: i === progressMessages.length - 1 ? 1 : 0.5,
                                      x: 0,
                                    }}
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
                              <div ref={progressEndRef} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Rest of fields hidden during search to reduce noise */}
                    {!isSearching && (
                      <>
                        {/* Description (optional) */}
                        <div>
                          <label className="block text-sm font-medium text-text-primary mb-2">
                            Description (Optional)
                          </label>
                          <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Additional details about this asset..."
                            rows={3}
                            className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1 focus:border-transparent resize-none"
                          />
                        </div>

                        {/* Additional Fields */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">Type</label>
                            <select
                              value={type}
                              onChange={(e) => setType(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-1"
                            >
                              <option value="unknown">Unknown</option>
                              <option value="server">Server</option>
                              <option value="database">Database</option>
                              <option value="network">Network</option>
                              <option value="firewall">Firewall</option>
                              <option value="iot">IoT Device</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">Status</label>
                            <select
                              value={status}
                              onChange={(e) => setStatus(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-1"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                              <option value="maintenance">Maintenance</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">Location</label>
                            <input
                              type="text"
                              value={location}
                              onChange={(e) => setLocation(e.target.value)}
                              placeholder="e.g., Data Center 1"
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-text-primary mb-2">IP Address</label>
                            <input
                              type="text"
                              value={ipAddress}
                              onChange={(e) => setIpAddress(e.target.value)}
                              placeholder="e.g., 192.168.1.1"
                              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1"
                            />
                          </div>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* Direct CPE Input */}
                    <div>
                      <label className="block text-sm font-medium text-text-primary mb-2">
                        CPE String
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={cpeInput}
                          onChange={(e) => {
                            setCpeInput(e.target.value);
                            setValidationResult(null);
                          }}
                          onKeyDown={(e) => e.key === "Enter" && handleValidateCpe()}
                          placeholder="cpe:2.3:a:vendor:product:version:*:*:*:*:*:*:*"
                          className="w-full px-4 py-3 pr-12 rounded-lg border border-border bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1 focus:border-transparent font-mono text-sm"
                        />
                        <button
                          onClick={handleValidateCpe}
                          disabled={!cpeInput.trim() || isValidating}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-text-muted hover:text-text-primary disabled:opacity-50"
                        >
                          {isValidating ? (
                            <FiLoader className="w-5 h-5 animate-spin" />
                          ) : (
                            <FiCheck className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-text-muted">
                        Enter a valid CPE 2.3 string to validate
                      </p>
                    </div>

                    {/* Validation Result */}
                    {validationResult && (
                      <div
                        className={`p-3 rounded-lg border text-sm ${
                          validationResult.isValid
                            ? "bg-success-bg border-success-border text-success-text"
                            : "bg-error-bg border-error-border text-error-text"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {validationResult.isValid ? (
                            <FiCheck className="w-4 h-4" />
                          ) : (
                            <FiAlertCircle className="w-4 h-4" />
                          )}
                          {validationResult.message}
                        </div>
                      </div>
                    )}

                    {/* Asset Name for CPE mode */}
                    {validationResult?.isValid && (
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-2">
                          Asset Name
                        </label>
                        <input
                          type="text"
                          value={assetName}
                          onChange={(e) => setAssetName(e.target.value)}
                          placeholder="Give this asset a friendly name"
                          className="w-full px-4 py-3 rounded-lg border border-border bg-background text-text-primary placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-brand-1 focus:border-transparent"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 2: Select CPEs */}
            {step === "select" && (
              <div className="space-y-4">
                {/* Completed pipeline indicator */}
                {pipelineComplete && progressMessages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="rounded-lg border border-border bg-surface-secondary p-3"
                  >
                    {/* Compact stepper — all done */}
                    <div className="flex items-center gap-1">
                      {PIPELINE_PHASES.map((phase, i) => (
                        <div key={phase} className="flex items-center flex-1 last:flex-initial">
                          <div className="flex flex-col items-center gap-0.5">
                            <motion.div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium border-2 bg-brand-1 border-brand-1 text-brand-2"
                              initial={{ scale: 0.8 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: i * 0.08, duration: 0.2 }}
                            >
                              <FiCheck className="w-3 h-3" />
                            </motion.div>
                            <span className="text-[9px] font-medium text-text-primary whitespace-nowrap">
                              {phase}
                            </span>
                          </div>
                          {i < PIPELINE_PHASES.length - 1 && (
                            <div className="flex-1 h-0.5 mx-1 mb-3.5 rounded-full bg-brand-1" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Expandable log */}
                    <button
                      onClick={() => setShowPipelineLog((v) => !v)}
                      className="mt-2 w-full text-[10px] text-text-muted hover:text-text-secondary transition-colors text-center"
                    >
                      {showPipelineLog ? "Hide details" : `Show pipeline details (${progressMessages.length} steps)`}
                    </button>
                    <AnimatePresence>
                      {showPipelineLog && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 pt-2 border-t border-border space-y-1 max-h-32 overflow-y-auto">
                            {progressMessages.map((msg, i) => (
                              <div
                                key={i}
                                className="text-xs flex items-start gap-2 text-text-muted"
                              >
                                <FiCheck className="w-3 h-3 mt-0.5 shrink-0" />
                                <span>{msg.message}</span>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                <div className="text-sm text-text-secondary">
                  Found {candidates.length} CPE candidates for &quot;{assetName}&quot;.
                  Select the ones that match your asset:
                </div>

                <div className="space-y-2">
                  {candidates.map((candidate) => {
                    const isSelected = selectedCpes.some((c) => c.cpeName === candidate.cpeName);
                    return (
                      <button
                        key={candidate.cpeName}
                        onClick={() => toggleCpeSelection(candidate)}
                        className={`w-full p-4 rounded-lg border text-left transition-colors ${
                          isSelected
                            ? "border-brand-1 bg-brand-1/10"
                            : "border-border hover:border-border-secondary hover:bg-surface-secondary"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-text-primary text-sm">
                              {candidate.title}
                            </div>
                            <div className="text-xs text-text-secondary mt-1">
                              {candidate.vendor} • {candidate.product} • {candidate.version}
                            </div>
                            <div className="text-xs text-text-muted font-mono mt-1 truncate">
                              {candidate.cpeName}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                candidate.score >= 80
                                  ? "bg-success-bg text-success-text"
                                  : candidate.score >= 50
                                  ? "bg-warning-bg text-warning-text"
                                  : "bg-surface-secondary text-text-muted"
                              }`}
                            >
                              {Math.round(candidate.score)}%
                            </span>
                            <div
                              className={`w-5 h-5 rounded border flex items-center justify-center ${
                                isSelected
                                  ? "bg-brand-1 border-brand-1"
                                  : "border-border"
                              }`}
                            >
                              {isSelected && (
                                <FiCheck className="w-3 h-3 text-brand-2" />
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-border">
            <div className="flex gap-3">
              {step === "input" ? (
                <>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex-1 px-4 py-3 rounded-lg border border-border text-text-secondary hover:bg-surface-secondary transition-colors"
                  >
                    Cancel
                  </button>
                  {searchMode === "name" ? (
                    <button
                      onClick={handleSearchByName}
                      disabled={!assetName.trim() || isSearching}
                      className="flex-1 px-4 py-3 rounded-lg bg-brand-1 text-brand-2 font-medium hover:bg-brand-1/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isSearching && <FiLoader className="w-4 h-4 animate-spin" />}
                      Find CPEs
                    </button>
                  ) : (
                    <button
                      onClick={handleCreateAsset}
                      disabled={!validationResult?.isValid || isCreating}
                      className="flex-1 px-4 py-3 rounded-lg bg-brand-1 text-brand-2 font-medium hover:bg-brand-1/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isCreating && <FiLoader className="w-4 h-4 animate-spin" />}
                      Add Asset
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("input");
                      setCandidates([]);
                      setSelectedCpes([]);
                      setProgressMessages([]);
                      setPipelineComplete(false);
                      setShowPipelineLog(false);
                    }}
                    className="flex-1 px-4 py-3 rounded-lg border border-border text-text-secondary hover:bg-surface-secondary transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreateAsset}
                    disabled={isCreating}
                    className="flex-1 px-4 py-3 rounded-lg bg-brand-1 text-brand-2 font-medium hover:bg-brand-1/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreating && <FiLoader className="w-4 h-4 animate-spin" />}
                    {selectedCpes.length > 0
                      ? `Add with ${selectedCpes.length} CPE${selectedCpes.length > 1 ? "s" : ""}`
                      : "Add without CPE"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
