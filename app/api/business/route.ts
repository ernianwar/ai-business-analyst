/**
 * SALAM LIT — Business Context API
 *
 * Handles CRUD operations for business context.
 * Identity derived from authenticated context — never from client-supplied IDs.
 *
 * Phase 4: Business Context + Business Truth Foundation
 * Phase 14.2.1: Migrated to authenticated context boundary
 */

import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import { businessContextService } from "@/lib/db/services/business-context";

/**
 * GET /api/business
 * List businesses for the authenticated user's workspace.
 * Workspace resolved from authenticated context — not from query params.
 */
export async function GET() {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!ctx.workspace_id) {
      return NextResponse.json(
        { businesses: [] }
      );
    }

    const businesses = await businessContextService.getBusinessesByWorkspace(
      ctx.workspace_id
    );

    return NextResponse.json({ businesses });
  } catch (error) {
    console.error("[SALAM LIT] Business list error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to list businesses",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/business
 * Create a new business in the authenticated user's workspace.
 * Workspace resolved from authenticated context — not from request body.
 */
export async function POST(request: Request) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!ctx.workspace_id) {
      return NextResponse.json(
        { error: "Workspace required: create a workspace before adding a business" },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      name,
      ssm_registration_no,
      ssm_registered_address,
      office_phone,
      nature_of_business,
      business_type,
      industry,
      location,
      description,
      years_operating,
      business_stage,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const business = await businessContextService.createBusiness({
      workspace_id: ctx.workspace_id,
      name,
      ssm_registration_no: ssm_registration_no ?? null,
      ssm_registered_address: ssm_registered_address ?? null,
      office_phone: office_phone ?? null,
      nature_of_business: nature_of_business ?? null,
      business_type: business_type ?? null,
      industry: industry ?? null,
      location: location ?? null,
      description: description ?? null,
      years_operating: years_operating ?? null,
      business_stage: business_stage ?? null,
      status: "ACTIVE",
    });

    return NextResponse.json({ business }, { status: 201 });
  } catch (error) {
    console.error("[SALAM LIT] Business creation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create business",
      },
      { status: 500 }
    );
  }
}
