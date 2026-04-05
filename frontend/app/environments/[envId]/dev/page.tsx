"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  generateMockVulnerabilities,
  clearMockVulnerabilities,
  getMockVulnerabilities,
  getMockVulnerabilityStats,
  type GeneratedVulnerability,
  type MockVulnerability,
  type MockVulnerabilityStats,
  getMockSeverityColor,
  formatCveId,
} from "@/lib/api";
import { getAssets, type Asset } from "@/lib/api/assets";

const STEPS = {
  START: 'start',
  SELECT: 'select',
  PROMPT: 'prompt', 
  GENERATING: 'generating',
  RESULTS: 'results'
} as const;

type Step = typeof STEPS[keyof typeof STEPS];

type SelectedAsset = {
  assetId: string;
  assetName: string;
  cpeIdentifier?: string;  // cpeName string (either from object.cpeName or the string itself)
  cpeDisplay?: string;     // What to show in the UI
};

function AIVulnGenerator() {
  const params = useParams();
  const envId = params.envId as string;

  const [step, setStep] = useState<Step>(STEPS.START);
  const [prompt, setPrompt] = useState("");
  const [generatedVulns, setGeneratedVulns] = useState<GeneratedVulnerability[]>([]);
  const [mockVulns, setMockVulns] = useState<MockVulnerability[]>([]);
  const [stats, setStats] = useState<MockVulnerabilityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, [envId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [vulnsRes, statsRes, assetsRes] = await Promise.all([
        getMockVulnerabilities(envId),
        getMockVulnerabilityStats(envId),
        getAssets(envId),
      ]);

      if (vulnsRes.data) setMockVulns(vulnsRes.data);
      if (statsRes.data) setStats(statsRes.data);
      if (assetsRes.data) setAssets(assetsRes.data);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleAsset = (asset: Asset, cpe?: CpeItem) => {
    setSelectedAssets(prev => {
      const cpeId = cpe ? (typeof cpe === 'string' ? cpe : cpe.cpeName) : undefined;
      const exists = prev.some(s => 
        s.assetId === asset.id && s.cpeIdentifier === cpeId
      );
      
      if (exists) {
        return prev.filter(s => 
          !(s.assetId === asset.id && s.cpeIdentifier === cpeId)
        );
      } else {
        return [...prev, {
          assetId: asset.id,
          assetName: asset.name,
          cpeIdentifier: cpeId,
          cpeDisplay: cpe ? (typeof cpe === 'string' ? cpe : cpe.cpeName) : undefined
        }];
      }
    });
  };

  const isSelected = (assetId: string, cpe?: CpeItem) => {
    const cpeId = cpe ? (typeof cpe === 'string' ? cpe : cpe.cpeName) : undefined;
    return selectedAssets.some(s => 
      s.assetId === assetId && s.cpeIdentifier === cpeId
    );
  };

  const toggleExpand = (assetId: string) => {
    setExpandedAssets(prev => {
      const next = new Set(prev);
      if (next.has(assetId)) next.delete(assetId);
      else next.add(assetId);
      return next;
    });
  };

  type CpeItem = string | { cpeName: string; title?: string; score?: number };

const getCpes = (asset: Asset): CpeItem[] => {
    if (!asset.cpes) return [];
    
    // Already an array
    if (Array.isArray(asset.cpes)) {
      return asset.cpes as CpeItem[];
    }
    
    // Try to parse JSON string
    try {
      const parsed = JSON.parse(asset.cpes);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

const getCpeDisplayName = (cpe: CpeItem): string => {
    if (typeof cpe === 'string') return cpe;
    return cpe.cpeName || 'Unknown CPE';
  };

  const handleContinueToPrompt = () => {
    if (selectedAssets.length === 0) return;
    setStep(STEPS.PROMPT);
    handleGeneratePrompt();
  };

  const handleGeneratePrompt = () => {
    setIsGeneratingPrompt(true);
    
    setTimeout(() => {
      const generatedPrompt = buildContextualPrompt();
      setPrompt(generatedPrompt);
      setIsGeneratingPrompt(false);
    }, 300);
  };

  const buildContextualPrompt = (): string => {
    const uniqueAssets = [...new Set(selectedAssets.map(s => s.assetName))];
    const cpes = selectedAssets.map(s => s.cpeDisplay).filter(Boolean) as string[];
    
    const assetList = uniqueAssets.join(", ");
    const cpeList = cpes.length > 0 ? cpes.slice(0, 2).join(", ") : "the selected systems";
    
    return `Generate 3 realistic vulnerabilities for:

Assets: ${assetList}
${cpes.length > 0 ? `CPEs: ${cpeList}${cpes.length > 2 ? ` +${cpes.length - 2} more` : ""}` : ""}

Create:
- 1 Critical: Remote Code Execution
- 1 High: SQL Injection or Auth Bypass  
- 1 Medium: Information Disclosure

Make them technically detailed and realistic for these specific systems.`;
  };

  const handleSendToLLM = async () => {
    if (!prompt.trim()) return;

    setIsSending(true);
    setStep(STEPS.GENERATING);
    setError(null);

    try {
      // Convert selected assets to targets format for API
      const targets = selectedAssets.map(s => ({
        assetId: s.assetId,
        assetName: s.assetName,
        cpeIdentifier: s.cpeIdentifier,
      }));

      const response = await generateMockVulnerabilities(envId, prompt, 3, targets);
      
      if (response.data) {
        setGeneratedVulns(response.data.vulnerabilities);
        await loadData();
        setStep(STEPS.RESULTS);
        setPrompt("");
        setSelectedAssets([]);
      } else {
        setError(response.message || "Failed");
        setStep(STEPS.PROMPT);
      }
    } catch (err: any) {
      const msg = err.message || "Error";
      if (msg.includes("GEMINI_API_KEY")) {
        setError("AI service not configured. Please set GEMINI_API_KEY in environment.");
      } else if (msg.includes("No assets found")) {
        setError("No assets in environment. Add assets first.");
      } else if (msg.includes("Dev mode")) {
        setError("Dev mode required. Contact admin to enable.");
      } else {
        setError(msg);
      }
      setStep(STEPS.PROMPT);
    } finally {
      setIsSending(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("Clear all?")) return;
    setClearing(true);
    try {
      await clearMockVulnerabilities(envId);
      setMockVulns([]);
      setGeneratedVulns([]);
      setStats(null);
      setStep(STEPS.START);
      setSelectedAssets([]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClearing(false);
    }
  };

  const handleStartOver = () => {
    setStep(STEPS.START);
    setPrompt("");
    setError(null);
    setSelectedAssets([]);
  };

  const totalCount = stats?.total || 0;

  // STEP 1: START
  if (step === STEPS.START) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Mock Vulnerability Generator</h2>
          <p className="text-sm text-gray-500">Select assets to target</p>
        </div>

        <div className="p-5">
          {totalCount > 0 && (
            <div className="flex gap-4 mb-5 pb-4 border-b border-gray-100">
              <div className="text-center">
                <div className="text-xl font-bold text-red-600">
                  {stats?.bySeverity.find(s => s.severity === "CRITICAL")?._count.id || 0}
                </div>
                <div className="text-xs text-gray-500 uppercase">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-orange-600">
                  {stats?.bySeverity.find(s => s.severity === "HIGH")?._count.id || 0}
                </div>
                <div className="text-xs text-gray-500 uppercase">High</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-yellow-600">
                  {stats?.bySeverity.find(s => s.severity === "MEDIUM")?._count.id || 0}
                </div>
                <div className="text-xs text-gray-500 uppercase">Medium</div>
              </div>
              <div className="ml-auto">
                <button
                  onClick={handleClear}
                  disabled={clearing}
                  className="text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded"
                >
                  {clearing ? "..." : "Clear"}
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No assets found</div>
          ) : (
            <>
              <div className="space-y-2 max-h-64 overflow-y-auto mb-4">
                {assets.map((asset) => {
                  const cpes = getCpes(asset);
                  const isExpanded = expandedAssets.has(asset.id);
                  const hasCpes = cpes.length > 0;
                  const assetSelected = isSelected(asset.id);
                  
                  return (
                    <div key={asset.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* Asset Row */}
                      <div 
                        className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                          assetSelected ? 'bg-gray-50' : 'hover:bg-gray-50'
                        }`}
                        onClick={() => !hasCpes && toggleAsset(asset)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={assetSelected}
                            onChange={() => toggleAsset(asset)}
                            className="w-4 h-4 rounded border-gray-300"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div>
                            <div className="font-medium text-sm text-gray-900">{asset.name}</div>
                            <div className="text-xs text-gray-500">{asset.type}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {hasCpes && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(asset.id);
                              }}
                              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                            >
                              {cpes.length} CPEs {isExpanded ? '▲' : '▼'}
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* CPE List */}
                      {isExpanded && hasCpes && (
                        <div className="border-t border-gray-100 bg-gray-50">
                          {cpes.map((cpe, idx) => (
                            <label
                              key={idx}
                              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-100 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected(asset.id, cpe)}
                                onChange={() => toggleAsset(asset, cpe)}
                                className="w-4 h-4 rounded border-gray-300"
                              />
                              <span className="text-xs font-mono text-gray-600 truncate">
                                {getCpeDisplayName(cpe)}
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => setStep(STEPS.SELECT)}
                disabled={selectedAssets.length === 0}
                className="w-full py-3 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-300 text-white rounded-lg font-medium transition-colors"
              >
                Continue ({selectedAssets.length} selected)
              </button>
            </>
          )}

          {mockVulns.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Previous ({mockVulns.length})
              </div>
              <div className="space-y-2">
                {mockVulns.slice(0, 3).map((vuln) => (
                  <div key={vuln.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono">{formatCveId(vuln.cveId)}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs ${getMockSeverityColor(vuln.severity)}`}>
                      {vuln.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // STEP 2: SELECTION SUMMARY + GENERATE PROMPT
  if (step === STEPS.SELECT) {
    const uniqueAssetIds = [...new Set(selectedAssets.map(s => s.assetId))];
    
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Selection</h2>
          <button
            onClick={() => setStep(STEPS.START)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Back
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-sm font-medium text-gray-700 mb-2">
              {selectedAssets.length} items selected
            </div>
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              {uniqueAssetIds.map(assetId => {
                const assetSelections = selectedAssets.filter(s => s.assetId === assetId);
                const name = assetSelections[0]?.assetName || 'Unknown';
                const cpes = assetSelections.filter(s => s.cpeIdentifier).map(s => s.cpeDisplay);
                
                return (
                  <div key={assetId} className="text-sm">
                    <span className="font-medium">{name}</span>
                    {cpes.length > 0 && (
                      <span className="text-gray-500 text-xs ml-2">
                        ({cpes.length} CPEs)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <button
            onClick={handleContinueToPrompt}
            disabled={isGeneratingPrompt}
            className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors"
          >
            {isGeneratingPrompt ? "Generating..." : "Generate Prompt"}
          </button>
        </div>
      </div>
    );
  }

  // STEP 3: PROMPT
  if (step === STEPS.PROMPT) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Review</h2>
          <button
            onClick={handleStartOver}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded text-sm">
              {error}
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-48 p-4 bg-gray-50 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-gray-400 resize-none"
          />

          <div className="flex gap-3">
            <button
              onClick={handleGeneratePrompt}
              disabled={isGeneratingPrompt}
              className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {isGeneratingPrompt ? "..." : "Regenerate"}
            </button>
            <button
              onClick={handleSendToLLM}
              disabled={isSending || !prompt.trim()}
              className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {isSending ? "Sending..." : "Send to AI"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // STEP 4: GENERATING
  if (step === STEPS.GENERATING) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="w-10 h-10 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-gray-900">Generating</h2>
        <p className="text-sm text-gray-500 mt-1">Creating vulnerabilities...</p>
      </div>
    );
  }

  // STEP 5: RESULTS
  if (step === STEPS.RESULTS) {
    return (
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Done</h2>
          <p className="text-sm text-gray-500">{generatedVulns.length} created</p>
        </div>

        <div className="p-5 space-y-3">
          {generatedVulns.map((vuln, idx) => (
            <div key={idx} className="p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm font-medium">{formatCveId(vuln.cveId)}</span>
                <span className={`px-1.5 py-0.5 rounded text-xs ${getMockSeverityColor(vuln.severity)}`}>
                  {vuln.severity}
                </span>
                <span className="px-1.5 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                  MOCK
                </span>
              </div>
              <p className="text-sm text-gray-600">{vuln.description}</p>
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleStartOver}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Generate More
            </button>
            <a
              href={`/environments/${envId}/security`}
              className="flex-1 px-4 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium text-center hover:bg-gray-800"
            >
              View Security
            </a>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function ComingSoonCard({ 
  title, 
  description 
}: { 
  title: string; 
  description: string; 
}) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 opacity-70">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-medium text-gray-900">{title}</h3>
        <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">Soon</span>
      </div>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

export default function DevModePage() {
  const params = useParams();
  const envId = params.envId as string;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-xl font-bold text-gray-900">Dev Mode</h1>
          <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded font-medium">BETA</span>
        </div>
        <p className="text-sm text-gray-500">Testing and development tools</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-amber-800">
          <strong>Note:</strong> Generated data appears in dashboards with "MOCK" labels.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AIVulnGenerator />
        
        <div className="space-y-3">
          <ComingSoonCard
            title="Mock Environment"
            description="Generate complete test environments"
          />
          <ComingSoonCard
            title="Scenario Tester"
            description="Test security dashboard responses"
          />
        </div>
      </div>
    </div>
  );
}
