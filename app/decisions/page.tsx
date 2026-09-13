"use client";

import { useState, useEffect } from "react";
import { DecisionCenter } from "@/components/office/DecisionCenter";

/**
 * Decision Center Page
 *
 * The primary Decision Center experience.
 * Turns validated recommendations into explicit business decisions.
 *
 * Phase 14.4.1: Uses authenticated context for business_id.
 */

interface MeContext {
  business_id: string | null;
}

export default function DecisionsPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        return res.json();
      })
      .then((data: MeContext | undefined) => {
        if (data?.business_id) {
          setBusinessId(data.business_id);
        } else {
          window.location.href = "/onboarding";
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--office-bg)]">
        <p className="text-sm text-[var(--office-text-muted)]">Loading...</p>
      </div>
    );
  }

  if (!businessId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--office-bg)]">
        <p className="text-sm text-[var(--office-text-muted)]">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--office-bg)]">
      <header className="flex items-center justify-between border-b border-[var(--office-border)] bg-[var(--office-surface)]/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-2 text-[var(--office-text-muted)] hover:text-[var(--office-text-primary)]"
          >
            <span className="text-lg">←</span>
            <span className="text-sm">Back to Office</span>
          </a>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--office-accent)]">
            <span className="text-sm font-bold text-white">SL</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-[var(--office-text-primary)]">Decision Center</h1>
            <p className="text-[10px] text-[var(--office-text-muted)]">SALAM LIT</p>
          </div>
        </div>
        <div className="w-24" />
      </header>

      <div className="flex-1 overflow-hidden">
        <DecisionCenter business_id={businessId} />
      </div>
    </div>
  );
}
