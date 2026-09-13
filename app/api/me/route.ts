/**
 * SALAM LIT — /api/me
 *
 * Returns the authenticated user's resolved context.
 * Identity derived exclusively from JWT → get_user_context() RPC.
 *
 * Never accepts user_id, workspace_id, or business_id from client sources.
 *
 * Phase 14.2: Authenticated Onboarding API
 */

import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

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
      user_id: ctx.user_id,
      email: ctx.email,
      display_name: ctx.display_name,
      workspace_id: ctx.workspace_id,
      business_id: ctx.business_id,
      role: ctx.role,
      onboarding_status: ctx.onboarding_status,
    });
  } catch (error) {
    console.error("[SALAM LIT] /api/me error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
