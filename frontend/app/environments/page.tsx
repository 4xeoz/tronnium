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
} from "react-icons/fi";
import { getEnvironments, deleteEnvironment, type Environment } from "@/lib/api";
import CreateEnvironmentSlideOver from "@/components/environments/CreateEnvironmentSlideOver";

// ============== Stats Row ==============

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
        <div
          key={stat.label}
          className="flex items-center gap-4 p-4 rounded-lg border border-border bg-surface"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-secondary">
            <stat.icon className="w-5 h-5 text-text-muted" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-text-primary">{stat.value}</p>
            <p className="text-sm text-text-muted">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============== Dropdown Menu ==============

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
        className="p-2 rounded-md hover:bg-surface-secondary transition-colors opacity-0 group-hover:opacity-100"
      >
        {children}
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-surface border border-border rounded-lg shadow-lg py-1 z-50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onView();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-surface-secondary transition-colors"
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

// ============== Environment Row ==============

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
      className="group flex items-center justify-between px-4 py-3 hover:bg-surface-secondary/50 transition-colors border-b border-border last:border-b-0 cursor-pointer"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-secondary shrink-0">
          <FiBox className="w-4 h-4 text-text-muted" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-text-primary truncate">
              {environment.name}
            </h3>
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-status-active" />
              Active
            </span>
          </div>
          {environment.description && (
            <p className="text-xs text-text-muted truncate mt-0.5">
              {environment.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden sm:flex items-center gap-6 text-xs text-text-muted">
          <span className="w-20">{environment.assetCount ?? 0} assets</span>
          {environment.labels && environment.labels.length > 0 && (
            <div className="flex gap-1">
              {environment.labels.slice(0, 2).map((label) => (
                <span
                  key={label}
                  className="px-1.5 py-0.5 bg-surface-secondary text-text-muted text-xs rounded"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        <DropdownMenu
          onView={onClick}
          onDelete={onDelete}
          isDeleting={isDeleting}
        >
          <FiMoreHorizontal className="w-4 h-4 text-text-muted" />
        </DropdownMenu>

        <FiChevronRight className="w-4 h-4 text-text-muted" />
      </div>
    </div>
  );
}

// ============== Empty State ==============

function EmptyState({ onCreateNew }: { onCreateNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-surface-secondary mb-4">
        <FiLayers className="w-6 h-6 text-text-muted" />
      </div>
      <h3 className="text-sm font-medium text-text-primary mb-1">No environments</h3>
      <p className="text-sm text-text-muted mb-4 text-center max-w-sm">
        Create your first environment to start monitoring your infrastructure.
      </p>
      <button
        onClick={onCreateNew}
        className="flex items-center gap-2 px-4 py-2 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
      >
        <FiPlus className="w-4 h-4" />
        New Environment
      </button>
    </div>
  );
}

// ============== Main Page ==============

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
      const data = await getEnvironments();
      setEnvironments(data);
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
    <div className="p-6 lg:p-8 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-text-primary mb-1">Environments</h1>
          <p className="text-sm text-text-muted">
            Manage and monitor your security environments
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <StatsRow environments={environments} />
        </div>

        {/* Environments List */}
        <div className="rounded-lg border border-border bg-surface ">
          {/* List Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="relative w-64">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Search environments..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-surface-secondary border-0 rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-border"
              />
            </div>
            <button
              onClick={() => setIsSlideOverOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brand-1 text-brand-2 rounded-lg text-sm font-medium hover:bg-brand-1/90 transition-colors"
            >
              <FiPlus className="w-4 h-4" />
              New
            </button>
          </div>

          {/* List Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin w-8 h-8 border-4 border-text-muted border-t-transparent rounded-full" />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-sm text-error-text mb-2">{error}</p>
              <button
                onClick={loadEnvironments}
                className="text-sm text-text-primary hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filteredEnvironments.length === 0 ? (
            searchQuery ? (
              <div className="py-12 text-center">
                <p className="text-sm text-text-muted">
                  No environments match &quot;{searchQuery}&quot;
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-sm text-text-primary hover:underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <EmptyState onCreateNew={() => setIsSlideOverOpen(true)} />
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
      </div>

      {/* Slide-over panel */}
      <CreateEnvironmentSlideOver
        isOpen={isSlideOverOpen}
        onClose={() => setIsSlideOverOpen(false)}
        onSuccess={loadEnvironments}
      />
    </div>
  );
}
