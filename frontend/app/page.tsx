'use client';

import { useUser } from "@/lib/UserContext";
import { getGoogleLoginUrl } from "@/lib/api";
import Link from "next/link";
import Image from "next/image";
import {
  FiShield,
  FiRefreshCw,
  FiGrid,
  FiArrowRight,
  FiLogOut,
} from "react-icons/fi";

// ── Feature card data ──────────────────────────────────────────
const FEATURES = [
  {
    icon: FiRefreshCw,
    title: "Continuous Scanning",
    description:
      "Schedule automated scans across all your environments. Never miss a new vulnerability — our engine runs on your cadence.",
  },
  {
    icon: FiShield,
    title: "AI-Powered Analysis",
    description:
      "Get instant briefings, root cause analysis, and prioritized remediation steps from our built-in AI security analyst.",
  },
  {
    icon: FiGrid,
    title: "Multi-Environment",
    description:
      "Manage dozens of environments from one dashboard. Group by team, region, or whatever structure makes sense for you.",
  },
];

// ── Stats data ─────────────────────────────────────────────────
const STATS = [
  { value: "99.9%", label: "Scan accuracy" },
  { value: "<2 min", label: "Avg scan time" },
  { value: "CVE++", label: "Vulnerability coverage" },
];

// ── How it works steps ─────────────────────────────────────────
const STEPS = [
  {
    num: "01",
    title: "Connect your environment",
    body: "Point Tronnium at your infrastructure targets — cloud, on-prem, or hybrid.",
  },
  {
    num: "02",
    title: "Run a scan",
    body: "Trigger instantly or schedule a recurring cadence. Results arrive in minutes.",
  },
  {
    num: "03",
    title: "Act on findings",
    body: "AI triage surfaces what matters. Assign, remediate, and track to closure.",
  },
];

// ══════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════

export default function Home() {
  const { user, loading: userLoading, logout } = useUser();

  const ctaHref = user ? "/environments" : getGoogleLoginUrl();
  const ctaLabel = user ? "Go to App" : "Get started free";
  const isExternal = !user; // Google OAuth is an external href

  return (
    <div className="min-h-screen bg-background text-text-primary">
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo + wordmark */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="relative w-8 h-8 rounded-full overflow-hidden shrink-0">
              <Image src="/Tronnium_Main.png" alt="Tronnium" fill className="object-cover" />
            </div>
            <span className="text-base font-semibold tracking-tight text-text-primary">Tronnium</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {userLoading ? (
              <div className="w-5 h-5 border-2 border-brand-1 border-t-transparent rounded-full animate-spin" />
            ) : user ? (
              <>
                <span className="text-sm text-text-muted hidden sm:block">{user.name}</span>
                <Link
                  href="/environments"
                  className="px-4 py-2 rounded-full bg-brand-1 text-brand-2 text-sm font-semibold btn-wise"
                >
                  Go to App
                </Link>
                <button
                  onClick={logout}
                  className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface-secondary transition-colors"
                  title="Logout"
                >
                  <FiLogOut className="w-4 h-4 text-text-muted" />
                </button>
              </>
            ) : (
              <a
                href={getGoogleLoginUrl()}
                className="px-4 py-2 rounded-full bg-brand-1 text-brand-2 text-sm font-semibold btn-wise"
              >
                Sign in
              </a>
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-24 pb-20 md:pt-32 md:pb-28">
        {/* Decorative blob */}
        <div
          className="pointer-events-none absolute -top-32 right-0 w-[600px] h-[600px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #9fe870 0%, transparent 70%)",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6">
          <div className="max-w-4xl">
            {/* Eyebrow pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-mint border border-brand-1/30 text-brand-2 text-xs font-semibold mb-8 dark:bg-brand-mint/10 dark:text-brand-1 dark:border-brand-1/20">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-1 inline-block" />
              Automated infrastructure security
            </div>

            {/* Headline */}
            <h1 className="text-display text-5xl sm:text-6xl md:text-7xl lg:text-[88px] text-text-primary mb-6">
              Security scanning
              <br />
              for{" "}
              <span className="text-brand-1">modern infra.</span>
            </h1>

            {/* Sub-headline */}
            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mb-10 leading-relaxed">
              Tronnium continuously scans your environments, surfaces critical vulnerabilities, and gives your
              team AI-powered remediation guidance — all from one dashboard.
            </p>

            {/* CTA row */}
            <div className="flex flex-wrap items-center gap-4">
              {isExternal ? (
                <a
                  href={ctaHref}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-brand-1 text-brand-2 font-semibold text-sm btn-wise"
                >
                  {ctaLabel}
                  <FiArrowRight className="w-4 h-4" />
                </a>
              ) : (
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-brand-1 text-brand-2 font-semibold text-sm btn-wise"
                >
                  {ctaLabel}
                  <FiArrowRight className="w-4 h-4" />
                </Link>
              )}
              <a
                href="#how"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-border text-text-secondary font-semibold text-sm btn-wise hover:border-border-secondary hover:text-text-primary transition-colors"
              >
                See how it works
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ───────────────────────────────────────── */}
      <div className="border-y border-border bg-surface-secondary/50">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-3 gap-8">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl md:text-4xl font-black text-text-primary tracking-tight">{s.value}</p>
              <p className="text-sm text-text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────── */}
      <section className="py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-text-primary tracking-tight mb-4">
              Everything you need
              <br />
              to stay secure.
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              A full-stack security platform built for engineering teams who move fast.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl bg-surface border border-border p-8 hover:border-border-secondary transition-colors"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-mint flex items-center justify-center mb-6 dark:bg-brand-mint/10">
                  <f.icon className="w-6 h-6 text-brand-2 dark:text-brand-1" />
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-3">{f.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────── */}
      <section id="how" className="py-24 md:py-32 bg-surface-secondary/30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black text-text-primary tracking-tight mb-4">
              Three steps to comprehensive
              <br />
              <span className="text-brand-1">security coverage.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map((step, i) => (
              <div key={step.num} className="relative">
                {/* Connector line (between cards, desktop only) */}
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-[calc(100%+1rem)] w-8 h-px bg-border" />
                )}
                <div className="text-5xl font-black text-brand-1/20 mb-4 leading-none">{step.num}</div>
                <h3 className="text-lg font-bold text-text-primary mb-2">{step.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA band ────────────────────────────────────────── */}
      <section className="py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="rounded-3xl bg-brand-1 px-10 py-14 md:py-16 flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-3xl md:text-4xl font-black text-brand-2 tracking-tight mb-2">
                Start securing your infra today.
              </h2>
              <p className="text-brand-2/70 text-sm">No credit card required. Setup in minutes.</p>
            </div>
            {isExternal ? (
              <a
                href={ctaHref}
                className="shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-brand-2 text-brand-1 font-semibold text-sm btn-wise whitespace-nowrap"
              >
                {ctaLabel}
                <FiArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <Link
                href={ctaHref}
                className="shrink-0 inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-brand-2 text-brand-1 font-semibold text-sm btn-wise whitespace-nowrap"
              >
                {ctaLabel}
                <FiArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text-muted">
          <div className="flex items-center gap-2">
            <div className="relative w-5 h-5 rounded-full overflow-hidden">
              <Image src="/Tronnium_Main.png" alt="Tronnium" fill className="object-cover" />
            </div>
            <span>© 2025 Tronnium</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-text-primary transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
