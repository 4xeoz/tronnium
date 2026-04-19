"use client";

import { useState, useRef, useEffect } from "react";
import { FiX, FiSearch, FiCheck, FiAlertCircle, FiLoader } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { Input, TextArea, Select } from "@/components/ui/Input";
import {
  findCpe,
  validateCpe,
  createAsset,
  listenForCpeFindProgress,
  type CpeCandidate,
  type CreateAssetInput,
} from "@/lib/api";
import { CpeSearchProgress } from "./CpeSearchProgress";
import { CpeCandidateSelector } from "./CpeCandidateSelector";

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
  const [searchMode, setSearchMode] = useState<SearchMode>("name");
  const [step, setStep] = useState<Step>("input");
  const [assetName, setAssetName] = useState("");
  const [cpeInput, setCpeInput] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("unknown");
  const [status, setStatus] = useState("active");
  const [location, setLocation] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [candidates, setCandidates] = useState<CpeCandidate[]>([]);
  const [selectedCpes, setSelectedCpes] = useState<CpeCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; message: string } | null>(null);
  const [progressMessages, setProgressMessages] = useState<{ step: string; message: string }[]>([]);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const showPipelineLog = true;

  const eventSourceRef = useRef<EventSource | null>(null);

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
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen && eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [isOpen]);

  const handleSearchByName = () => {
    if (!assetName.trim()) return;
    if (assetName.length < 4) {
      setError("Please enter at least 4 characters to search");
      return;
    }
    if (eventSourceRef.current) eventSourceRef.current.close();
    setError(null);
    setIsSearching(true);
    setProgressMessages([]);
    setPipelineComplete(false);

    eventSourceRef.current = listenForCpeFindProgress(
      assetName.trim(),
      10,
      (update) => setProgressMessages((prev) => [...prev, update]),
      (result) => {
        setIsSearching(false);
        setPipelineComplete(true);
        if (result.success && result.candidates.length > 0) {
          setCandidates(result.candidates);
          setStep("select");
        } else {
          setError("No CPE candidates found. Try a different search term.");
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

  const handleValidateCpe = async () => {
    if (!cpeInput.trim()) return;
    setError(null);
    setValidationResult(null);
    setIsValidating(true);
    try {
      const result = await validateCpe(cpeInput.trim());
      const payload = result.data;
      setValidationResult({ isValid: payload.isValid, message: payload.message });
      if (payload.isValid) {
        const manualCpe: CpeCandidate = {
          cpeName: cpeInput.trim(),
          cpeNameId: "",
          title: cpeInput.trim(),
          score: 100,
          vendor: payload.parsed?.vendor || "",
          product: payload.parsed?.product || "",
          version: payload.parsed?.version || "",
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

  const toggleCpeSelection = (cpe: CpeCandidate) => {
    setSelectedCpes((prev) =>
      prev.some((c) => c.cpeName === cpe.cpeName)
        ? prev.filter((c) => c.cpeName !== cpe.cpeName)
        : [...prev, cpe]
    );
  };

  const handleCreateAsset = async () => {
    if (!assetName.trim() && searchMode === "name") {
      setError("Asset name is required");
      return;
    }
    setError(null);
    setIsCreating(true);
    try {
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
      <div
        className={`fixed inset-0 bg-black/45 transition-opacity duration-200 z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-lg bg-surface border-l border-border shadow-[var(--shadow-card)] z-50 flex flex-col transform transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-bold text-text-primary tracking-[-0.3px]">Add Asset</h2>
            <p className="text-[13px] text-text-muted mt-0.5">
              {step === "input" && "Search for an asset or enter a CPE directly"}
              {step === "select" && "Select CPEs to associate with this asset"}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-border text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-all active:scale-95"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-error-bg border border-error-border rounded-[10px] text-error-text text-sm flex items-center gap-2">
              <FiAlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {step === "input" && (
            <div className="space-y-5">
              <div className="flex gap-1 p-1 bg-background-secondary rounded-[10px]">
                <button
                  onClick={() => setSearchMode("name")}
                  className={`flex-1 px-4 py-2 rounded-[10px] text-sm font-medium transition-all ${
                    searchMode === "name"
                      ? "bg-surface text-text-primary shadow-[var(--shadow-ring)]"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Search by Name
                </button>
                <button
                  onClick={() => setSearchMode("cpe")}
                  className={`flex-1 px-4 py-2 rounded-[10px] text-sm font-medium transition-all ${
                    searchMode === "cpe"
                      ? "bg-surface text-text-primary shadow-[var(--shadow-ring)]"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  Enter CPE
                </button>
              </div>

              {searchMode === "name" ? (
                <>
                  <div>
                    <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">
                      Asset Name
                    </label>
                    <div className="relative">
                      <Input
                        type="text"
                        value={assetName}
                        onChange={(e) => setAssetName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !isSearching && handleSearchByName()}
                        placeholder="e.g., OpenSSL 1.1.1, Apache HTTP Server 2.4"
                        disabled={isSearching}
                        className="pr-11"
                      />
                      <button
                        onClick={handleSearchByName}
                        disabled={!assetName.trim() || isSearching}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-secondary disabled:opacity-50 transition-all active:scale-95"
                      >
                        {isSearching ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiSearch className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-text-muted">Enter a software/hardware name to find matching CPEs</p>
                  </div>

                  {isSearching && <CpeSearchProgress progressMessages={progressMessages} />}

                  {!isSearching && (
                    <>
                      <div>
                        <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">
                          Description (Optional)
                        </label>
                        <TextArea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Additional details about this asset..."
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Type</label>
                          <Select value={type} onChange={(e) => setType(e.target.value)}>
                            <option value="unknown">Unknown</option>
                            <option value="server">Server</option>
                            <option value="database">Database</option>
                            <option value="network">Network</option>
                            <option value="firewall">Firewall</option>
                            <option value="iot">IoT Device</option>
                          </Select>
                        </div>
                        <div>
                          <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Status</label>
                          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="maintenance">Maintenance</option>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Location</label>
                          <Input
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="e.g., Data Center 1"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">IP Address</label>
                          <Input
                            type="text"
                            value={ipAddress}
                            onChange={(e) => setIpAddress(e.target.value)}
                            placeholder="e.g., 192.168.1.1"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">CPE String</label>
                    <div className="relative">
                      <Input
                        type="text"
                        value={cpeInput}
                        onChange={(e) => { setCpeInput(e.target.value); setValidationResult(null); }}
                        onKeyDown={(e) => e.key === "Enter" && handleValidateCpe()}
                        placeholder="cpe:2.3:a:vendor:product:version:*:*:*:*:*:*:*"
                        className="pr-11 font-mono text-sm"
                      />
                      <button
                        onClick={handleValidateCpe}
                        disabled={!cpeInput.trim() || isValidating}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-brand-2 text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                      >
                        {isValidating ? <FiLoader className="w-4 h-4 animate-spin" /> : <FiSearch className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-text-muted">Enter a valid CPE 2.3 string to validate</p>
                  </div>

                  {validationResult && (
                    <div className={`p-3 rounded-[10px] border text-sm ${
                      validationResult.isValid
                        ? "bg-success-bg border-success-border text-success-text"
                        : "bg-error-bg border-error-border text-error-text"
                    }`}>
                      <div className="flex items-center gap-2">
                        {validationResult.isValid ? <FiCheck className="w-4 h-4" /> : <FiAlertCircle className="w-4 h-4" />}
                        {validationResult.message}
                      </div>
                    </div>
                  )}

                  {validationResult?.isValid && (
                    <div>
                      <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Asset Name</label>
                      <Input
                        type="text"
                        value={assetName}
                        onChange={(e) => setAssetName(e.target.value)}
                        placeholder="Give this asset a friendly name"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === "select" && (
            <CpeCandidateSelector
              candidates={candidates}
              selectedCpes={selectedCpes}
              onToggle={toggleCpeSelection}
              assetName={assetName}
              progressMessages={pipelineComplete ? progressMessages : undefined}
            />
          )}
        </div>

        <div className="px-6 py-4 border-t border-border">
          <div className="flex gap-3">
            {step === "input" ? (
              <>
                <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                {searchMode === "name" ? (
                  <Button
                    onClick={handleSearchByName}
                    disabled={!assetName.trim() || isSearching}
                    isLoading={isSearching}
                    className="flex-1"
                  >
                    Find CPEs
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreateAsset}
                    disabled={!validationResult?.isValid || isCreating}
                    isLoading={isCreating}
                    className="flex-1"
                  >
                    Add Asset
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setStep("input");
                    setCandidates([]);
                    setSelectedCpes([]);
                    setProgressMessages([]);
                    setPipelineComplete(false);
                  }}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreateAsset}
                  disabled={isCreating}
                  isLoading={isCreating}
                  className="flex-1"
                >
                  {selectedCpes.length > 0
                    ? `Add with ${selectedCpes.length} CPE${selectedCpes.length > 1 ? "s" : ""}`
                    : "Add without CPE"}
                </Button>
              </>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
