/**
 * SALAM LIT — Actions API
 *
 * Identity derived from authenticated context — never from client-supplied IDs.
 *
 * Phase 14.2.2: Migrated to authenticated context boundary
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createAction,
  getActionsByBusiness,
  checkAndAuthorizeAction,
  queueAction,
  cancelAction,
  getAction,
} from "@/lib/action/action-service";
import { getActionAuditEvents } from "@/lib/action/audit";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

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

    const business_id = ctx.business_id;
    const searchParams = new URL(request.url).searchParams;
    const status = searchParams.get("status");
    const audit = searchParams.get("audit");

    if (audit === "true") {
      return NextResponse.json({ events: getActionAuditEvents(business_id) });
    }

    if (status) {
      return NextResponse.json({
        actions: getActionsByBusiness(business_id).filter((a) => a.status === status),
      });
    }

    return NextResponse.json({ actions: getActionsByBusiness(business_id) });
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

    const body = await request.json();
    const { action: verb } = body;

    if (verb === "create") {
      const action = createAction({
        business_id: ctx.business_id,
        decision_id: body.decision_id,
        approval_id: body.approval_id,
        recommendation_id: body.recommendation_id,
        requested_by: ctx.user_id,
        requested_by_type: body.requested_by_type,
        agent_key: body.agent_key,
        action_type: body.action_type,
        action_description: body.action_description,
        target_type: body.target_type,
        target_reference: body.target_reference,
        parameters: body.parameters,
        risk_level: body.risk_level,
      });
      return NextResponse.json({ action }, { status: 201 });
    }

    if (verb === "authorize") {
      if (!body.action_id) {
        return NextResponse.json({ error: "action_id required" }, { status: 400 });
      }

      const existingAction = getAction(body.action_id);
      if (existingAction && existingAction.business_id !== ctx.business_id) {
        return NextResponse.json({ error: "Action not found" }, { status: 404 });
      }

      const result = await checkAndAuthorizeAction({
        action_id: body.action_id,
        workspace_id: ctx.workspace_id ?? "",
        approval_id: body.approval_id,
      });
      return NextResponse.json(result);
    }

    if (verb === "queue") {
      if (!body.action_id) {
        return NextResponse.json({ error: "action_id required" }, { status: 400 });
      }

      const existingAction = getAction(body.action_id);
      if (existingAction && existingAction.business_id !== ctx.business_id) {
        return NextResponse.json({ error: "Action not found" }, { status: 404 });
      }

      const action = queueAction(body.action_id);
      if (!action) {
        return NextResponse.json({ error: "Action not found or not authorized" }, { status: 404 });
      }
      return NextResponse.json({ action });
    }

    if (verb === "cancel") {
      if (!body.action_id || !body.reason) {
        return NextResponse.json({ error: "action_id and reason required" }, { status: 400 });
      }

      const existingAction = getAction(body.action_id);
      if (existingAction && existingAction.business_id !== ctx.business_id) {
        return NextResponse.json({ error: "Action not found" }, { status: 404 });
      }

      const action = cancelAction(body.action_id, body.reason);
      if (!action) {
        return NextResponse.json({ error: "Action not found or cannot be cancelled" }, { status: 404 });
      }
      return NextResponse.json({ action });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
