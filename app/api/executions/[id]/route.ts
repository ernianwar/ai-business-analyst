/**
 * SALAM LIT — Execution Detail API
 *
 * Identity derived from authenticated context — never from client-supplied IDs.
 *
 * Phase 14.2.2: Migrated to authenticated context boundary
 */

import { NextRequest, NextResponse } from "next/server";
import { getExecution, reconcileExecution } from "@/lib/action/execution-engine";
import { getAction } from "@/lib/action/action-service";
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

    const execution = getExecution(id);
    if (!execution) {
      return NextResponse.json({ error: "Execution not found" }, { status: 404 });
    }

    if (ctx.business_id) {
      const execAction = getAction(execution.action_id);
      if (execAction && execAction.business_id !== ctx.business_id) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ execution });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
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

    const result = await reconcileExecution(id);
    if (!result) {
      return NextResponse.json({ error: "Execution not found or not UNKNOWN" }, { status: 404 });
    }

    if (ctx.business_id) {
      const execAction = getAction(result.action_id);
      if (execAction && execAction.business_id !== ctx.business_id) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }
    }

    return NextResponse.json({ execution: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
