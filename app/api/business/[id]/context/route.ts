/**
 * SALAM LIT — Context Resolution API
 *
 * Resolves the correct business context for operations.
 *
 * Phase 4: Business Context + Business Truth Foundation
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextResponse } from "next/server";
import { contextResolverService } from "@/lib/db/services/context-resolver";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/business/[id]/context
 * Resolve the full context for a business operation.
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
    const type = searchParams.get("type") ?? "full";

    let context;

    switch (type) {
      case "financial":
        context = await contextResolverService.resolveFinancialContext(id);
        break;
      case "marketing":
        context = await contextResolverService.resolveMarketingContext(id);
        break;
      case "sales":
        context = await contextResolverService.resolveSalesContext(id);
        break;
      case "hr":
        context = await contextResolverService.resolveHrContext(id);
        break;
      case "funding":
        context = await contextResolverService.resolveFundingContext(id);
        break;
      default:
        context = await contextResolverService.resolveContext(id);
    }

    if (!context) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    return NextResponse.json({ context });
  } catch (error) {
    console.error("[SALAM LIT] Context resolution error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resolve context" },
      { status: 500 }
    );
  }
}
