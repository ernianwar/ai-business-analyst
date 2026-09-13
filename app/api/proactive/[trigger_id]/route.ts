/**
 * SALAM LIT — Trigger Detail API
 *
 * Provides endpoints for:
 *   GET  /api/proactive/[trigger_id] — Get trigger details
 *   PATCH /api/proactive/[trigger_id] — Dismiss trigger
 */

import { NextRequest, NextResponse } from "next/server";
import { getTrigger, dismissTrigger } from "@/lib/proactive/trigger-manager";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/proactive/[trigger_id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ trigger_id: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx || !ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Business context required. Complete onboarding first.", code: "NO_BUSINESS" },
        { status: 404 }
      );
    }

    const { trigger_id } = await params;
    const trigger = getTrigger(trigger_id);

    if (!trigger) {
      return NextResponse.json(
        { success: false, error: "Trigger not found" },
        { status: 404 }
      );
    }

    if (trigger.business_id !== ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Trigger not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      trigger: {
        id: trigger.id,
        rule_id: trigger.rule_id,
        rule_name: trigger.rule_name,
        event: trigger.event,
        priority: trigger.priority,
        status: trigger.status,
        assigned_agents: trigger.assigned_agents,
        investigation_id: trigger.investigation_id,
        created_at: trigger.created_at,
        updated_at: trigger.updated_at,
        started_at: trigger.started_at,
        completed_at: trigger.completed_at,
        error: trigger.error,
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
 * PATCH /api/proactive/[trigger_id]
 *
 * Dismiss a trigger.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ trigger_id: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx || !ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Business context required. Complete onboarding first.", code: "NO_BUSINESS" },
        { status: 404 }
      );
    }

    const { trigger_id } = await params;
    const body = await req.json();
    const { action } = body;

    if (action !== "dismiss") {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}. Only "dismiss" is supported.` },
        { status: 400 }
      );
    }

    const trigger = getTrigger(trigger_id);

    if (!trigger) {
      return NextResponse.json(
        { success: false, error: "Trigger not found or cannot be dismissed" },
        { status: 404 }
      );
    }

    if (trigger.business_id !== ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "Trigger not found or cannot be dismissed" },
        { status: 404 }
      );
    }

    const dismissed = dismissTrigger(trigger_id);

    if (!dismissed) {
      return NextResponse.json(
        { success: false, error: "Trigger not found or cannot be dismissed" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Trigger dismissed",
      trigger: {
        id: dismissed.id,
        status: dismissed.status,
        updated_at: dismissed.updated_at,
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
