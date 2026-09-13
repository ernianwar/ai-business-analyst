/**
 * SALAM LIT — Executions API
 *
 * Identity derived from authenticated context — never from client-supplied IDs.
 * All scope checks are fail-closed: if business_id is missing, deny access.
 *
 * Phase 14.2.2: Migrated to authenticated context boundary
 * Phase 15.3: Fail-closed business scope enforcement
 */

import { NextRequest, NextResponse } from "next/server";
import {
  executeAction,
  reconcileExecution,
  getExecution,
  getExecutionsByBusiness,
  registerProvider,
  getProvider,
  generateIdempotencyKey,
} from "@/lib/action/execution-engine";
import { queueAction, getAction } from "@/lib/action/action-service";
import { testProvider } from "@/lib/action/providers";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

if (!getProvider("test-provider")) {
  registerProvider(testProvider);
}

export async function GET(request: NextRequest) {
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

    const searchParams = new URL(request.url).searchParams;
    const execution_id = searchParams.get("execution_id");
    const reconcile = searchParams.get("reconcile");

    if (execution_id && reconcile === "true") {
      const result = await reconcileExecution(execution_id);
      if (!result) {
        return NextResponse.json({ error: "Execution not found or not UNKNOWN" }, { status: 404 });
      }

      const execAction = getAction(result.action_id);
      if (!execAction || execAction.business_id !== ctx.business_id) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }

      return NextResponse.json({ execution: result });
    }

    if (execution_id) {
      const execution = getExecution(execution_id);
      if (!execution) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }

      const execAction = getAction(execution.action_id);
      if (!execAction || execAction.business_id !== ctx.business_id) {
        return NextResponse.json({ error: "Execution not found" }, { status: 404 });
      }

      return NextResponse.json({ execution });
    }

    return NextResponse.json({ executions: getExecutionsByBusiness(ctx.business_id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    if (!ctx.workspace_id) {
      return NextResponse.json(
        { success: false, error: "Workspace context required" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { action: verb } = body;

    if (verb === "execute") {
      if (!body.action_id || !body.provider || !body.operation) {
        return NextResponse.json({ error: "action_id, provider, and operation required" }, { status: 400 });
      }

      const existingAction = getAction(body.action_id);
      if (!existingAction || existingAction.business_id !== ctx.business_id) {
        return NextResponse.json({ error: "Action not found" }, { status: 404 });
      }

      if (!getProvider(body.provider)) {
        if (body.provider === "test-provider") {
          registerProvider(testProvider);
        } else {
          return NextResponse.json({ error: `Provider ${body.provider} not registered` }, { status: 400 });
        }
      }

      if (existingAction.status === "AUTHORIZED") {
        queueAction(body.action_id);
      }

      const idempotency_key = body.idempotency_key || generateIdempotencyKey(body.action_id);

      const execution = await executeAction({
        action_id: body.action_id,
        provider_name: body.provider,
        operation: body.operation,
        idempotency_key,
        timeout_ms: body.timeout_ms,
        workspace_id: ctx.workspace_id, // H1 HOTFIX: REQUIRED — derived from authenticated context, never from client
      });

      return NextResponse.json({ execution, idempotency_key }, { status: 201 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
