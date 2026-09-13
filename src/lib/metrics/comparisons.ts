/**
 * SALAM LIT — Period Comparison Engine
 *
 * Deterministic period-over-period comparisons.
 * Supports MoM, YoY, and previous-period comparisons.
 *
 * Phase 6: Business Metrics & Financial Foundation
 */

import type {
  MetricComparison,
  MetricKey,
  MetricStatus,
  ComparisonType,
  BusinessFact,
  FinancialPeriod,
  PeriodRange,
  BusinessMetric,
} from "../db/types";

/**
 * Calculate the previous period range for a given period.
 */
export function getPreviousPeriod(range: PeriodRange): PeriodRange | null {
  const start = new Date(range.start);
  const end = new Date(range.end);

  switch (range.type) {
    case "MONTHLY": {
      const prevStart = new Date(start);
      prevStart.setMonth(prevStart.getMonth() - 1);
      const prevEnd = new Date(end);
      prevEnd.setMonth(prevEnd.getMonth() - 1);
      return {
        start: prevStart.toISOString().split("T")[0],
        end: prevEnd.toISOString().split("T")[0],
        type: "MONTHLY",
      };
    }
    case "QUARTERLY": {
      const prevStart = new Date(start);
      prevStart.setMonth(prevStart.getMonth() - 3);
      const prevEnd = new Date(end);
      prevEnd.setMonth(prevEnd.getMonth() - 3);
      return {
        start: prevStart.toISOString().split("T")[0],
        end: prevEnd.toISOString().split("T")[0],
        type: "QUARTERLY",
      };
    }
    case "YEARLY": {
      const prevStart = new Date(start);
      prevStart.setFullYear(prevStart.getFullYear() - 1);
      const prevEnd = new Date(end);
      prevEnd.setFullYear(prevEnd.getFullYear() - 1);
      return {
        start: prevStart.toISOString().split("T")[0],
        end: prevEnd.toISOString().split("T")[0],
        type: "YEARLY",
      };
    }
    case "WEEKLY": {
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 7);
      const prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 7);
      return {
        start: prevStart.toISOString().split("T")[0],
        end: prevEnd.toISOString().split("T")[0],
        type: "WEEKLY",
      };
    }
    case "DAILY": {
      const prevStart = new Date(start);
      prevStart.setDate(prevStart.getDate() - 1);
      const prevEnd = new Date(end);
      prevEnd.setDate(prevEnd.getDate() - 1);
      return {
        start: prevStart.toISOString().split("T")[0],
        end: prevEnd.toISOString().split("T")[0],
        type: "DAILY",
      };
    }
    case "CUSTOM": {
      const diffMs = end.getTime() - start.getTime();
      const prevEnd = new Date(start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - diffMs);
      return {
        start: prevStart.toISOString().split("T")[0],
        end: prevEnd.toISOString().split("T")[0],
        type: "CUSTOM",
      };
    }
    default:
      return null;
  }
}

/**
 * Calculate the same period last year.
 */
export function getSamePeriodLastYear(range: PeriodRange): PeriodRange {
  const start = new Date(range.start);
  const end = new Date(range.end);

  start.setFullYear(start.getFullYear() - 1);
  end.setFullYear(end.getFullYear() - 1);

  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
    type: range.type,
  };
}

/**
 * Find a metric for a specific period.
 */
function findMetricForPeriod(
  metrics: BusinessMetric[],
  metricKey: MetricKey,
  periodStart: string,
  periodEnd: string
): BusinessMetric | null {
  return (
    metrics.find(
      (m) =>
        m.metric_key === metricKey &&
        m.period_start === periodStart &&
        m.period_end === periodEnd
    ) ?? null
  );
}

/**
 * Calculate a period-over-period comparison for a given metric.
 */
export function calculateComparison(
  business_id: string,
  metricKey: MetricKey,
  metrics: BusinessMetric[],
  currentPeriod: PeriodRange,
  comparisonType: ComparisonType
): MetricComparison {
  let previousPeriod: PeriodRange | null = null;

  switch (comparisonType) {
    case "MOM":
      previousPeriod = getPreviousPeriod(currentPeriod);
      break;
    case "YOY":
      previousPeriod = getSamePeriodLastYear(currentPeriod);
      break;
    case "PREVIOUS_PERIOD":
      previousPeriod = getPreviousPeriod(currentPeriod);
      break;
    case "CUSTOM":
      previousPeriod = getPreviousPeriod(currentPeriod);
      break;
  }

  if (!previousPeriod) {
    return {
      id: crypto.randomUUID(),
      metric_key: metricKey,
      business_id,
      current_period_start: currentPeriod.start,
      current_period_end: currentPeriod.end,
      previous_period_start: "",
      previous_period_end: "",
      current_value: null,
      previous_value: null,
      absolute_change: null,
      percentage_change: null,
      comparison_type: comparisonType,
      status: "UNAVAILABLE",
      currency: null,
      calculated_at: new Date().toISOString(),
    };
  }

  const currentMetric = findMetricForPeriod(
    metrics,
    metricKey,
    currentPeriod.start,
    currentPeriod.end
  );
  const previousMetric = findMetricForPeriod(
    metrics,
    metricKey,
    previousPeriod.start,
    previousPeriod.end
  );

  const currentValue = currentMetric?.numeric_value ?? null;
  const previousValue = previousMetric?.numeric_value ?? null;

  // Determine status
  let status: MetricStatus = "VALID";
  if (currentValue === null && previousValue === null) {
    status = "INSUFFICIENT_DATA";
  } else if (currentValue === null) {
    status = "INSUFFICIENT_DATA";
  } else if (previousValue === null) {
    status = "PARTIAL";
  }

  // Calculate changes
  let absoluteChange: number | null = null;
  let percentageChange: number | null = null;

  if (currentValue !== null && previousValue !== null) {
    absoluteChange = currentValue - previousValue;
    if (previousValue !== 0) {
      percentageChange = (absoluteChange / Math.abs(previousValue)) * 100;
    }
  }

  const currency = currentMetric?.currency ?? previousMetric?.currency ?? null;

  return {
    id: crypto.randomUUID(),
    metric_key: metricKey,
    business_id,
    current_period_start: currentPeriod.start,
    current_period_end: currentPeriod.end,
    previous_period_start: previousPeriod.start,
    previous_period_end: previousPeriod.end,
    current_value: currentValue,
    previous_value: previousValue,
    absolute_change: absoluteChange,
    percentage_change: percentageChange,
    comparison_type: comparisonType,
    status,
    currency,
    calculated_at: new Date().toISOString(),
  };
}

/**
 * Calculate MoM comparison for a metric.
 */
export function calculateMoM(
  business_id: string,
  metricKey: MetricKey,
  metrics: BusinessMetric[],
  currentPeriod: PeriodRange
): MetricComparison {
  return calculateComparison(
    business_id,
    metricKey,
    metrics,
    currentPeriod,
    "MOM"
  );
}

/**
 * Calculate YoY comparison for a metric.
 */
export function calculateYoY(
  business_id: string,
  metricKey: MetricKey,
  metrics: BusinessMetric[],
  currentPeriod: PeriodRange
): MetricComparison {
  return calculateComparison(
    business_id,
    metricKey,
    metrics,
    currentPeriod,
    "YOY"
  );
}

/**
 * Calculate all comparisons for a set of metrics.
 */
export function calculateAllComparisons(
  business_id: string,
  metrics: BusinessMetric[],
  currentPeriod: PeriodRange,
  metricKeys: MetricKey[]
): MetricComparison[] {
  const comparisons: MetricComparison[] = [];

  for (const key of metricKeys) {
    comparisons.push(calculateMoM(business_id, key, metrics, currentPeriod));
    comparisons.push(calculateYoY(business_id, key, metrics, currentPeriod));
  }

  return comparisons;
}

/**
 * Calculate trend direction from a comparison.
 */
export function getTrendDirection(
  comparison: MetricComparison
): "UP" | "DOWN" | "FLAT" | "UNKNOWN" {
  if (comparison.percentage_change === null) return "UNKNOWN";
  if (Math.abs(comparison.percentage_change) < 0.01) return "FLAT";
  return comparison.percentage_change > 0 ? "UP" : "DOWN";
}

/**
 * Format a comparison as a human-readable string.
 */
export function formatComparison(comparison: MetricComparison): string {
  const { metric_key, current_value, previous_value, percentage_change, comparison_type } = comparison;

  if (current_value === null) return `${metric_key}: No current data`;
  if (previous_value === null) return `${metric_key}: ${current_value} (no previous period)`;
  if (percentage_change === null) return `${metric_key}: ${current_value} (cannot calculate change)`;

  const direction = percentage_change > 0 ? "increased" : percentage_change < 0 ? "decreased" : "unchanged";
  return `${metric_key}: ${current_value} (${direction} ${Math.abs(percentage_change).toFixed(2)}% ${comparison_type})`;
}
