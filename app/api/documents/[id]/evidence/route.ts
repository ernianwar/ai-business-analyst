/**
 * SALAM LIT — Document Evidence API
 *
 * Get evidence extracted from a document.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextRequest, NextResponse } from "next/server";
import { getExtractedEvidence } from "@/lib/ingestion/ingestion-service";
import { businessTruthService } from "@/lib/db/services/business-truth";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/documents/[id]/evidence
 *
 * Get all evidence extracted from a document.
 * Verifies document belongs to authenticated user's business.
 * Business scope derived from authenticated context — never from client.
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

    if (!ctx.business_id) {
      return NextResponse.json(
        { error: "No business context: complete onboarding first" },
        { status: 400 }
      );
    }

    const { id: document_id } = await params;

    // Verify document exists and belongs to authenticated business
    const document = await businessTruthService.getDocument(document_id);
    if (!document || document.business_id !== ctx.business_id) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Get evidence and verify business ownership (defense in depth)
    const evidence = getExtractedEvidence(document_id).filter(
      (e) => e.business_id === ctx.business_id
    );

    return NextResponse.json({
      document_id,
      evidence_count: evidence.length,
      evidence,
    });
  } catch (error) {
    console.error("Error fetching document evidence:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
