/**
 * SALAM LIT — Decision Detail API
 *
 * Provides endpoints for:
 *   GET  /api/decisions/[id]   — Get decision details
 *   PATCH /api/decisions/[id]  — Supersede or cancel a decision
 *
 * Identity derived from authenticated context — never from client-supplied IDs.
 *
 * Phase 14.2.2: Migrated to authenticated context boundary
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getDecision,
  supersedeDecision,
  cancelDecision,
  createDecision,
} from "@/lib/decisions/decision-service";
import {
  canViewDecisions,
  canSupersedeDecision,
} from "@/lib/decisions/authorization";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/decisions/[id]
 */
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

    const decision = getDecision(id);
    if (!decision) {
      return NextResponse.json(
        { success: false, error: "Decision not found" },
        { status: 404 }
      );
    }

    if (!ctx.workspace_id) {
      return NextResponse.json(
        { success: false, error: "Workspace context required" },
        { status: 400 }
      );
    }

    const auth = canViewDecisions(ctx.user_id, decision.business_id, ctx.workspace_id);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.reason },
        { status: 403 }
      );
    }

    if (decision.business_id !== ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Decision not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/decisions/[id]
 *
 * Body:
 *   action — "supersede" | "cancel"
 *   For supersede: decision_type, reason, modified_scope (optional)
 *   For cancel: reason (optional)
 */
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

    const body = await req.json();
    const { action } = body;

    const existingDecision = getDecision(id);
    if (!existingDecision) {
      return NextResponse.json(
        { success: false, error: "Decision not found" },
        { status: 404 }
      );
    }

    if (existingDecision.business_id !== ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Decision not found" },
        { status: 404 }
      );
    }

    if (!ctx.workspace_id) {
      return NextResponse.json(
        { success: false, error: "Workspace context required" },
        { status: 400 }
      );
    }

    const auth = canSupersedeDecision(ctx.user_id, existingDecision.business_id, ctx.workspace_id);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.reason },
        { status: 403 }
      );
    }

    if (action === "cancel") {
      const result = cancelDecision(id);
      if (!result) {
        return NextResponse.json(
          { success: false, error: "Cannot cancel decision" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        decision: result,
        message: "Decision cancelled",
      });
    }

    if (action === "supersede") {
      const { decision_type, reason, modified_scope } = body;
      if (!decision_type || !reason) {
        return NextResponse.json(
          { success: false, error: "decision_type and reason are required" },
          { status: 400 }
        );
      }

      const newResult = createDecision({
        business_id: existingDecision.business_id,
        recommendation_id: existingDecision.recommendation_id,
        decision_type,
        decision_maker: ctx.user_id,
        reason,
        modified_scope,
        trigger_id: existingDecision.trigger_id ?? undefined,
      });

      if (!newResult.success || !newResult.decision) {
        return NextResponse.json(
          { success: false, error: newResult.error },
          { status: 400 }
        );
      }

      supersedeDecision(id, newResult.decision);

      return NextResponse.json({
        success: true,
        old_decision: existingDecision,
        new_decision: newResult.decision,
        message: "Decision superseded",
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
