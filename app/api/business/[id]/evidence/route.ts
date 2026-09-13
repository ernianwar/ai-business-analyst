/**
 * SALAM LIT — Evidence API
 *
 * Handles CRUD operations for evidence.
 *
 * Phase 4: Business Context + Business Truth Foundation
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextResponse } from "next/server";
import { businessTruthService } from "@/lib/db/services/business-truth";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/business/[id]/evidence
 * List evidence for a business.
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

    const evidence = await businessTruthService.getEvidenceByBusiness(id);
    return NextResponse.json({ evidence });
  } catch (error) {
    console.error("[SALAM LIT] Evidence list error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list evidence" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/business/[id]/evidence
 * Create a new evidence record.
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
      data_source_id,
      document_id,
      evidence_type,
      content_reference,
      excerpt,
      source_timestamp,
      classification,
      source_reliability,
      content_hash,
    } = body;

    if (!data_source_id || !evidence_type || !content_reference) {
      return NextResponse.json(
        { error: "data_source_id, evidence_type, and content_reference are required" },
        { status: 400 }
      );
    }

    const evidence = await businessTruthService.createEvidence({
      business_id: id,
      data_source_id,
      document_id: document_id ?? null,
      evidence_type,
      content_reference,
      excerpt: excerpt ?? null,
      source_timestamp: source_timestamp ?? null,
      retrieved_at: new Date().toISOString(),
      classification: classification ?? "INTERNAL",
      source_reliability: source_reliability ?? "MEDIUM",
      content_hash: content_hash ?? null,
      status: "ACTIVE",
    });

    return NextResponse.json({ evidence }, { status: 201 });
  } catch (error) {
    console.error("[SALAM LIT] Evidence creation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create evidence" },
      { status: 500 }
    );
  }
}
