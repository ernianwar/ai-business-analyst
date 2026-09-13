/**
 * SALAM LIT — Action Audit Repository
 *
 * Append-only persistence for ActionAuditEvent records.
 *
 * Phase 13B: Persistent Action + Execution State Engine
 */

import type { ActionAuditEvent } from "../runtime/types";
import { getSupabaseClient } from "../db/supabase-client";

const TABLE = "action_audit_events";

class AuditRepository {
  private events: ActionAuditEvent[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private pendingWrites: any[] = [];

  append(event: ActionAuditEvent): ActionAuditEvent {
    this.events.unshift(event);
    this.persistInsert(event);
    return event;
  }

  getEvents(business_id: string, limit = 100): ActionAuditEvent[] {
    return this.events
      .filter((e) => e.business_id === business_id)
      .slice(0, limit);
  }

  private persistInsert(event: ActionAuditEvent): void {
    const client = getSupabaseClient();
    if (!client) return;
    const p = client
      .from(TABLE)
      .insert({
        id: event.id,
        business_id: event.business_id,
        action_id: event.action_id,
        execution_id: event.execution_id,
        event_type: event.event_type,
        actor: event.actor,
        actor_type: event.actor_type,
        details: event.details,
        timestamp: event.timestamp,
      })
      .then(({ error }) => {
        if (error) console.error(`[AuditRepo] insert error: ${error.message}`);
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

    let query = client.from(TABLE).select("*").order("timestamp", { ascending: false });
    if (business_id) query = query.eq("business_id", business_id);
    const { data, error } = await query;
    if (error || !data) return;

    this.events = data.map((row) => this.rowToEvent(row));
  }

  clearCache(): void {
    this.events = [];
  }

  private rowToEvent(row: Record<string, unknown>): ActionAuditEvent {
    return {
      id: row.id as string,
      business_id: row.business_id as string,
      action_id: row.action_id as string | null,
      execution_id: row.execution_id as string | null,
      event_type: row.event_type as ActionAuditEvent["event_type"],
      actor: row.actor as string,
      actor_type: row.actor_type as "USER" | "AGENT" | "SYSTEM",
      details: (row.details as Record<string, unknown>) ?? {},
      timestamp: row.timestamp as string,
    };
  }
}

let instance: AuditRepository | null = null;

export function getAuditRepository(): AuditRepository {
  if (!instance) instance = new AuditRepository();
  return instance;
}

export function resetAuditRepository(): void {
  if (instance) instance.clearCache();
  instance = null;
}
