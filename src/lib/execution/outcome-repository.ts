/**
 * SALAM LIT — Execution Outcome Repository
 *
 * Write-through cache for ExecutionOutcome records.
 *
 * Phase 13B: Persistent Action + Execution State Engine
 */

import type { ExecutionOutcome } from "../runtime/types";
import { getSupabaseClient } from "../db/supabase-client";

const TABLE = "execution_outcomes";

class OutcomeRepository {
  private cache = new Map<string, ExecutionOutcome>();
  private byAction = new Map<string, string>();
  private byExecution = new Map<string, string>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingWrites: any[] = [];

  create(outcome: ExecutionOutcome): ExecutionOutcome {
    this.cache.set(outcome.id, { ...outcome });
    this.byAction.set(outcome.action_id, outcome.id);
    this.byExecution.set(outcome.execution_id, outcome.id);
    this.persistInsert(outcome);
    return outcome;
  }

  getById(id: string): ExecutionOutcome | null {
    const o = this.cache.get(id);
    return o ? { ...o } : null;
  }

  getByAction(action_id: string): ExecutionOutcome | null {
    const id = this.byAction.get(action_id);
    if (!id) return null;
    const o = this.cache.get(id);
    return o ? { ...o } : null;
  }

  getByExecution(execution_id: string): ExecutionOutcome | null {
    const id = this.byExecution.get(execution_id);
    if (!id) return null;
    const o = this.cache.get(id);
    return o ? { ...o } : null;
  }

  private persistInsert(outcome: ExecutionOutcome): void {
    const client = getSupabaseClient();
    if (!client) return;
    const p = client
      .from(TABLE)
      .insert({
        id: outcome.id,
        business_id: outcome.business_id,
        action_id: outcome.action_id,
        execution_id: outcome.execution_id,
        outcome_type: outcome.outcome_type,
        summary: outcome.summary,
        details: outcome.details,
        financial_impact: outcome.financial_impact,
        currency: outcome.currency,
        created_at: outcome.created_at,
      })
      .then(({ error }) => {
        if (error) console.error(`[OutcomeRepo] insert error: ${error.message}`);
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
      const outcome = this.rowToOutcome(row);
      this.cache.set(outcome.id, outcome);
      this.byAction.set(outcome.action_id, outcome.id);
      this.byExecution.set(outcome.execution_id, outcome.id);
    }
  }

  clearCache(): void {
    this.cache.clear();
    this.byAction.clear();
    this.byExecution.clear();
  }

  private rowToOutcome(row: Record<string, unknown>): ExecutionOutcome {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      action_id: row.action_id as string,
      execution_id: row.execution_id as string,
      outcome_type: row.outcome_type as ExecutionOutcome["outcome_type"],
      summary: row.summary as string,
      details: (row.details as Record<string, unknown>) ?? {},
      financial_impact: row.financial_impact as number | null,
      currency: row.currency as string | null,
      created_at: row.created_at as string,
    };
  }
}

let instance: OutcomeRepository | null = null;

export function getOutcomeRepository(): OutcomeRepository {
  if (!instance) instance = new OutcomeRepository();
  return instance;
}

export function resetOutcomeRepository(): void {
  if (instance) instance.clearCache();
  instance = null;
}
