/**
 * SALAM LIT — Standing Authorization Repository
 *
 * Write-through cache for StandingAuthorization records.
 * Phase 13B.1: Decision + Approval Persistence Hardening
 * Phase 15.2A: Persistent usage enforcement via PostgreSQL RPC
 * Phase 15.2A.2: Fail-closed — no in-memory usage fallback
 *
 * PostgreSQL is authoritative for usage enforcement.
 * When DB is unavailable, usage verification FAILS CLOSED (denies).
 */

import type { StandingAuthorization } from "../runtime/types";
import { getSupabaseClient } from "../db/supabase-client";

const TABLE = "standing_authorizations";
const USAGE_TABLE = "standing_auth_usage";

class StandingAuthRepository {
  private cache = new Map<string, StandingAuthorization>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingWrites: any[] = [];

  create(auth: StandingAuthorization): StandingAuthorization {
    this.cache.set(auth.id, { ...auth });
    this.persistInsert(auth);
    return auth;
  }

  getById(id: string): StandingAuthorization | null {
    const a = this.cache.get(id);
    return a ? { ...a } : null;
  }

  getActiveByBusiness(business_id: string): StandingAuthorization[] {
    const now = new Date();
    return Array.from(this.cache.values())
      .filter((a) => {
        if (a.business_id !== business_id) return false;
        if (!a.active || a.revoked) return false;
        if (new Date(a.effective_from) > now) return false;
        if (a.effective_until && new Date(a.effective_until) < now) return false;
        return true;
      })
      .map((a) => ({ ...a }));
  }

  update(id: string, updates: Partial<StandingAuthorization>): StandingAuthorization | null {
    const existing = this.cache.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
    this.cache.set(id, updated);
    this.persistUpdate(id, updates);
    return { ...updated };
  }

  // ── USAGE ENFORCEMENT (PostgreSQL authoritative) ──────────────────

  /**
   * Atomically check and increment standing authorization usage.
   * Uses PostgreSQL RPC for atomic concurrency-safe enforcement.
   * Returns { allowed: boolean, dbAvailable: boolean }.
   * When dbAvailable is false, caller MUST fail closed (deny usage).
   */
  async checkAndIncrementUsageAtomic(params: {
    authorization_id: string;
    period_start: string;
    max_uses_per_period: number;
  }): Promise<{ allowed: boolean; dbAvailable: boolean }> {
    const client = getSupabaseClient();
    if (!client) return { allowed: false, dbAvailable: false };

    const { data, error } = await client.rpc("increment_standing_auth_usage", {
      p_authorization_id: params.authorization_id,
      p_period_start: params.period_start,
      p_max_uses: params.max_uses_per_period,
    });

    if (error) {
      // FK violation means authorization doesn't exist in DB yet
      // (e.g., in-memory-only standing auth). Fall back to non-DB path.
      if (error.message?.includes("foreign key") || error.message?.includes("23503")) {
        return { allowed: false, dbAvailable: false };
      }
      console.error(`[StandingAuthRepo] usage RPC error: ${error.message}`);
      return { allowed: false, dbAvailable: true };
    }

    return { allowed: data === true, dbAvailable: true };
  }

  /**
   * Get current usage count for an authorization in a period.
   * Returns 0 if no usage record exists.
   */
  async getUsageCount(authorization_id: string, period_start: string): Promise<number> {
    const client = getSupabaseClient();
    if (!client) return 0;

    const { data, error } = await client
      .from(USAGE_TABLE)
      .select("usage_count")
      .eq("authorization_id", authorization_id)
      .eq("period_start", period_start)
      .single();

    if (error || !data) return 0;
    return (data.usage_count as number) ?? 0;
  }

  // ── PERSISTENCE ──────────────────────────────────────────────────

  private persistInsert(auth: StandingAuthorization): void {
    const client = getSupabaseClient();
    if (!client) return;
    const p = client
      .from(TABLE)
      .insert({
        id: auth.id,
        business_id: auth.business_id,
        authorized_by: auth.authorized_by,
        authorized_agent: auth.authorized_agent,
        scope: auth.scope,
        max_amount_per_use: auth.max_amount_per_use,
        max_amount_per_period: auth.max_amount_per_period,
        period: auth.period,
        max_uses_per_period: auth.max_uses_per_period,
        active: auth.active,
        revoked: auth.revoked,
        revoked_at: auth.revoked_at,
        revoked_by: auth.revoked_by,
        effective_from: auth.effective_from,
        effective_until: auth.effective_until,
        created_at: auth.created_at,
        updated_at: auth.updated_at,
      })
      .then(({ error }) => {
        if (error) console.error(`[StandingAuthRepo] insert error: ${error.message}`);
      });
    this.pendingWrites.push(p);
  }

  private persistUpdate(id: string, updates: Partial<StandingAuthorization>): void {
    const client = getSupabaseClient();
    if (!client) return;
    const rowUpdates: Record<string, unknown> = {};
    if (updates.active !== undefined) rowUpdates.active = updates.active;
    if (updates.revoked !== undefined) rowUpdates.revoked = updates.revoked;
    if (updates.revoked_at !== undefined) rowUpdates.revoked_at = updates.revoked_at;
    if (updates.revoked_by !== undefined) rowUpdates.revoked_by = updates.revoked_by;
    rowUpdates.updated_at = new Date().toISOString();

    const p = client
      .from(TABLE)
      .update(rowUpdates)
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error(`[StandingAuthRepo] update error: ${error.message}`);
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
      const auth = this.rowToAuth(row);
      this.cache.set(auth.id, auth);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  private rowToAuth(row: Record<string, unknown>): StandingAuthorization {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      authorized_by: row.authorized_by as string,
      authorized_agent: row.authorized_agent as string | null,
      scope: row.scope as StandingAuthorization["scope"],
      max_amount_per_use: row.max_amount_per_use as number,
      max_amount_per_period: row.max_amount_per_period as number,
      period: row.period as string,
      max_uses_per_period: row.max_uses_per_period as number | null,
      active: row.active as boolean,
      revoked: row.revoked as boolean,
      revoked_at: row.revoked_at as string | null,
      revoked_by: row.revoked_by as string | null,
      effective_from: row.effective_from as string,
      effective_until: row.effective_until as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}

let instance: StandingAuthRepository | null = null;

export function getStandingAuthRepository(): StandingAuthRepository {
  if (!instance) instance = new StandingAuthRepository();
  return instance;
}

export function resetStandingAuthRepository(): void {
  if (instance) instance.clearCache();
  instance = null;
}
