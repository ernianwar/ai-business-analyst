/**
 * SALAM LIT — Finance Page
 *
 * Business Financial Analysis & Verification.
 *
 * Phase 6: Business Metrics & Financial Foundation
 * Phase 15.3: Uses authenticated context for business_id.
 *
 * IMPORTANT: This is NOT an accounting replacement.
 * Use language like "Business Financial Analysis" or "Management Financial View".
 */

"use client";

import React, { useState, useEffect } from "react";
import { FinancialMetricsView } from "@/components/finance/FinancialMetricsView";
import { DataQualityView } from "@/components/finance/DataQualityView";
import type { BusinessMetric, MetricComparison, DataQualityCheck } from "@/lib/db/types";

type Tab = "overview" | "quality" | "definitions" | "provenance";

interface MeContext {
  business_id: string | null;
}

export default function FinancePage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [metrics, setMetrics] = useState<BusinessMetric[]>([]);
  const [comparisons, setComparisons] = useState<MetricComparison[]>([]);
  const [qualityChecks, setQualityChecks] = useState<DataQualityCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Default to current month
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodStart = `${currentMonth}-01`;
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

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

  useEffect(() => {
    if (!businessId) return;
    fetchMetrics();
    fetchComparisons();
  }, [businessId, periodStart, periodEnd]);

  const fetchMetrics = async () => {
    if (!businessId) return;
    try {
      setLoading(true);
      const response = await fetch(
        `/api/business/${businessId}/finance?period_start=${periodStart}&period_end=${periodEnd}`
      );
      const data = await response.json();
      setMetrics(data.metrics || []);

      // Run quality checks on metrics
      const checks: DataQualityCheck[] = [];
      const requiredMetrics = ["revenue", "cogs", "gross_profit", "net_profit"];
      for (const key of requiredMetrics) {
        const metric = data.metrics?.find((m: BusinessMetric) => m.metric_key === key);
        if (!metric) {
          checks.push({
            check_type: `${key}_missing`,
            status: "MISSING",
            message: `No ${key} data for this period`,
            affected_field: key,
          });
        } else if (metric.status === "VALID") {
          checks.push({
            check_type: `${key}_present`,
            status: "PASS",
            message: `${key} data available`,
            affected_field: key,
          });
        } else if (metric.status === "CONFLICTED") {
          checks.push({
            check_type: `${key}_conflict`,
            status: "FAIL",
            message: `Conflicting ${key} values`,
            affected_field: key,
          });
        } else {
          checks.push({
            check_type: `${key}_partial`,
            status: "WARN",
            message: `${key} data is ${metric.status}`,
            affected_field: key,
          });
        }
      }
      setQualityChecks(checks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  const fetchComparisons = async () => {
    if (!businessId) return;
    try {
      const response = await fetch(
        `/api/business/${businessId}/finance/compare?period_start=${periodStart}&period_end=${periodEnd}`
      );
      const data = await response.json();
      setComparisons(data.comparisons || []);
    } catch (err) {
      // Silent fail for comparisons
    }
  };

  const handleCalculate = async () => {
    if (!businessId) return;
    try {
      setCalculating(true);
      await fetch(`/api/business/${businessId}/finance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: periodStart,
          period_end: periodEnd,
          period_type: "MONTHLY",
        }),
      });
      await fetchMetrics();
      await fetchComparisons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate");
    } finally {
      setCalculating(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "overview", label: "Financial Overview", icon: "📊" },
    { key: "quality", label: "Data Quality", icon: "✅" },
    { key: "definitions", label: "Metric Definitions", icon: "📖" },
    { key: "provenance", label: "Provenance", icon: "🔍" },
  ];

  // Calculate completeness score
  const completenessScore =
    qualityChecks.length > 0
      ? qualityChecks.filter((c) => c.status === "PASS").length /
        qualityChecks.length
      : 0;
  const overallStatus =
    completenessScore >= 0.8
      ? "COMPLETE"
      : completenessScore >= 0.5
      ? "PARTIAL"
      : completenessScore > 0
      ? "INSUFFICIENT"
      : "INSUFFICIENT";

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
    <div className="min-h-screen bg-[var(--office-bg)]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--office-text-primary)]">
              Business Financial Analysis
            </h1>
            <p className="text-sm text-[var(--office-text-muted)] mt-1">
              Management Financial View — verify figures before use
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="rounded-lg bg-[var(--office-surface-elevated)] px-4 py-2 text-sm text-[var(--office-text-secondary)] hover:bg-[var(--office-surface-hover)]"
            >
              ← Back to Office
            </a>
            <button
              onClick={handleCalculate}
              disabled={calculating}
              className="px-4 py-2 bg-[var(--office-accent)] hover:bg-[var(--office-accent-hover)] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {calculating ? "Calculating..." : "Recalculate Metrics"}
            </button>
          </div>
        </div>

        {/* Period Display */}
        <div className="mb-6 p-4 office-panel">
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--office-text-muted)]">Period:</span>
            <span className="text-sm font-medium text-[var(--office-text-primary)]">
              {periodStart} to {periodEnd}
            </span>
            <span className="text-xs text-[var(--office-border)]">|</span>
            <span className="text-xs text-[var(--office-text-muted)]">
              {metrics.length} metrics calculated
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 office-panel">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                transition-colors
                ${
                  activeTab === tab.key
                    ? "bg-[var(--office-surface-elevated)] text-[var(--office-text-primary)]"
                    : "text-[var(--office-text-muted)] hover:text-[var(--office-text-secondary)] hover:bg-[var(--office-surface-hover)]"
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "overview" && (
            <FinancialMetricsView
              metrics={metrics}
              comparisons={comparisons}
            />
          )}

          {activeTab === "quality" && (
            <DataQualityView
              checks={qualityChecks}
              completenessScore={completenessScore}
              overallStatus={overallStatus as any}
            />
          )}

          {activeTab === "definitions" && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-[var(--office-text-primary)]">
                Metric Definitions
              </h3>
              <p className="text-sm text-[var(--office-text-muted)]">
                Each metric has a deterministic formula and calculation version.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "revenue", name: "Revenue", formula: "SUM(revenue_facts.value)", version: "1.0" },
                  { key: "cogs", name: "Cost of Goods Sold", formula: "SUM(cogs_facts.value)", version: "1.0" },
                  { key: "gross_profit", name: "Gross Profit", formula: "revenue - cogs", version: "1.0" },
                  { key: "gross_margin", name: "Gross Margin", formula: "(gross_profit / revenue) * 100", version: "1.0" },
                  { key: "operating_expenses", name: "Operating Expenses", formula: "SUM(opex_facts.value)", version: "1.0" },
                  { key: "operating_expense_ratio", name: "Opex Ratio", formula: "(opex / revenue) * 100", version: "1.0" },
                  { key: "net_profit", name: "Net Profit", formula: "gross_profit - opex (partial)", version: "1.0" },
                  { key: "net_margin", name: "Net Margin", formula: "(net_profit / revenue) * 100", version: "1.0" },
                ].map((def) => (
                  <div
                    key={def.key}
                    className="p-4 office-panel"
                  >
                    <p className="text-sm font-medium text-[var(--office-text-primary)]">{def.name}</p>
                    <p className="text-xs text-[var(--office-text-muted)] mt-1 font-mono">{def.formula}</p>
                    <p className="text-xs text-[var(--office-border)] mt-2">v{def.version}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === "provenance" && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-[var(--office-text-primary)]">
                Metric Provenance
              </h3>
              <p className="text-sm text-[var(--office-text-muted)]">
                Trace metrics back to source facts, evidence, and documents.
              </p>
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-sm text-[var(--office-text-muted)]">
                  Select a metric to view its provenance chain
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="fixed bottom-6 right-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-xs text-[var(--office-text-muted)] hover:text-[var(--office-text-secondary)] mt-1"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
