"use client";

import { useState, useEffect } from "react";
import type {
  Business,
  BusinessJurisdiction,
  CurrencyContext,
  MarketProfile,
  BusinessGoal,
  BusinessConstraint,
  AiReadiness,
} from "@/lib/db/types";

/**
 * SALAM LIT — Business Context Page
 *
 * Allows the authorized owner/admin to view and edit business context.
 *
 * Phase 4: Business Context + Business Truth Foundation
 *
 * The Virtual AI Business Office remains the primary experience.
 * This page is accessible from the product navigation.
 */

type Tab = "overview" | "jurisdiction" | "markets" | "goals" | "constraints" | "ai-readiness";

export default function BusinessContextPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [business, setBusiness] = useState<Business | null>(null);
  const [jurisdiction, setJurisdiction] = useState<BusinessJurisdiction | null>(null);
  const [currency, setCurrency] = useState<CurrencyContext | null>(null);
  const [marketProfiles, setMarketProfiles] = useState<MarketProfile[]>([]);
  const [goals, setGoals] = useState<BusinessGoal[]>([]);
  const [constraints, setConstraints] = useState<BusinessConstraint[]>([]);
  const [aiReadiness, setAiReadiness] = useState<AiReadiness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Demo business ID (in production, this would come from auth context)
  const demoBusinessId = "demo-business-001";

  useEffect(() => {
    loadBusinessContext();
  }, []);

  async function loadBusinessContext() {
    setLoading(true);
    setError(null);

    try {
      // For demo purposes, create a business if it doesn't exist
      const createResponse = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: "demo-workspace",
          name: "Demo Business",
          nature_of_business: "Technology Services",
          business_type: "Sdn Bhd",
          industry: "Technology",
          location: "Kuala Lumpur",
          description: "A demo business for testing",
          years_operating: 2,
          business_stage: "Growth",
        }),
      });

      const createData = await createResponse.json();
      if (createData.business) {
        setBusiness(createData.business);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load business context"
      );
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--office-bg)]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--office-accent)] border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--office-text-muted)]">
            Loading business context...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--office-bg)]">
        <div className="office-panel max-w-md p-8 text-center">
          <p className="text-sm text-[var(--office-danger)]">{error}</p>
          <button
            onClick={loadBusinessContext}
            className="mt-4 rounded-lg bg-[var(--office-accent)] px-4 py-2 text-sm text-white hover:bg-[var(--office-accent-hover)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-[var(--office-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--office-border)] bg-[var(--office-surface)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[var(--office-text-primary)]">
              Business Context
            </h1>
            <p className="text-sm text-[var(--office-text-muted)]">
              Configure your business information and context
            </p>
          </div>
          <a
            href="/"
            className="rounded-lg bg-[var(--office-surface-elevated)] px-4 py-2 text-sm text-[var(--office-text-secondary)] hover:bg-[var(--office-surface-hover)]"
          >
            ← Back to Office
          </a>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-[var(--office-border)] bg-[var(--office-surface)] px-6">
        {([
          "overview",
          "jurisdiction",
          "markets",
          "goals",
          "constraints",
          "ai-readiness",
        ] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "border-b-2 border-[var(--office-accent)] text-[var(--office-accent)]"
                : "text-[var(--office-text-muted)] hover:text-[var(--office-text-primary)]"
            }`}
          >
            {tab
              .split("-")
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(" ")}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === "overview" && (
          <OverviewTab business={business} />
        )}
        {activeTab === "jurisdiction" && (
          <JurisdictionTab
            jurisdiction={jurisdiction}
            currency={currency}
          />
        )}
        {activeTab === "markets" && (
          <MarketsTab marketProfiles={marketProfiles} />
        )}
        {activeTab === "goals" && <GoalsTab goals={goals} />}
        {activeTab === "constraints" && (
          <ConstraintsTab constraints={constraints} />
        )}
        {activeTab === "ai-readiness" && (
          <AiReadinessTab aiReadiness={aiReadiness} />
        )}
      </main>
    </div>
  );
}

// ============================================================
// Tab Components
// ============================================================

function OverviewTab({ business }: { business: Business | null }) {
  if (!business) {
    return (
      <div className="office-panel p-8 text-center">
        <p className="text-sm text-[var(--office-text-muted)]">
          No business configured yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="office-panel p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--office-text-primary)]">
          Business Information
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Business Name
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {business.name}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Business Type
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {business.business_type || "Not provided"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Industry
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {business.industry || "Not provided"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Location
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {business.location || "Not provided"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Nature of Business
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {business.nature_of_business || "Not provided"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Years Operating
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {business.years_operating ?? "Not provided"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Business Stage
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {business.business_stage || "Not provided"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              SSM Registration No
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {business.ssm_registration_no || "Not provided"}
            </p>
          </div>
        </div>
        {business.description && (
          <div className="mt-4">
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Description
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {business.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function JurisdictionTab({
  jurisdiction,
  currency,
}: {
  jurisdiction: BusinessJurisdiction | null;
  currency: CurrencyContext | null;
}) {
  return (
    <div className="space-y-6">
      <div className="office-panel p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--office-text-primary)]">
          Jurisdiction & Country Context
        </h2>
        <p className="mb-4 text-sm text-[var(--office-text-muted)]">
          These settings determine how SALAM LIT resolves jurisdiction, tax, employment, and funding context for your business.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Registered Country
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {jurisdiction?.registered_country || "Not configured"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Operating Country
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {jurisdiction?.operating_country || "Not configured"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Business Jurisdiction
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {jurisdiction?.business_jurisdiction || "Not configured"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              User Country
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {jurisdiction?.user_country || "Not configured"}
            </p>
          </div>
        </div>
      </div>

      <div className="office-panel p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--office-text-primary)]">
          Currency Context
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Default Currency
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {currency?.default_currency || "Not configured"}
            </p>
          </div>
          <div>
            <label className="text-xs font-medium text-[var(--office-text-muted)]">
              Display Currency
            </label>
            <p className="mt-1 text-sm text-[var(--office-text-primary)]">
              {currency?.display_currency || "Same as default"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketsTab({
  marketProfiles,
}: {
  marketProfiles: MarketProfile[];
}) {
  return (
    <div className="space-y-6">
      <div className="office-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--office-text-primary)]">
            Market Profiles
          </h2>
          <span className="text-sm text-[var(--office-text-muted)]">
            {marketProfiles.length} market{marketProfiles.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="mb-4 text-sm text-[var(--office-text-muted)]">
          Define the markets your business targets. Each market can have its own currency, language, and marketing preferences.
        </p>

        {marketProfiles.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--office-text-muted)]">
              No market profiles configured.
            </p>
            <p className="mt-1 text-xs text-[var(--office-text-muted)]">
              Add markets to help SALAM LIT resolve marketing and sales context.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {marketProfiles.map((profile) => (
              <div
                key={profile.id}
                className="rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[var(--office-text-primary)]">
                    {profile.country}
                  </h3>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      profile.market_status === "ACTIVE"
                        ? "bg-green-500/10 text-green-400"
                        : profile.market_status === "TARGETED"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {profile.market_status}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--office-text-muted)]">
                  <div>Currency: {profile.currency}</div>
                  <div>Language: {profile.language}</div>
                  <div>Timezone: {profile.timezone}</div>
                  <div>Locale: {profile.locale}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GoalsTab({ goals }: { goals: BusinessGoal[] }) {
  return (
    <div className="space-y-6">
      <div className="office-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--office-text-primary)]">
            Business Goals
          </h2>
          <span className="text-sm text-[var(--office-text-muted)]">
            {goals.length} goal{goals.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="mb-4 text-sm text-[var(--office-text-muted)]">
          Define your business goals separately from general business description.
        </p>

        {goals.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--office-text-muted)]">
              No goals provided.
            </p>
            <p className="mt-1 text-xs text-[var(--office-text-muted)]">
              Add goals to help SALAM LIT prioritize recommendations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {goals.map((goal) => (
              <div
                key={goal.id}
                className="rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-[var(--office-text-primary)]">
                      {goal.goal}
                    </p>
                    {goal.target && (
                      <p className="mt-1 text-sm text-[var(--office-text-muted)]">
                        Target: {goal.target}
                      </p>
                    )}
                    {goal.timeline && (
                      <p className="mt-1 text-xs text-[var(--office-text-muted)]">
                        Timeline: {goal.timeline}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        goal.priority === "CRITICAL"
                          ? "bg-red-500/10 text-red-400"
                          : goal.priority === "HIGH"
                          ? "bg-orange-500/10 text-orange-400"
                          : goal.priority === "MEDIUM"
                          ? "bg-yellow-500/10 text-yellow-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {goal.priority}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        goal.status === "ACTIVE"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {goal.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConstraintsTab({
  constraints,
}: {
  constraints: BusinessConstraint[];
}) {
  return (
    <div className="space-y-6">
      <div className="office-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--office-text-primary)]">
            Business Constraints
          </h2>
          <span className="text-sm text-[var(--office-text-muted)]">
            {constraints.length} constraint{constraints.length !== 1 ? "s" : ""}
          </span>
        </div>
        <p className="mb-4 text-sm text-[var(--office-text-muted)]">
          Define constraints that affect your business operations and AI recommendations.
        </p>

        {constraints.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--office-text-muted)]">
              No constraints provided.
            </p>
            <p className="mt-1 text-xs text-[var(--office-text-muted)]">
              Add constraints to help SALAM LIT provide realistic recommendations.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {constraints.map((constraint) => (
              <div
                key={constraint.id}
                className="rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-[var(--office-text-primary)]">
                      {constraint.description}
                    </p>
                    <p className="mt-1 text-xs text-[var(--office-text-muted)]">
                      Type: {constraint.constraint_type}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        constraint.severity === "CRITICAL"
                          ? "bg-red-500/10 text-red-400"
                          : constraint.severity === "HIGH"
                          ? "bg-orange-500/10 text-orange-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {constraint.severity}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-medium ${
                        constraint.status === "ACTIVE"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {constraint.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AiReadinessTab({
  aiReadiness,
}: {
  aiReadiness: AiReadiness[];
}) {
  return (
    <div className="space-y-6">
      <div className="office-panel p-6">
        <h2 className="mb-4 text-lg font-semibold text-[var(--office-text-primary)]">
          AI Adoption Readiness
        </h2>
        <p className="mb-4 text-sm text-[var(--office-text-muted)]">
          Assess your business readiness for AI adoption across key dimensions.
        </p>

        {aiReadiness.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-[var(--office-text-muted)]">
              Insufficient Data
            </p>
            <p className="mt-1 text-xs text-[var(--office-text-muted)]">
              Complete the AI readiness assessment to help SALAM LIT tailor recommendations.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {aiReadiness.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[var(--office-border)] bg-[var(--office-surface-elevated)] p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-[var(--office-text-primary)]">
                    {item.dimension}
                  </h3>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      item.status === "HIGH"
                        ? "bg-green-500/10 text-green-400"
                        : item.status === "MEDIUM"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : item.status === "LOW"
                        ? "bg-orange-500/10 text-orange-400"
                        : "bg-gray-500/10 text-gray-400"
                    }`}
                  >
                    {item.status === "INSUFFICIENT_DATA"
                      ? "Insufficient Data"
                      : item.status}
                  </span>
                </div>
                {item.notes && (
                  <p className="mt-2 text-xs text-[var(--office-text-muted)]">
                    {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
