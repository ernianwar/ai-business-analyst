/**
 * SALAM LIT — Action Repository
 *
 * Write-through cache: in-memory Map + PostgreSQL via Supabase.
 * - Reads: from in-memory cache (synchronous)
 * - Writes: to in-memory cache + async PostgreSQL persist
 * - flush(): ensures all pending writes are persisted
 * - loadFromDatabase(): populates cache from PostgreSQL (for recovery)
 * - clearCache(): clears in-memory cache (for restart tests)
 *
 * Phase 13B: Persistent Action + Execution State Engine
 */

import type { Action, ActionStatus } from "../runtime/types";
import { getSupabaseClient } from "../db/supabase-client";

const TABLE = "actions";

// ──────────────────────────────────────────────────────────────────────
// WRITE-THROUGH CACHE REPOSITORY
// ──────────────────────────────────────────────────────────────────────

class ActionRepository {
  private cache = new Map<string, Action>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingWrites: any[] = [];

  // ── CREATE ────────────────────────────────────────────────────────

  create(action: Action): Action {
    this.cache.set(action.id, { ...action });
    this.persistInsert(action);
    return action;
  }

  // ── READ (sync, from cache) ──────────────────────────────────────

  getById(id: string): Action | null {
    const a = this.cache.get(id);
    return a ? { ...a } : null;
  }

  getByBusiness(business_id: string, limit = 50): Action[] {
    return Array.from(this.cache.values())
      .filter((a) => a.business_id === business_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }

  getByStatus(business_id: string, status: ActionStatus): Action[] {
    return Array.from(this.cache.values())
      .filter((a) => a.business_id === business_id && a.status === status)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((a) => ({ ...a }));
  }

  // ── UPDATE (sync cache + async persist) ──────────────────────────

  update(id: string, updates: Partial<Action>): Action | null {
    const existing = this.cache.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
    this.cache.set(id, updated);
    this.persistUpdate(id, updates);
    return { ...updated };
  }

  // ── PERSISTENCE ──────────────────────────────────────────────────

  private persistInsert(action: Action): void {
    const client = getSupabaseClient();
    if (!client) return;
    const p = client
      .from(TABLE)
      .insert(this.actionToRow(action))
      .then(({ error }) => {
        if (error) console.error(`[ActionRepo] insert error: ${error.message}`);
      });
    this.pendingWrites.push(p);
  }

  private persistUpdate(id: string, updates: Partial<Action>): void {
    const client = getSupabaseClient();
    if (!client) return;
    const rowUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) rowUpdates.status = updates.status;
    if (updates.authorization_result !== undefined) rowUpdates.authorization_result = updates.authorization_result;
    if (updates.blocked_reason !== undefined) rowUpdates.blocked_reason = updates.blocked_reason;
    if (updates.failure_reason !== undefined) rowUpdates.failure_reason = updates.failure_reason;
    if (updates.authorized_at !== undefined) rowUpdates.authorized_at = updates.authorized_at;
    if (updates.queued_at !== undefined) rowUpdates.queued_at = updates.queued_at;
    if (updates.started_at !== undefined) rowUpdates.started_at = updates.started_at;
    if (updates.completed_at !== undefined) rowUpdates.completed_at = updates.completed_at;
    if (updates.approval_id !== undefined) rowUpdates.approval_id = updates.approval_id;
    rowUpdates.updated_at = new Date().toISOString();

    const p = client
      .from(TABLE)
      .update(rowUpdates)
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error(`[ActionRepo] update error: ${error.message}`);
      });
    this.pendingWrites.push(p);
  }

  /**
   * Wait for all pending writes to complete.
   */
  async flush(): Promise<void> {
    await Promise.allSettled(this.pendingWrites.map((p) => Promise.resolve(p)));
    this.pendingWrites = [];
  }

  /**
   * Load all actions from PostgreSQL into the cache.
   * Used for process restart recovery.
   */
  async loadFromDatabase(business_id?: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    let query = client.from(TABLE).select("*");
    if (business_id) query = query.eq("business_id", business_id);
    const { data, error } = await query;
    if (error || !data) return;

    for (const row of data) {
      const action = this.rowToAction(row);
      this.cache.set(action.id, action);
    }
  }

  /**
   * Clear the in-memory cache.
   * Does NOT delete from PostgreSQL.
   */
  clearCache(): void {
    this.cache.clear();
  }

  // ── MAPPING ──────────────────────────────────────────────────────

  private actionToRow(action: Action): Record<string, unknown> {
    return {
      id: action.id,
      business_id: action.business_id,
      decision_id: action.decision_id,
      approval_id: action.approval_id,
      recommendation_id: action.recommendation_id,
      requested_by: action.requested_by,
      requested_by_type: action.requested_by_type,
      agent_key: action.agent_key,
      action_type: action.action_type,
      action_description: action.action_description,
      target_type: action.target_type,
      target_reference: action.target_reference,
      parameters: action.parameters,
      risk_level: action.risk_level,
      authorization_result: action.authorization_result,
      status: action.status,
      blocked_reason: action.blocked_reason,
      failure_reason: action.failure_reason,
      created_at: action.created_at,
      authorized_at: action.authorized_at,
      queued_at: action.queued_at,
      started_at: action.started_at,
      completed_at: action.completed_at,
      updated_at: action.updated_at,
    };
  }

  private rowToAction(row: Record<string, unknown>): Action {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      decision_id: row.decision_id as string | null,
      approval_id: row.approval_id as string | null,
      recommendation_id: row.recommendation_id as string | null,
      requested_by: row.requested_by as string,
      requested_by_type: row.requested_by_type as "USER" | "AGENT",
      agent_key: row.agent_key as string | null,
      action_type: row.action_type as Action["action_type"],
      action_description: row.action_description as string,
      target_type: row.target_type as string,
      target_reference: row.target_reference as string | null,
      parameters: (row.parameters as Record<string, unknown>) ?? {},
      risk_level: row.risk_level as Action["risk_level"],
      authorization_result: row.authorization_result as Action["authorization_result"],
      status: row.status as ActionStatus,
      blocked_reason: row.blocked_reason as string | null,
      failure_reason: row.failure_reason as string | null,
      created_at: row.created_at as string,
      authorized_at: row.authorized_at as string | null,
      queued_at: row.queued_at as string | null,
      started_at: row.started_at as string | null,
      completed_at: row.completed_at as string | null,
      updated_at: row.updated_at as string,
    };
  }
}

// ──────────────────────────────────────────────────────────────────────
// SINGLETON
// ──────────────────────────────────────────────────────────────────────

let instance: ActionRepository | null = null;

export function getActionRepository(): ActionRepository {
  if (!instance) instance = new ActionRepository();
  return instance;
}

export function resetActionRepository(): void {
  if (instance) {
    instance.clearCache();
  }
  instance = null;
}
