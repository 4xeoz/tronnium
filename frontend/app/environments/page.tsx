"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FiPlus,
  FiBox,
  FiSearch,
  FiShield,
  FiActivity,
  FiLayers,
  FiChevronRight,
  FiTrash2,
  FiMoreHorizontal,
  FiEye,
  FiZap,
  FiLoader,
  FiCheckCircle,
  FiInfo,
  FiServer,
  FiCpu,
} from "react-icons/fi";
import { fetchEnvironments, deleteEnvironment, type Environment } from "@/lib/api";
import CreateEnvironmentSlideOver from "@/components/environments/CreateEnvironmentSlideOver";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { fetchSeedTemplates, seedTemplate, type SeedTemplate } from "@/lib/api/dev";

function StatsRow({ environments }: { environments: Environment[] }) {
  const totalAssets = environments.reduce((acc, env) => acc + (env.assetCount ?? 0), 0);
  const stats = [
    { label: "Environments", value: environments.length, icon: FiLayers },
    { label: "Total Assets", value: totalAssets, icon: FiBox },
    { label: "Security Score", value: "98%", icon: FiShield },
    { label: "Uptime", value: "99.9%", icon: FiActivity },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          icon={<stat.icon className="w-5 h-5" />}
          label={stat.label}
          value={stat.value}
        />
      ))}
    </div>
  );
}

function DropdownMenu({
  children,
  onView,
  onDelete,
  isDeleting,
}: {
  children: React.ReactNode;
  onView: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="w-8 h-8 rounded-full flex items-center justify-center border border-transparent text-text-muted hover:text-text-primary hover:border-border hover:bg-surface-secondary transition-all opacity-0 group-hover:opacity-100 active:scale-95"
      >
        {children}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-surface border border-border rounded-[16px] shadow-[var(--shadow-card)] py-1 z-50 animate-[fadeIn_100ms_ease]">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-background-secondary transition-colors"
          >
            <FiEye className="w-4 h-4" />
            View Details
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setIsOpen(false);
            }}
            disabled={isDeleting}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error-text hover:bg-error-bg transition-colors"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-error-text border-t-transparent rounded-full animate-spin" />
            ) : (
              <FiTrash2 className="w-4 h-4" />
            )}
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function EnvironmentRow({
  environment,
  onDelete,
  onClick,
  isDeleting,
}: {
  environment: Environment;
  onDelete: () => void;
  onClick: () => void;
  isDeleting: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className="group flex items-center justify-between px-4 py-3 hover:bg-background-secondary/50 transition-colors border-b border-border last:border-b-0 cursor-pointer"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-background-secondary shrink-0">
          <FiBox className="w-4 h-4 text-text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">{environment.name}</h3>
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active" />
              Active
            </span>
          </div>
          {environment.description && (
            <p className="text-xs text-text-muted truncate mt-0.5">{environment.description}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-6 text-xs text-text-muted">
          <span className="w-20">{environment.assetCount ?? 0} assets</span>
          {environment.labels && environment.labels.length > 0 && (
            <div className="flex gap-1">
              {environment.labels.slice(0, 2).map((label) => (
                <Badge key={label} variant="neutral" size="sm">{label}</Badge>
              ))}
            </div>
          )}
        </div>

        <DropdownMenu onView={onClick} onDelete={onDelete} isDeleting={isDeleting}>
          <FiMoreHorizontal className="w-4 h-4" />
        </DropdownMenu>

        <FiChevronRight className="w-4 h-4 text-text-muted" />
      </div>
    </div>
  );
}

// ── Per-template visual config ────────────────────────────────────────────────

const TEMPLATE_CONFIG: Record<string, {
  icon: React.ElementType;
  domain: string;
  iconBg: string;
  iconColor: string;
  domainBg: string;
  domainText: string;
}> = {
  "enterprise-it":       { icon: FiServer,   domain: "IT", iconBg: "bg-blue-500/10",   iconColor: "text-blue-400",   domainBg: "bg-blue-500/10",   domainText: "text-blue-400"   },
  "cloud-microservices": { icon: FiLayers,   domain: "IT", iconBg: "bg-indigo-500/10", iconColor: "text-indigo-400", domainBg: "bg-indigo-500/10", domainText: "text-indigo-400" },
  "zero-trust-failure":  { icon: FiShield,   domain: "IT", iconBg: "bg-rose-500/10",   iconColor: "text-rose-400",   domainBg: "bg-rose-500/10",   domainText: "text-rose-400"   },
  "ot-power-grid":       { icon: FiZap,      domain: "OT", iconBg: "bg-amber-500/10",  iconColor: "text-amber-400",  domainBg: "bg-amber-500/10",  domainText: "text-amber-400"  },
  "ot-manufacturing":    { icon: FiCpu,      domain: "OT", iconBg: "bg-orange-500/10", iconColor: "text-orange-400", domainBg: "bg-orange-500/10", domainText: "text-orange-400" },
};

const TAG_COLORS: Record<string, string> = {
  IT: "bg-blue-500/10 text-blue-400",
  OT: "bg-amber-500/10 text-amber-400",
  "AV:A": "bg-purple-500/10 text-purple-400",
  web: "bg-sky-500/10 text-sky-400",
  database: "bg-emerald-500/10 text-emerald-400",
  cloud: "bg-indigo-500/10 text-indigo-400",
  containers: "bg-cyan-500/10 text-cyan-400",
  microservices: "bg-indigo-500/10 text-indigo-400",
  "CI/CD": "bg-pink-500/10 text-pink-400",
  secrets: "bg-rose-500/10 text-rose-400",
  "zero-trust": "bg-orange-500/10 text-orange-400",
  ICS: "bg-red-500/10 text-red-400",
  SCADA: "bg-red-500/10 text-red-400",
  PLC: "bg-red-500/10 text-red-400",
  MES: "bg-amber-500/10 text-amber-400",
  safety: "bg-yellow-500/10 text-yellow-400",
  robots: "bg-lime-500/10 text-lime-400",
  manufacturing: "bg-orange-500/10 text-orange-400",
  "credential-theft": "bg-rose-500/10 text-rose-400",
};

type SeedResultEntry = {
  environmentId: string;
  environmentName: string;
  summary: { assets: number; vulnerabilities: number; relationships: number };
};

function TemplateTag({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag] ?? "bg-surface-secondary text-text-muted";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {tag}
    </span>
  );
}

function StatChip({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-background-secondary rounded-lg p-2.5 text-center flex-1">
      <div className="text-sm font-bold text-text-primary tabular-nums">{value}</div>
      <div className="text-[10px] text-text-muted mt-0.5">{label}</div>
    </div>
  );
}

function TemplateCard({
  template,
  onSeed,
  isSeeding,
  anySeeding,
  result,
  onNavigate,
  onSeedAgain,
}: {
  template: SeedTemplate;
  onSeed: () => void;
  isSeeding: boolean;
  anySeeding: boolean;
  result: SeedResultEntry | null;
  onNavigate: (envId: string, path: string) => void;
  onSeedAgain: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const cfg = TEMPLATE_CONFIG[template.id] ?? {
    icon: FiBox,
    domain: "IT",
    iconBg: "bg-surface-secondary",
    iconColor: "text-text-muted",
    domainBg: "bg-surface-secondary",
    domainText: "text-text-muted",
  };
  const Icon = cfg.icon;

  // ── Success state ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="rounded-[16px] border border-green-500/25 bg-surface p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-green-500/10">
            <FiCheckCircle className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Environment ready</p>
            <p className="text-xs text-text-muted">{result.environmentName}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <StatChip value={result.summary.assets} label="assets" />
          <StatChip value={result.summary.vulnerabilities} label="vulnerabilities" />
          <StatChip value={result.summary.relationships} label="edges" />
        </div>

        <p className="text-xs text-text-muted leading-relaxed">
          The environment is fully configured. Open the Asset Map to run blast radius analysis and explore attack paths, or start at the Dashboard for a vulnerability overview.
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onNavigate(result.environmentId, "map")}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-1 text-white text-xs font-semibold hover:opacity-90 transition-opacity active:scale-[0.98]"
          >
            <FiActivity className="w-3.5 h-3.5" />
            Open Asset Map & Attack Paths
          </button>
          <button
            onClick={() => onNavigate(result.environmentId, "dashboard")}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-background-secondary text-text-primary text-xs font-medium hover:bg-surface-secondary transition-colors active:scale-[0.98]"
          >
            <FiShield className="w-3.5 h-3.5" />
            Go to Dashboard
          </button>
        </div>

        <button
          onClick={onSeedAgain}
          className="text-[11px] text-text-muted hover:text-text-primary transition-colors text-center"
        >
          Seed another copy of this template
        </button>
      </div>
    );
  }

  // ── Seeding state ──────────────────────────────────────────────────────────
  if (isSeeding) {
    return (
      <div className="rounded-[16px] border border-border bg-surface p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
            <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{template.name}</p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded inline-block mt-0.5 ${cfg.domainBg} ${cfg.domainText}`}>
              {cfg.domain}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <div className="w-8 h-8 border-2 border-brand-1 border-t-transparent rounded-full animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-text-primary">Creating environment...</p>
            <p className="text-xs text-text-muted leading-relaxed">
              Seeding {template.stats.assets} assets and {template.stats.vulnerabilities} vulnerabilities,<br />
              wiring {template.stats.relationships} relationship edges.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Default state ──────────────────────────────────────────────────────────
  return (
    <div className="rounded-[16px] border border-border bg-surface p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
          <Icon className={`w-4 h-4 ${cfg.iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-text-primary">{template.name}</h3>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.domainBg} ${cfg.domainText}`}>
              {cfg.domain}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-1 leading-relaxed">{template.description}</p>
        </div>
      </div>

      {/* What gets created */}
      <div className="flex gap-2">
        <StatChip value={template.stats.assets} label="assets" />
        <StatChip value={template.stats.vulnerabilities} label="vulnerabilities" />
        <StatChip value={template.stats.relationships} label="edges" />
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        {template.tags.map((tag) => (
          <TemplateTag key={tag} tag={tag} />
        ))}
      </div>

      {/* Expandable: what you'll explore */}
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary transition-colors font-medium"
        >
          <FiChevronRight className={`w-3 h-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
          What you'll explore
        </button>
        {expanded && (
          <p className="mt-2.5 text-xs text-text-muted leading-relaxed pl-4 border-l-2 border-border">
            {template.longDescription}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-border mt-auto gap-3">
        <p className="text-[10px] text-text-muted leading-tight">
          Saved to your account<br />
          <span className="text-text-muted/60">Deletable anytime from this list</span>
        </p>
        <button
          onClick={onSeed}
          disabled={anySeeding}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-1 text-white text-xs font-semibold hover:opacity-90 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <FiPlus className="w-3 h-3" />
          Seed
        </button>
      </div>
    </div>
  );
}

function DemoTemplatesSection({ onSeeded }: { onSeeded: () => void }) {
  const router = useRouter();
  const [templates, setTemplates] = useState<SeedTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seedingId, setSeedingId] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, SeedResultEntry>>({});

  useEffect(() => {
    fetchSeedTemplates().then((res) => {
      if (res.data) setTemplates(res.data);
      setIsLoading(false);
    });
  }, []);

  const handleSeed = async (templateId: string) => {
    setSeedingId(templateId);
    try {
      const res = await seedTemplate(templateId);
      if (res.data) {
        setResults((prev) => ({
          ...prev,
          [templateId]: {
            environmentId: res.data!.environmentId,
            environmentName: res.data!.environmentName,
            summary: res.data!.summary,
          },
        }));
        onSeeded();
      }
    } finally {
      setSeedingId(null);
    }
  };

  const handleNavigate = (envId: string, path: string) => {
    router.push(`/environments/${envId}/${path}`);
  };

  const handleSeedAgain = (templateId: string) => {
    setResults((prev) => {
      const next = { ...prev };
      delete next[templateId];
      return next;
    });
  };

  if (isLoading) return null;
  if (templates.length === 0) return null;

  return (
    <div className="mt-10">
      {/* Section header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <FiZap className="w-4 h-4 text-brand-1" />
          <h2 className="text-sm font-semibold text-text-primary">Demo Environments</h2>
        </div>
        <p className="text-xs text-text-muted leading-relaxed">
          Pre-built templates loaded with realistic assets, CVSS-scored vulnerabilities, and typed relationship edges.
          Ready to explore attack paths, blast radius, and entry point detection — no manual setup needed.
        </p>
      </div>

      {/* Info callout */}
      <div className="flex gap-3 p-4 rounded-[16px] bg-brand-1/5 border border-brand-1/15 mb-5">
        <FiInfo className="w-4 h-4 text-brand-1 shrink-0 mt-0.5" />
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-text-primary">What happens when you seed?</p>
          <p className="text-xs text-text-muted leading-relaxed">
            A new environment is created in your account with pre-configured assets, real CVSS vectors and EPSS scores on each vulnerability, and typed relationship edges (network connections, auth dependencies, code execution paths, etc.). The graph traversal engine runs immediately — open the Asset Map to see detected entry points, reachable blast radius, and scored attack paths.
          </p>
          <p className="text-xs text-text-muted leading-relaxed">
            Each seed is isolated and independent. You can seed the same template multiple times — CVE IDs are randomized to avoid conflicts. Delete any environment from this list when you&apos;re done.
          </p>
        </div>
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            onSeed={() => handleSeed(template.id)}
            isSeeding={seedingId === template.id}
            anySeeding={seedingId !== null}
            result={results[template.id] ?? null}
            onNavigate={handleNavigate}
            onSeedAgain={() => handleSeedAgain(template.id)}
          />
        ))}
      </div>
    </div>
  );
}

export default function EnvironmentsPage() {
  const router = useRouter();
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSlideOverOpen, setIsSlideOverOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadEnvironments = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchEnvironments();
      
      setEnvironments(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load environments");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEnvironments();
  }, [loadEnvironments]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this environment?")) return;
    setDeletingId(id);
    try {
      await deleteEnvironment(id);
      setEnvironments((prev) => prev.filter((env) => env.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete environment");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEnvironmentClick = (envId: string) => {
    router.push(`/environments/${envId}/dashboard`);
  };

  const filteredEnvironments = useMemo(
    () =>
      environments.filter(
        (env) =>
          env.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          env.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [environments, searchQuery]
  );

  return (
    <div className="p-8 h-full overflow-auto max-w-7xl mx-auto">
      <PageHeader
        title="Environments"
        subtitle="Manage and monitor your security environments"
      />

      <div className="mb-8">
        <StatsRow environments={environments} />
      </div>

      <div className="rounded-[24px] border border-border bg-surface ">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="relative w-72">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <Input
              type="text"
              placeholder="Search environments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button size="sm" onClick={() => setIsSlideOverOpen(true)}>
            <FiPlus className="w-4 h-4" />
            New
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-4 border-brand-1 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-sm text-error-text mb-2">{error}</p>
            <button onClick={loadEnvironments} className="text-sm text-text-primary hover:underline font-medium">
              Try again
            </button>
          </div>
        ) : filteredEnvironments.length === 0 ? (
          searchQuery ? (
            <div className="py-12 text-center">
              <p className="text-sm text-text-muted">No environments match &quot;{searchQuery}&quot;</p>
              <button onClick={() => setSearchQuery("")} className="mt-2 text-sm text-text-primary hover:underline font-medium">
                Clear search
              </button>
            </div>
          ) : (
            <EmptyState
              icon={<FiLayers className="w-7 h-7" />}
              title="No environments"
              description="Create your first environment to start monitoring your infrastructure."
              action={
                <Button size="sm" onClick={() => setIsSlideOverOpen(true)}>
                  <FiPlus className="w-4 h-4" />
                  New Environment
                </Button>
              }
            />
          )
        ) : (
          <div>
            {filteredEnvironments.map((env) => (
              <EnvironmentRow
                key={env.id}
                environment={env}
                onDelete={() => handleDelete(env.id)}
                onClick={() => handleEnvironmentClick(env.id)}
                isDeleting={deletingId === env.id}
              />
            ))}
          </div>
        )}
      </div>

      <DemoTemplatesSection onSeeded={loadEnvironments} />

      <CreateEnvironmentSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onSuccess={loadEnvironments}
      />
    </div>
  );
}
