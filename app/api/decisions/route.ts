/**
 * SALAM LIT — Decisions API
 *
 * Provides endpoints for:
 *   GET  /api/decisions        — List pending/decided items or decision memory
 *   POST /api/decisions        — Create a new decision
 *
 * Identity derived from authenticated context — never from client-supplied IDs.
 *
 * Phase 14.2.2: Migrated to authenticated context boundary
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createDecision,
  getPendingDecisions,
  getDecidedItems,
  getDecisionMemoryByBusiness,
} from "@/lib/decisions/decision-service";
import {
  canViewDecisions,
  canMakeDecision,
} from "@/lib/decisions/authorization";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/decisions
 *
 * Query params:
 *   filter — "pending" | "decided" | "memory" | "all" (default: "all")
 *   limit — number (default: 50)
 *
 * Business resolved from authenticated context — not from query params.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "No business context: complete onboarding first" },
        { status: 400 }
      );
    }

    const business_id = ctx.business_id;
    const user_id = ctx.user_id;

    if (!ctx.workspace_id) {
      return NextResponse.json(
        { success: false, error: "Workspace context required" },
        { status: 400 }
      );
    }
    const filter = new URL(req.url).searchParams.get("filter") ?? "all";
    const limit = parseInt(new URL(req.url).searchParams.get("limit") ?? "50", 10);

    const auth = canViewDecisions(user_id, business_id, ctx.workspace_id);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.reason },
        { status: 403 }
      );
    }

    switch (filter) {
      case "pending": {
        const items = getPendingDecisions(business_id);
        return NextResponse.json({ success: true, items, count: items.length });
      }

      case "decided": {
        const items = getDecidedItems(business_id);
        return NextResponse.json({ success: true, items, count: items.length });
      }

      case "memory": {
        const memory = getDecisionMemoryByBusiness(business_id);
        return NextResponse.json({
          success: true,
          memory: memory.slice(0, limit),
          count: memory.length,
        });
      }

      default: {
        const pending = getPendingDecisions(business_id);
        const decided = getDecidedItems(business_id);
        const memory = getDecisionMemoryByBusiness(business_id);
        return NextResponse.json({
          success: true,
          pending,
          decided,
          memory: memory.slice(0, limit),
          summary: {
            pending_count: pending.length,
            decided_count: decided.length,
            memory_count: memory.length,
          },
        });
      }
    }
  } catch (error) {
    // H5: Safe error — never expose internal details
    console.error("[DECISIONS] Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}

/**
 * POST /api/decisions
 *
 * Body:
 *   recommendation_id — required
 *   decision_type — "APPROVE" | "APPROVE_WITH_CHANGES" | "REJECT" | "INVESTIGATE_FURTHER"
 *   reason — string
 *   modified_scope — optional string (for APPROVE_WITH_CHANGES)
 *
 * Business and decision_maker resolved from authenticated context.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "No business context: complete onboarding first" },
        { status: 400 }
      );
    }

    const business_id = ctx.business_id;
    const decision_maker = ctx.user_id;

    if (!ctx.workspace_id) {
      return NextResponse.json(
        { success: false, error: "Workspace context required" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const {
      recommendation_id,
      decision_type,
      reason,
      modified_scope,
      trigger_id,
    } = body;

    if (!recommendation_id || !decision_type || !reason) {
      return NextResponse.json(
        {
          success: false,
          error: "recommendation_id, decision_type, and reason are required",
        },
        { status: 400 }
      );
    }

    const auth = canMakeDecision(decision_maker, business_id, ctx.workspace_id);
    if (!auth.authorized) {
      return NextResponse.json(
        { success: false, error: auth.reason },
        { status: 403 }
      );
    }

    const result = createDecision({
      business_id,
      recommendation_id,
      decision_type,
      decision_maker,
      reason,
      modified_scope,
      trigger_id,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      decision: result.decision,
      message: `Decision recorded: ${decision_type}`,
    });
  } catch (error) {
    // H5: Safe error — never expose internal details
    console.error("[DECISIONS] POST Error:", error);
    return NextResponse.json({ success: false, error: "Internal server error", code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
