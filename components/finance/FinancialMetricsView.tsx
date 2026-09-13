/**
 * SALAM LIT — Financial Metrics View Component
 *
 * Displays financial metrics with verification guidance.
 *
 * Phase 6: Business Metrics & Financial Foundation
 */

"use client";

import React from "react";
import type { BusinessMetric, MetricStatus, MetricComparison } from "@/lib/db/types";

interface FinancialMetricsViewProps {
  metrics: BusinessMetric[];
  comparisons: MetricComparison[];
  currency?: string;
}

const STATUS_CONFIG: Record<MetricStatus, { color: string; label: string; bg: string }> = {
  VALID: { color: "text-green-400", label: "Valid", bg: "bg-green-500/10 border-green-500/20" },
  PARTIAL: { color: "text-yellow-400", label: "Partial", bg: "bg-yellow-500/10 border-yellow-500/20" },
  INSUFFICIENT_DATA: { color: "text-orange-400", label: "Insufficient Data", bg: "bg-orange-500/10 border-orange-500/20" },
  CONFLICTED: { color: "text-red-400", label: "Conflicting Data", bg: "bg-red-500/10 border-red-500/20" },
  STALE: { color: "text-zinc-400", label: "Stale Data", bg: "bg-zinc-500/10 border-zinc-500/20" },
  UNAVAILABLE: { color: "text-zinc-500", label: "Unavailable", bg: "bg-zinc-800/50 border-zinc-700/30" },
  ERROR: { color: "text-red-500", label: "Error", bg: "bg-red-500/10 border-red-500/20" },
};

const METRIC_LABELS: Record<string, string> = {
  revenue: "Revenue",
  cogs: "Cost of Goods Sold",
  gross_profit: "Gross Profit",
  gross_margin: "Gross Margin",
  operating_expenses: "Operating Expenses",
  operating_expense_ratio: "Operating Expense Ratio",
  net_profit: "Net Profit",
  net_margin: "Net Margin",
  cash_position: "Cash Position",
  accounts_receivable: "Accounts Receivable",
  accounts_payable: "Accounts Payable",
};

function formatValue(value: number | null, unit: string | null): string {
  if (value === null) return "—";
  if (unit === "percentage") return `${value.toFixed(2)}%`;
  if (unit === "currency") return `RM ${value.toLocaleString()}`;
  return value.toLocaleString();
}

function ComparisonBadge({ comparison }: { comparison: MetricComparison }) {
  if (comparison.percentage_change === null) return null;

  const isUp = comparison.percentage_change > 0;
  const isDown = comparison.percentage_change < 0;
  const isFlat = Math.abs(comparison.percentage_change) < 0.01;

  return (
    <span
      className={`text-xs font-medium ${
        isUp ? "text-green-400" : isDown ? "text-red-400" : "text-zinc-400"
      }`}
    >
      {isFlat ? "→ 0%" : isUp ? `↑ ${comparison.percentage_change.toFixed(1)}%` : `↓ ${Math.abs(comparison.percentage_change).toFixed(1)}%`}
    </span>
  );
}

export function FinancialMetricsView({
  metrics,
  comparisons,
  currency = "RM",
}: FinancialMetricsViewProps) {
  const getMetric = (key: string) =>
    metrics.find((m) => m.metric_key === key);

  const getComparison = (key: string) =>
    comparisons.find((c) => c.metric_key === key);

  const revenue = getMetric("revenue");
  const cogs = getMetric("cogs");
  const grossProfit = getMetric("gross_profit");
  const grossMargin = getMetric("gross_margin");
  const opex = getMetric("operating_expenses");
  const opexRatio = getMetric("operating_expense_ratio");
  const netProfit = getMetric("net_profit");
  const netMargin = getMetric("net_margin");
  const cash = getMetric("cash_position");
  const ar = getMetric("accounts_receivable");
  const ap = getMetric("accounts_payable");

  const revenueComp = getComparison("revenue");
  const grossProfitComp = getComparison("gross_profit");
  const netProfitComp = getComparison("net_profit");

  const renderMetricRow = (
    metric: BusinessMetric | undefined,
    comparison: MetricComparison | undefined,
    label: string
  ) => {
    const status = metric?.status ?? "UNAVAILABLE";
    const config = STATUS_CONFIG[status];

    return (
      <div className={`flex items-center justify-between p-3 rounded-lg border ${config.bg}`}>
        <div className="flex-1">
          <p className="text-sm font-medium text-zinc-100">{label}</p>
          {metric?.period_start && metric?.period_end && (
            <p className="text-xs text-zinc-500 mt-0.5">
              {metric.period_start} to {metric.period_end}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className={`text-lg font-semibold ${config.color}`}>
            {formatValue(metric?.numeric_value ?? null, metric?.unit ?? "currency")}
          </p>
          <div className="flex items-center gap-2 justify-end">
            {comparison && <ComparisonBadge comparison={comparison} />}
            <span className={`text-xs ${config.color}`}>{config.label}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Verification Warning */}
      <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
        <div className="flex items-start gap-3">
          <span className="text-yellow-400 text-lg">⚠️</span>
          <div>
            <p className="text-sm font-medium text-yellow-400">
              Please Review Before Use
            </p>
            <p className="text-xs text-zinc-400 mt-1">
              This financial analysis was generated from the business information
              and evidence currently available to SALAM LIT. Verify the figures,
              classifications and supporting records before relying on this
              analysis for financial, tax, accounting, statutory, or other
              high-impact decisions.
            </p>
          </div>
        </div>
      </div>

      {/* P&L Section */}
      <div>
        <h3 className="text-lg font-medium text-zinc-100 mb-4">
          Management P&L
        </h3>
        <div className="space-y-2">
          {renderMetricRow(revenue, revenueComp, "Revenue")}
          {renderMetricRow(cogs, undefined, "Cost of Goods Sold")}
          {renderMetricRow(grossProfit, grossProfitComp, "Gross Profit")}
          {renderMetricRow(grossMargin, undefined, "Gross Margin")}
          {renderMetricRow(opex, undefined, "Operating Expenses")}
          {renderMetricRow(opexRatio, undefined, "Operating Expense Ratio")}
          {renderMetricRow(netProfit, netProfitComp, "Net Profit")}
          {renderMetricRow(netMargin, undefined, "Net Margin")}
        </div>
      </div>

      {/* Balance Sheet Section */}
      <div>
        <h3 className="text-lg font-medium text-zinc-100 mb-4">
          Position
        </h3>
        <div className="space-y-2">
          {renderMetricRow(cash, undefined, "Cash Position")}
          {renderMetricRow(ar, undefined, "Accounts Receivable")}
          {renderMetricRow(ap, undefined, "Accounts Payable")}
        </div>
      </div>

      {/* No Data State */}
      {metrics.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-sm text-zinc-400">No financial data available</p>
          <p className="text-xs text-zinc-600 mt-1">
            Add business facts (Revenue, COGS, etc.) to generate financial metrics
          </p>
        </div>
      )}
    </div>
  );
}
