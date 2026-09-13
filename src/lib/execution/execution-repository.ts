/**
 * SALAM LIT — Execution Repository
 *
 * Write-through cache: in-memory Map + PostgreSQL via Supabase.
 * Enforces idempotency at the database level via UNIQUE constraint.
 *
 * Phase 13B: Persistent Action + Execution State Engine
 */

import type { Execution, ExecutionStatus } from "../runtime/types";
import { getSupabaseClient } from "../db/supabase-client";

const TABLE = "executions";

class ExecutionRepository {
  private cache = new Map<string, Execution>();
  private idempotencyIndex = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingWrites: any[] = [];

  // ── CREATE (with idempotency) ────────────────────────────────────

  /**
   * Insert an execution. If the idempotency_key already exists,
   * returns the existing execution (database-level uniqueness enforced).
   */
  create(execution: Execution): Execution {
    // Check cache first (fast path)
    const existingId = this.idempotencyIndex.get(execution.idempotency_key);
    if (existingId) {
      const existing = this.cache.get(existingId);
      if (existing) return { ...existing };
    }

    // Write to cache
    this.cache.set(execution.id, { ...execution });
    this.idempotencyIndex.set(execution.idempotency_key, execution.id);

    // Persist to PostgreSQL (async, UNIQUE constraint prevents duplicates)
    this.persistInsert(execution);

    return execution;
  }

  /**
   * Check idempotency. Returns existing execution if key already used.
   */
  checkIdempotency(idempotency_key: string): Execution | null {
    const existingId = this.idempotencyIndex.get(idempotency_key);
    if (!existingId) return null;
    const existing = this.cache.get(existingId);
    return existing ? { ...existing } : null;
  }

  // ── READ ─────────────────────────────────────────────────────────

  getById(id: string): Execution | null {
    const e = this.cache.get(id);
    return e ? { ...e } : null;
  }

  getByAction(action_id: string): Execution[] {
    return Array.from(this.cache.values())
      .filter((e) => e.action_id === action_id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((e) => ({ ...e }));
  }

  getByBusiness(business_id: string, limit = 50): Execution[] {
    return Array.from(this.cache.values())
      .filter((e) => e.business_id === business_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  // ── UPDATE ───────────────────────────────────────────────────────

  update(id: string, updates: Partial<Execution>): Execution | null {
    const existing = this.cache.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
    this.cache.set(id, updated);
    this.persistUpdate(id, updates);
    return { ...updated };
  }

  // ── PERSISTENCE ──────────────────────────────────────────────────

  private persistInsert(execution: Execution): void {
    const client = getSupabaseClient();
    if (!client) return;
    const p = client
      .from(TABLE)
      .insert(this.executionToRow(execution))
      .then(({ error }) => {
        if (error) {
          // UNIQUE constraint violation = idempotency duplicate (expected)
          if (error.code === "23505") return;
          console.error(`[ExecutionRepo] insert error: ${error.message}`);
        }
      });
    this.pendingWrites.push(p);
  }

  private persistUpdate(id: string, updates: Partial<Execution>): void {
    const client = getSupabaseClient();
    if (!client) return;
    const rowUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) rowUpdates.status = updates.status;
    if (updates.external_reference !== undefined) rowUpdates.external_reference = updates.external_reference;
    if (updates.response_metadata !== undefined) rowUpdates.response_metadata = updates.response_metadata;
    if (updates.error_code !== undefined) rowUpdates.error_code = updates.error_code;
    if (updates.error_message !== undefined) rowUpdates.error_message = updates.error_message;
    if (updates.reconciliation_status !== undefined) rowUpdates.reconciliation_status = updates.reconciliation_status;
    if (updates.reconciled_at !== undefined) rowUpdates.reconciled_at = updates.reconciled_at;
    if (updates.reconciliation_details !== undefined) rowUpdates.reconciliation_details = updates.reconciliation_details;
    if (updates.started_at !== undefined) rowUpdates.started_at = updates.started_at;
    if (updates.completed_at !== undefined) rowUpdates.completed_at = updates.completed_at;
    rowUpdates.updated_at = new Date().toISOString();

    const p = client
      .from(TABLE)
      .update(rowUpdates)
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error(`[ExecutionRepo] update error: ${error.message}`);
      });
    this.pendingWrites.push(p);
  }

  async flush(): Promise<void> {
    await Promise.allSettled(this.pendingWrites.map((p) => Promise.resolve(p)));
    this.pendingWrites = [];
  }

  async loadFromDatabase(action_id?: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    let query = client.from(TABLE).select("*");
    if (action_id) query = query.eq("action_id", action_id);
    const { data, error } = await query;
    if (error || !data) return;

    for (const row of data) {
      const execution = this.rowToExecution(row);
      this.cache.set(execution.id, execution);
      this.idempotencyIndex.set(execution.idempotency_key, execution.id);
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.idempotencyIndex.clear();
  }

  // ── MAPPING ──────────────────────────────────────────────────────

  private executionToRow(e: Execution): Record<string, unknown> {
    return {
      id: e.id,
      business_id: e.business_id,
      action_id: e.action_id,
      provider: e.provider,
      operation: e.operation,
      idempotency_key: e.idempotency_key,
      external_reference: e.external_reference,
      status: e.status,
      request_metadata: e.request_metadata,
      response_metadata: e.response_metadata,
      error_code: e.error_code,
      error_message: e.error_message,
      reconciliation_status: e.reconciliation_status,
      reconciled_at: e.reconciled_at,
      reconciliation_details: e.reconciliation_details,
      created_at: e.created_at,
      started_at: e.started_at,
      completed_at: e.completed_at,
      updated_at: e.updated_at,
    };
  }

  private rowToExecution(row: Record<string, unknown>): Execution {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      action_id: row.action_id as string,
      provider: row.provider as string,
      operation: row.operation as string,
      idempotency_key: row.idempotency_key as string,
      external_reference: row.external_reference as string | null,
      status: row.status as ExecutionStatus,
      request_metadata: (row.request_metadata as Record<string, unknown>) ?? {},
      response_metadata: (row.response_metadata as Record<string, unknown>) ?? {},
      error_code: row.error_code as string | null,
      error_message: row.error_message as string | null,
      reconciliation_status: row.reconciliation_status as Execution["reconciliation_status"],
      reconciled_at: row.reconciled_at as string | null,
      reconciliation_details: row.reconciliation_details as Record<string, unknown> | null,
      created_at: row.created_at as string,
      started_at: row.started_at as string | null,
      completed_at: row.completed_at as string | null,
      updated_at: row.updated_at as string,
    };
  }
}

let instance: ExecutionRepository | null = null;

export function getExecutionRepository(): ExecutionRepository {
  if (!instance) instance = new ExecutionRepository();
  return instance;
}

export function resetExecutionRepository(): void {
  if (instance) instance.clearCache();
  instance = null;
}
