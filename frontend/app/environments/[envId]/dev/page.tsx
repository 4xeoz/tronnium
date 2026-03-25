"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { FiCode, FiAlertTriangle, FiZap, FiTerminal, FiCpu, FiSend, FiRefreshCw, FiShield } from "react-icons/fi";

// Dummy AI Vulnerability Generator Component
function AIVulnGenerator() {
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVulns, setGeneratedVulns] = useState<Array<{
    cveId: string;
    severity: string;
    description: string;
    asset: string;
  }>>([]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Dummy generated vulnerabilities
    const dummyVulns = [
      {
        cveId: "CVE-2024-DEV-001",
        severity: "CRITICAL",
        description: "Remote code execution vulnerability in Apache Tomcat 9.0.x - Allows attackers to execute arbitrary code via crafted JSP file upload.",
        asset: "Web Server (Apache Tomcat)",
      },
      {
        cveId: "CVE-2024-DEV-002",
        severity: "HIGH",
        description: "SQL injection vulnerability in MySQL connector - Potential data exfiltration through malformed query parameters.",
        asset: "Database Server (MySQL)",
      },
      {
        cveId: "CVE-2024-DEV-003",
        severity: "MEDIUM",
        description: "Information disclosure via verbose error messages in API responses.",
        asset: "API Gateway",
      },
    ];
    
    setGeneratedVulns((prev) => [...dummyVulns, ...prev]);
    setIsGenerating(false);
    setPrompt("");
  };

  const severityColors: Record<string, string> = {
    CRITICAL: "bg-red-500 text-white",
    HIGH: "bg-orange-500 text-white",
    MEDIUM: "bg-yellow-500 text-black",
    LOW: "bg-blue-500 text-white",
  };

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="p-4 border-b border-border bg-purple-500/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <FiZap className="w-5 h-5 text-purple-500" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">AI Vulnerability Generator</h3>
            <p className="text-xs text-text-muted">Generate fake CVEs for testing using AI prompts</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary">
            Describe what vulnerabilities to generate
          </label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'Generate 3 critical vulnerabilities for Apache servers with remote code execution' or 'Create vulnerabilities for a financial system with SQL injection issues'..."
              className="w-full h-24 p-3 bg-surface-secondary border border-border rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            />
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="absolute bottom-3 right-3 px-3 py-1.5 bg-purple-500 text-white rounded-md text-xs font-medium hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isGenerating ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FiSend className="w-3 h-3" />
                  Generate
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Prompts */}
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-text-muted">Quick prompts:</span>
          {[
            "Critical RCE vulnerabilities",
            "Database injection issues",
            "Network misconfigurations",
            "API security flaws",
          ].map((quickPrompt) => (
            <button
              key={quickPrompt}
              onClick={() => setPrompt(`Generate ${quickPrompt} for testing purposes`)}
              className="px-2 py-1 bg-surface-secondary hover:bg-purple-500/10 border border-border hover:border-purple-500/30 rounded text-[10px] text-text-muted hover:text-purple-500 transition-colors"
            >
              {quickPrompt}
            </button>
          ))}
        </div>

        {/* Generated Vulnerabilities */}
        {generatedVulns.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-text-secondary">Generated Vulnerabilities</h4>
              <button
                onClick={() => setGeneratedVulns([])}
                className="text-xs text-text-muted hover:text-error-text flex items-center gap-1"
              >
                <FiRefreshCw className="w-3 h-3" />
                Clear
              </button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {generatedVulns.map((vuln, idx) => (
                <div
                  key={`${vuln.cveId}-${idx}`}
                  className="p-3 bg-surface-secondary rounded-lg border border-border hover:border-purple-500/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-text-primary">{vuln.cveId}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityColors[vuln.severity]}`}>
                          {vuln.severity}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary line-clamp-2">{vuln.description}</p>
                      <p className="text-[10px] text-text-muted mt-1">Target: {vuln.asset}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-info-bg/50 border border-info-border rounded-lg p-3 flex gap-3">
          <FiTerminal className="w-4 h-4 text-info-text flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs text-info-text font-medium">Demo Mode Active</p>
            <p className="text-[10px] text-info-text/80 mt-0.5">
              These vulnerabilities are not real and are only stored in memory for this session. 
              No actual CVE data is created or saved to the database.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Coming Soon Feature Card
function ComingSoonCard({ 
  title, 
  description, 
  icon: Icon 
}: { 
  title: string; 
  description: string; 
  icon: React.ElementType;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 opacity-60">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center">
          <Icon className="w-5 h-5 text-text-muted" />
        </div>
        <div>
          <h3 className="font-medium text-text-primary">{title}</h3>
          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-500 text-[10px] rounded-full">Coming Soon</span>
        </div>
      </div>
      <p className="text-xs text-text-muted">{description}</p>
    </div>
  );
}

export default function DevModePage() {
  const params = useParams();
  const envId = params.envId as string;

  return (
    <div className="p-6 h-full flex flex-col max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <FiCode className="w-6 h-6 text-purple-500" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text-primary">Developer Mode</h1>
            <span className="px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full font-medium">
              BETA
            </span>
          </div>
          <p className="text-text-secondary text-sm mt-0.5">
            Experimental features for testing, development, and exploring application capabilities.
          </p>
        </div>
      </div>

      {/* Warning Banner */}
      <div className="bg-warning-bg/50 border border-warning-border rounded-xl p-4 flex gap-4 mb-6">
        <FiAlertTriangle className="w-6 h-6 text-warning-text flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-warning-text">Development Environment</h3>
          <p className="text-xs text-warning-text/80 mt-1">
            Features on this page are intended for testing and experimentation only. 
            Generated data is simulated and does not represent real security vulnerabilities. 
            Use responsibly and never use generated data for production security decisions.
          </p>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        {/* Left Column */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-1">
          <AIVulnGenerator />
          
          <ComingSoonCard
            title="Mock Data Generator"
            description="Generate complete mock environments with realistic asset configurations, relationships, and scan histories for testing."
            icon={FiCpu}
          />
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6 overflow-y-auto pr-1">
          <ComingSoonCard
            title="Security Playground"
            description="Test different security scenarios and see how the dashboard responds to various vulnerability combinations and severity levels."
            icon={FiShield}
          />
          
          <ComingSoonCard
            title="Performance Stress Test"
            description="Simulate high-load scenarios with thousands of assets and vulnerabilities to test dashboard performance and rendering limits."
            icon={FiTerminal}
          />

          {/* Debug Info */}
          <div className="bg-surface rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-2">
              <FiTerminal className="w-4 h-4" />
              Debug Information
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-text-muted">Environment ID:</span>
                <span className="text-text-primary">{envId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Dev Mode:</span>
                <span className="text-green-500">Active</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">API Version:</span>
                <span className="text-text-primary">v1.0.0-beta</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Build:</span>
                <span className="text-text-primary">dev-{new Date().toISOString().slice(0, 10)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
