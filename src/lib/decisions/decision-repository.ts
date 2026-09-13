/**
 * SALAM LIT — Decision Repository
 *
 * Write-through cache for Decision records.
 *
 * Phase 13B.1: Decision + Approval Persistence Hardening
 */

import type { Decision, DecisionStatus } from "../runtime/types";
import { getSupabaseClient } from "../db/supabase-client";

const TABLE = "decisions";

class DecisionRepository {
  private cache = new Map<string, Decision>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingWrites: any[] = [];

  create(decision: Decision): Decision {
    this.cache.set(decision.id, { ...decision });
    this.persistInsert(decision);
    return decision;
  }

  getById(id: string): Decision | null {
    const d = this.cache.get(id);
    return d ? { ...d } : null;
  }

  getByBusiness(business_id: string, limit = 50): Decision[] {
    return Array.from(this.cache.values())
      .filter((d) => d.business_id === business_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((d) => ({ ...d }));
  }

  getActiveByRecommendation(recommendation_id: string): Decision | null {
    for (const d of this.cache.values()) {
      if (d.recommendation_id === recommendation_id && d.status === "ACTIVE") {
        return { ...d };
      }
    }
    return null;
  }

  update(id: string, updates: Partial<Decision>): Decision | null {
    const existing = this.cache.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
    this.cache.set(id, updated);
    this.persistUpdate(id, updates);
    return { ...updated };
  }

  // ── PERSISTENCE ──────────────────────────────────────────────────

  private persistInsert(decision: Decision): void {
    const client = getSupabaseClient();
    if (!client) return;
    const p = client
      .from(TABLE)
      .insert({
        id: decision.id,
        business_id: decision.business_id,
        recommendation_id: decision.recommendation_id,
        investigation_id: decision.investigation_id,
        trigger_id: decision.trigger_id,
        decision_type: decision.decision_type,
        decision_maker: decision.decision_maker,
        reason: decision.reason,
        original_scope: decision.original_scope,
        modified_scope: decision.modified_scope,
        status: decision.status,
        superseded_by: decision.superseded_by,
        decision_context: decision.decision_context,
        decided_at: decision.decided_at,
        created_at: decision.created_at,
        updated_at: decision.updated_at,
      })
      .then(({ error }) => {
        if (error) console.error(`[DecisionRepo] insert error: ${error.message}`);
      });
    this.pendingWrites.push(p);
  }

  private persistUpdate(id: string, updates: Partial<Decision>): void {
    const client = getSupabaseClient();
    if (!client) return;
    const rowUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) rowUpdates.status = updates.status;
    if (updates.superseded_by !== undefined) rowUpdates.superseded_by = updates.superseded_by;
    if (updates.modified_scope !== undefined) rowUpdates.modified_scope = updates.modified_scope;
    rowUpdates.updated_at = new Date().toISOString();

    const p = client
      .from(TABLE)
      .update(rowUpdates)
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error(`[DecisionRepo] update error: ${error.message}`);
      });
    this.pendingWrites.push(p);
  }

  async flush(): Promise<void> {
    await Promise.allSettled(this.pendingWrites.map((p) => Promise.resolve(p)));
    this.pendingWrites = [];
  }

  async loadFromDatabase(business_id?: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    let query = client.from(TABLE).select("*");
    if (business_id) query = query.eq("business_id", business_id);
    const { data, error } = await query;
    if (error || !data) return;
    for (const row of data) {
      const decision = this.rowToDecision(row);
      this.cache.set(decision.id, decision);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  private rowToDecision(row: Record<string, unknown>): Decision {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      recommendation_id: row.recommendation_id as string,
      investigation_id: row.investigation_id as string | null,
      trigger_id: row.trigger_id as string | null,
      decision_type: row.decision_type as Decision["decision_type"],
      decision_maker: row.decision_maker as string,
      reason: row.reason as string,
      original_scope: row.original_scope as string | null,
      modified_scope: row.modified_scope as string | null,
      status: row.status as DecisionStatus,
      superseded_by: row.superseded_by as string | null,
      decision_context: (row.decision_context as Decision["decision_context"]) ?? {
        recommendation_title: "",
        recommendation_description: "",
        recommendation_confidence: 0,
        recommendation_impact: "",
        recommendation_risk: "",
      },
      decided_at: row.decided_at as string,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}

let instance: DecisionRepository | null = null;

export function getDecisionRepository(): DecisionRepository {
  if (!instance) instance = new DecisionRepository();
  return instance;
}

export function resetDecisionRepository(): void {
  if (instance) instance.clearCache();
  instance = null;
}
