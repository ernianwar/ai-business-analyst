/**
 * SALAM LIT — Business Context API (by ID)
 *
 * Handles CRUD operations for a specific business context.
 *
 * Phase 4: Business Context + Business Truth Foundation
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextResponse } from "next/server";
import { businessContextService } from "@/lib/db/services/business-context";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import { filterBusinessPatchFields } from "@/lib/security/sanitize";

/**
 * GET /api/business/[id]
 * Get a specific business with full context bundle.
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

    const bundle = await businessContextService.getBusinessContextBundle(id);

    if (!bundle) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({ business: bundle });
  } catch (error) {
    console.error("[SALAM LIT] Business fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch business" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/business/[id]
 * Update a specific business.
 */
export async function PATCH(
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

    // C5: Mass assignment prevention — filter to only mutable fields
    const { filtered, rejected } = filterBusinessPatchFields(body);
    if (rejected.length > 0) {
      return NextResponse.json(
        { error: `Cannot modify server-controlled fields: ${rejected.join(", ")}` },
        { status: 400 }
      );
    }

    const business = await businessContextService.updateBusiness(id, filtered);

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({ business });
  } catch (error) {
    console.error("[SALAM LIT] Business update error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update business" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/business/[id]
 * Delete a specific business.
 */
export async function DELETE(
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

    const deleted = await businessContextService.deleteBusiness(id);

    if (!deleted) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[SALAM LIT] Business deletion error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete business" },
      { status: 500 }
    );
  }
}
