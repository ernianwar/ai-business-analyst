/**
 * SALAM LIT — Financial Metrics API
 *
 * CRUD operations for financial metrics within a business.
 * Supports metric calculation, retrieval, and provenance tracking.
 *
 * Phase 6: Business Metrics & Financial Foundation
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextRequest, NextResponse } from "next/server";
import { businessTruthService } from "@/lib/db/services/business-truth";
import { calculatePeriodMetrics } from "@/lib/metrics/financial-metrics";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import type { FinancialPeriod, MetricKey } from "@/lib/db/types";

/**
 * GET /api/business/[id]/finance
 * List all financial metrics for a business.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: business_id } = await params;

    if (!ctx.business_id) {
      return NextResponse.json({ error: "No business context" }, { status: 400 });
    }
    if (ctx.business_id !== business_id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const periodStart = searchParams.get("period_start");
    const periodEnd = searchParams.get("period_end");
    const metricKey = searchParams.get("metric_key") as MetricKey | null;

    let metrics;
    if (periodStart && periodEnd) {
      metrics = await businessTruthService.getMetricsForPeriod(business_id, periodStart, periodEnd);
    } else if (metricKey) {
      metrics = await businessTruthService.getMetricsByKey(business_id, metricKey);
    } else {
      metrics = await businessTruthService.getMetricsByBusiness(business_id);
    }

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Error fetching financial metrics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/business/[id]/finance
 * Calculate and store financial metrics for a period.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: business_id } = await params;

    if (!ctx.business_id) {
      return NextResponse.json({ error: "No business context" }, { status: 400 });
    }
    if (ctx.business_id !== business_id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const { period_start, period_end, period_type } = body;

    if (!period_start || !period_end) {
      return NextResponse.json({ error: "period_start and period_end are required" }, { status: 400 });
    }

    const facts = await businessTruthService.getActiveFactsByBusiness(business_id);
    const results = calculatePeriodMetrics(
      business_id, facts, period_start, period_end,
      (period_type as FinancialPeriod) ?? "MONTHLY"
    );

    const storedMetrics = [];
    for (const result of results) {
      const metric = await businessTruthService.createMetric({
        business_id: result.metric.business_id,
        metric_type: result.metric.metric_type,
        metric_name: result.metric.metric_name,
        metric_key: result.metric.metric_key,
        value: result.metric.value,
        numeric_value: result.metric.numeric_value,
        unit: result.metric.unit,
        currency: result.metric.currency,
        period_start: result.metric.period_start,
        period_end: result.metric.period_end,
        period_type: result.metric.period_type,
        calculation_method: result.metric.calculation_method,
        calculation_version: result.metric.calculation_version,
        source_facts: result.metric.source_facts,
        status: result.metric.status,
        confidence: result.metric.confidence,
        freshness_status: result.metric.freshness_status,
      });

      for (const source of result.sources) {
        await businessTruthService.addMetricSource({
          metric_id: metric.id,
          fact_id: source.fact_id,
          contribution_weight: source.contribution_weight,
          contribution_value: source.contribution_value,
        });
      }

      storedMetrics.push({ metric, quality: result.quality, warnings: result.warnings });
    }

    return NextResponse.json({
      message: "Financial metrics calculated and stored",
      period: { start: period_start, end: period_end },
      metric_count: storedMetrics.length,
      metrics: storedMetrics,
    });
  } catch (error) {
    console.error("Error calculating financial metrics:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
