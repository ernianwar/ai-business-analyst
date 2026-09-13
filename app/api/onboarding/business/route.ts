/**
 * SALAM LIT — /api/onboarding/business
 *
 * POST: Creates a business for the authenticated user's workspace.
 * GET:  Returns current business status for the authenticated user.
 *
 * Calls hardened create_business_with_context(ws_id, name, industry, desc, website).
 * workspace_id comes from authenticated context ONLY — never from client.
 *
 * Phase 14.2: Authenticated Onboarding API
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * POST /api/onboarding/business
 *
 * Creates a business + default context in the authenticated user's workspace.
 * Accepts ONLY: name, industry, description, website.
 * Does NOT accept: user_id, workspace_id.
 */
export async function POST(request: NextRequest) {
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
    const { name, industry, description, website } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Business name is required" },
        { status: 400 }
      );
    }

    if (website && typeof website === "string" && website.trim().length > 0) {
      try {
        new URL(website.trim());
      } catch {
        return NextResponse.json(
          { error: "Invalid website URL" },
          { status: 400 }
        );
      }
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("create_business_with_context", {
      p_workspace_id: ctx.workspace_id,
      p_name: name.trim(),
      p_industry: industry ?? null,
      p_description: description ?? null,
      p_website: website?.trim() ?? null,
    });

    if (error) {
      console.error("[SALAM LIT] Business creation RPC error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create business" },
        { status: 400 }
      );
    }

    return NextResponse.json({ business: data }, { status: 201 });
  } catch (error) {
    console.error("[SALAM LIT] /api/onboarding/business POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/onboarding/business
 *
 * Returns current business information for the authenticated user.
 * Does NOT accept business_id from client — resolved from session.
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

    return NextResponse.json({
      business_id: ctx.business_id,
      workspace_id: ctx.workspace_id,
      onboarding_status: ctx.onboarding_status,
      has_business: ctx.business_id !== null,
    });
  } catch (error) {
    console.error("[SALAM LIT] /api/onboarding/business GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
