import type {
  Approval,
  AuthorizationResult,
  ProposedAction,
  RiskLevel,
} from "../runtime/types";
import { hasActionScope } from "../runtime/permissions";
import {
  canAccessBusiness,
  canAgentRequestAction,
  getMembership,
} from "./access-control";
import {
  alwaysRequiresApproval,
  determineRiskLevel,
  getActiveStandingAuthorizations,
  matchStandingAuthorization,
  validateScopeMatch,
} from "./approval-service";
import { recordApprovalAuditEvent } from "./audit";

function result(
  status: AuthorizationResult["status"],
  reason: string,
  risk_level: RiskLevel,
  approval_id: string | null = null,
  matched_standing_authorization_id: string | null = null
): AuthorizationResult {
  return {
    authorized: status === "AUTHORIZED",
    status,
    reason,
    risk_level,
    approval_required: status === "REQUIRES_APPROVAL" || status === "PAYMENT_REQUIRES_APPROVAL",
    approval_id,
    matched_standing_authorization_id,
  };
}

export async function checkAuthorization(params: {
  action: ProposedAction;
  workspace_id: string;
  approval?: Approval | null;
  permission?: string;
}): Promise<AuthorizationResult> {
  const { action } = params;
  const risk_level = determineRiskLevel(action);
  const access = canAccessBusiness({
    user_id: action.requested_by_type === "AGENT" ? (action.agent_key ?? "system") : action.requested_by,
    workspace_id: params.workspace_id,
    business_id: action.business_id,
    permission: params.permission ?? "REQUEST_APPROVAL",
  });

  if (!access.allowed) {
    recordApprovalAuditEvent({
      business_id: action.business_id,
      approval_id: params.approval?.id ?? null,
      event_type: "AUTHORIZATION_DENIED",
      actor: action.requested_by,
      actor_type: action.requested_by_type,
      details: { reason: access.reason, action_type: action.action_type },
    });
    return result("UNAUTHORIZED", access.reason, risk_level, params.approval?.id ?? null);
  }

  if (action.requested_by_type === "AGENT" && !canAgentRequestAction(action.agent_key, action.action_type)) {
    recordApprovalAuditEvent({
      business_id: action.business_id,
      approval_id: params.approval?.id ?? null,
      event_type: "UNAUTHORIZED_ATTEMPT",
      actor: action.requested_by,
      actor_type: "AGENT",
      details: { reason: "Agent cannot request this action" },
    });
    return result("AGENT_NOT_AUTHORIZED", "Agent is not authorized to request this action", risk_level);
  }

  // If explicit approval provided, validate it first
  if (params.approval) {
    const approval = params.approval;
    if (approval.business_id !== action.business_id) {
      return result("SCOPE_MISMATCH", "Approval belongs to a different business", risk_level, approval.id);
    }
    if (approval.status === "REVOKED") return result("REVOKED", "Approval has been revoked", risk_level, approval.id);
    if (approval.status === "EXPIRED") return result("EXPIRED", "Approval has expired", risk_level, approval.id);
    if (approval.status !== "APPROVED") return result("REQUIRES_APPROVAL", "Approval is not granted", risk_level, approval.id);
    if (!approval.expires_at || new Date(approval.expires_at) <= new Date()) {
      return result("EXPIRED", "Approved actions must have a valid future expiry", risk_level, approval.id);
    }

    const scope = validateScopeMatch(approval.scope, action.scope);
    if (!scope.matches) {
      recordApprovalAuditEvent({
        business_id: action.business_id,
        approval_id: approval.id,
        event_type: "SCOPE_MISMATCH",
        actor: action.requested_by,
        actor_type: action.requested_by_type,
        details: { mismatches: scope.mismatches },
      });
      return result("SCOPE_MISMATCH", scope.mismatches.join("; "), risk_level, approval.id);
    }
    return result("AUTHORIZED", "Approved action matches current authorization scope", risk_level, approval.id);
  }

  // No explicit approval - check for standing authorization
  const standing = await matchStandingAuthorization(action.business_id, {
    action_type: action.action_type,
    scope: action.scope,
    agent_key: action.agent_key,
  });
  if (standing) {
    // Standing authorization matches — authorize the action
    // Payment actions covered only when standing auth exactly matches scope
    return result("AUTHORIZED", "Matched narrowly scoped standing authorization", risk_level, null, standing.id);
  }

  // No approval, no standing authorization
  // Payment rule: ALL money/payment actions require explicit user approval
  if (alwaysRequiresApproval(action.action_type)) {
    recordApprovalAuditEvent({
      business_id: action.business_id,
      approval_id: null,
      event_type: "PAYMENT_REQUIRES_APPROVAL",
      actor: action.requested_by,
      actor_type: action.requested_by_type,
      details: { action_type: action.action_type },
    });
    return result("PAYMENT_REQUIRES_APPROVAL", "Money and payment actions require explicit user approval", risk_level);
  }

  // L0 actions authorized without approval
  if (risk_level === "L0") return result("AUTHORIZED", "Internal analysis action authorized", risk_level);

  // Other actions require explicit approval
  return result("REQUIRES_APPROVAL", "Explicit approval is required", risk_level);
}

export function canApproveAction(params: {
  approver_id: string;
  workspace_id: string;
  business_id: string;
  approval: Approval;
}): { allowed: boolean; reason: string } {
  // Check self-approval first (before role check) to record audit event
  if (params.approval.requested_by === params.approver_id) {
    recordApprovalAuditEvent({
      business_id: params.business_id,
      approval_id: params.approval.id,
      event_type: "AGENT_SELF_APPROVAL_BLOCKED",
      actor: params.approver_id,
      actor_type: params.approval.requested_by_type,
      details: { reason: "Self-approval attempt blocked" },
    });
    return { allowed: false, reason: "Requester cannot approve their own action" };
  }

  const access = canAccessBusiness({
    user_id: params.approver_id,
    workspace_id: params.workspace_id,
    business_id: params.business_id,
    permission: "APPROVE_ACTION",
  });
  if (!access.allowed) return access;
  if (!getMembership(params.approver_id, params.workspace_id)) {
    return { allowed: false, reason: "Approver membership cannot be verified" };
  }
  return { allowed: true, reason: "Approver is authorized" };
}

export function getApprovalPolicy(action: ProposedAction): {
  risk_level: RiskLevel;
  approval_required: boolean;
  reason: string;
} {
  const risk_level = determineRiskLevel(action);
  const approval_required = risk_level !== "L0" || alwaysRequiresApproval(action.action_type);
  return {
    risk_level,
    approval_required,
    reason: alwaysRequiresApproval(action.action_type)
      ? "Payment and money actions always require explicit user approval"
      : approval_required
        ? `Risk level ${risk_level} requires approval`
        : "Internal analysis does not require approval",
  };
}