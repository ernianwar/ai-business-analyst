/**
 * SALAM LIT — Business Facts API
 *
 * Handles CRUD operations for business facts.
 *
 * Phase 4: Business Context + Business Truth Foundation
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextResponse } from "next/server";
import { businessTruthService } from "@/lib/db/services/business-truth";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/business/[id]/facts
 * List facts for a business.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!ctx.business_id) {
      return NextResponse.json({ error: "No business context" }, { status: 400 });
    }
    if (ctx.business_id !== id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const fact_type = searchParams.get("fact_type");
    const status = searchParams.get("status");

    let facts;
    if (fact_type) {
      facts = await businessTruthService.getFactsByType(id, fact_type as any);
    } else if (status === "active") {
      facts = await businessTruthService.getActiveFactsByBusiness(id);
    } else {
      facts = await businessTruthService.getFactsByBusiness(id);
    }

    return NextResponse.json({ facts });
  } catch (error) {
    console.error("[SALAM LIT] Facts list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list facts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/business/[id]/facts
 * Create a new business fact.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (!ctx.business_id) {
      return NextResponse.json({ error: "No business context" }, { status: 400 });
    }
    if (ctx.business_id !== id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      fact_type, subject, value, unit, period_start, period_end,
      source_type, confidence, evidence_strength, freshness_status,
      created_by_type, created_by,
    } = body;

    if (!fact_type || !subject || !value || !source_type || !created_by_type) {
      return NextResponse.json(
        { error: "fact_type, subject, value, source_type, and created_by_type are required" },
        { status: 400 }
      );
    }

    const fact = await businessTruthService.createFact({
      business_id: id,
      fact_type, subject, value,
      unit: unit ?? null,
      period_start: period_start ?? null,
      period_end: period_end ?? null,
      valid_from: new Date().toISOString(),
      valid_to: null,
      source_type,
      confidence: confidence ?? 0.5,
      evidence_strength: evidence_strength ?? "MODERATE",
      freshness_status: freshness_status ?? "CURRENT",
      lifecycle_status: "ACTIVE",
      created_by_type,
      created_by: created_by ?? null,
    });

    return NextResponse.json({ fact }, { status: 201 });
  } catch (error) {
    console.error("[SALAM LIT] Fact creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create fact" },
      { status: 500 }
    );
  }
}
