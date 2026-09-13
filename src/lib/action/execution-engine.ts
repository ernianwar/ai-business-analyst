/**
 * SALAM LIT — Execution Engine
 *
 * Processes authorized actions through provider abstraction.
 *
 * Phase 13B: Persistent Action + Execution State Engine
 * - Uses ExecutionRepository + OutcomeRepository for write-through persistence
 * - Idempotency enforced at database level via UNIQUE constraint
 * - UNKNOWN is a first-class execution state
 *
 * CRITICAL:
 * - The Execution Engine is NOT an authorization system
 * - Phase 12 remains authoritative for authorization
 * - Authorization must be re-checked immediately before execution
 * - Do not blindly retry non-idempotent operations
 */

import type {
  Action,
  Execution,
  ExecutionOutcome,
  ExecutionStatus,
} from "../runtime/types";
import { getAction, startExecution, completeAction, failAction } from "./action-service";
import { recordActionAuditEvent } from "./audit";
import type { ExecutionProvider } from "./providers/types";
import { getExecutionRepository } from "../execution/execution-repository";
import { getOutcomeRepository } from "../execution/outcome-repository";
import { checkAuthorization } from "../approval/authorization-engine";
import { getApproval } from "../approval/approval-service";

// ──────────────────────────────────────────────────────────────────────
// PROVIDER REGISTRY
// ──────────────────────────────────────────────────────────────────────

const providers: Map<string, ExecutionProvider> = new Map();

export function registerProvider(provider: ExecutionProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): ExecutionProvider | null {
  return providers.get(name) ?? null;
}

// ──────────────────────────────────────────────────────────────────────
// IDEMPOTENCY
// ──────────────────────────────────────────────────────────────────────

/**
 * Generate an idempotency key for an action execution.
 */
export function generateIdempotencyKey(action_id: string): string {
  return `exec-${action_id}-${crypto.randomUUID()}`;
}

/**
 * Check if an idempotency key has already been used.
 * Returns the existing execution if found.
 */
export function checkIdempotency(idempotency_key: string): Execution | null {
  return getExecutionRepository().checkIdempotency(idempotency_key);
}

// ──────────────────────────────────────────────────────────────────────
// EXECUTION
// ──────────────────────────────────────────────────────────────────────

/**
 * Execute an authorized action through a provider.
 *
 * Pipeline:
 * 1. Idempotency check (MUST come before status check)
 * 2. Verify action is QUEUED
 * 3. Provider execution
 * 4. Record result
 * 5. Transition action state
 * 6. Audit
 */
export async function executeAction(params: {
  action_id: string;
  provider_name: string;
  operation: string;
  idempotency_key: string;
  timeout_ms?: number;
  workspace_id: string; // H1 HOTFIX: REQUIRED — authorization re-check cannot be skipped. Type system enforces presence.
}): Promise<Execution> {
  const repo = getExecutionRepository();
  const action = getAction(params.action_id);
  if (!action) {
    throw new Error(`Action ${params.action_id} not found`);
  }

  // Idempotency check MUST come before status check.
  const existing = repo.checkIdempotency(params.idempotency_key);
  if (existing) {
    recordActionAuditEvent({
      business_id: action.business_id,
      action_id: action.id,
      execution_id: existing.id,
      event_type: "IDEMPOTENCY_DUPLICATE",
      actor: "system",
      actor_type: "SYSTEM",
      details: {
        idempotency_key: params.idempotency_key,
        original_execution_id: existing.id,
      },
    });
    return existing;
  }

  if (action.status !== "QUEUED") {
    throw new Error(`Action ${params.action_id} is in status ${action.status}, must be QUEUED to execute`);
  }

  // Get provider
  const provider = providers.get(params.provider_name);
  if (!provider) {
    throw new Error(`Provider ${params.provider_name} not registered`);
  }

  // Create execution record
  const execution: Execution = {
    id: crypto.randomUUID(),
    business_id: action.business_id,
    action_id: action.id,
    provider: params.provider_name,
    operation: params.operation,
    idempotency_key: params.idempotency_key,
    external_reference: null,
    status: "PENDING",
    request_metadata: {
      action_type: action.action_type,
      target_type: action.target_type,
      parameters: action.parameters,
    },
    response_metadata: {},
    error_code: null,
    error_message: null,
    reconciliation_status: "NOT_REQUIRED",
    reconciled_at: null,
    reconciliation_details: null,
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    updated_at: new Date().toISOString(),
  };

  repo.create(execution);

  // Transition action to EXECUTING
  startExecution(action.id);

  // Audit: execution queued
  recordActionAuditEvent({
    business_id: action.business_id,
    action_id: action.id,
    execution_id: execution.id,
    event_type: "EXECUTION_QUEUED",
    actor: "system",
    actor_type: "SYSTEM",
    details: {
      provider: params.provider_name,
      operation: params.operation,
      idempotency_key: params.idempotency_key,
    },
  });

  // Transition to RUNNING
  repo.update(execution.id, {
    status: "RUNNING",
    started_at: new Date().toISOString(),
  });

  recordActionAuditEvent({
    business_id: action.business_id,
    action_id: action.id,
    execution_id: execution.id,
    event_type: "EXECUTION_STARTED",
    actor: "system",
    actor_type: "SYSTEM",
    details: { provider: params.provider_name },
  });

  // H1 HOTFIX: FINAL AUTHORIZATION RE-CHECK — ALWAYS runs before provider execution
  // Prevents TOCTOU: authorization may have been revoked between initial check and now
  // workspace_id is REQUIRED (type system enforces). No conditional skip.
  {
    const resolvedApproval = action.approval_id ? getApproval(action.approval_id) : null;
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

    if (!authResult.authorized) {
      // BLOCK execution — authorization revoked/expired/scope-mismatched
      repo.update(execution.id, {
        status: "FAILED",
        error_code: "AUTHORIZATION_REVOKED",
        error_message: `Authorization re-check failed: ${authResult.reason}`,
        completed_at: new Date().toISOString(),
      });
      failAction(action.id, `Authorization re-check failed: ${authResult.reason}`);
      recordActionAuditEvent({
        business_id: action.business_id,
        action_id: action.id,
        execution_id: execution.id,
        event_type: "EXECUTION_AUTHORIZATION_REVOKED",
        actor: "system",
        actor_type: "SYSTEM",
        details: {
          authorization_status: authResult.status,
          reason: authResult.reason,
          risk_level: authResult.risk_level,
        },
      });
      throw new Error(`Execution blocked: authorization re-check failed — ${authResult.reason}`);
    }
  }

  // Execute through provider
  try {
    const result = await provider.execute({
      operation: params.operation,
      idempotency_key: params.idempotency_key,
      parameters: action.parameters,
      timeout_ms: params.timeout_ms,
    });

    if (result.success) {
      repo.update(execution.id, {
        status: "SUCCEEDED",
        external_reference: result.external_reference,
        response_metadata: result.response_metadata,
        completed_at: new Date().toISOString(),
      });
      completeAction(action.id);

      recordActionAuditEvent({
        business_id: action.business_id,
        action_id: action.id,
        execution_id: execution.id,
        event_type: "EXECUTION_SUCCEEDED",
        actor: "system",
        actor_type: "SYSTEM",
        details: {
          external_reference: result.external_reference,
          response_metadata: result.response_metadata,
        },
      });

      // Create outcome
      const outcomeRepo = getOutcomeRepository();
      const outcome: ExecutionOutcome = {
        id: crypto.randomUUID(),
        business_id: action.business_id,
        action_id: action.id,
        execution_id: execution.id,
        outcome_type: "SUCCESS",
        summary: `Action ${action.action_type} executed successfully via ${params.provider_name}`,
        details: result.response_metadata,
        financial_impact: null,
        currency: null,
        created_at: new Date().toISOString(),
      };
      outcomeRepo.create(outcome);
    } else {
      if (result.error_code === "UNKNOWN_RESULT") {
        repo.update(execution.id, {
          status: "UNKNOWN",
          external_reference: result.external_reference,
          error_code: result.error_code,
          error_message: result.error_message,
          reconciliation_status: "PENDING",
          completed_at: new Date().toISOString(),
        });

        recordActionAuditEvent({
          business_id: action.business_id,
          action_id: action.id,
          execution_id: execution.id,
          event_type: "EXECUTION_UNKNOWN",
          actor: "system",
          actor_type: "SYSTEM",
          details: {
            error_code: result.error_code,
            external_reference: result.external_reference,
          },
        });
      } else {
        repo.update(execution.id, {
          status: "FAILED",
          error_code: result.error_code,
          error_message: result.error_message,
          completed_at: new Date().toISOString(),
        });

        failAction(action.id, result.error_message ?? "Execution failed");

        recordActionAuditEvent({
          business_id: action.business_id,
          action_id: action.id,
          execution_id: execution.id,
          event_type: "EXECUTION_FAILED",
          actor: "system",
          actor_type: "SYSTEM",
          details: {
            error_code: result.error_code,
            error_message: result.error_message,
          },
        });
      }
    }
  } catch (error) {
    repo.update(execution.id, {
      status: "FAILED",
      error_code: "PROVIDER_ERROR",
      error_message: error instanceof Error ? error.message : "Unknown provider error",
      completed_at: new Date().toISOString(),
    });

    failAction(action.id, error instanceof Error ? error.message : "Unknown provider error");

    recordActionAuditEvent({
      business_id: action.business_id,
      action_id: action.id,
      execution_id: execution.id,
      event_type: "EXECUTION_FAILED",
      actor: "system",
      actor_type: "SYSTEM",
      details: {
        error_code: "PROVIDER_ERROR",
        error_message: error instanceof Error ? error.message : "Unknown provider error",
      },
    });
  }

  // Return the execution from cache (ensures consistent state)
  return repo.getById(execution.id) ?? execution;
}

// ──────────────────────────────────────────────────────────────────────
// RECONCILIATION
// ──────────────────────────────────────────────────────────────────────

/**
 * Reconcile an UNKNOWN execution by checking with the provider.
 */
export async function reconcileExecution(execution_id: string): Promise<Execution | null> {
  const repo = getExecutionRepository();
  const execution = repo.getById(execution_id);
  if (!execution || execution.status !== "UNKNOWN") return null;

  const provider = providers.get(execution.provider);
  if (!provider) return null;

  if (!execution.external_reference) return null;

  recordActionAuditEvent({
    business_id: execution.business_id,
    action_id: execution.action_id,
    execution_id: execution.id,
    event_type: "RECONCILIATION_ATTEMPTED",
    actor: "system",
    actor_type: "SYSTEM",
    details: {
      provider: execution.provider,
      external_reference: execution.external_reference,
    },
  });

  try {
    const result = await provider.reconcile({
      external_reference: execution.external_reference,
      operation: execution.operation,
    });

    const updateFields: Partial<Execution> = {
      reconciliation_details: result.details,
      reconciled_at: new Date().toISOString(),
    };

    if (result.status === "SUCCEEDED") {
      updateFields.status = "SUCCEEDED";
      updateFields.reconciliation_status = "RECONCILED";
      completeAction(execution.action_id);

      const action = getAction(execution.action_id);
      if (action) {
        const outcomeRepo = getOutcomeRepository();
        const outcome: ExecutionOutcome = {
          id: crypto.randomUUID(),
          business_id: execution.business_id,
          action_id: execution.action_id,
          execution_id: execution.id,
          outcome_type: "SUCCESS",
          summary: `Action ${action.action_type} reconciled as succeeded via ${execution.provider}`,
          details: result.details,
          financial_impact: null,
          currency: null,
          created_at: new Date().toISOString(),
        };
        outcomeRepo.create(outcome);
      }
    } else if (result.status === "FAILED") {
      updateFields.status = "FAILED";
      updateFields.reconciliation_status = "RECONCILED";
      failAction(execution.action_id, "Reconciliation determined execution failed");
    } else {
      updateFields.reconciliation_status = "UNRESOLVED";
    }

    repo.update(execution.id, updateFields);

    recordActionAuditEvent({
      business_id: execution.business_id,
      action_id: execution.action_id,
      execution_id: execution.id,
      event_type: "RECONCILIATION_RESULT",
      actor: "system",
      actor_type: "SYSTEM",
      details: {
        reconciliation_status: updateFields.reconciliation_status,
        provider_status: result.status,
      },
    });
  } catch {
    repo.update(execution.id, {
      reconciliation_status: "UNRESOLVED",
    });

    recordActionAuditEvent({
      business_id: execution.business_id,
      action_id: execution.action_id,
      execution_id: execution.id,
      event_type: "RECONCILIATION_RESULT",
      actor: "system",
      actor_type: "SYSTEM",
      details: { reconciliation_status: "UNRESOLVED", error: "Reconciliation check failed" },
    });
  }

  return repo.getById(execution_id);
}

// ──────────────────────────────────────────────────────────────────────
// QUERIES
// ──────────────────────────────────────────────────────────────────────

export function getExecution(id: string): Execution | null {
  return getExecutionRepository().getById(id);
}

export function getExecutionsByAction(action_id: string): Execution[] {
  return getExecutionRepository().getByAction(action_id);
}

export function getExecutionsByBusiness(business_id: string, limit = 50): Execution[] {
  return getExecutionRepository().getByBusiness(business_id, limit);
}

export function getOutcome(id: string): ExecutionOutcome | null {
  return getOutcomeRepository().getById(id);
}

export function getOutcomeByAction(action_id: string): ExecutionOutcome | null {
  return getOutcomeRepository().getByAction(action_id);
}

export function getOutcomeByExecution(execution_id: string): ExecutionOutcome | null {
  return getOutcomeRepository().getByExecution(execution_id);
}

// ──────────────────────────────────────────────────────────────────────
// PERSISTENCE HELPERS (Phase 13B)
// ──────────────────────────────────────────────────────────────────────

export async function flushExecutions(): Promise<void> {
  await getExecutionRepository().flush();
  await getOutcomeRepository().flush();
}

export async function loadExecutionsFromDatabase(action_id?: string): Promise<void> {
  await getExecutionRepository().loadFromDatabase(action_id);
}

export function clearExecutionCache(): void {
  getExecutionRepository().clearCache();
  getOutcomeRepository().clearCache();
}
