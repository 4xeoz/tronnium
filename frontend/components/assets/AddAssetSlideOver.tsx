"use client";

import { useState, useEffect, useMemo } from "react";
import { FiX, FiSearch, FiCheck, FiAlertCircle, FiLoader, FiZap } from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { Input, TextArea, Select } from "@/components/ui/Input";
import { createAsset, type CpeCandidate } from "@/lib/api";
import { CpeSearchProgress } from "./CpeSearchProgress";
import { CpeCandidateSelector } from "./CpeCandidateSelector";
import { useCpeNameSearch } from "@/lib/hooks/useCpeNameSearch";
import { useCpeValidation } from "@/lib/hooks/useCpeValidation";
import { useAddAssetForm } from "@/lib/hooks/useAddAssetForm";

type SearchMode = "name" | "cpe";
type Step = "input" | "select";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  environmentId: string;
}

export default function AddAssetSlideOver({ isOpen, onClose, onSuccess, environmentId }: Props) {
  const [searchMode, setSearchMode] = useState<SearchMode>("name");
  const [searchType, setSearchType] = useState<"standard" | "semantic">("standard");
  const [topN, setTopN] = useState(10);
  const [step, setStep] = useState<Step>("input");
  const [selectedCpes, setSelectedCpes] = useState<CpeCandidate[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cpeSearch = useCpeNameSearch();
  const cpeValidation = useCpeValidation();
  const form = useAddAssetForm();

  // Advance to select step when either search type returns results
  useEffect(() => {
    if (cpeSearch.candidates.length > 0) setStep("select");
  }, [cpeSearch.candidates]);

  useEffect(() => {
    if (cpeSearch.semanticCandidates.length > 0) setStep("select");
  }, [cpeSearch.semanticCandidates]);

  // Cancel any in-flight SSE when slide-over is closed externally
  useEffect(() => {
    if (!isOpen) cpeSearch.reset();
  }, [isOpen]);

  // Map semantic candidates to CpeCandidate shape so CpeCandidateSelector can render them
  const semanticAsCandidates = useMemo<CpeCandidate[]>(() =>
    cpeSearch.semanticCandidates.map((r) => ({
      cpeName: r.cpeName,
      cpeNameId: "",
      title: r.title,
      // similarity is 0–1, convert to 0–100 to match the score field
      score: Math.round(r.similarity * 100),
      vendor: "",
      product: "",
      version: "",
      breakdown: { vendor: 0, product: 0, version: 0, tokenOverlap: 0 },
    })),
    [cpeSearch.semanticCandidates],
  );

  const isSemanticResults = searchType === "semantic";
  const displayCandidates = isSemanticResults ? semanticAsCandidates : cpeSearch.candidates;

  function handleClose() {
    cpeSearch.reset();
    cpeValidation.reset();
    form.reset();
    setStep("input");
    setSearchMode("name");
    setSearchType("standard");
    setTopN(10);
    setSelectedCpes([]);
    setError(null);
    onClose();
  }

  function goBack() {
    setStep("input");
    setSelectedCpes([]);
    setSearchType("standard");
    cpeSearch.reset();
  }

  function runSearch() {
    cpeSearch.reset();
    if (searchType === "semantic") {
      cpeSearch.semanticSearch(form.fields.assetName, topN);
    } else {
      cpeSearch.search(form.fields.assetName, topN);
    }
  }

  function toggleCpeSelection(cpe: CpeCandidate) {
    setSelectedCpes((prev) =>
      prev.some((c) => c.cpeName === cpe.cpeName)
        ? prev.filter((c) => c.cpeName !== cpe.cpeName)
        : [...prev, cpe]
    );
  }

  async function handleCreateAsset() {
    const cpes = searchMode === "cpe" && cpeValidation.validatedCpe
      ? [cpeValidation.validatedCpe]
      : selectedCpes;

    const input = form.buildCreateInput(cpes);
    const name = input.name || cpeValidation.cpeInput.trim();
    if (!name) { setError("Asset name is required"); return; }

    setError(null);
    setIsCreating(true);
    try {
      await createAsset(environmentId, { ...input, name });
      onSuccess();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setIsCreating(false);
    }
  }

  const displayError = error || cpeValidation.error;

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/45 transition-opacity duration-200 z-40 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={handleClose}
      />

      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-[860px] bg-surface border-l border-border shadow-(--shadow-card) z-50 flex flex-col transform transition-transform duration-200 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[22px] font-bold text-text-primary tracking-[-0.3px]">Add Asset</h2>
            <p className="text-[13px] text-text-muted mt-0.5">
              {step === "input" && "Search for an asset or enter a CPE directly"}
              {step === "select" && !isSemanticResults && "Select CPEs to associate with this asset"}
              {step === "select" && isSemanticResults && "Showing semantic similarity matches"}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-full flex items-center justify-center border border-border text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-all active:scale-95"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Body — two-panel layout when results are available */}
        <div className="flex-1 overflow-hidden flex">

          {/* Left panel: input form */}
          <div className={`overflow-y-auto p-6 flex flex-col gap-5 ${step === "select" ? "w-[360px] shrink-0 border-r border-border" : "flex-1"}`}>
            {displayError && (
              <div className="p-3 bg-error-bg border border-error-border rounded-[10px] text-error-text text-sm flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4 shrink-0" />
                {displayError}
              </div>
            )}
            <div className="space-y-5">
              {/* Mode toggle */}
              <div className="flex gap-1 p-1 bg-background-secondary rounded-[10px]">
                {(["name", "cpe"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSearchMode(mode)}
                    className={`flex-1 px-4 py-2 rounded-[10px] text-sm font-medium transition-all ${
                      searchMode === mode
                        ? "bg-surface text-text-primary shadow-(--shadow-ring)"
                        : "text-text-muted hover:text-text-secondary"
                    }`}
                  >
                    {mode === "name" ? "Search by Name" : "Enter CPE"}
                  </button>
                ))}
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
                        value={form.fields.assetName}
                        onChange={(e) => form.setField("assetName", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && !cpeSearch.isSearching && runSearch()}
                        placeholder="e.g., OpenSSL 1.1.1, Apache HTTP Server 2.4"
                        disabled={cpeSearch.isSearching}
                        className="pr-11"
                      />
                      <button
                        onClick={runSearch}
                        disabled={!form.fields.assetName.trim() || cpeSearch.isSearching}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-secondary disabled:opacity-50 transition-all active:scale-95"
                      >
                        {cpeSearch.isSearching
                          ? <FiLoader className="w-4 h-4 animate-spin" />
                          : <FiSearch className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-text-muted">Enter a software/hardware name to find matching CPEs</p>
                  </div>

                  {/* Search type toggle + result count */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 flex gap-1 p-1 bg-background-secondary rounded-[10px]">
                      {(["standard", "semantic"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setSearchType(type)}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            searchType === type
                              ? "bg-surface text-text-primary shadow-(--shadow-ring)"
                              : "text-text-muted hover:text-text-secondary"
                          }`}
                        >
                          {type === "semantic" && <FiZap className="w-3 h-3" />}
                          {type === "standard" ? "Standard" : "Semantic"}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <label className="text-[11px] font-semibold uppercase tracking-[0.4px] text-text-secondary whitespace-nowrap">
                        Results
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={topN}
                        onChange={(e) => setTopN(Math.min(50, Math.max(1, Number(e.target.value))))}
                        className="w-16 text-center"
                      />
                    </div>
                  </div>

                  {cpeSearch.isSearching && <CpeSearchProgress progressMessages={cpeSearch.progressMessages} />}

                  {!cpeSearch.isSearching && step === "input" && (
                    <>
                      <div>
                        <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">
                          Description (Optional)
                        </label>
                        <TextArea
                          value={form.fields.description}
                          onChange={(e) => form.setField("description", e.target.value)}
                          placeholder="Additional details about this asset..."
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Type</label>
                          <Select value={form.fields.type} onChange={(e) => form.setField("type", e.target.value)}>
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
                          <Select value={form.fields.status} onChange={(e) => form.setField("status", e.target.value)}>
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
                            value={form.fields.location}
                            onChange={(e) => form.setField("location", e.target.value)}
                            placeholder="e.g., Data Center 1"
                          />
                        </div>
                        <div>
                          <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">IP Address</label>
                          <Input
                            type="text"
                            value={form.fields.ipAddress}
                            onChange={(e) => form.setField("ipAddress", e.target.value)}
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
                        value={cpeValidation.cpeInput}
                        onChange={(e) => cpeValidation.setCpeInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && cpeValidation.validate()}
                        placeholder="cpe:2.3:a:vendor:product:version:*:*:*:*:*:*:*"
                        className="pr-11 font-mono text-sm"
                      />
                      <button
                        onClick={cpeValidation.validate}
                        disabled={!cpeValidation.cpeInput.trim() || cpeValidation.isValidating}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center bg-brand-2 text-white hover:opacity-90 disabled:opacity-50 transition-all active:scale-95"
                      >
                        {cpeValidation.isValidating
                          ? <FiLoader className="w-4 h-4 animate-spin" />
                          : <FiSearch className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-text-muted">Enter a valid CPE 2.3 string to validate</p>
                  </div>

                  {cpeValidation.validationResult && (
                    <div className={`p-3 rounded-[10px] border text-sm ${
                      cpeValidation.validationResult.isValid
                        ? "bg-success-bg border-success-border text-success-text"
                        : "bg-error-bg border-error-border text-error-text"
                    }`}>
                      <div className="flex items-center gap-2">
                        {cpeValidation.validationResult.isValid
                          ? <FiCheck className="w-4 h-4" />
                          : <FiAlertCircle className="w-4 h-4" />}
                        {cpeValidation.validationResult.message}
                      </div>
                    </div>
                  )}

                  {cpeValidation.validationResult?.isValid && (
                    <div>
                      <label className="block text-[12px] font-semibold uppercase tracking-[0.4px] text-text-secondary mb-2">Asset Name</label>
                      <Input
                        type="text"
                        value={form.fields.assetName}
                        onChange={(e) => form.setField("assetName", e.target.value)}
                        placeholder="Give this asset a friendly name"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right panel: results — only visible once candidates are available */}
          {step === "select" && (
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isSemanticResults && (
                <div className="flex items-start gap-2 p-3 bg-brand-1/10 border border-brand-1/20 rounded-[10px] text-sm text-text-secondary">
                  <FiZap className="w-4 h-4 mt-0.5 shrink-0 text-brand-1" />
                  <span>No exact CPE matches found. Showing AI semantic similarity results instead — ranked by how closely they match your search.</span>
                </div>
              )}
              <CpeCandidateSelector
                candidates={displayCandidates}
                selectedCpes={selectedCpes}
                onToggle={toggleCpeSelection}
                assetName={form.fields.assetName}
                progressMessages={!isSemanticResults && cpeSearch.pipelineComplete ? cpeSearch.progressMessages : undefined}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border">
          <div className="flex gap-3">
            {step === "input" ? (
              <>
                <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
                  Cancel
                </Button>
                {searchMode === "name" ? (
                  <Button
                    onClick={runSearch}
                    disabled={!form.fields.assetName.trim() || cpeSearch.isSearching}
                    isLoading={cpeSearch.isSearching}
                    className="flex-1"
                  >
                    Find CPEs
                  </Button>
                ) : (
                  <Button
                    onClick={handleCreateAsset}
                    disabled={!cpeValidation.validationResult?.isValid || isCreating}
                    isLoading={isCreating}
                    className="flex-1"
                  >
                    Add Asset
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={goBack} className="flex-1">
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
