/**
 * SALAM LIT — Action Detail API
 *
 * Identity derived from authenticated context — never from client-supplied IDs.
 * All scope checks are fail-closed: if business_id is missing, deny access.
 *
 * Phase 14.2.2: Migrated to authenticated context boundary
 * Phase 15.3: Fail-closed business scope enforcement
 */

import { NextRequest, NextResponse } from "next/server";
import { getAction, cancelAction } from "@/lib/action/action-service";
import { getExecutionsByAction, getOutcomeByAction } from "@/lib/action/execution-engine";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

export async function GET(
  _request: NextRequest,
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

    if (!ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "No business context: complete onboarding first" },
        { status: 400 }
      );
    }

    const action = getAction(id);
    if (!action || action.business_id !== ctx.business_id) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    const executions = getExecutionsByAction(id);
    const outcome = getOutcomeByAction(id);

    return NextResponse.json({ action, executions, outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
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

    if (!ctx.business_id) {
      return NextResponse.json(
        { success: false, error: "No business context: complete onboarding first" },
        { status: 400 }
      );
    }

    const action = getAction(id);
    if (!action || action.business_id !== ctx.business_id) {
      return NextResponse.json({ error: "Action not found" }, { status: 404 });
    }

    const body = await request.json();

    if (body.action === "cancel") {
      if (!body.reason) {
        return NextResponse.json({ error: "reason required" }, { status: 400 });
      }
      const cancelled = cancelAction(id, body.reason);
      if (!cancelled) {
        return NextResponse.json({ error: "Action not found or cannot be cancelled" }, { status: 404 });
      }
      return NextResponse.json({ action: cancelled });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
