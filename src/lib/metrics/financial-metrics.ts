/**
 * SALAM LIT — Deterministic Financial Metric Calculation Engine
 *
 * Calculates financial metrics from Business Facts.
 * All arithmetic is deterministic — no LLM involvement.
 *
 * Phase 6: Business Metrics & Financial Foundation
 *
 * RULES:
 * - Missing data is NOT zero — it's UNKNOWN
 * - Division by zero returns UNAVAILABLE
 * - Conflicting facts block metric calculation
 * - Every metric traces to source facts
 * - Calculation version must be recorded
 * - Currency must be consistent
 */

import type {
  BusinessFact,
  BusinessMetric,
  MetricSource,
  MetricKey,
  MetricStatus,
  MetricCalculationResult,
  FinancialPeriod,
  PeriodRange,
  DataQualityCheck,
  FactType,
} from "../db/types";
import { METRIC_DEFINITIONS, getMetricDefinition } from "./definitions";

/**
 * Extract numeric value from a fact's value field.
 */
function extractNumericValue(fact: BusinessFact): number | null {
  const val = fact.value;
  if (typeof val === "number") return val;
  if (typeof val === "object" && val !== null) {
    const numVal = (val as Record<string, unknown>).value;
    if (typeof numVal === "number") return numVal;
    if (typeof numVal === "string") {
      const parsed = parseFloat(numVal);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
}

/**
 * Safe division — returns null for division by zero or invalid inputs.
 */
function safeDivide(numerator: number, denominator: number): number | null {
  if (denominator === 0 || !isFinite(denominator)) return null;
  if (!isFinite(numerator)) return null;
  return (numerator / denominator) * 100;
}

/**
 * Safe subtract — returns null if either input is null.
 */
function safeSubtract(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return a - b;
}

/**
 * Filter active facts within a period.
 */
function filterFactsForPeriod(
  facts: BusinessFact[],
  factType: FactType,
  periodStart: string,
  periodEnd: string
): BusinessFact[] {
  return facts.filter(
    (f) =>
      f.fact_type === factType &&
      f.lifecycle_status === "ACTIVE" &&
      f.period_start === periodStart &&
      f.period_end === periodEnd
  );
}

/**
 * Aggregate facts of a type for a period (sum).
 * Returns null if no facts found.
 */
function aggregateFacts(
  facts: BusinessFact[],
  factType: FactType,
  periodStart: string,
  periodEnd: string
): { value: number | null; factIds: string[]; currency: string | null; count: number } {
  const filtered = filterFactsForPeriod(facts, factType, periodStart, periodEnd);
  if (filtered.length === 0) return { value: null, factIds: [], currency: null, count: 0 };

  const values: number[] = [];
  const factIds: string[] = [];
  let currency: string | null = null;
  const currencies = new Set<string>();

  for (const fact of filtered) {
    const numVal = extractNumericValue(fact);
    if (numVal !== null) {
      values.push(numVal);
      factIds.push(fact.id);
    }
    if (fact.unit) {
      currencies.add(fact.unit);
      currency = fact.unit;
    }
  }

  // Check for currency conflicts
  if (currencies.size > 1) {
    return { value: null, factIds, currency: null, count: filtered.length };
  }

  if (values.length === 0) {
    return { value: null, factIds, currency, count: filtered.length };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return { value: sum, factIds, currency, count: filtered.length };
}

/**
 * Check for conflicting facts.
 */
function detectFactConflicts(
  facts: BusinessFact[],
  factType: FactType,
  periodStart: string,
  periodEnd: string
): boolean {
  const filtered = filterFactsForPeriod(facts, factType, periodStart, periodEnd);
  if (filtered.length <= 1) return false;

  const values = filtered
    .map(extractNumericValue)
    .filter((v) => v !== null) as number[];

  if (values.length <= 1) return false;

  // Check if values differ by more than 0.01 (rounding tolerance)
  const unique = new Set(values.map((v) => Math.round(v * 100) / 100));
  return unique.size > 1;
}

/**
 * Run data quality checks for a period.
 */
function runQualityChecks(
  facts: BusinessFact[],
  periodStart: string,
  periodEnd: string,
  requiredFactTypes: FactType[]
): DataQualityCheck[] {
  const checks: DataQualityCheck[] = [];

  for (const factType of requiredFactTypes) {
    const filtered = filterFactsForPeriod(facts, factType, periodStart, periodEnd);

    if (filtered.length === 0) {
      checks.push({
        check_type: `${factType}_missing`,
        status: "MISSING",
        message: `No ${factType} data for period`,
        affected_field: factType.toLowerCase(),
      });
    } else if (filtered.length > 1) {
      const hasConflict = detectFactConflicts(facts, factType, periodStart, periodEnd);
      if (hasConflict) {
        checks.push({
          check_type: `${factType}_conflict`,
          status: "FAIL",
          message: `Conflicting ${factType} values detected`,
          affected_field: factType.toLowerCase(),
        });
      } else {
        checks.push({
          check_type: `${factType}_multiple`,
          status: "WARN",
          message: `Multiple ${factType} records for period`,
          affected_field: factType.toLowerCase(),
        });
      }
    } else {
      checks.push({
        check_type: `${factType}_present`,
        status: "PASS",
        message: `${factType} data available`,
        affected_field: factType.toLowerCase(),
      });
    }
  }

  return checks;
}

/**
 * Determine metric status from quality checks.
 */
function determineStatus(checks: DataQualityCheck[]): MetricStatus {
  const hasFail = checks.some((c) => c.status === "FAIL");
  const hasMissing = checks.some((c) => c.status === "MISSING");
  const hasWarn = checks.some((c) => c.status === "WARN");

  if (hasFail) return "CONFLICTED";
  if (hasMissing) return "INSUFFICIENT_DATA";
  if (hasWarn) return "PARTIAL";
  return "VALID";
}

/**
 * Create a metric object.
 */
function createMetric(
  business_id: string,
  metricKey: MetricKey,
  numericValue: number | null,
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod,
  currency: string | null,
  sourceFactIds: string[],
  status: MetricStatus,
  calculationMethod: string
): BusinessMetric {
  const definition = getMetricDefinition(metricKey);
  return {
    id: crypto.randomUUID(),
    business_id,
    metric_type: metricKey,
    metric_name: definition?.display_name ?? metricKey,
    metric_key: metricKey,
    value: numericValue !== null ? { value: numericValue } : { value: null },
    numeric_value: numericValue,
    unit: definition?.unit ?? "currency",
    currency,
    period_start: periodStart,
    period_end: periodEnd,
    period_type: periodType,
    calculation_method: calculationMethod,
    calculation_version: definition?.calculation_version ?? "1.0",
    source_facts: sourceFactIds,
    status,
    confidence: status === "VALID" ? 0.85 : status === "PARTIAL" ? 0.5 : 0,
    freshness_status: "CURRENT",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ============================================================
// Primary Metric Calculators
// ============================================================

/**
 * Calculate Revenue metric.
 */
export function calculateRevenue(
  business_id: string,
  facts: BusinessFact[],
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const agg = aggregateFacts(facts, "REVENUE", periodStart, periodEnd);
  const checks = runQualityChecks(facts, periodStart, periodEnd, ["REVENUE"]);
  const status = determineStatus(checks);

  const metric = createMetric(
    business_id,
    "revenue",
    agg.value,
    periodStart,
    periodEnd,
    periodType,
    agg.currency,
    agg.factIds,
    status,
    "SUM(REVENUE facts)"
  );

  const sources: MetricSource[] = agg.factIds.map((factId) => ({
    id: crypto.randomUUID(),
    metric_id: metric.id,
    fact_id: factId,
    contribution_weight: 1.0,
    contribution_value: null,
    created_at: new Date().toISOString(),
  }));

  return { metric, sources, quality: checks, warnings: [] };
}

/**
 * Calculate COGS metric.
 */
export function calculateCogs(
  business_id: string,
  facts: BusinessFact[],
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const agg = aggregateFacts(facts, "COGS", periodStart, periodEnd);
  const checks = runQualityChecks(facts, periodStart, periodEnd, ["COGS"]);
  const status = determineStatus(checks);

  const metric = createMetric(
    business_id,
    "cogs",
    agg.value,
    periodStart,
    periodEnd,
    periodType,
    agg.currency,
    agg.factIds,
    status,
    "SUM(COGS facts)"
  );

  const sources: MetricSource[] = agg.factIds.map((factId) => ({
    id: crypto.randomUUID(),
    metric_id: metric.id,
    fact_id: factId,
    contribution_weight: 1.0,
    contribution_value: null,
    created_at: new Date().toISOString(),
  }));

  return { metric, sources, quality: checks, warnings: [] };
}

/**
 * Calculate Operating Expenses metric.
 */
export function calculateOperatingExpenses(
  business_id: string,
  facts: BusinessFact[],
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const agg = aggregateFacts(facts, "OPERATING_EXPENSES", periodStart, periodEnd);
  const checks = runQualityChecks(facts, periodStart, periodEnd, ["OPERATING_EXPENSES"]);
  const status = determineStatus(checks);

  const metric = createMetric(
    business_id,
    "operating_expenses",
    agg.value,
    periodStart,
    periodEnd,
    periodType,
    agg.currency,
    agg.factIds,
    status,
    "SUM(OPERATING_EXPENSES facts)"
  );

  const sources: MetricSource[] = agg.factIds.map((factId) => ({
    id: crypto.randomUUID(),
    metric_id: metric.id,
    fact_id: factId,
    contribution_weight: 1.0,
    contribution_value: null,
    created_at: new Date().toISOString(),
  }));

  return { metric, sources, quality: checks, warnings: [] };
}

/**
 * Calculate Cash Position metric.
 */
export function calculateCashPosition(
  business_id: string,
  facts: BusinessFact[],
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const agg = aggregateFacts(facts, "CASH", periodStart, periodEnd);
  const checks = runQualityChecks(facts, periodStart, periodEnd, ["CASH"]);
  const status = determineStatus(checks);

  const metric = createMetric(
    business_id,
    "cash_position",
    agg.value,
    periodStart,
    periodEnd,
    periodType,
    agg.currency,
    agg.factIds,
    status,
    "CASH fact value"
  );

  const sources: MetricSource[] = agg.factIds.map((factId) => ({
    id: crypto.randomUUID(),
    metric_id: metric.id,
    fact_id: factId,
    contribution_weight: 1.0,
    contribution_value: null,
    created_at: new Date().toISOString(),
  }));

  return { metric, sources, quality: checks, warnings: [] };
}

/**
 * Calculate Accounts Receivable metric.
 */
export function calculateAccountsReceivable(
  business_id: string,
  facts: BusinessFact[],
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const agg = aggregateFacts(facts, "ACCOUNTS_RECEIVABLE", periodStart, periodEnd);
  const checks = runQualityChecks(facts, periodStart, periodEnd, ["ACCOUNTS_RECEIVABLE"]);
  const status = determineStatus(checks);

  const metric = createMetric(
    business_id,
    "accounts_receivable",
    agg.value,
    periodStart,
    periodEnd,
    periodType,
    agg.currency,
    agg.factIds,
    status,
    "SUM(ACCOUNTS_RECEIVABLE facts)"
  );

  const sources: MetricSource[] = agg.factIds.map((factId) => ({
    id: crypto.randomUUID(),
    metric_id: metric.id,
    fact_id: factId,
    contribution_weight: 1.0,
    contribution_value: null,
    created_at: new Date().toISOString(),
  }));

  return { metric, sources, quality: checks, warnings: [] };
}

/**
 * Calculate Accounts Payable metric.
 */
export function calculateAccountsPayable(
  business_id: string,
  facts: BusinessFact[],
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const agg = aggregateFacts(facts, "ACCOUNTS_PAYABLE", periodStart, periodEnd);
  const checks = runQualityChecks(facts, periodStart, periodEnd, ["ACCOUNTS_PAYABLE"]);
  const status = determineStatus(checks);

  const metric = createMetric(
    business_id,
    "accounts_payable",
    agg.value,
    periodStart,
    periodEnd,
    periodType,
    agg.currency,
    agg.factIds,
    status,
    "SUM(ACCOUNTS_PAYABLE facts)"
  );

  const sources: MetricSource[] = agg.factIds.map((factId) => ({
    id: crypto.randomUUID(),
    metric_id: metric.id,
    fact_id: factId,
    contribution_weight: 1.0,
    contribution_value: null,
    created_at: new Date().toISOString(),
  }));

  return { metric, sources, quality: checks, warnings: [] };
}

// ============================================================
// Derived Metric Calculators
// ============================================================

/**
 * Calculate Gross Profit (Revenue - COGS).
 */
export function calculateGrossProfit(
  business_id: string,
  revenueResult: MetricCalculationResult,
  cogsResult: MetricCalculationResult,
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const warnings: string[] = [];
  const revenueVal = revenueResult.metric.numeric_value;
  const cogsVal = cogsResult.metric.numeric_value;

  // Check for conflicts in source metrics
  if (revenueResult.metric.status === "CONFLICTED" || cogsResult.metric.status === "CONFLICTED") {
    const metric = createMetric(
      business_id,
      "gross_profit",
      null,
      periodStart,
      periodEnd,
      periodType,
      null,
      [...revenueResult.metric.source_facts, ...cogsResult.metric.source_facts],
      "CONFLICTED",
      "gross_profit = revenue - cogs (blocked: source conflict)"
    );
    return { metric, sources: [], quality: [...revenueResult.quality, ...cogsResult.quality], warnings: ["Blocked: conflicting source data"] };
  }

  if (revenueVal === null || cogsVal === null) {
    const missingInputs: string[] = [];
    if (revenueVal === null) missingInputs.push("revenue");
    if (cogsVal === null) missingInputs.push("cogs");

    const metric = createMetric(
      business_id,
      "gross_profit",
      null,
      periodStart,
      periodEnd,
      periodType,
      null,
      [...revenueResult.metric.source_facts, ...cogsResult.metric.source_facts],
      "INSUFFICIENT_DATA",
      `gross_profit = revenue - cogs (missing: ${missingInputs.join(", ")})`
    );
    warnings.push(`Insufficient data: ${missingInputs.join(" and ")} unavailable`);
    return { metric, sources: [], quality: [...revenueResult.quality, ...cogsResult.quality], warnings };
  }

  const grossProfit = revenueVal - cogsVal;
  const currency = revenueResult.metric.currency ?? cogsResult.metric.currency;
  const sourceFacts = [...revenueResult.metric.source_facts, ...cogsResult.metric.source_facts];
  const checks = [...revenueResult.quality, ...cogsResult.quality];

  const metric = createMetric(
    business_id,
    "gross_profit",
    grossProfit,
    periodStart,
    periodEnd,
    periodType,
    currency,
    sourceFacts,
    "VALID",
    "gross_profit = revenue - cogs"
  );

  return { metric, sources: [], quality: checks, warnings };
}

/**
 * Calculate Gross Margin (Gross Profit / Revenue * 100).
 */
export function calculateGrossMargin(
  business_id: string,
  grossProfitResult: MetricCalculationResult,
  revenueResult: MetricCalculationResult,
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const warnings: string[] = [];
  const grossProfitVal = grossProfitResult.metric.numeric_value;
  const revenueVal = revenueResult.metric.numeric_value;

  if (grossProfitVal === null || revenueVal === null) {
    const missingInputs: string[] = [];
    if (grossProfitVal === null) missingInputs.push("gross_profit");
    if (revenueVal === null) missingInputs.push("revenue");

    const metric = createMetric(
      business_id,
      "gross_margin",
      null,
      periodStart,
      periodEnd,
      periodType,
      null,
      [...grossProfitResult.metric.source_facts, ...revenueResult.metric.source_facts],
      "INSUFFICIENT_DATA",
      `gross_margin = (gross_profit / revenue) * 100 (missing: ${missingInputs.join(", ")})`
    );
    return { metric, sources: [], quality: [...grossProfitResult.quality, ...revenueResult.quality], warnings };
  }

  if (revenueVal === 0) {
    const metric = createMetric(
      business_id,
      "gross_margin",
      null,
      periodStart,
      periodEnd,
      periodType,
      grossProfitResult.metric.currency,
      [...grossProfitResult.metric.source_facts, ...revenueResult.metric.source_facts],
      "UNAVAILABLE",
      "gross_margin = (gross_profit / revenue) * 100 (division by zero: revenue = 0)"
    );
    warnings.push("Cannot calculate margin: revenue is zero");
    return { metric, sources: [], quality: [...grossProfitResult.quality, ...revenueResult.quality], warnings };
  }

  const grossMargin = safeDivide(grossProfitVal, revenueVal);
  const sourceFacts = [...grossProfitResult.metric.source_facts, ...revenueResult.metric.source_facts];

  const metric = createMetric(
    business_id,
    "gross_margin",
    grossMargin,
    periodStart,
    periodEnd,
    periodType,
    grossProfitResult.metric.currency,
    sourceFacts,
    grossMargin !== null ? "VALID" : "UNAVAILABLE",
    "gross_margin = (gross_profit / revenue) * 100"
  );

  return { metric, sources: [], quality: [...grossProfitResult.quality, ...revenueResult.quality], warnings };
}

/**
 * Calculate Operating Expense Ratio.
 */
export function calculateOperatingExpenseRatio(
  business_id: string,
  opexResult: MetricCalculationResult,
  revenueResult: MetricCalculationResult,
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const warnings: string[] = [];
  const opexVal = opexResult.metric.numeric_value;
  const revenueVal = revenueResult.metric.numeric_value;

  if (opexVal === null || revenueVal === null) {
    const missingInputs: string[] = [];
    if (opexVal === null) missingInputs.push("operating_expenses");
    if (revenueVal === null) missingInputs.push("revenue");

    const metric = createMetric(
      business_id,
      "operating_expense_ratio",
      null,
      periodStart,
      periodEnd,
      periodType,
      null,
      [...opexResult.metric.source_facts, ...revenueResult.metric.source_facts],
      "INSUFFICIENT_DATA",
      `opex_ratio = (operating_expenses / revenue) * 100 (missing: ${missingInputs.join(", ")})`
    );
    return { metric, sources: [], quality: [...opexResult.quality, ...revenueResult.quality], warnings };
  }

  if (revenueVal === 0) {
    const metric = createMetric(
      business_id,
      "operating_expense_ratio",
      null,
      periodStart,
      periodEnd,
      periodType,
      opexResult.metric.currency,
      [...opexResult.metric.source_facts, ...revenueResult.metric.source_facts],
      "UNAVAILABLE",
      "opex_ratio = (operating_expenses / revenue) * 100 (division by zero: revenue = 0)"
    );
    return { metric, sources: [], quality: [...opexResult.quality, ...revenueResult.quality], warnings };
  }

  const ratio = safeDivide(opexVal, revenueVal);

  const metric = createMetric(
    business_id,
    "operating_expense_ratio",
    ratio,
    periodStart,
    periodEnd,
    periodType,
    opexResult.metric.currency,
    [...opexResult.metric.source_facts, ...revenueResult.metric.source_facts],
    ratio !== null ? "VALID" : "UNAVAILABLE",
    "opex_ratio = (operating_expenses / revenue) * 100"
  );

  return { metric, sources: [], quality: [...opexResult.quality, ...revenueResult.quality], warnings };
}

/**
 * Calculate Net Profit (Gross Profit - Operating Expenses).
 */
export function calculateNetProfit(
  business_id: string,
  grossProfitResult: MetricCalculationResult,
  opexResult: MetricCalculationResult,
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const warnings: string[] = [];
  const grossProfitVal = grossProfitResult.metric.numeric_value;
  const opexVal = opexResult.metric.numeric_value;

  if (grossProfitVal === null || opexVal === null) {
    const missingInputs: string[] = [];
    if (grossProfitVal === null) missingInputs.push("gross_profit");
    if (opexVal === null) missingInputs.push("operating_expenses");

    const metric = createMetric(
      business_id,
      "net_profit",
      null,
      periodStart,
      periodEnd,
      periodType,
      null,
      [...grossProfitResult.metric.source_facts, ...opexResult.metric.source_facts],
      "INSUFFICIENT_DATA",
      `net_profit = gross_profit - operating_expenses (missing: ${missingInputs.join(", ")})`
    );
    return { metric, sources: [], quality: [...grossProfitResult.quality, ...opexResult.quality], warnings };
  }

  const netProfit = grossProfitVal - opexVal;
  const currency = grossProfitResult.metric.currency ?? opexResult.metric.currency;
  const sourceFacts = [...grossProfitResult.metric.source_facts, ...opexResult.metric.source_facts];

  warnings.push("PARTIAL scope: only COGS and operating expenses included. Other income/expenses not accounted for.");

  const metric = createMetric(
    business_id,
    "net_profit",
    netProfit,
    periodStart,
    periodEnd,
    periodType,
    currency,
    sourceFacts,
    "PARTIAL",
    "net_profit = gross_profit - operating_expenses (partial scope)"
  );

  return { metric, sources: [], quality: [...grossProfitResult.quality, ...opexResult.quality], warnings };
}

/**
 * Calculate Net Margin.
 */
export function calculateNetMargin(
  business_id: string,
  netProfitResult: MetricCalculationResult,
  revenueResult: MetricCalculationResult,
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod
): MetricCalculationResult {
  const warnings: string[] = [];
  const netProfitVal = netProfitResult.metric.numeric_value;
  const revenueVal = revenueResult.metric.numeric_value;

  if (netProfitVal === null || revenueVal === null) {
    const missingInputs: string[] = [];
    if (netProfitVal === null) missingInputs.push("net_profit");
    if (revenueVal === null) missingInputs.push("revenue");

    const metric = createMetric(
      business_id,
      "net_margin",
      null,
      periodStart,
      periodEnd,
      periodType,
      null,
      [...netProfitResult.metric.source_facts, ...revenueResult.metric.source_facts],
      "INSUFFICIENT_DATA",
      `net_margin = (net_profit / revenue) * 100 (missing: ${missingInputs.join(", ")})`
    );
    return { metric, sources: [], quality: [...netProfitResult.quality, ...revenueResult.quality], warnings };
  }

  if (revenueVal === 0) {
    const metric = createMetric(
      business_id,
      "net_margin",
      null,
      periodStart,
      periodEnd,
      periodType,
      netProfitResult.metric.currency,
      [...netProfitResult.metric.source_facts, ...revenueResult.metric.source_facts],
      "UNAVAILABLE",
      "net_margin = (net_profit / revenue) * 100 (division by zero: revenue = 0)"
    );
    return { metric, sources: [], quality: [...netProfitResult.quality, ...revenueResult.quality], warnings };
  }

  const margin = safeDivide(netProfitVal, revenueVal);
  const sourceFacts = [...netProfitResult.metric.source_facts, ...revenueResult.metric.source_facts];

  warnings.push("PARTIAL scope: net profit is partial, therefore net margin is partial.");

  const metric = createMetric(
    business_id,
    "net_margin",
    margin,
    periodStart,
    periodEnd,
    periodType,
    netProfitResult.metric.currency,
    sourceFacts,
    netProfitResult.metric.status === "PARTIAL" ? "PARTIAL" : (margin !== null ? "VALID" : "UNAVAILABLE"),
    "net_margin = (net_profit / revenue) * 100 (partial scope)"
  );

  return { metric, sources: [], quality: [...netProfitResult.quality, ...revenueResult.quality], warnings };
}

// ============================================================
// Full Period Calculation
// ============================================================

/**
 * Calculate all financial metrics for a given period.
 * This is the main entry point for the calculation engine.
 */
export function calculatePeriodMetrics(
  business_id: string,
  facts: BusinessFact[],
  periodStart: string,
  periodEnd: string,
  periodType: FinancialPeriod = "MONTHLY"
): MetricCalculationResult[] {
  const results: MetricCalculationResult[] = [];

  // Primary metrics
  const revenueResult = calculateRevenue(business_id, facts, periodStart, periodEnd, periodType);
  const cogsResult = calculateCogs(business_id, facts, periodStart, periodEnd, periodType);
  const opexResult = calculateOperatingExpenses(business_id, facts, periodStart, periodEnd, periodType);
  const cashResult = calculateCashPosition(business_id, facts, periodStart, periodEnd, periodType);
  const arResult = calculateAccountsReceivable(business_id, facts, periodStart, periodEnd, periodType);
  const apResult = calculateAccountsPayable(business_id, facts, periodStart, periodEnd, periodType);

  results.push(revenueResult, cogsResult, opexResult, cashResult, arResult, apResult);

  // Derived metrics (only if primary metrics have values)
  const grossProfitResult = calculateGrossProfit(business_id, revenueResult, cogsResult, periodStart, periodEnd, periodType);
  results.push(grossProfitResult);

  const grossMarginResult = calculateGrossMargin(business_id, grossProfitResult, revenueResult, periodStart, periodEnd, periodType);
  results.push(grossMarginResult);

  const opexRatioResult = calculateOperatingExpenseRatio(business_id, opexResult, revenueResult, periodStart, periodEnd, periodType);
  results.push(opexRatioResult);

  const netProfitResult = calculateNetProfit(business_id, grossProfitResult, opexResult, periodStart, periodEnd, periodType);
  results.push(netProfitResult);

  const netMarginResult = calculateNetMargin(business_id, netProfitResult, revenueResult, periodStart, periodEnd, periodType);
  results.push(netMarginResult);

  return results;
}
