/**
 * SALAM LIT — Approvals API
 *
 * Identity derived from authenticated context — never from client-supplied IDs.
 * Preserves Phase 12 authorization rules.
 *
 * Phase 14.2.2: Migrated to authenticated context boundary
 */

import { NextRequest, NextResponse } from "next/server";
import type { ActionType, ApprovalScope, ProposedAction } from "@/lib/runtime/types";
import {
  createApprovalRequest,
  createStandingAuthorization,
  getActiveStandingAuthorizations,
  getApprovalsByBusiness,
  getPendingApprovals,
  expireOldApprovals,
} from "@/lib/approval/approval-service";
import { canApproveAction, getApprovalPolicy } from "@/lib/approval/authorization-engine";
import { canCreateStandingAuthorization, type ApprovalRole } from "@/lib/approval/access-control";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import { getApprovalAuditEvents } from "@/lib/approval/audit";

function scopeFromBody(body: Record<string, unknown>): ApprovalScope {
  const scope = (body.scope ?? {}) as Record<string, unknown>;
  return {
    business_id: "",
    action_type: String(body.action_type ?? scope.action_type ?? "OTHER") as ActionType,
    max_amount: typeof scope.max_amount === "number" ? scope.max_amount : null,
    currency: typeof scope.currency === "string" ? scope.currency : null,
    vendor_payee: typeof scope.vendor_payee === "string" ? scope.vendor_payee : null,
    vendor_category: typeof scope.vendor_category === "string" ? scope.vendor_category : null,
    frequency: typeof scope.frequency === "string" ? scope.frequency : null,
    time_period: typeof scope.time_period === "string" ? scope.time_period : null,
    resource: typeof scope.resource === "string" ? scope.resource : null,
    authorized_agent: typeof scope.authorized_agent === "string" ? scope.authorized_agent : null,
  };
}

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
    const filter = new URL(req.url).searchParams.get("filter") ?? "all";

    expireOldApprovals();

    if (filter === "pending") {
      return NextResponse.json({ success: true, approvals: getPendingApprovals(business_id) });
    }
    if (filter === "audit") {
      return NextResponse.json({ success: true, events: getApprovalAuditEvents(business_id) });
    }
    if (filter === "standing") {
      return NextResponse.json({ success: true, authorizations: getActiveStandingAuthorizations(business_id) });
    }
    return NextResponse.json({
      success: true,
      approvals: getApprovalsByBusiness(business_id),
      authorizations: getActiveStandingAuthorizations(business_id),
      audit: getApprovalAuditEvents(business_id),
    });
  } catch (error) {
    // H5: Safe error — never expose internal details
    console.error("[APPROVALS] GET Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}

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
    const user_id = ctx.user_id;

    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "request");

    if (action === "request") {
      const scope = scopeFromBody(body);
      scope.business_id = business_id;

      const proposed: ProposedAction = {
        business_id,
        requested_by: user_id,
        requested_by_type: body.requested_by_type === "AGENT" ? "AGENT" : "USER",
        agent_key: typeof body.agent_key === "string" ? body.agent_key : null,
        action_type: scope.action_type,
        action_description: String(body.action_description ?? ""),
        scope,
        risk_level: getApprovalPolicy({
          business_id,
          requested_by: user_id,
          requested_by_type: body.requested_by_type === "AGENT" ? "AGENT" : "USER",
          agent_key: typeof body.agent_key === "string" ? body.agent_key : null,
          action_type: scope.action_type,
          action_description: String(body.action_description ?? ""),
          scope,
          risk_level: "L0",
          decision_id: typeof body.decision_id === "string" ? body.decision_id : null,
        }).risk_level,
        decision_id: typeof body.decision_id === "string" ? body.decision_id : null,
      };

      const approval = createApprovalRequest({
        business_id,
        requested_by: proposed.requested_by,
        requested_by_type: proposed.requested_by_type,
        action_type: scope.action_type,
        action_description: proposed.action_description,
        scope,
        decision_id: proposed.decision_id ?? undefined,
      });

      return NextResponse.json({ success: true, approval, policy: getApprovalPolicy(proposed) }, { status: 201 });
    }

    if (action === "standing") {
      if (!canCreateStandingAuthorization((ctx.role as ApprovalRole) ?? undefined)) {
        return NextResponse.json(
          { success: false, error: "Owner authorization is required" },
          { status: 403 }
        );
      }

      const authorization = createStandingAuthorization({
        business_id,
        authorized_by: user_id,
        authorized_agent: typeof body.authorized_agent === "string" ? body.authorized_agent : null,
        scope: scopeFromBody(body),
        max_amount_per_use: Number(body.max_amount_per_use),
        max_amount_per_period: Number(body.max_amount_per_period),
        period: String(body.period ?? "monthly"),
        max_uses_per_period: body.max_uses_per_period == null ? null : Number(body.max_uses_per_period),
        effective_until: typeof body.effective_until === "string" ? body.effective_until : null,
      });

      return NextResponse.json({ success: true, authorization }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error) {
    // H5: Safe error — never expose internal details
    console.error("[APPROVALS] POST Error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error", code: "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
