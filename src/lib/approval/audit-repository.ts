/**
 * SALAM LIT — Approval Audit Repository
 *
 * Write-through cache for ApprovalAuditEvent records.
 *
 * Phase 13B.1: Decision + Approval Persistence Hardening
 */

import type { ApprovalAuditEvent } from "../runtime/types";
import { getSupabaseClient } from "../db/supabase-client";

const TABLE = "approval_audit_events";

class ApprovalAuditRepository {
  private cache = new Map<string, ApprovalAuditEvent>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingWrites: any[] = [];

  create(event: ApprovalAuditEvent): ApprovalAuditEvent {
    this.cache.set(event.id, { ...event });
    this.persistInsert(event);
    return event;
  }

  getByBusiness(business_id: string, limit = 100): ApprovalAuditEvent[] {
    return Array.from(this.cache.values())
      .filter((e) => e.business_id === business_id)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit)
      .map((e) => ({ ...e }));
  }

  getByApprovalId(approval_id: string): ApprovalAuditEvent[] {
    return Array.from(this.cache.values())
      .filter((e) => e.approval_id === approval_id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
      .map((e) => ({ ...e }));
  }

  async flush(): Promise<void> {
    await Promise.allSettled(this.pendingWrites.map((p) => Promise.resolve(p)));
    this.pendingWrites = [];
  }

  async loadFromDatabase(business_id?: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    let query = client.from(TABLE).select("*").order("timestamp", { ascending: false });
    if (business_id) query = query.eq("business_id", business_id);
    const { data, error } = await query.limit(500);
    if (error || !data) return;
    for (const row of data) {
      const event = this.rowToEvent(row);
      this.cache.set(event.id, event);
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  // ── PERSISTENCE ──────────────────────────────────────────────────

  private persistInsert(event: ApprovalAuditEvent): void {
    const client = getSupabaseClient();
    if (!client) return;
    const p = client
      .from(TABLE)
      .insert({
        id: event.id,
        business_id: event.business_id,
        approval_id: event.approval_id,
        event_type: event.event_type,
        actor: event.actor,
        actor_type: event.actor_type,
        details: event.details,
        timestamp: event.timestamp,
      })
      .then(({ error }) => {
        if (error) console.error(`[ApprovalAuditRepo] insert error: ${error.message}`);
      });
    this.pendingWrites.push(p);
  }

  private rowToEvent(row: Record<string, unknown>): ApprovalAuditEvent {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      approval_id: row.approval_id as string | null,
      event_type: row.event_type as ApprovalAuditEvent["event_type"],
      actor: row.actor as string,
      actor_type: row.actor_type as "USER" | "AGENT" | "SYSTEM",
      details: (row.details as Record<string, unknown>) ?? {},
      timestamp: row.timestamp as string,
    };
  }
}

let instance: ApprovalAuditRepository | null = null;

export function getApprovalAuditRepository(): ApprovalAuditRepository {
  if (!instance) instance = new ApprovalAuditRepository();
  return instance;
}

export function resetApprovalAuditRepository(): void {
  if (instance) instance.clearCache();
  instance = null;
}
