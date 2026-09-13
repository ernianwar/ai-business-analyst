/**
 * SALAM LIT — Financial Comparisons API
 *
 * Period-over-period comparisons for financial metrics.
 *
 * Phase 6: Business Metrics & Financial Foundation
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextRequest, NextResponse } from "next/server";
import { businessTruthService } from "@/lib/db/services/business-truth";
import {
  calculateMoM,
  calculateYoY,
  calculateAllComparisons,
} from "@/lib/metrics/comparisons";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import type { MetricKey, ComparisonType } from "@/lib/db/types";

/**
 * GET /api/business/[id]/finance/compare
 * Calculate period-over-period comparisons.
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
    const comparisonType = (searchParams.get("type") as ComparisonType) ?? "MOM";

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "period_start and period_end are required" },
        { status: 400 }
      );
    }

    const metrics = await businessTruthService.getMetricsByBusiness(business_id);
    const currentPeriod = { start: periodStart, end: periodEnd, type: "MONTHLY" as const };

    let comparisons;
    if (metricKey) {
      switch (comparisonType) {
        case "YOY":
          comparisons = [calculateYoY(business_id, metricKey, metrics, currentPeriod)];
          break;
        case "MOM":
        default:
          comparisons = [calculateMoM(business_id, metricKey, metrics, currentPeriod)];
          break;
      }
    } else {
      const metricKeys: MetricKey[] = [
        "revenue", "cogs", "gross_profit", "gross_margin",
        "operating_expenses", "net_profit", "net_margin", "cash_position",
      ];
      comparisons = calculateAllComparisons(business_id, metrics, currentPeriod, metricKeys);
    }

    return NextResponse.json({ comparisons });
  } catch (error) {
    console.error("Error calculating comparisons:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
