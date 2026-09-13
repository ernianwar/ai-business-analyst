/**
 * SALAM LIT — Action Service
 *
 * Manages action lifecycle: PROPOSED → AUTHORIZED → QUEUED → EXECUTING → COMPLETED
 *
 * Phase 13B: Persistent Action + Execution State Engine
 * - Uses ActionRepository for write-through cache persistence
 * - PostgreSQL is authoritative when configured
 * - In-memory fallback for local development/testing
 *
 * CRITICAL:
 * - ACTION ≠ APPROVAL ≠ AUTHORIZATION ≠ EXECUTION
 * - An action must never become AUTHORIZED without passing authorization
 * - The Execution Engine is NOT an authorization system
 * - Phase 12 remains authoritative for authorization
 */

import type {
  Action,
  ActionStatus,
  ActionType,
  AuthorizationResult,
  RiskLevel,
} from "../runtime/types";
import { checkAuthorization } from "../approval/authorization-engine";
import { getApproval } from "../approval/approval-service";
import { recordActionAuditEvent } from "./audit";
import { getActionRepository } from "./action-repository";

// ──────────────────────────────────────────────────────────────────────
// ACTION CRUD (delegates to repository)
// ──────────────────────────────────────────────────────────────────────

/**
 * Create a new action in PROPOSED status.
 * The action is NOT authorized until checkAndAuthorizeAction succeeds.
 */
export function createAction(params: {
  business_id: string;
  decision_id?: string | null;
  approval_id?: string | null;
  recommendation_id?: string | null;
  requested_by: string;
  requested_by_type: "USER" | "AGENT";
  agent_key?: string | null;
  action_type: ActionType;
  action_description: string;
  target_type: string;
  target_reference?: string | null;
  parameters?: Record<string, unknown>;
  risk_level: RiskLevel;
}): Action {
  const action: Action = {
    id: crypto.randomUUID(),
    business_id: params.business_id,
    decision_id: params.decision_id ?? null,
    approval_id: params.approval_id ?? null,
    recommendation_id: params.recommendation_id ?? null,
    requested_by: params.requested_by,
    requested_by_type: params.requested_by_type,
    agent_key: params.agent_key ?? null,
    action_type: params.action_type,
    action_description: params.action_description,
    target_type: params.target_type,
    target_reference: params.target_reference ?? null,
    parameters: params.parameters ?? {},
    risk_level: params.risk_level,
    authorization_result: null,
    status: "PROPOSED",
    blocked_reason: null,
    failure_reason: null,
    created_at: new Date().toISOString(),
    authorized_at: null,
    queued_at: null,
    started_at: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
  };

  getActionRepository().create(action);
  recordActionAuditEvent({
    business_id: action.business_id,
    action_id: action.id,
    execution_id: null,
    event_type: "ACTION_CREATED",
    actor: action.requested_by,
    actor_type: action.requested_by_type,
    details: {
      action_type: action.action_type,
      target_type: action.target_type,
      risk_level: action.risk_level,
    },
  });
  return action;
}

/**
 * Get an action by ID.
 */
export function getAction(id: string): Action | null {
  return getActionRepository().getById(id);
}

/**
 * Get all actions for a business.
 */
export function getActionsByBusiness(business_id: string, limit = 50): Action[] {
  return getActionRepository().getByBusiness(business_id, limit);
}

/**
 * Get actions by status for a business.
 */
export function getActionsByStatus(business_id: string, status: ActionStatus): Action[] {
  return getActionRepository().getByStatus(business_id, status);
}

// ──────────────────────────────────────────────────────────────────────
// AUTHORIZATION HANDOFF
// ──────────────────────────────────────────────────────────────────────

/**
 * Check authorization and, if authorized, transition action to AUTHORIZED.
 * This is the ONLY way an action becomes AUTHORIZED.
 *
 * Authorization is re-checked at execution time — this does not grant
 * permanent authorization.
 */
export async function checkAndAuthorizeAction(params: {
  action_id: string;
  workspace_id: string;
  approval_id?: string | null;
}): Promise<{ authorized: boolean; result: AuthorizationResult }> {
  const repo = getActionRepository();
  const action = repo.getById(params.action_id);
  if (!action) {
    return {
      authorized: false,
      result: {
        authorized: false,
        status: "UNAUTHORIZED",
        reason: "Action not found",
        risk_level: "L2",
        approval_required: true,
        approval_id: null,
        matched_standing_authorization_id: null,
      },
    };
  }

  if (action.status === "CANCELLED") {
    return {
      authorized: false,
      result: {
        authorized: false,
        status: "DENIED",
        reason: "Action has been cancelled",
        risk_level: action.risk_level,
        approval_required: false,
        approval_id: null,
        matched_standing_authorization_id: null,
      },
    };
  }

  if (action.status === "BLOCKED") {
    return {
      authorized: false,
      result: {
        authorized: false,
        status: "DENIED",
        reason: action.blocked_reason ?? "Action is blocked",
        risk_level: action.risk_level,
        approval_required: false,
        approval_id: null,
        matched_standing_authorization_id: null,
      },
    };
  }

  // Delegate to Phase 12 authorization engine
  const resolvedApproval = params.approval_id
    ? getApproval(params.approval_id)
    : action.approval_id
      ? getApproval(action.approval_id)
      : null;

  const actionScope = {
    business_id: action.business_id,
    action_type: action.action_type,
    max_amount: typeof action.parameters.amount === "number" ? action.parameters.amount : null,
    currency: typeof action.parameters.currency === "string" ? action.parameters.currency : null,
    vendor_payee: typeof action.parameters.vendor_payee === "string" ? action.parameters.vendor_payee : null,
    vendor_category: typeof action.parameters.vendor_category === "string" ? action.parameters.vendor_category : null,
    frequency: typeof action.parameters.frequency === "string" ? action.parameters.frequency : null,
    time_period: typeof action.parameters.time_period === "string" ? action.parameters.time_period : null,
    resource: action.target_type,
    authorized_agent: action.agent_key,
  };

  const authResult = await checkAuthorization({
    action: {
      business_id: action.business_id,
      requested_by: action.requested_by,
      requested_by_type: action.requested_by_type,
      agent_key: action.agent_key,
      action_type: action.action_type,
      action_description: action.action_description,
      scope: actionScope,
      risk_level: action.risk_level,
      decision_id: action.decision_id,
    },
    workspace_id: params.workspace_id,
    approval: resolvedApproval,
  });

  if (authResult.authorized) {
    repo.update(action.id, {
      authorization_result: authResult,
      status: "AUTHORIZED",
      authorized_at: new Date().toISOString(),
      // HOTFIX: Store approval_id on action so executeAction re-check can resolve it
      ...(authResult.approval_id ? { approval_id: authResult.approval_id } : {}),
    });
    recordActionAuditEvent({
      business_id: action.business_id,
      action_id: action.id,
      execution_id: null,
      event_type: "ACTION_AUTHORIZED",
      actor: "system",
      actor_type: "SYSTEM",
      details: {
        authorization_status: authResult.status,
        risk_level: authResult.risk_level,
        approval_id: authResult.approval_id,
      },
    });
  } else {
    const updates: Partial<Action> = {
      authorization_result: authResult,
    };
    if (authResult.status === "REQUIRES_APPROVAL" || authResult.status === "PAYMENT_REQUIRES_APPROVAL") {
      updates.status = "PROPOSED";
    } else {
      updates.status = "BLOCKED";
      updates.blocked_reason = authResult.reason;
    }
    repo.update(action.id, updates);
    recordActionAuditEvent({
      business_id: action.business_id,
      action_id: action.id,
      execution_id: null,
      event_type: "ACTION_AUTHORIZATION_FAILED",
      actor: "system",
      actor_type: "SYSTEM",
      details: {
        authorization_status: authResult.status,
        reason: authResult.reason,
      },
    });
  }

  return { authorized: authResult.authorized, result: authResult };
}

// ──────────────────────────────────────────────────────────────────────
// LIFECYCLE TRANSITIONS
// ──────────────────────────────────────────────────────────────────────

/**
 * Transition action to QUEUED status.
 * Only AUTHORIZED actions can be queued.
 */
export function queueAction(action_id: string): Action | null {
  const repo = getActionRepository();
  const action = repo.getById(action_id);
  if (!action || action.status !== "AUTHORIZED") return null;

  const updated = repo.update(action_id, {
    status: "QUEUED",
    queued_at: new Date().toISOString(),
  });
  if (!updated) return null;

  recordActionAuditEvent({
    business_id: action.business_id,
    action_id: action.id,
    execution_id: null,
    event_type: "ACTION_QUEUED",
    actor: "system",
    actor_type: "SYSTEM",
    details: {},
  });
  return updated;
}

/**
 * Transition action to EXECUTING status.
 * Only QUEUED actions can start executing.
 */
export function startExecution(action_id: string): Action | null {
  const repo = getActionRepository();
  const action = repo.getById(action_id);
  if (!action || action.status !== "QUEUED") return null;

  const updated = repo.update(action_id, {
    status: "EXECUTING",
    started_at: new Date().toISOString(),
  });
  if (!updated) return null;

  recordActionAuditEvent({
    business_id: action.business_id,
    action_id: action.id,
    execution_id: null,
    event_type: "ACTION_EXECUTING",
    actor: "system",
    actor_type: "SYSTEM",
    details: {},
  });
  return updated;
}

/**
 * Transition action to COMPLETED status.
 */
export function completeAction(action_id: string): Action | null {
  const repo = getActionRepository();
  const action = repo.getById(action_id);
  if (!action || action.status !== "EXECUTING") return null;

  const updated = repo.update(action_id, {
    status: "COMPLETED",
    completed_at: new Date().toISOString(),
  });
  if (!updated) return null;

  recordActionAuditEvent({
    business_id: action.business_id,
    action_id: action.id,
    execution_id: null,
    event_type: "ACTION_COMPLETED",
    actor: "system",
    actor_type: "SYSTEM",
    details: {},
  });
  return updated;
}

/**
 * Transition action to FAILED status.
 */
export function failAction(action_id: string, reason: string): Action | null {
  const repo = getActionRepository();
  const action = repo.getById(action_id);
  if (!action) return null;
  if (action.status !== "EXECUTING" && action.status !== "QUEUED") return null;

  const updated = repo.update(action_id, {
    status: "FAILED",
    failure_reason: reason,
  });
  if (!updated) return null;

  recordActionAuditEvent({
    business_id: action.business_id,
    action_id: action.id,
    execution_id: null,
    event_type: "ACTION_FAILED",
    actor: "system",
    actor_type: "SYSTEM",
    details: { reason },
  });
  return updated;
}

/**
 * Cancel an action. Only PROPOSED or QUEUED actions can be cancelled.
 */
export function cancelAction(action_id: string, reason: string): Action | null {
  const repo = getActionRepository();
  const action = repo.getById(action_id);
  if (!action) return null;
  if (action.status !== "PROPOSED" && action.status !== "QUEUED") return null;

  const updated = repo.update(action_id, {
    status: "CANCELLED",
    blocked_reason: reason,
  });
  if (!updated) return null;

  recordActionAuditEvent({
    business_id: action.business_id,
    action_id: action.id,
    execution_id: null,
    event_type: "ACTION_CANCELLED",
    actor: "system",
    actor_type: "SYSTEM",
    details: { reason },
  });
  return updated;
}

// ──────────────────────────────────────────────────────────────────────
// PERSISTENCE HELPERS (Phase 13B)
// ──────────────────────────────────────────────────────────────────────

/**
 * Flush all pending writes to PostgreSQL.
 */
export async function flushActions(): Promise<void> {
  await getActionRepository().flush();
}

/**
 * Load actions from PostgreSQL into cache (for process restart recovery).
 */
export async function loadActionsFromDatabase(business_id?: string): Promise<void> {
  await getActionRepository().loadFromDatabase(business_id);
}

/**
 * Clear in-memory cache (for restart tests).
 */
export function clearActionCache(): void {
  getActionRepository().clearCache();
}
