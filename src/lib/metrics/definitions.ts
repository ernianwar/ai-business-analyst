/**
 * SALAM LIT — Metric Definition Registry
 *
 * Central registry for all financial metric definitions.
 * Each metric has a clear formula, required inputs, and calculation version.
 *
 * Phase 6: Business Metrics & Financial Foundation
 */

import type { MetricDefinition, MetricKey } from "../db/types";

/**
 * Registry of all metric definitions.
 * This is the single source of truth for metric semantics.
 */
export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  // ─── Primary P&L Metrics ───
  revenue: {
    metric_key: "revenue",
    display_name: "Revenue",
    description: "Total revenue for the period",
    unit: "currency",
    formula: "SUM(revenue_facts.value)",
    required_fact_types: ["REVENUE"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },
  cogs: {
    metric_key: "cogs",
    display_name: "Cost of Goods Sold",
    description: "Total cost of goods sold for the period",
    unit: "currency",
    formula: "SUM(cogs_facts.value)",
    required_fact_types: ["COGS"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },
  gross_profit: {
    metric_key: "gross_profit",
    display_name: "Gross Profit",
    description: "Revenue minus Cost of Goods Sold",
    unit: "currency",
    formula: "revenue - cogs",
    required_fact_types: [],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: true,
    depends_on: ["revenue", "cogs"],
  },
  gross_margin: {
    metric_key: "gross_margin",
    display_name: "Gross Margin",
    description: "Gross Profit as percentage of Revenue",
    unit: "percentage",
    formula: "(gross_profit / revenue) * 100",
    required_fact_types: [],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: true,
    depends_on: ["gross_profit", "revenue"],
  },
  operating_expenses: {
    metric_key: "operating_expenses",
    display_name: "Operating Expenses",
    description: "Total operating expenses for the period",
    unit: "currency",
    formula: "SUM(operating_expense_facts.value)",
    required_fact_types: ["OPERATING_EXPENSES"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },
  operating_expense_ratio: {
    metric_key: "operating_expense_ratio",
    display_name: "Operating Expense Ratio",
    description: "Operating Expenses as percentage of Revenue",
    unit: "percentage",
    formula: "(operating_expenses / revenue) * 100",
    required_fact_types: [],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: true,
    depends_on: ["operating_expenses", "revenue"],
  },
  net_profit: {
    metric_key: "net_profit",
    display_name: "Net Profit",
    description: "Gross Profit minus Operating Expenses (partial scope)",
    unit: "currency",
    formula: "gross_profit - operating_expenses",
    required_fact_types: [],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: true,
    depends_on: ["gross_profit", "operating_expenses"],
  },
  net_margin: {
    metric_key: "net_margin",
    display_name: "Net Margin",
    description: "Net Profit as percentage of Revenue",
    unit: "percentage",
    formula: "(net_profit / revenue) * 100",
    required_fact_types: [],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: true,
    depends_on: ["net_profit", "revenue"],
  },

  // ─── Balance Sheet / Position Metrics ───
  cash_position: {
    metric_key: "cash_position",
    display_name: "Cash Position",
    description: "Current cash/bank balance",
    unit: "currency",
    formula: "cash_fact.value",
    required_fact_types: ["CASH"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },
  accounts_receivable: {
    metric_key: "accounts_receivable",
    display_name: "Accounts Receivable",
    description: "Total outstanding receivables",
    unit: "currency",
    formula: "SUM(accounts_receivable_facts.value)",
    required_fact_types: ["ACCOUNTS_RECEIVABLE"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },
  accounts_payable: {
    metric_key: "accounts_payable",
    display_name: "Accounts Payable",
    description: "Total outstanding payables",
    unit: "currency",
    formula: "SUM(accounts_payable_facts.value)",
    required_fact_types: ["ACCOUNTS_PAYABLE"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },

  // ─── Cash Flow Metrics ───
  cash_inflow: {
    metric_key: "cash_inflow",
    display_name: "Cash Inflow",
    description: "Total cash received during the period",
    unit: "currency",
    formula: "SUM(cash_inflow_facts.value)",
    required_fact_types: ["OTHER"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },
  cash_outflow: {
    metric_key: "cash_outflow",
    display_name: "Cash Outflow",
    description: "Total cash paid during the period",
    unit: "currency",
    formula: "SUM(cash_outflow_facts.value)",
    required_fact_types: ["OTHER"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },
  net_cash_movement: {
    metric_key: "net_cash_movement",
    display_name: "Net Cash Movement",
    description: "Cash Inflow minus Cash Outflow",
    unit: "currency",
    formula: "cash_inflow - cash_outflow",
    required_fact_types: [],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: true,
    depends_on: ["cash_inflow", "cash_outflow"],
  },
  opening_cash: {
    metric_key: "opening_cash",
    display_name: "Opening Cash",
    description: "Cash balance at period start",
    unit: "currency",
    formula: "cash_fact.value (period_start)",
    required_fact_types: ["CASH"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },
  closing_cash: {
    metric_key: "closing_cash",
    display_name: "Closing Cash",
    description: "Cash balance at period end",
    unit: "currency",
    formula: "cash_fact.value (period_end)",
    required_fact_types: ["CASH"],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: false,
    depends_on: [],
  },

  // ─── Comparison Metrics ───
  mom_revenue_change: {
    metric_key: "mom_revenue_change",
    display_name: "MoM Revenue Change",
    description: "Month-over-month revenue percentage change",
    unit: "percentage",
    formula: "((current_revenue - previous_revenue) / previous_revenue) * 100",
    required_fact_types: [],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: true,
    depends_on: ["revenue"],
  },
  yoy_revenue_change: {
    metric_key: "yoy_revenue_change",
    display_name: "YoY Revenue Change",
    description: "Year-over-year revenue percentage change",
    unit: "percentage",
    formula: "((current_revenue - previous_revenue) / previous_revenue) * 100",
    required_fact_types: [],
    optional_fact_types: [],
    calculation_version: "1.0",
    is_composable: true,
    depends_on: ["revenue"],
  },
};

/**
 * Get a metric definition by key.
 */
export function getMetricDefinition(key: MetricKey): MetricDefinition | null {
  return METRIC_DEFINITIONS[key] ?? null;
}

/**
 * Get all metric definitions.
 */
export function getAllMetricDefinitions(): MetricDefinition[] {
  return Object.values(METRIC_DEFINITIONS);
}

/**
 * Get metric definitions that depend on a given metric key.
 */
export function getDependentMetrics(key: MetricKey): MetricDefinition[] {
  return Object.values(METRIC_DEFINITIONS).filter((def) =>
    def.depends_on.includes(key)
  );
}

/**
 * Get primary (non-composable) metric definitions.
 */
export function getPrimaryMetricDefinitions(): MetricDefinition[] {
  return Object.values(METRIC_DEFINITIONS).filter((def) => !def.is_composable);
}

/**
 * Get derived (composable) metric definitions.
 */
export function getDerivedMetricDefinitions(): MetricDefinition[] {
  return Object.values(METRIC_DEFINITIONS).filter((def) => def.is_composable);
}
