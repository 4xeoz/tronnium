"use client";

import { ReactNode } from "react";
import {
  FiShield,
  FiAlertTriangle,
  FiActivity,
  FiBarChart2,
  FiSearch,
  FiZap,
  FiMessageSquare,
} from "react-icons/fi";

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 bg-brand-1/10 rounded-lg flex items-center justify-center">
          {icon}
        </div>
        <span className="text-text-secondary text-sm">{label}</span>
      </div>
      <span className="text-2xl font-bold text-text-primary">{value}</span>
      {sub && <span className="text-xs text-text-muted ml-2">{sub}</span>}
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-surface rounded-xl border border-border p-8 text-center">
      <div className="w-14 h-14 bg-surface-secondary rounded-full flex items-center justify-center mx-auto mb-3">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1">{title}</h3>
      <p className="text-text-secondary text-sm mb-4 max-w-sm mx-auto">{description}</p>
    </div>
  );
}

export default function SecurityPage() {
  const features = [
    {
      icon: <FiSearch className="w-5 h-5" />,
      title: "Vulnerability Scanning",
      description: "Scan assets for known CVEs using NVD and CPE matching.",
    },
    {
      icon: <FiBarChart2 className="w-5 h-5" />,
      title: "Risk Scoring & CVSS",
      description:
        "Calculated risk scores per asset and environment, with CVSS breakdowns and dependency analysis.",
    },
    {
      icon: <FiMessageSquare className="w-5 h-5" />,
      title: "AI-Powered Analysis",
      description:
        "LLM explains vulnerabilities in plain language, suggests remediation steps, and prioritizes for SOC analysts.",
    },
    {
      icon: <FiZap className="w-5 h-5" />,
      title: "Continuous Monitoring",
      description:
        "Scheduled scans with alerting, trend tracking, and compliance reporting.",
    },
  ];

  return (
    <div className="p-8 h-full overflow-auto space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-brand-1/10 rounded-xl flex items-center justify-center">
          <FiShield className="w-6 h-6 text-brand-1" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">Security</h1>
          <p className="text-text-secondary text-sm mt-0.5">
            Vulnerability scanning, risk scoring, and compliance monitoring for this environment.
          </p>
        </div>
      </div>

      {/* Overview stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<FiAlertTriangle className="w-5 h-5 text-brand-1" />}
          label="Vulnerabilities"
          value="--"
          sub="Not scanned"
        />
        <StatCard
          icon={<FiShield className="w-5 h-5 text-brand-1" />}
          label="Risk Score"
          value="--"
        />
        <StatCard
          icon={<FiActivity className="w-5 h-5 text-brand-1" />}
          label="Last Scan"
          value="Never"
        />
        <StatCard
          icon={<FiBarChart2 className="w-5 h-5 text-brand-1" />}
          label="Compliance"
          value="--"
        />
      </div>

      {/* Feature cards */}
      <div>
        <SectionHeader title="Coming Soon" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-surface rounded-xl border border-border p-5 flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-brand-1/10 flex items-center justify-center shrink-0 text-brand-1">
                {f.icon}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">
                  {f.title}
                </h3>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {f.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      <EmptyState
        icon={<FiShield className="w-6 h-6 text-text-muted" />}
        title="Security analysis not configured"
        description="Once vulnerability scanning is enabled, risk scores, CVE details, and AI-powered remediation advice will appear here."
      />
    </div>
  );
}
