/**
 * SALAM LIT — Trigger Lifecycle Manager
 *
 * Manages the lifecycle of proactive triggers.
 * Handles deduplication, status transitions, and expiry.
 *
 * Phase 10: Proactive Work Engine
 *
 * LIFECYCLE:
 * PENDING → INVESTIGATING → COMPLETED
 * PENDING → DISMISSED
 * PENDING → EXPIRED
 * PENDING/INVESTIGATING → FAILED
 */

import type {
  ProactiveTrigger,
  TriggerStatus,
  TriggerPriority,
  BusinessEvent,
  DeduplicationRecord,
} from "../runtime/types";

/**
 * In-memory trigger store.
 */
const triggers: Map<string, ProactiveTrigger> = new Map();

/**
 * In-memory deduplication store.
 */
const deduplicationStore: Map<string, DeduplicationRecord> = new Map();

/**
 * Maximum age for deduplication records (24 hours).
 */
const DEDUP_TTL_MS = 86400000;

/**
 * Generate a deduplication key for an event.
 */
function generateDeduplicationKey(event: BusinessEvent): string {
  return `${event.type}:${event.business_id}:${event.source_data.metric_keys?.join(",") ?? ""}`;
}

/**
 * Check if a duplicate trigger already exists.
 */
function isDuplicate(event: BusinessEvent): boolean {
  const key = generateDeduplicationKey(event);
  const existing = deduplicationStore.get(key);
  if (!existing) return false;

  // Check if record has expired
  if (new Date(existing.expires_at) < new Date()) {
    deduplicationStore.delete(key);
    return false;
  }

  // Check if existing trigger is still active
  const existingTrigger = triggers.get(existing.trigger_id);
  if (!existingTrigger) return false;
  if (["COMPLETED", "DISMISSED", "EXPIRED", "FAILED"].includes(existingTrigger.status)) {
    return false;
  }

  return true;
}

/**
 * Register a deduplication record.
 */
function registerDeduplication(event: BusinessEvent, trigger_id: string): void {
  const key = generateDeduplicationKey(event);
  deduplicationStore.set(key, {
    key,
    trigger_id,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + DEDUP_TTL_MS).toISOString(),
  });
}

/**
 * Create a new trigger from a business event.
 * Returns null if duplicate.
 */
export function createTrigger(
  event: BusinessEvent,
  rule_id: string,
  rule_name: string,
  priority: TriggerPriority,
  assigned_agents: string[]
): ProactiveTrigger | null {
  // Check for duplicates
  if (isDuplicate(event)) return null;

  const trigger: ProactiveTrigger = {
    id: crypto.randomUUID(),
    business_id: event.business_id,
    rule_id,
    rule_name,
    event,
    priority,
    status: "PENDING",
    investigation_id: null,
    assigned_agents: assigned_agents as any,
    deduplication_key: generateDeduplicationKey(event),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    expires_at: new Date(Date.now() + 86400000 * 7).toISOString(), // 7 days
    error: null,
  };

  triggers.set(trigger.id, trigger);
  registerDeduplication(event, trigger.id);

  return trigger;
}

/**
 * Transition trigger status.
 */
export function transitionTrigger(
  trigger_id: string,
  new_status: TriggerStatus,
  details?: { investigation_id?: string; error?: string }
): ProactiveTrigger | null {
  const trigger = triggers.get(trigger_id);
  if (!trigger) return null;

  // Validate transition
  const validTransitions: Record<TriggerStatus, TriggerStatus[]> = {
    PENDING: ["INVESTIGATING", "DISMISSED", "EXPIRED", "FAILED"],
    INVESTIGATING: ["COMPLETED", "FAILED", "DISMISSED"],
    COMPLETED: [],
    DISMISSED: [],
    EXPIRED: [],
    FAILED: ["PENDING"], // Can retry
  };

  if (!validTransitions[trigger.status]?.includes(new_status)) {
    return null; // Invalid transition
  }

  trigger.status = new_status;
  trigger.updated_at = new Date().toISOString();

  if (new_status === "INVESTIGATING") {
    trigger.started_at = new Date().toISOString();
    if (details?.investigation_id) {
      trigger.investigation_id = details.investigation_id;
    }
  }

  if (new_status === "COMPLETED") {
    trigger.completed_at = new Date().toISOString();
  }

  if (new_status === "FAILED") {
    trigger.error = details?.error ?? "Unknown error";
  }

  return trigger;
}

/**
 * Get a trigger by ID.
 */
export function getTrigger(id: string): ProactiveTrigger | null {
  return triggers.get(id) ?? null;
}

/**
 * Get all triggers for a business.
 */
export function getTriggersByBusiness(
  business_id: string,
  limit: number = 50
): ProactiveTrigger[] {
  return Array.from(triggers.values())
    .filter((t) => t.business_id === business_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/**
 * Get pending triggers for a business.
 */
export function getPendingTriggers(business_id: string): ProactiveTrigger[] {
  return Array.from(triggers.values())
    .filter((t) => t.business_id === business_id && t.status === "PENDING")
    .sort((a, b) => {
      const priorityOrder: Record<TriggerPriority, number> = {
        CRITICAL: 0,
        IMPORTANT: 1,
        UPCOMING: 2,
        ROUTINE: 3,
        INFO: 4,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

/**
 * Get active triggers (PENDING or INVESTIGATING).
 */
export function getActiveTriggers(business_id: string): ProactiveTrigger[] {
  return Array.from(triggers.values())
    .filter(
      (t) =>
        t.business_id === business_id &&
        (t.status === "PENDING" || t.status === "INVESTIGATING")
    )
    .sort((a, b) => {
      const priorityOrder: Record<TriggerPriority, number> = {
        CRITICAL: 0,
        IMPORTANT: 1,
        UPCOMING: 2,
        ROUTINE: 3,
        INFO: 4,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
}

/**
 * Expire old triggers.
 */
export function expireOldTriggers(): number {
  let expiredCount = 0;
  const now = new Date();

  for (const trigger of triggers.values()) {
    if (trigger.status === "PENDING" || trigger.status === "INVESTIGATING") {
      if (trigger.expires_at && new Date(trigger.expires_at) < now) {
        trigger.status = "EXPIRED";
        trigger.updated_at = now.toISOString();
        expiredCount++;
      }
    }
  }

  return expiredCount;
}

/**
 * Clean up expired deduplication records.
 */
export function cleanupDeduplicationRecords(): number {
  let cleanedCount = 0;
  const now = new Date();

  for (const [key, record] of deduplicationStore) {
    if (new Date(record.expires_at) < now) {
      deduplicationStore.delete(key);
      cleanedCount++;
    }
  }

  return cleanedCount;
}

/**
 * Dismiss a trigger.
 */
export function dismissTrigger(trigger_id: string): ProactiveTrigger | null {
  return transitionTrigger(trigger_id, "DISMISSED");
}
