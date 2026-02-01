'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, getBackendUrl, type HealthResponse } from "@/lib/backend";
import { useUser } from "@/lib/UserContext";
import Link from 'next/link';

export default function Home() {
  const backendUrl = getBackendUrl();
  const { user, loading: userLoading , logout} = useUser();

  const [status, setStatus] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadHealth = async () => {
      try {
        const healthStatus = await fetchHealth();
        setStatus(healthStatus);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to reach backend";
        setError(message);
      }
    };

    loadHealth();
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-100 px-6 py-16 text-slate-900">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 shadow-lg shadow-slate-200/60">
        <header className="mb-6 flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Tronnium Dashboard</h1>
          <p className="text-sm text-slate-500">
            Frontend is connected to the backend at {backendUrl}.
          </p>
        </header>

        {userLoading ? (
          <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-6">
            <h2 className="text-lg font-medium text-slate-700">Loading...</h2>
          </section>
        ) : user ? (
          <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-6">
            <h2 className="text-lg font-medium text-slate-700">Welcome, {user.name}!</h2>
            <p className="text-sm text-slate-600">Role: {user.role}</p>
            {user.email && <p className="text-sm text-slate-600">Email: {user.email}</p>}
            <button
              onClick={logout}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-white transition hover:bg-red-700"
            >
              Logout
            </button>
            <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700">
              Go to Dashboard
            </Link>
          </section>
        ) : (
          <section className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-6">
            <h2 className="text-lg font-medium text-slate-700">Login Required</h2>
            <p className="text-sm text-slate-600 mb-4">Please log in with Google to access the dashboard.</p>
            <a
              href={`${backendUrl}/auth/google`}
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
            >
              Login with Google
            </a>
          </section>
        )}

        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-6">
          <h2 className="text-lg font-medium text-slate-700">Backend Health</h2>
          {status ? (
            <dl className="mt-4 grid gap-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-xl bg-white/80 px-4 py-3">
                <dt className="font-medium">Status</dt>
                <dd className="font-semibold text-emerald-600">{status.isOk}</dd>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/80 px-4 py-3">
                <dt className="font-medium">Uptime</dt>
                <dd className="font-mono">
                  {Math.floor(status.uptime)} seconds
                </dd>
              </div>
            </dl>
          ) : (
            <div className="mt-4 rounded-xl bg-white/80 px-4 py-3 text-sm text-red-600">
              {error ?? "Unable to read backend status."}
            </div>
          )}
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
          <span>
            Need to adjust the backend URL? Update <code>NEXT_PUBLIC_BACKEND_URL</code> in your environment.
          </span>
          <a
            href="https://nextjs.org/docs"
            className="rounded-full bg-slate-900 px-4 py-2 text-white transition hover:bg-slate-700"
            target="_blank"
            rel="noreferrer"
          >
            Next.js Docs
          </a>
        </footer>
      </div>
    </main>
  );
}
