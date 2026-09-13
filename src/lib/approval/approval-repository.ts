/**
 * SALAM LIT — Approval Repository
 *
 * Write-through cache for Approval records.
 *
 * Phase 13B.1: Decision + Approval Persistence Hardening
 */

import type { Approval, ApprovalStatus } from "../runtime/types";
import { getSupabaseClient } from "../db/supabase-client";

const TABLE = "approvals";

class ApprovalRepository {
  private cache = new Map<string, Approval>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingWrites: any[] = [];

  create(approval: Approval): Approval {
    this.cache.set(approval.id, { ...approval });
    this.persistInsert(approval);
    return approval;
  }

  getById(id: string): Approval | null {
    const a = this.cache.get(id);
    return a ? { ...a } : null;
  }

  getByBusiness(business_id: string, limit = 50): Approval[] {
    return Array.from(this.cache.values())
      .filter((a) => a.business_id === business_id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }

  getPendingByBusiness(business_id: string): Approval[] {
    return Array.from(this.cache.values())
      .filter((a) => a.business_id === business_id && a.status === "PENDING")
      .sort((a, b) => {
        const riskOrder: Record<string, number> = { L4: 0, L3: 1, L2: 2, L1: 3, L0: 4 };
        return (riskOrder[a.risk_level] ?? 5) - (riskOrder[b.risk_level] ?? 5);
      })
      .map((a) => ({ ...a }));
  }

  getAll(): Approval[] {
    return Array.from(this.cache.values()).map((a) => ({ ...a }));
  }

  update(id: string, updates: Partial<Approval>): Approval | null {
    const existing = this.cache.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
    this.cache.set(id, updated);
    this.persistUpdate(id, updates);
    return { ...updated };
  }

  // ── PERSISTENCE ──────────────────────────────────────────────────

  private persistInsert(approval: Approval): void {
    const client = getSupabaseClient();
    if (!client) return;
    const p = client
      .from(TABLE)
      .insert({
        id: approval.id,
        business_id: approval.business_id,
        decision_id: approval.decision_id,
        requested_by: approval.requested_by,
        requested_by_type: approval.requested_by_type,
        action_type: approval.action_type,
        action_description: approval.action_description,
        scope: approval.scope,
        risk_level: approval.risk_level,
        status: approval.status,
        approver_id: approval.approver_id,
        approval_reason: approval.approval_reason,
        rejection_reason: approval.rejection_reason,
        standing_authorization_id: approval.standing_authorization_id,
        requested_at: approval.requested_at,
        approved_at: approval.approved_at,
        expires_at: approval.expires_at,
        revoked_at: approval.revoked_at,
        created_at: approval.created_at,
        updated_at: approval.updated_at,
      })
      .then(({ error }) => {
        if (error) console.error(`[ApprovalRepo] insert error: ${error.message}`);
      });
    this.pendingWrites.push(p);
  }

  private persistUpdate(id: string, updates: Partial<Approval>): void {
    const client = getSupabaseClient();
    if (!client) return;
    const rowUpdates: Record<string, unknown> = {};
    if (updates.status !== undefined) rowUpdates.status = updates.status;
    if (updates.approver_id !== undefined) rowUpdates.approver_id = updates.approver_id;
    if (updates.approval_reason !== undefined) rowUpdates.approval_reason = updates.approval_reason;
    if (updates.rejection_reason !== undefined) rowUpdates.rejection_reason = updates.rejection_reason;
    if (updates.approved_at !== undefined) rowUpdates.approved_at = updates.approved_at;
    if (updates.expires_at !== undefined) rowUpdates.expires_at = updates.expires_at;
    if (updates.revoked_at !== undefined) rowUpdates.revoked_at = updates.revoked_at;
    rowUpdates.updated_at = new Date().toISOString();

    const p = client
      .from(TABLE)
      .update(rowUpdates)
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.error(`[ApprovalRepo] update error: ${error.message}`);
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
      const approval = this.rowToApproval(row);
      this.cache.set(approval.id, approval);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  private rowToApproval(row: Record<string, unknown>): Approval {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      decision_id: row.decision_id as string | null,
      requested_by: row.requested_by as string,
      requested_by_type: row.requested_by_type as "USER" | "AGENT",
      action_type: row.action_type as Approval["action_type"],
      action_description: row.action_description as string,
      scope: row.scope as Approval["scope"],
      risk_level: row.risk_level as Approval["risk_level"],
      status: row.status as ApprovalStatus,
      approver_id: row.approver_id as string | null,
      approval_reason: row.approval_reason as string | null,
      rejection_reason: row.rejection_reason as string | null,
      standing_authorization_id: row.standing_authorization_id as string | null,
      requested_at: row.requested_at as string,
      approved_at: row.approved_at as string | null,
      expires_at: row.expires_at as string | null,
      revoked_at: row.revoked_at as string | null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}

let instance: ApprovalRepository | null = null;

export function getApprovalRepository(): ApprovalRepository {
  if (!instance) instance = new ApprovalRepository();
  return instance;
}

export function resetApprovalRepository(): void {
  if (instance) instance.clearCache();
  instance = null;
}
