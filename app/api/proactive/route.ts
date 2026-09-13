/**
 * SALAM LIT — Proactive Triggers API
 *
 * Provides endpoints for:
 *   GET  /api/proactive        — List triggers and work queue
 *   POST /api/proactive        — Evaluate rules and create triggers
 *   GET  /api/proactive/status — Worker status
 */

import { NextRequest, NextResponse } from "next/server";
import { proactiveWorkEngine } from "@/lib/proactive";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import type { AgentKey } from "@/lib/agents/definitions";

/**
 * GET /api/proactive
 *
 * Returns proactive triggers and work queue for a business.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx || !ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Business context required. Complete onboarding first.", code: "NO_BUSINESS" },
        { status: 404 }
      );
    }

    proactiveWorkEngine.initialize();

    const summary = proactiveWorkEngine.getWorkQueueSummary(ctx.business_id);

    return NextResponse.json({
      success: true,
      business_id: ctx.business_id,
      triggers: summary.items.map((item) => ({
        id: item.trigger.id,
        rule_name: item.trigger.rule_name,
        event_summary: item.event.summary,
        priority: item.trigger.priority,
        status: item.trigger.status,
        assigned_agents: item.trigger.assigned_agents,
        investigation_id: item.trigger.investigation_id,
        created_at: item.trigger.created_at,
        status_label: item.status_label,
        recommendation_count: item.recommendation_count,
      })),
      summary: {
        total: summary.total,
        critical: summary.critical,
        important: summary.important,
        upcoming: summary.upcoming,
        routine: summary.routine,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Unauthenticated")) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/proactive
 *
 * Evaluate business rules and create new triggers.
 */
export async function POST(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx || !ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Business context required. Complete onboarding first.", code: "NO_BUSINESS" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      action = "evaluate",
      specialist_scope,
    } = body;

    const requestedScope = specialist_scope as unknown;
    if (requestedScope !== undefined &&
      (!Array.isArray(requestedScope) || requestedScope.some((key) => key !== "erni"))) {
      return NextResponse.json(
        { success: false, error: "Only the Erni first-proof scope is supported" },
        { status: 400 }
      );
    }

    proactiveWorkEngine.initialize();

    if (action === "evaluate") {
      const result = await proactiveWorkEngine.runCycle({
        business_id: ctx.business_id,
        user_id: ctx.user_id,
        workspace_id: ctx.workspace_id!,
        specialist_scope: requestedScope as AgentKey[] | undefined,
      });

      return NextResponse.json({
        success: true,
        status: result.status ?? "COMPLETED",
        message: result.status === "INSUFFICIENT_BUSINESS_DATA"
          ? "Business check could not evaluate this business because no legitimate business truth is available."
          : `Evaluation complete: ${result.triggers_created} trigger(s) created, ${result.investigations_started} investigation(s) started`,
        result,
      });
    }

    if (action === "cleanup") {
      const result = proactiveWorkEngine.cleanup();

      return NextResponse.json({
        success: true,
        message: `Cleanup complete: ${result.expired_triggers} trigger(s) expired, ${result.cleaned_dedup_records} dedup record(s) cleaned`,
        result,
      });
    }

    return NextResponse.json(
      { success: false, error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Unauthenticated")) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
