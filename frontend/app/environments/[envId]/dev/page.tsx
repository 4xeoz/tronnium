"use client";


import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  generateMockVulnerabilities,
  clearMockVulnerabilities,
  fetchMockVulnerabilities,
  fetchMockVulnerabilityStats,
  type GeneratedVulnerability,
  type MockVulnerability,
  type MockVulnerabilityStats} from "@/lib/api";
import { fetchAssets, type Asset } from "@/lib/api/assets";
import { formatCveId } from "@/lib/formatters";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const STEPS = {
  START: 'start',
  PROMPT: 'prompt',
  GENERATING: 'generating',
  RESULTS: 'results'
} as const;

type Step = typeof STEPS[keyof typeof STEPS];

type SelectedAsset = {
  assetId: string;
  assetName: string;
  cpeIdentifier?: string;
  cpeDisplay?: string;
};

type CpeItem = { cpeName: string; title?: string; score?: number };

function AIVulnGenerator() {
  const params = useParams();
  const envId = params.envId as string;

  const [step, setStep] = useState<Step>(STEPS.START);
  const [prompt, setPrompt] = useState("");
  const [generatedVulns, setGeneratedVulns] = useState<GeneratedVulnerability[]>([]);
  const [mockVulns, setMockVulns] = useState<MockVulnerability[]>([]);
  const [stats, setStats] = useState<MockVulnerabilityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());
  const [selectedSeverity, setSelectedSeverity] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | null>(null);
  const cancelledRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [vulnsRes, statsRes, assetsRes] = await Promise.all([
        fetchMockVulnerabilities(envId),
        fetchMockVulnerabilityStats(envId),
        fetchAssets(envId),
      ]);
      if (vulnsRes) setMockVulns(vulnsRes.data);
      if (statsRes) setStats(statsRes.data);
      if (assetsRes) setAssets(assetsRes.data);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [envId]);

  useEffect(() => { loadData(); }, [loadData]);

  const getCpes = (asset: Asset): CpeItem[] => {
    return Array.isArray(asset.cpes) ? (asset.cpes as CpeItem[]) : [];
  };

  const getCpeDisplayName = (cpe: CpeItem): string => {
    return cpe.cpeName || 'Unknown CPE';
  };

  const toggleAsset = (asset: Asset, cpe?: CpeItem) => {
    const cpeId = cpe ? cpe.cpeName : undefined;
    setSelectedAssets(prev => {
      const exists = prev.some(s => s.assetId === asset.id && s.cpeIdentifier === cpeId);
      if (exists) {
        return prev.filter(s => !(s.assetId === asset.id && s.cpeIdentifier === cpeId));
      }
      return [...prev, { assetId: asset.id, assetName: asset.name, cpeIdentifier: cpeId, cpeDisplay: cpe ? getCpeDisplayName(cpe) : undefined }];
    });
  };

  const isSelected = (assetId: string, cpe?: CpeItem) => {
    const cpeId = cpe ? cpe.cpeName : undefined;
    return selectedAssets.some(s => s.assetId === assetId && s.cpeIdentifier === cpeId);
  };

  const toggleExpand = (assetId: string) => {
    setExpandedAssets(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  const buildContextualPrompt = (): string => {
    const uniqueAssets = [...new Set(selectedAssets.map(s => s.assetName))];
    const cpes = selectedAssets.map(s => s.cpeDisplay).filter(Boolean) as string[];
    const assetList = uniqueAssets.join(", ");
    const cpeList = cpes.length > 0 ? cpes.slice(0, 2).join(", ") : "the selected systems";
    return `Generate 1 realistic vulnerability for:

Assets: ${assetList}
${cpes.length > 0 ? `CPEs: ${cpeList}${cpes.length > 2 ? ` +${cpes.length - 2} more` : ""}` : ""}

Severity: ${selectedSeverity}

Invent a creative, technically detailed, and realistic vulnerability description specific to these systems. Do not use generic placeholder text.`;
  };

  const handleContinueToPrompt = () => {
    if (selectedAssets.length === 0) return;
    setStep(STEPS.PROMPT);
  };

  const handleSendToLLM = async () => {
    cancelledRef.current = false;
    setIsSending(true);
    setStep(STEPS.GENERATING);
    setError(null);
    try {
      const builtPrompt = buildContextualPrompt();
      const targets = selectedAssets.map(s => ({ assetId: s.assetId, assetName: s.assetName, cpeIdentifier: s.cpeIdentifier }));
      const response = await generateMockVulnerabilities(envId, builtPrompt, 1, targets);
      if (cancelledRef.current) return;
      setGeneratedVulns(response.data.vulnerabilities);
      await loadData();
      setStep(STEPS.RESULTS);
      setPrompt("");
      setSelectedAssets([]);
    } catch (err) {
      if (cancelledRef.current) return;
      const msg = err instanceof Error ? err.message : "Error";
      if (msg.includes("GEMINI_API_KEY")) setError("AI service not configured. Please set GEMINI_API_KEY in environment.");
      else if (msg.includes("No assets found")) setError("No assets in environment. Add assets first.");
      else if (msg.includes("Dev mode")) setError("Dev mode required. Contact admin to enable.");
      else setError(msg);
      setStep(STEPS.PROMPT);
    } finally {
      setIsSending(false);
    }
  };

  const handleCancelGeneration = () => {
    cancelledRef.current = true;
    setIsSending(false);
    setStep(STEPS.PROMPT);
  };

  const handleClear = async () => {
    setClearing(true);
    setConfirmClear(false);
    try {
      await clearMockVulnerabilities(envId);
      setMockVulns([]);
      setGeneratedVulns([]);
      setStats(null);
      setStep(STEPS.START);
      setSelectedAssets([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setClearing(false);
    }
  };

  const handleStartOver = () => {
    setStep(STEPS.START);
    setPrompt("");
    setError(null);
    setSelectedAssets([]);
    setSelectedSeverity(null);
  };

  const totalCount = stats?.total || 0;

  if (step === STEPS.START) {
    return (
      <div className="bg-surface rounded-[16px] border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-text-primary tracking-[-0.2px]">Mock Vulnerability Generator</h2>
            <p className="text-[13px] text-text-muted mt-0.5">Select assets to target</p>
          </div>
          {totalCount > 0 && !confirmClear && (
            <Button variant="danger" size="sm" onClick={() => setConfirmClear(true)} disabled={clearing}>
              {clearing ? "Clearing..." : "Clear All"}
            </Button>
          )}
          {confirmClear && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Clear all mock data?</span>
              <Button variant="danger" size="sm" onClick={handleClear} disabled={clearing}>
                {clearing ? "Clearing..." : "Confirm"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
            </div>
          )}
        </div>

        <div className="p-5">
          {totalCount > 0 && (
            <div className="flex gap-4 mb-5 pb-4 border-b border-border">
              <div className="text-center">
                <div className="text-[28px] font-bold text-error-text tracking-[-1px]">
                  {stats?.bySeverity.find(s => s.severity === "CRITICAL")?._count.id || 0}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-text-muted">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-[28px] font-bold text-warning-text tracking-[-1px]">
                  {stats?.bySeverity.find(s => s.severity === "HIGH")?._count.id || 0}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-text-muted">High</div>
              </div>
              <div className="text-center">
                <div className="text-[28px] font-bold text-info-text tracking-[-1px]">
                  {stats?.bySeverity.find(s => s.severity === "MEDIUM")?._count.id || 0}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.5px] text-text-muted">Medium</div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-text-muted">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-8 text-text-muted">No assets found</div>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {assets.map((asset) => {
                  const cpes = getCpes(asset);
                  const isExpanded = expandedAssets.has(asset.id);
                  const hasCpes = cpes.length > 0;
                  const assetSelected = isSelected(asset.id);
                  return (
                    <div key={asset.id} className="border border-border rounded-[10px] overflow-hidden">
                      <div
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${assetSelected ? 'bg-brand-mint/30' : 'hover:bg-background-secondary'}`}
                        onClick={() => hasCpes ? toggleExpand(asset.id) : toggleAsset(asset)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={assetSelected}
                            onChange={() => toggleAsset(asset)}
                            className="w-4 h-4 rounded border-border-secondary accent-brand-1"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <div className="font-semibold text-sm text-text-primary">{asset.name}</div>
                            <div className="text-xs text-text-muted">{asset.type}</div>
                          </div>
                        </div>
                        {hasCpes && (
                          <span className="text-xs text-text-muted px-2 py-1">
                            {cpes.length} CPEs {isExpanded ? '▲' : '▼'}
                          </span>
                        )}
                      </div>
                      {isExpanded && hasCpes && (
                        <div className="border-t border-border bg-background-secondary/50">
                          {cpes.map((cpe, idx) => (
                            <label key={idx} className="flex items-center gap-3 px-3 py-2 hover:bg-background-secondary cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isSelected(asset.id, cpe)}
                                onChange={() => toggleAsset(asset, cpe)}
                                className="w-4 h-4 rounded border-border-secondary accent-brand-1"
                              />
                              <span className="text-xs font-mono text-text-secondary truncate">{getCpeDisplayName(cpe)}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button onClick={handleContinueToPrompt} disabled={selectedAssets.length === 0} className="w-full">
                Generate Prompt ({selectedAssets.length} selected)
              </Button>
            </>
          )}

          {mockVulns.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <div className="text-sm font-semibold text-text-primary mb-2">Previous ({mockVulns.length})</div>
              <div className="space-y-2">
                {mockVulns.slice(0, 3).map((vuln) => (
                  <div key={vuln.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-text-secondary">{formatCveId(vuln.cveId)}</span>
                    <Badge variant={vuln.severity === "CRITICAL" ? "error" : vuln.severity === "HIGH" ? "warning" : "info"} size="sm">{vuln.severity}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === STEPS.PROMPT) {
    const uniqueAssetIds = [...new Set(selectedAssets.map(s => s.assetId))];
    const severities = [
      { value: "CRITICAL" as const, label: "Critical", sub: "9.0 – 10.0", activeClass: "bg-error-bg border-error-border text-error-text", dotClass: "bg-error-text" },
      { value: "HIGH"     as const, label: "High",     sub: "7.0 – 8.9",  activeClass: "bg-warning-bg border-warning-border text-warning-text", dotClass: "bg-warning-text" },
      { value: "MEDIUM"   as const, label: "Medium",   sub: "4.0 – 6.9",  activeClass: "bg-info-bg border-info-border text-info-text", dotClass: "bg-info-text" },
      { value: "LOW"      as const, label: "Low",      sub: "0.1 – 3.9",  activeClass: "bg-success-bg border-success-border text-success-text", dotClass: "bg-success-text" },
    ] as const;
    return (
      <div className="bg-surface rounded-[16px] border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-bold text-text-primary tracking-[-0.2px]">Configure Vulnerability</h2>
            <p className="text-[13px] text-text-muted mt-0.5">
              {uniqueAssetIds.length} {uniqueAssetIds.length === 1 ? "asset" : "assets"} targeted
            </p>
          </div>
          <button onClick={handleStartOver} className="text-sm text-text-muted hover:text-text-primary font-medium">← Back</button>
        </div>
        <div className="p-5 space-y-5">
          {error && (
            <div className="bg-error-bg border border-error-border rounded-[10px] text-error-text px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text-muted mb-2">Severity</div>
            <div className="grid grid-cols-2 gap-2">
              {severities.map(({ value, label, sub, activeClass, dotClass }) => {
                const isActive = selectedSeverity === value;
                return (
                  <button
                    key={value}
                    onClick={() => setSelectedSeverity(value)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-[10px] border text-left transition-all ${
                      isActive
                        ? activeClass
                        : "border-border bg-background-secondary hover:bg-background-secondary/70 text-text-primary"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full shrink-0 ${isActive ? dotClass : "bg-border"}`} />
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className={`block text-[11px] ${isActive ? "opacity-70" : "text-text-muted"}`}>CVSS {sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.6px] text-text-muted mb-2">Targets</div>
            <div className="space-y-1.5">
              {uniqueAssetIds.map(assetId => {
                const assetSelections = selectedAssets.filter(s => s.assetId === assetId);
                const name = assetSelections[0]?.assetName || "Unknown";
                const cpeCount = assetSelections.filter(s => s.cpeIdentifier).length;
                return (
                  <div key={assetId} className="flex items-center justify-between px-3 py-2 bg-background-secondary rounded-lg">
                    <span className="text-sm font-medium text-text-primary">{name}</span>
                    <span className="text-xs text-text-muted">
                      {cpeCount > 0 ? `${cpeCount} CPE${cpeCount > 1 ? "s" : ""}` : "No specific CPE"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <Button
            onClick={handleSendToLLM}
            disabled={isSending || !selectedSeverity}
            isLoading={isSending}
            className="w-full"
          >
            Generate Vulnerability
          </Button>
        </div>
      </div>
    );
  }

  if (step === STEPS.GENERATING) {
    return (
      <div className="bg-surface rounded-[16px] border border-border p-12 text-center">
        <div className="w-10 h-10 border-2 border-border border-t-brand-1 rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-text-primary">Generating</h2>
        <p className="text-sm text-text-muted mt-1">Creating vulnerabilities...</p>
        <button
          onClick={handleCancelGeneration}
          className="mt-6 text-sm text-text-muted hover:text-text-primary font-medium transition-colors"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (step === STEPS.RESULTS) {
    return (
      <div className="bg-surface rounded-[16px] border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[18px] font-bold text-text-primary tracking-[-0.2px]">Done</h2>
          <p className="text-[13px] text-text-muted mt-0.5">Vulnerability created{selectedSeverity ? ` · ${selectedSeverity}` : ""}</p>
        </div>
        <div className="p-5 space-y-3">
          {generatedVulns.map((vuln, idx) => (
            <div key={idx} className="p-4 bg-success-bg rounded-[10px] border border-success-border">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-sm font-semibold text-text-primary">{formatCveId(vuln.cveId)}</span>
                <Badge variant={vuln.severity === "CRITICAL" ? "error" : vuln.severity === "HIGH" ? "warning" : "info"} size="sm">{vuln.severity}</Badge>
                <Badge variant="neutral" size="sm">MOCK</Badge>
              </div>
              <p className="text-sm text-text-secondary">{vuln.description}</p>
            </div>
          ))}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={handleStartOver} className="flex-1">Generate More</Button>
            <a href={`/environments/${envId}/security`} className="flex-1">
              <Button className="w-full">View Security</Button>
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ComingSoonCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-background-secondary rounded-[16px] border border-border p-4 opacity-80">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-text-primary">{title}</h3>
        <Badge variant="neutral" size="sm">Soon</Badge>
      </div>
      <p className="text-xs text-text-muted">{description}</p>
    </div>
  );
}

export default function DevModePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      <PageHeader
        title="Dev Mode"
        subtitle="Testing and development tools"
        action={<Badge variant="neutral" size="sm">BETA</Badge>}
      />

      <div className="bg-warning-bg border border-warning-border rounded-[16px] p-4 mb-6">
        <p className="text-sm text-warning-text font-medium">
          <strong>Note:</strong> Generated data appears in dashboards with &quot;MOCK&quot; labels.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AIVulnGenerator />
        <div className="space-y-3">
          <ComingSoonCard title="Mock Environment" description="Generate complete test environments" />
          <ComingSoonCard title="Scenario Tester" description="Test security dashboard responses" />
        </div>
      </div>
    </div>
  );
}
