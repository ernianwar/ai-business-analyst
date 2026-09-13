/**
 * SALAM LIT — Approval Service
 *
 * Manages approval lifecycle, risk policy, and scoped approval.
 *
 * Phase 12: Approval + Authorization Engine
 *
 * CRITICAL:
 * - RECOMMENDATION ≠ DECISION ≠ APPROVAL ≠ AUTHORIZATION ≠ EXECUTION
 * - This service manages APPROVALS only
 * - Every action involving money/payment requires explicit approval
 * - AI agents may NOT approve their own actions
 */

import type {
  Approval,
  ApprovalScope,
  ActionType,
  RiskLevel,
  StandingAuthorization,
} from "../runtime/types";
import { recordApprovalAuditEvent } from "./audit";
import { getApprovalRepository } from "./approval-repository";
import { getStandingAuthRepository } from "./standing-auth-repository";

// ──────────────────────────────────────────────────────────────────────
// STANDING AUTHORIZATION USAGE
// ──────────────────────────────────────────────────────────────────────
// Phase 15.2A/15.2A.2: Usage enforcement is PostgreSQL-authoritative via RPC.
// FAIL CLOSED: if PostgreSQL usage cannot be verified, authorization is DENIED.
// No in-memory usage fallback. No silent reset to zero.

// ──────────────────────────────────────────────────────────────────────
// RISK POLICY
// ──────────────────────────────────────────────────────────────────────

/**
 * Action types that ALWAYS require approval (payment/money related).
 * No prompt or model output can override this rule.
 */
const PAYMENT_ACTION_TYPES: ActionType[] = [
  "PAYMENT",
  "TRANSFER",
  "AD_SPEND",
  "PURCHASE",
  "REFUND",
  "FINANCIAL_COMMITMENT",
];

/**
 * Action types that are L0 (internal cognitive — no external effect).
 * Reserved for future cognitive action types (analysis, summarization, etc.)
 * No existing ActionType qualifies as purely internal cognitive.
 */
const L0_ACTION_TYPES: ActionType[] = [];

/**
 * Action types that are L1 (low-risk internal).
 * Routine internal operations with minimal impact.
 */
const L1_ACTION_TYPES: ActionType[] = [
  "CUSTOMER_MESSAGE",
  "DATA_EXPORT",
  "OTHER",
];

/**
 * Action types that are L2 (consequential business action).
 */
const L2_ACTION_TYPES: ActionType[] = [
  "CONTRACT",
  "HIRING",
  "FIRING",
  "CAMPAIGN_PUBLISH",
  "SYSTEM_CHANGE",
];

/**
 * Determine risk level for an action.
 */
export function determineRiskLevel(action: {
  action_type: ActionType;
  scope: ApprovalScope;
}): RiskLevel {
  const { action_type, scope } = action;

  // L0: Internal cognitive (no external effect)
  if (L0_ACTION_TYPES.includes(action_type)) {
    return "L0";
  }

  // L1: Low-risk internal action/notification
  if (L1_ACTION_TYPES.includes(action_type)) {
    return "L1";
  }

  // L3: High-impact financial/sensitive/irreversible
  if (PAYMENT_ACTION_TYPES.includes(action_type)) {
    if (scope.max_amount !== null && scope.max_amount > 10000) {
      return "L3";
    }
    return "L2";
  }

  // L2: Consequential business action
  if (L2_ACTION_TYPES.includes(action_type)) {
    return "L2";
  }

  // Default to L2 for unknown consequential actions
  return "L2";
}

/**
 * Check if an action type always requires approval (payment rule).
 */
export function alwaysRequiresApproval(action_type: ActionType): boolean {
  return PAYMENT_ACTION_TYPES.includes(action_type);
}

// ──────────────────────────────────────────────────────────────────────
// APPROVAL CRUD
// ──────────────────────────────────────────────────────────────────────

/**
 * Create an approval request.
 */
export function createApprovalRequest(params: {
  business_id: string;
  requested_by: string;
  requested_by_type: "USER" | "AGENT";
  action_type: ActionType;
  action_description: string;
  scope: ApprovalScope;
  risk_level?: RiskLevel;
  decision_id?: string;
  standing_authorization_id?: string;
}): Approval {
  const approval: Approval = {
    id: crypto.randomUUID(),
    business_id: params.business_id,
    decision_id: params.decision_id ?? null,
    requested_by: params.requested_by,
    requested_by_type: params.requested_by_type,
    action_type: params.action_type,
    action_description: params.action_description,
    scope: params.scope,
    risk_level: determineRiskLevel({ action_type: params.action_type, scope: params.scope }),
    status: "PENDING",
    approver_id: null,
    approval_reason: null,
    rejection_reason: null,
    standing_authorization_id: params.standing_authorization_id ?? null,
    requested_at: new Date().toISOString(),
    approved_at: null,
    expires_at: null,
    revoked_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  getApprovalRepository().create(approval);
  recordApprovalAuditEvent({
    business_id: approval.business_id,
    approval_id: approval.id,
    event_type: "APPROVAL_REQUESTED",
    actor: approval.requested_by,
    actor_type: approval.requested_by_type,
    details: { action_type: approval.action_type, risk_level: approval.risk_level },
  });
  return approval;
}

/**
 * Get an approval by ID.
 */
export function getApproval(id: string): Approval | null {
  return getApprovalRepository().getById(id);
}

/**
 * Get all approvals for a business.
 */
export function getApprovalsByBusiness(business_id: string, limit: number = 50): Approval[] {
  return getApprovalRepository().getByBusiness(business_id, limit);
}

/**
 * Get pending approvals for a business.
 */
export function getPendingApprovals(business_id: string): Approval[] {
  return getApprovalRepository().getPendingByBusiness(business_id);
}

/**
 * Approve an approval request.
 */
export function approveRequest(
  approval_id: string,
  approver_id: string,
  reason: string,
  expires_in_ms = 24 * 60 * 60 * 1000
): Approval | null {
  const repo = getApprovalRepository();
  const approval = repo.getById(approval_id);
  if (!approval || approval.status !== "PENDING") return null;

  const approved_at = new Date().toISOString();
  const expires_at = expires_in_ms
    ? new Date(Date.now() + expires_in_ms).toISOString()
    : null;

  repo.update(approval_id, {
    status: "APPROVED",
    approver_id,
    approval_reason: reason,
    approved_at,
    expires_at,
  });

  recordApprovalAuditEvent({
    business_id: approval.business_id,
    approval_id: approval.id,
    event_type: "APPROVAL_GRANTED",
    actor: approver_id,
    actor_type: "USER",
    details: { expires_at },
  });

  return { ...approval, status: "APPROVED", approver_id, approval_reason: reason, approved_at, expires_at };
}

/**
 * Reject an approval request.
 */
export function rejectRequest(
  approval_id: string,
  approver_id: string,
  reason: string
): Approval | null {
  const repo = getApprovalRepository();
  const approval = repo.getById(approval_id);
  if (!approval || approval.status !== "PENDING") return null;

  repo.update(approval_id, {
    status: "REJECTED",
    approver_id,
    rejection_reason: reason,
  });

  recordApprovalAuditEvent({
    business_id: approval.business_id,
    approval_id: approval.id,
    event_type: "APPROVAL_REJECTED",
    actor: approver_id,
    actor_type: "USER",
    details: { reason },
  });

  return { ...approval, status: "REJECTED", approver_id, rejection_reason: reason };
}

/**
 * Revoke an approved approval.
 */
export function revokeApproval(
  approval_id: string,
  revoked_by: string,
  reason: string
): Approval | null {
  const repo = getApprovalRepository();
  const approval = repo.getById(approval_id);
  if (!approval || approval.status !== "APPROVED") return null;

  repo.update(approval_id, { status: "REVOKED", revoked_at: new Date().toISOString() });

  recordApprovalAuditEvent({
    business_id: approval.business_id,
    approval_id: approval.id,
    event_type: "APPROVAL_REVOKED",
    actor: revoked_by,
    actor_type: "USER",
    details: { reason },
  });

  return { ...approval, status: "REVOKED", revoked_at: new Date().toISOString() };
}

/**
 * Expire old approvals.
 */
export function expireOldApprovals(): number {
  let expiredCount = 0;
  const now = new Date();
  const repo = getApprovalRepository();

  for (const approval of repo.getAll()) {
    if (approval.status === "APPROVED" && approval.expires_at) {
      if (new Date(approval.expires_at) < now) {
        repo.update(approval.id, { status: "EXPIRED" });
        recordApprovalAuditEvent({
          business_id: approval.business_id,
          approval_id: approval.id,
          event_type: "APPROVAL_EXPIRED",
          actor: "system",
          actor_type: "SYSTEM",
          details: {},
        });
        expiredCount++;
      }
    }
  }

  return expiredCount;
}

// ──────────────────────────────────────────────────────────────────────
// STANDING AUTHORIZATION
// ──────────────────────────────────────────────────────────────────────

/**
 * Create a standing authorization.
 */
export function createStandingAuthorization(params: {
  business_id: string;
  authorized_by: string;
  authorized_agent: string | null;
  scope: ApprovalScope;
  max_amount_per_use: number;
  max_amount_per_period: number;
  period: string;
  max_uses_per_period: number | null;
  effective_from?: string;
  effective_until?: string | null;
}): StandingAuthorization {
  const auth: StandingAuthorization = {
    id: crypto.randomUUID(),
    business_id: params.business_id,
    authorized_by: params.authorized_by,
    authorized_agent: params.authorized_agent,
    scope: params.scope,
    max_amount_per_use: params.max_amount_per_use,
    max_amount_per_period: params.max_amount_per_period,
    period: params.period,
    max_uses_per_period: params.max_uses_per_period,
    active: true,
    revoked: false,
    revoked_at: null,
    revoked_by: null,
    effective_from: params.effective_from ?? new Date().toISOString(),
    effective_until: params.effective_until ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  getStandingAuthRepository().create(auth);
  recordApprovalAuditEvent({
    business_id: auth.business_id,
    approval_id: null,
    event_type: "STANDING_AUTH_CREATED",
    actor: auth.authorized_by,
    actor_type: "USER",
    details: { standing_authorization_id: auth.id, action_type: auth.scope.action_type },
  });
  return auth;
}

/**
 * Get standing authorization by ID.
 */
export function getStandingAuthorization(id: string): StandingAuthorization | null {
  return getStandingAuthRepository().getById(id);
}

/**
 * Get active standing authorizations for a business.
 */
export function getActiveStandingAuthorizations(business_id: string): StandingAuthorization[] {
  return getStandingAuthRepository().getActiveByBusiness(business_id);
}

/**
 * Get the current period start timestamp for a standing authorization.
 */
function getPeriodStart(period: string): number {
  const now = new Date();
  switch (period) {
    case "daily":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    case "weekly": {
      const day = now.getDay();
      const diff = now.getDate() - day;
      return new Date(now.getFullYear(), now.getMonth(), diff).getTime();
    }
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    case "quarterly": {
      const quarter = Math.floor(now.getMonth() / 3);
      return new Date(now.getFullYear(), quarter * 3, 1).getTime();
    }
    case "yearly":
      return new Date(now.getFullYear(), 0, 1).getTime();
    default:
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
}

/**
 * Check and increment standing authorization usage.
 * Phase 15.2A/15.2A.2: PostgreSQL-authoritative via atomic RPC.
 * FAIL CLOSED: if PostgreSQL usage cannot be verified, DENY.
 * Returns true if usage is within limits, false if exceeded or unverifiable.
 */
async function checkAndIncrementUsage(auth: StandingAuthorization): Promise<boolean> {
  if (auth.max_uses_per_period === null) return true; // No limit

  const periodStart = new Date(getPeriodStart(auth.period)).toISOString();
  const repo = getStandingAuthRepository();

  const result = await repo.checkAndIncrementUsageAtomic({
    authorization_id: auth.id,
    period_start: periodStart,
    max_uses_per_period: auth.max_uses_per_period,
  });

  if (result.dbAvailable) {
    return result.allowed;
  }

  // FAIL CLOSED: PostgreSQL is unavailable — deny usage.
  // Never assume usage = 0. Never authorize without authoritative state.
  return false;
}

/**
 * Match a proposed action against standing authorizations.
 * Enforces usage limits (max_uses_per_period) via PostgreSQL.
 * Phase 15.2A: Now async for persistent usage enforcement.
 */
export async function matchStandingAuthorization(
  business_id: string,
  action: {
    action_type: ActionType;
    scope: ApprovalScope;
    agent_key: string | null;
  }
): Promise<StandingAuthorization | null> {
  const activeAuths = getActiveStandingAuthorizations(business_id);

  for (const auth of activeAuths) {
    // Check agent authorization
    if (auth.authorized_agent && auth.authorized_agent !== action.agent_key) {
      continue;
    }

    // Check action type match
    if (auth.scope.action_type !== action.action_type) {
      continue;
    }

    // Check business match
    if (auth.scope.business_id !== action.scope.business_id) {
      continue;
    }

    // Check amount limit
    if (
      action.scope.max_amount !== null &&
      auth.max_amount_per_use < action.scope.max_amount
    ) {
      continue;
    }

    // Check vendor/payee match (if specified in standing auth)
    if (
      auth.scope.vendor_payee &&
      action.scope.vendor_payee &&
      auth.scope.vendor_payee !== action.scope.vendor_payee
    ) {
      continue;
    }

    // Check vendor category match (if specified in standing auth)
    if (
      auth.scope.vendor_category &&
      action.scope.vendor_category &&
      auth.scope.vendor_category !== action.scope.vendor_category
    ) {
      continue;
    }

    // Check currency match
    if (
      auth.scope.currency &&
      action.scope.currency &&
      auth.scope.currency !== action.scope.currency
    ) {
      continue;
    }

    // Check frequency match (if specified in standing auth)
    if (
      auth.scope.frequency &&
      action.scope.frequency &&
      auth.scope.frequency !== action.scope.frequency
    ) {
      continue;
    }

    // Check time_period match (if specified in standing auth)
    if (
      auth.scope.time_period &&
      action.scope.time_period &&
      auth.scope.time_period !== action.scope.time_period
    ) {
      continue;
    }

    // Check usage limits (PostgreSQL-authoritative)
    if (!(await checkAndIncrementUsage(auth))) {
      continue; // Exceeded usage limit for this period
    }

    return auth;
  }

  return null;
}

/**
 * Revoke a standing authorization.
 */
export function revokeStandingAuthorization(
  auth_id: string,
  revoked_by: string
): StandingAuthorization | null {
  const repo = getStandingAuthRepository();
  const auth = repo.getById(auth_id);
  if (!auth || auth.revoked) return null;

  repo.update(auth_id, {
    active: false,
    revoked: true,
    revoked_at: new Date().toISOString(),
    revoked_by,
  });

  recordApprovalAuditEvent({
    business_id: auth.business_id,
    approval_id: null,
    event_type: "STANDING_AUTH_REVOKED",
    actor: revoked_by,
    actor_type: "USER",
    details: { standing_authorization_id: auth.id },
  });

  return { ...auth, active: false, revoked: true, revoked_at: new Date().toISOString(), revoked_by };
}

// ──────────────────────────────────────────────────────────────────────
// SCOPE VALIDATION
// ──────────────────────────────────────────────────────────────────────

/**
 * Validate that an action matches an approval scope.
 */
export function validateScopeMatch(
  approval_scope: ApprovalScope,
  action_scope: ApprovalScope
): { matches: boolean; mismatches: string[] } {
  const mismatches: string[] = [];

  // Business must match
  if (approval_scope.business_id !== action_scope.business_id) {
    mismatches.push(`business: expected ${approval_scope.business_id}, got ${action_scope.business_id}`);
  }

  // Action type must match
  if (approval_scope.action_type !== action_scope.action_type) {
    mismatches.push(`action_type: expected ${approval_scope.action_type}, got ${action_scope.action_type}`);
  }

  // Amount check
  if (approval_scope.max_amount !== null && action_scope.max_amount !== null) {
    if (action_scope.max_amount > approval_scope.max_amount) {
      mismatches.push(`amount: ${action_scope.max_amount} exceeds approved ${approval_scope.max_amount}`);
    }
  }

  // Currency check
  if (approval_scope.currency !== action_scope.currency) {
    mismatches.push(`currency: expected ${approval_scope.currency ?? "none"}, got ${action_scope.currency ?? "none"}`);
  }

  // Vendor/payee check
  if (approval_scope.vendor_payee !== action_scope.vendor_payee) {
    mismatches.push(`vendor: expected ${approval_scope.vendor_payee ?? "any"}, got ${action_scope.vendor_payee ?? "none"}`);
  }

  // Vendor category check
  if (approval_scope.vendor_category !== action_scope.vendor_category) {
    mismatches.push(`vendor_category: expected ${approval_scope.vendor_category ?? "any"}, got ${action_scope.vendor_category ?? "none"}`);
  }

  // Frequency check
  if (approval_scope.frequency !== action_scope.frequency) {
    mismatches.push(`frequency: expected ${approval_scope.frequency ?? "none"}, got ${action_scope.frequency ?? "none"}`);
  }

  // Time period check
  if (approval_scope.time_period !== action_scope.time_period) {
    mismatches.push(`time_period: expected ${approval_scope.time_period ?? "none"}, got ${action_scope.time_period ?? "none"}`);
  }

  // Agent check
  if (approval_scope.authorized_agent !== action_scope.authorized_agent) {
    mismatches.push(`agent: expected ${approval_scope.authorized_agent ?? "any"}, got ${action_scope.authorized_agent ?? "none"}`);
  }

  return { matches: mismatches.length === 0, mismatches };
}
