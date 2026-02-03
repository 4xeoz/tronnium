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
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6 py-16 text-slate-900">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 shadow-lg shadow-slate-200/60">
        <header className="mb-6 flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Tronnium</h1>
          <p className="text-sm text-slate-500">
            Connected to backend at {backendUrl}
          </p>
        </header>

        {userLoading ? (
          <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-6">
            <p className="text-slate-600">Loading...</p>
          </section>
        ) : user ? (
          <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-6">
            <h2 className="text-lg font-medium text-slate-700">Welcome, {user.name}!</h2>
            <p className="text-sm text-slate-600">Role: {user.role}</p>
            {user.email && <p className="text-sm text-slate-600">{user.email}</p>}
            <div className="mt-4 flex gap-3">
              <Link 
                href="/environments" 
                className="rounded-full bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Go to Environments
              </Link>
              <button
                onClick={logout}
                className="rounded-full bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </section>
        ) : (
          <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-6">
            <h2 className="text-lg font-medium text-slate-700">Login Required</h2>
            <p className="text-sm text-slate-600 mb-4">Sign in with Google to access your environments.</p>
            <a
              href={getGoogleLoginUrl()}
              className="inline-flex rounded-full bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Login with Google
            </a>
          </section>
        )}

        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
          <h2 className="text-lg font-medium text-slate-700">Backend Status</h2>
          {status ? (
            <dl className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-xl bg-white/80 px-4 py-3">
                <dt className="font-medium">Status</dt>
                <dd className="font-semibold text-emerald-600">{status.isOk}</dd>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/80 px-4 py-3">
                <dt className="font-medium">Uptime</dt>
                <dd className="font-mono">{Math.floor(status.uptime)}s</dd>
              </div>
            </dl>
          ) : (
            <div className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm text-red-600">
              {error ?? "Unable to reach backend"}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
