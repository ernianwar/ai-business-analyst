/**
 * SALAM LIT — Approval Detail API
 *
 * Identity derived from authenticated context — never from client-supplied IDs.
 * Preserves Phase 12 authorization rules.
 *
 * Phase 14.2.2: Migrated to authenticated context boundary
 */

import { NextRequest, NextResponse } from "next/server";
import { getApproval, approveRequest, rejectRequest, revokeApproval } from "@/lib/approval/approval-service";
import { canApproveAction } from "@/lib/approval/authorization-engine";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const approval = getApproval(id);
    if (!approval) {
      return NextResponse.json(
        { success: false, error: "Approval not found" },
        { status: 404 }
      );
    }

    if (approval.business_id !== ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Approval not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, approval });
  } catch (error) {
    // H5: Safe error — never expose internal details
    console.error("[APPROVALS] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const approval = getApproval(id);
    if (!approval) {
      return NextResponse.json(
        { success: false, error: "Approval not found" },
        { status: 404 }
      );
    }

    if (approval.business_id !== ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Approval not found" },
        { status: 404 }
      );
    }

    const access = canApproveAction({
      approver_id: ctx.user_id,
      workspace_id: ctx.workspace_id ?? "",
      business_id: ctx.business_id,
      approval,
    });
    if (!access.allowed) {
      return NextResponse.json(
        { success: false, error: access.reason },
        { status: 403 }
      );
    }

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "");

    if (action === "approve") {
      const updated = approveRequest(id, ctx.user_id, String(body.reason ?? "Approved"), Number(body.expires_in_ms) || undefined);
      return updated
        ? NextResponse.json({ success: true, approval: updated })
        : NextResponse.json({ success: false, error: "Approval cannot be approved" }, { status: 409 });
    }

    if (action === "reject") {
      const updated = rejectRequest(id, ctx.user_id, String(body.reason ?? "Rejected"));
      return updated
        ? NextResponse.json({ success: true, approval: updated })
        : NextResponse.json({ success: false, error: "Approval cannot be rejected" }, { status: 409 });
    }

    if (action === "revoke") {
      const updated = revokeApproval(id, ctx.user_id, String(body.reason ?? "Revoked"));
      return updated
        ? NextResponse.json({ success: true, approval: updated })
        : NextResponse.json({ success: false, error: "Approval cannot be revoked" }, { status: 409 });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    // H5: Safe error — never expose internal details
    console.error("[APPROVALS] PATCH Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
