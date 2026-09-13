"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * SALAM LIT — Authenticated Onboarding Wizard
 *
 * Multi-step onboarding:
 *   Step 1: Create Workspace
 *   Step 2: Create Business
 *   Step 3: Completion → redirect to /
 *
 * On load, fetches GET /api/onboarding/status to determine actual state.
 * Never accepts user_id, workspace_id, or business_id from the client.
 *
 * Phase 14.3: Authenticated SaaS Onboarding
 */

type OnboardingStatus =
  | "INVITED"
  | "WORKSPACE_CREATED"
  | "BUSINESS_CREATED"
  | "CONTEXT_CONFIGURED"
  | "COMPLETE"
  | null;

interface StatusResponse {
  user_id: string;
  onboarding_status: OnboardingStatus;
  workspace_id: string | null;
  business_id: string | null;
  role: string | null;
  has_workspace: boolean;
  has_business: boolean;
  onboarding_complete: boolean;
}

type Step = 1 | 2 | 3;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [businessLoading, setBusinessLoading] = useState(false);

  const [completing, setCompleting] = useState(false);

  const fetchStatus = useCallback(async (): Promise<StatusResponse | null> => {
    try {
      const res = await fetch("/api/onboarding/status", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/login";
        return null;
      }
      if (!res.ok) throw new Error("Failed to load onboarding status");
      return await res.json();
    } catch {
      setError("Could not load your onboarding status. Please try again.");
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const status = await fetchStatus();
      if (cancelled || !status) return;

      if (status.onboarding_complete) {
        window.location.href = "/";
        return;
      }

      if (status.has_business) {
        setStep(3);
      } else if (status.has_workspace) {
        setStep(2);
      } else {
        setStep(1);
      }

      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchStatus]);

  useEffect(() => {
    if (!slugManuallyEdited) {
      setWorkspaceSlug(slugify(workspaceName));
    }
  }, [workspaceName, slugManuallyEdited]);

  if (loading) {
    return (
      <main className="min-h-screen bg-[var(--office-bg)] flex items-center justify-center">
        <div className="text-[var(--office-text-muted)] text-sm">Loading...</div>
      </main>
    );
  }

  async function handleCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setWorkspaceLoading(true);

    const name = workspaceName.trim();
    const slug = workspaceSlug.trim();

    if (!name || !slug) {
      setError("Workspace name and slug are required.");
      setWorkspaceLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/onboarding/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (res.status === 409) {
        setError("A workspace with that slug already exists. Please choose a different slug.");
        setWorkspaceLoading(false);
        return;
      }

      if (!res.ok) {
        setError(data?.error || "Failed to create workspace. Please try again.");
        setWorkspaceLoading(false);
        return;
      }

      setStep(2);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function handleCreateBusiness(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusinessLoading(true);

    const name = businessName.trim();

    if (!name) {
      setError("Business name is required.");
      setBusinessLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/onboarding/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          industry: industry.trim() || undefined,
          description: description.trim() || undefined,
          website: website.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => null);

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      if (!res.ok) {
        setError(data?.error || "Failed to create business. Please try again.");
        setBusinessLoading(false);
        return;
      }

      setStep(3);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusinessLoading(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    setError(null);

    try {
      const status = await fetchStatus();
      if (!status) return;

      if (status.onboarding_complete || status.has_business) {
        window.location.href = "/";
        return;
      }

      setError("Onboarding is not yet complete. Please complete the previous steps.");
      setCompleting(false);
    } catch {
      setError("Could not verify onboarding status. Please try again.");
      setCompleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--office-bg)] flex items-center justify-center px-4">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="text-center mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-[var(--office-accent)]">
            SALAM LIT
          </p>
          <h1 className="mt-3 text-2xl font-bold text-[var(--office-text-primary)]">
            Your AI Business Office
          </h1>
          <p className="mt-2 text-sm text-[var(--office-text-secondary)]">
            Set up your workspace so your AI workforce can get to work.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-3 mb-8">
          {(["Workspace", "Business", "Ready"] as const).map((label, i) => {
            const num = (i + 1) as Step;
            const active = step === num;
            const done = step > num;
            return (
              <div key={label} className="flex items-center gap-3">
                {i > 0 && (
                  <div className={`w-8 h-px ${done || active ? "bg-[var(--office-accent)]" : "bg-[var(--office-border)]"}`} />
                )}
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      done
                        ? "bg-[var(--office-accent)] text-white"
                        : active
                        ? "bg-[var(--office-accent)] text-white"
                        : "bg-[var(--office-surface-elevated)] text-[var(--office-text-muted)] border border-[var(--office-border)]"
                    }`}
                  >
                    {done ? "✓" : num}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      active ? "text-[var(--office-text-primary)]" : "text-[var(--office-text-muted)]"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Card */}
        <div className="rounded-2xl border border-[var(--office-border)] bg-[var(--office-surface)] p-8">
          {/* Step 1: Workspace */}
          {step === 1 && (
            <form onSubmit={handleCreateWorkspace}>
              <h2 className="text-lg font-semibold text-[var(--office-text-primary)] mb-1">
                Create your workspace
              </h2>
              <p className="text-sm text-[var(--office-text-secondary)] mb-6">
                This is your team&apos;s home. You can invite collaborators later.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="ws-name" className="block text-sm font-medium text-[var(--office-text-secondary)] mb-2">
                    Workspace name
                  </label>
                  <input
                    id="ws-name"
                    type="text"
                    value={workspaceName}
                    onChange={(e) => {
                      setWorkspaceName(e.target.value);
                      if (!slugManuallyEdited) setWorkspaceSlug(slugify(e.target.value));
                    }}
                    required
                    maxLength={100}
                    className="w-full rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] px-4 py-3 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)] transition-colors"
                    placeholder="My Company"
                  />
                </div>

                <div>
                  <label htmlFor="ws-slug" className="block text-sm font-medium text-[var(--office-text-secondary)] mb-2">
                    Workspace slug
                  </label>
                  <div className="flex items-center rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] overflow-hidden focus-within:border-[var(--office-accent)] transition-colors">
                    <span className="pl-4 text-sm text-[var(--office-text-muted)] select-none">/</span>
                    <input
                      id="ws-slug"
                      type="text"
                      value={workspaceSlug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        setWorkspaceSlug(slugify(e.target.value));
                      }}
                      required
                      maxLength={60}
                      className="flex-1 bg-transparent px-1 py-3 text-[var(--office-text-primary)] outline-none"
                      placeholder="my-company"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--office-text-muted)]">
                    URL-friendly identifier. Auto-generated from name.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                disabled={workspaceLoading || !workspaceName.trim() || !workspaceSlug.trim()}
                className="mt-6 w-full rounded-full bg-[var(--office-accent)] px-6 py-3 font-semibold text-white hover:bg-[var(--office-accent-hover)] disabled:opacity-60 transition-colors"
              >
                {workspaceLoading ? "Creating..." : "Create Workspace"}
              </button>
            </form>
          )}

          {/* Step 2: Business */}
          {step === 2 && (
            <form onSubmit={handleCreateBusiness}>
              <h2 className="text-lg font-semibold text-[var(--office-text-primary)] mb-1">
                Tell us about your business
              </h2>
              <p className="text-sm text-[var(--office-text-secondary)] mb-6">
                Your AI workforce uses this context to deliver relevant insights.
              </p>

              <div className="space-y-4">
                <div>
                  <label htmlFor="biz-name" className="block text-sm font-medium text-[var(--office-text-secondary)] mb-2">
                    Business name
                  </label>
                  <input
                    id="biz-name"
                    type="text"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    maxLength={200}
                    className="w-full rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] px-4 py-3 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)] transition-colors"
                    placeholder="Acme Sdn Bhd"
                  />
                </div>

                <div>
                  <label htmlFor="biz-industry" className="block text-sm font-medium text-[var(--office-text-secondary)] mb-2">
                    Industry
                  </label>
                  <input
                    id="biz-industry"
                    type="text"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    maxLength={100}
                    className="w-full rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] px-4 py-3 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)] transition-colors"
                    placeholder="e.g. F&B, E-commerce, Education"
                  />
                </div>

                <div>
                  <label htmlFor="biz-desc" className="block text-sm font-medium text-[var(--office-text-secondary)] mb-2">
                    Description
                  </label>
                  <textarea
                    id="biz-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    maxLength={1000}
                    className="w-full rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] px-4 py-3 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)] transition-colors resize-none"
                    placeholder="What does your business do?"
                  />
                </div>

                <div>
                  <label htmlFor="biz-website" className="block text-sm font-medium text-[var(--office-text-secondary)] mb-2">
                    Website
                  </label>
                  <input
                    id="biz-website"
                    type="url"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    maxLength={500}
                    className="w-full rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] px-4 py-3 text-[var(--office-text-primary)] outline-none focus:border-[var(--office-accent)] transition-colors"
                    placeholder="https://example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={businessLoading || !businessName.trim()}
                className="mt-6 w-full rounded-full bg-[var(--office-accent)] px-6 py-3 font-semibold text-white hover:bg-[var(--office-accent-hover)] disabled:opacity-60 transition-colors"
              >
                {businessLoading ? "Creating..." : "Create Business"}
              </button>
            </form>
          )}

          {/* Step 3: Completion */}
          {step === 3 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[var(--office-success)]/10 border border-[var(--office-success)]/20 flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">✓</span>
              </div>
              <h2 className="text-lg font-semibold text-[var(--office-text-primary)] mb-2">
                You&apos;re all set
              </h2>
              <p className="text-sm text-[var(--office-text-secondary)] mb-8">
                Your workspace and business are configured. Your AI workforce is ready to work with real business context.
              </p>

              <button
                onClick={handleComplete}
                disabled={completing}
                className="w-full rounded-full bg-[var(--office-accent)] px-6 py-3 font-semibold text-white hover:bg-[var(--office-accent-hover)] disabled:opacity-60 transition-colors"
              >
                {completing ? "Verifying..." : "Enter Your Office"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-[var(--office-text-muted)]">
          Your data is secured. Authentication powered by Supabase.
        </p>
      </div>
    </main>
  );
}
