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
  FiTag,
  FiLoader,
  FiCheckCircle,
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

const TAG_COLORS: Record<string, string> = {
  IT: "bg-blue-500/10 text-blue-400",
  OT: "bg-amber-500/10 text-amber-400",
  "AV:A": "bg-purple-500/10 text-purple-400",
  web: "bg-sky-500/10 text-sky-400",
  database: "bg-emerald-500/10 text-emerald-400",
  cloud: "bg-indigo-500/10 text-indigo-400",
  "CI/CD": "bg-pink-500/10 text-pink-400",
  secrets: "bg-rose-500/10 text-rose-400",
  "zero-trust": "bg-orange-500/10 text-orange-400",
  ICS: "bg-red-500/10 text-red-400",
  SCADA: "bg-red-500/10 text-red-400",
  PLC: "bg-red-500/10 text-red-400",
  MES: "bg-amber-500/10 text-amber-400",
  safety: "bg-yellow-500/10 text-yellow-400",
  robots: "bg-lime-500/10 text-lime-400",
};

function TemplateTag({ tag }: { tag: string }) {
  const cls = TAG_COLORS[tag] ?? "bg-surface-secondary text-text-muted";
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${cls}`}>
      {tag}
    </span>
  );
}

function DemoTemplatesSection({ onSeeded }: { onSeeded: () => void }) {
  const [templates, setTemplates] = useState<SeedTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [seedingId, setSeedingId] = useState<string | null>(null);
  const [seededId, setSeededId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetchSeedTemplates().then((res) => {
      if (res.data) setTemplates(res.data);
      setIsLoading(false);
    });
  }, []);

  const handleSeed = async (templateId: string) => {
    setSeedingId(templateId);
    setSeededId(null);
    try {
      const res = await seedTemplate(templateId);
      if (res.data) {
        setSeededId(templateId);
        setTimeout(() => setSeededId(null), 3000);
        onSeeded();
      }
    } finally {
      setSeedingId(null);
    }
  };

  if (isLoading) return null;
  if (templates.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-3">
        <FiZap className="w-4 h-4 text-brand-1" />
        <h2 className="text-sm font-semibold text-text-primary">Demo Environments</h2>
        <span className="text-xs text-text-muted">— pre-seeded templates for quick testing and showcase</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {templates.map((template) => {
          const isExpanded = expanded === template.id;
          const isSeeding = seedingId === template.id;
          const isSeeded = seededId === template.id;

          return (
            <div
              key={template.id}
              className="rounded-[16px] border border-border bg-surface p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-text-primary truncate">{template.name}</h3>
                  <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{template.description}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {template.tags.map((tag) => (
                  <TemplateTag key={tag} tag={tag} />
                ))}
              </div>

              {isExpanded && (
                <p className="text-xs text-text-muted leading-relaxed border-t border-border pt-3">
                  {template.longDescription}
                </p>
              )}

              <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-border">
                <button
                  onClick={() => setExpanded(isExpanded ? null : template.id)}
                  className="text-[11px] text-text-muted hover:text-text-primary transition-colors"
                >
                  {isExpanded ? "Less" : "Details"}
                </button>

                <button
                  onClick={() => handleSeed(template.id)}
                  disabled={isSeeding || !!seedingId}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSeeded
                      ? "bg-green-500/10 text-green-400"
                      : "bg-brand-1 text-white hover:opacity-90"
                  }`}
                >
                  {isSeeding ? (
                    <>
                      <FiLoader className="w-3 h-3 animate-spin" />
                      Seeding...
                    </>
                  ) : isSeeded ? (
                    <>
                      <FiCheckCircle className="w-3 h-3" />
                      Created
                    </>
                  ) : (
                    <>
                      <FiPlus className="w-3 h-3" />
                      Seed
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
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
