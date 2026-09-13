/**
 * SALAM LIT — /api/onboarding/workspace
 *
 * POST: Creates a workspace for the authenticated user.
 * GET:  Returns current workspace status for the authenticated user.
 *
 * Calls hardened create_workspace_with_owner(name, slug) RPC.
 * RPC derives identity from auth.uid() — no user_id accepted from client.
 *
 * Phase 14.2: Authenticated Onboarding API
 */

import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/db/supabase-server";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * POST /api/onboarding/workspace
 *
 * Creates a workspace + OWNER membership for the authenticated user.
 * Accepts ONLY: name, slug.
 * Does NOT accept: user_id.
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

    const body = await request.json();
    const { name, slug } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Workspace name is required" },
        { status: 400 }
      );
    }

    if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
      return NextResponse.json(
        { error: "Workspace slug is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("create_workspace_with_owner", {
      p_name: name.trim(),
      p_slug: slug.trim(),
    });

    if (error) {
      console.error("[SALAM LIT] Workspace creation RPC error:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create workspace" },
        { status: 400 }
      );
    }

    return NextResponse.json({ workspace: data }, { status: 201 });
  } catch (error) {
    console.error("[SALAM LIT] /api/onboarding/workspace POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/onboarding/workspace
 *
 * Returns current workspace information for the authenticated user.
 * Does NOT accept workspace_id from client — resolved from session.
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
      workspace_id: ctx.workspace_id,
      role: ctx.role,
      onboarding_status: ctx.onboarding_status,
      has_workspace: ctx.workspace_id !== null,
    });
  } catch (error) {
    console.error("[SALAM LIT] /api/onboarding/workspace GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
