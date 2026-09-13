/**
 * SALAM LIT — /api/onboarding/status
 *
 * Returns the authenticated user's onboarding state.
 * Provides enough information for the onboarding UI to determine next steps.
 *
 * Identity derived exclusively from JWT → get_user_context() RPC.
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

    const has_workspace = ctx.workspace_id !== null;
    const has_business = ctx.business_id !== null;
    const onboarding_complete = ctx.onboarding_status === "COMPLETE";

    return NextResponse.json({
      user_id: ctx.user_id,
      onboarding_status: ctx.onboarding_status,
      workspace_id: ctx.workspace_id,
      business_id: ctx.business_id,
      role: ctx.role,
      has_workspace,
      has_business,
      onboarding_complete,
    });
  } catch (error) {
    console.error("[SALAM LIT] /api/onboarding/status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
