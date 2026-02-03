'use client';

import { useEffect, useState } from 'react';
import { getHealth, getBackendUrl, getGoogleLoginUrl, type HealthStatus } from "@/lib/api";
import { useUser } from "@/lib/UserContext";
import Link from 'next/link';

export default function Home() {
  const backendUrl = getBackendUrl();
  const { user, loading: userLoading, logout } = useUser();

  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const healthStatus = await getHealth();
        setStatus(healthStatus);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to reach backend");
      }
    };
    loadHealth();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-foreground">
      <div className="w-full max-w-2xl rounded-3xl border border-border bg-surface p-10 shadow-lg">
        <header className="mb-6 flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Tronnium</h1>
          <p className="text-sm text-text-secondary">
            Connected to backend at {backendUrl}
          </p>
        </header>

        {userLoading ? (
          <section className="mb-6 rounded-2xl border border-border bg-surface-secondary p-6">
            <p className="text-text-secondary">Loading...</p>
          </section>
        ) : user ? (
          <section className="mb-6 rounded-2xl border border-border bg-surface-secondary p-6">
            <h2 className="text-lg font-medium text-text-primary">Welcome, {user.name}!</h2>
            <p className="text-sm text-text-secondary">Role: {user.role}</p>
            {user.email && <p className="text-sm text-text-secondary">{user.email}</p>}
            <div className="mt-4 flex gap-3">
              <Link 
                href="/environments" 
                className="rounded-full bg-brand-1 px-4 py-2 text-brand-2 font-medium hover:bg-brand-1/90 transition-colors"
              >
                Go to Environments
              </Link>
              <button
                onClick={logout}
                className="rounded-full bg-error-bg border border-error-border px-4 py-2 text-error-text hover:bg-error-border/50 transition-colors"
              >
                Logout
              </button>
            </div>
          </section>
        ) : (
          <section className="mb-6 rounded-2xl border border-border bg-surface-secondary p-6">
            <h2 className="text-lg font-medium text-text-primary">Login Required</h2>
            <p className="text-sm text-text-secondary mb-4">Sign in with Google to access your environments.</p>
            <a
              href={getGoogleLoginUrl()}
              className="inline-flex rounded-full bg-brand-1 px-4 py-2 text-brand-2 font-medium hover:bg-brand-1/90 transition-colors"
            >
              Login with Google
            </a>
          </section>
        )}

        <section className="rounded-2xl border border-border bg-surface-secondary p-6">
          <h2 className="text-lg font-medium text-text-primary">Backend Status</h2>
          {status ? (
            <dl className="mt-4 grid gap-3 text-sm text-text-secondary">
              <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                <dt className="font-medium">Status</dt>
                <dd className="font-semibold text-success-text">{status.isOk}</dd>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3">
                <dt className="font-medium">Uptime</dt>
                <dd className="font-mono">{Math.floor(status.uptime)}s</dd>
              </div>
            </dl>
          ) : (
            <div className="mt-4 rounded-xl bg-error-bg px-4 py-3 text-sm text-error-text">
              {error ?? "Unable to reach backend"}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
