/**
 * SALAM LIT — Action Audit Trail
 *
 * Phase 13B: Uses AuditRepository for write-through persistence.
 */

import type { ActionAuditEvent } from "../runtime/types";
import { getAuditRepository } from "./audit-repository";

/**
 * Record an action audit event.
 * Appends to in-memory cache and async persists to PostgreSQL.
 */
export function recordActionAuditEvent(
  event: Omit<ActionAuditEvent, "id" | "timestamp">
): ActionAuditEvent {
  const fullEvent: ActionAuditEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  getAuditRepository().append(fullEvent);
  return fullEvent;
}

/**
 * Get audit events for a business.
 */
export function getActionAuditEvents(
  business_id: string,
  limit = 100
): ActionAuditEvent[] {
  return getAuditRepository().getEvents(business_id, limit);
}

/**
 * Clear audit events from cache.
 */
export function clearActionAuditEvents(): void {
  getAuditRepository().clearCache();
}

// ──────────────────────────────────────────────────────────────────────
// PERSISTENCE HELPERS (Phase 13B)
// ──────────────────────────────────────────────────────────────────────

export async function flushAuditEvents(): Promise<void> {
  await getAuditRepository().flush();
}

export async function loadAuditFromDatabase(business_id?: string): Promise<void> {
  await getAuditRepository().loadFromDatabase(business_id);
}
