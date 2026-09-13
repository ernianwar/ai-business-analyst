"use client";

import { useState, useEffect, useCallback } from "react";
import { VirtualOffice } from "@/components/office/VirtualOffice";
import type { AgentKey } from "@/lib/agents/definitions";

/**
 * SALAM LIT — Main Page
 *
 * The primary product experience: Virtual AI Business Office.
 *
 * Phase 14.4: Authenticated context-driven entry point.
 * Identity flows from JWT → /api/me → AuthenticatedContext.
 * No query parameters used for identity.
 */

interface MeContext {
  user_id: string;
  email: string | null;
  display_name: string | null;
  workspace_id: string | null;
  business_id: string | null;
  role: string | null;
  onboarding_status: string | null;
}

export default function Home() {
  const [view, setView] = useState<"office" | "research">("office");
  const [selectedAgent, setSelectedAgent] = useState<AgentKey | null>(null);
  const [me, setMe] = useState<MeContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error("Failed to load context");
      const data = await res.json();
      setMe(data);
      setError(null);
    } catch {
      setError("Could not load your business context.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // Loading
  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--office-bg)] flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--office-accent)] border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--office-text-muted)]">Loading...</p>
        </div>
      </main>
    );
  }

  // Error
  if (error && !me) {
    return (
      <main className="min-h-screen bg-[var(--office-bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--office-danger)]">{error}</p>
          <button
            onClick={() => { setLoading(true); setError(null); fetchMe(); }}
            className="mt-4 rounded-lg bg-[var(--office-accent)] px-4 py-2 text-sm text-white hover:bg-[var(--office-accent-hover)]"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  // Redirect: incomplete onboarding
  if (me && !me.business_id) {
    window.location.href = "/onboarding";
    return (
      <main className="min-h-screen bg-[var(--office-bg)] flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--office-text-muted)]">Redirecting to onboarding...</p>
        </div>
      </main>
    );
  }

  // Research view
  if (view === "research") {
    return <ResearchView onBack={() => setView("office")} />;
  }

  // Main office
  return (
    <main className="h-screen w-screen overflow-hidden bg-[var(--office-bg)]">
      <VirtualOffice
        onAgentClick={(key) => setSelectedAgent(key)}
        onOpenChat={(key) => setSelectedAgent(key ?? "zue")}
      />

      <button
        onClick={() => setView("research")}
        className="fixed bottom-4 left-4 z-50 rounded-lg bg-[var(--office-surface)] px-3 py-2 text-xs text-[var(--office-text-muted)] opacity-30 transition-opacity hover:opacity-100"
        aria-label="Switch to research mode"
      >
        Research Mode
      </button>
    </main>
  );
}

/**
 * Research View — preserves the existing research functionality.
 * This is a secondary view, not the primary experience.
 */
function ResearchView({ onBack }: { onBack: () => void }) {
  const [idea, setIdea] = useState(
    "Evaluate the opportunity for LIT Digital Creators to provide AI workforce training to Malaysian SMEs."
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runResearch() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Research failed");
      setResult(data?.result ?? null);
    } catch (err) {
      setError(
        (err as Error).message === "Insufficient evidence"
          ? "Insufficient evidence."
          : "Live research could not be completed."
      );
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--office-bg)] text-[var(--office-text-primary)]">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <header className="rounded-3xl border border-[var(--office-border)] bg-[var(--office-surface)] p-8 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[var(--office-accent)]">
                SALAM LIT
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-tight">
                Agentic AI Business Opportunity Intelligence
              </h1>
            </div>
            <button
              onClick={onBack}
              className="rounded-lg bg-[var(--office-surface-elevated)] px-4 py-2 text-sm text-[var(--office-text-secondary)] hover:bg-[var(--office-surface-hover)]"
            >
              ← Back to Office
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-3xl border border-[var(--office-border)] bg-[var(--office-surface)] p-6 shadow-sm">
          <label className="block text-sm font-semibold text-[var(--office-text-secondary)]">
            What business opportunity do you want to investigate?
          </label>
          <textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            className="mt-3 min-h-28 w-full rounded-2xl border border-[var(--office-border)] bg-[var(--office-surface-elevated)] p-4 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)]"
          />
          <button
            onClick={runResearch}
            disabled={running}
            className="mt-4 rounded-full bg-[var(--office-accent)] px-6 py-3 font-semibold text-white disabled:opacity-60"
          >
            RUN SALAM LIT
          </button>
        </section>

        {error && (
          <section className="mt-6 rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-400 shadow-sm">
            {error}
          </section>
        )}

        {result && (
          <section className="mt-6 rounded-3xl border border-[var(--office-border)] bg-[var(--office-surface)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold">Research Results</h2>
            <pre className="mt-4 overflow-auto text-sm text-[var(--office-text-secondary)]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </main>
  );
}
