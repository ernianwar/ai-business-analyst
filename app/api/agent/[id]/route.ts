/**
 * SALAM LIT — Investigation API
 *
 * Get investigation details, findings, insights, and recommendations.
 *
 * Phase 9: Investigation & Intelligence Engine
 * Phase 15.4.2: H6 — Business scope enforced BEFORE subtype dispatch
 */

import { NextRequest, NextResponse } from "next/server";
import { getInvestigation, getInvestigationsByBusiness } from "@/lib/orchestration/zue";
import { getInvocationsByInvestigation, getFindingsByInvestigation } from "@/lib/runtime/agent-runtime";
import { getInsightsByInvestigation } from "@/lib/intelligence/insight-engine";
import { getRecommendationsByInvestigation } from "@/lib/intelligence/recommendation-engine";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/agent/[id]
 *
 * Get investigation details with findings, insights, and recommendations.
 * H6: Business scope enforced BEFORE any data is returned.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx || !ctx.business_id) {
      return NextResponse.json(
        { error: "Business context required. Complete onboarding first.", code: "NO_BUSINESS" },
        { status: 404 }
      );
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "investigation";

    // H6: Load investigation FIRST to verify business scope before ANY data dispatch
    const investigation = getInvestigation(id);
    if (!investigation) {
      return NextResponse.json(
        { error: "Investigation not found" },
        { status: 404 }
      );
    }

    // H6: Business scope check — must happen BEFORE any subtype data is returned
    if (investigation.business_id !== ctx.business_id) {
      return NextResponse.json(
        { error: "Investigation not found" },
        { status: 404 }
      );
    }

    // Business scope verified — safe to return subtype data
    if (type === "invocations") {
      const invocations = getInvocationsByInvestigation(id);
      return NextResponse.json({ invocations });
    }

    if (type === "findings") {
      const findings = getFindingsByInvestigation(id);
      return NextResponse.json({ findings });
    }

    if (type === "insights") {
      const insights = getInsightsByInvestigation(id);
      return NextResponse.json({ insights });
    }

    if (type === "recommendations") {
      const recommendations = getRecommendationsByInvestigation(id);
      return NextResponse.json({ recommendations });
    }

    const invocations = getInvocationsByInvestigation(id);
    const findings = getFindingsByInvestigation(id);
    const insights = getInsightsByInvestigation(id);
    const recommendations = getRecommendationsByInvestigation(id);

    return NextResponse.json({
      investigation,
      invocations,
      findings,
      insights,
      recommendations,
      data_gaps: investigation.data_gaps,
      specialist_failures: investigation.specialist_failures,
    });
  } catch (error) {
    // H5: Safe error — never expose internal details
    console.error("[AGENT] GET Error:", error);
    return NextResponse.json(
      { error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
