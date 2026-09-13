/**
 * SALAM LIT — Metric Definitions API
 *
 * Returns the metric definition registry.
 *
 * Phase 6: Business Metrics & Financial Foundation
 * Phase 15.3: Authentication hardening
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getAllMetricDefinitions,
  getMetricDefinition,
} from "@/lib/metrics/definitions";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import type { MetricKey } from "@/lib/db/types";

/**
 * GET /api/business/[id]/finance/definitions
 * List all metric definitions or get a specific definition.
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

    const { searchParams } = new URL(request.url);
    const metricKey = searchParams.get("metric_key") as MetricKey | null;

    if (metricKey) {
      const definition = getMetricDefinition(metricKey);
      if (!definition) {
        return NextResponse.json(
          { error: `Metric definition not found: ${metricKey}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ definition });
    }

    const definitions = getAllMetricDefinitions();
    return NextResponse.json({ definitions });
  } catch (error) {
    console.error("Error fetching metric definitions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
