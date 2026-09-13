/**
 * SALAM LIT — Authorization Check API
 *
 * Identity derived from authenticated context — never from client-supplied IDs.
 *
 * Phase 14.2.2: Migrated to authenticated context boundary
 */

import { NextRequest, NextResponse } from "next/server";
import type { ProposedAction } from "@/lib/runtime/types";
import { getApproval } from "@/lib/approval/approval-service";
import { checkAuthorization } from "@/lib/approval/authorization-engine";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = (await req.json()) as { action: ProposedAction; approval_id?: string };

    if (!body.action?.business_id || !body.action.scope) {
      return NextResponse.json(
        { success: false, error: "action and scoped business context are required" },
        { status: 400 }
      );
    }

    if (body.action.business_id !== ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Business mismatch: cannot check authorization for another business" },
        { status: 403 }
      );
    }

    const approval = body.approval_id ? getApproval(body.approval_id) : null;

    const result = checkAuthorization({
      action: body.action,
      workspace_id: ctx.workspace_id ?? "",
      approval,
    });

    return NextResponse.json({ success: true, authorization: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
