/**
 * SALAM LIT — Proactive Work Queue
 *
 * Central queue of proactive work items for Zue.
 * Each item links a trigger to its investigation and recommendations.
 *
 * Phase 10: Proactive Work Engine
 */

import type {
  ProactiveTrigger,
  ProactiveWorkItem,
  BusinessEvent,
} from "../runtime/types";
import { getPendingTriggers, getActiveTriggers, getTrigger } from "./trigger-manager";
import { getInvestigation } from "../orchestration/zue";
import { getRecommendationsByInvestigation } from "../intelligence/recommendation-engine";

/**
 * In-memory work queue.
 */
const workQueue: Map<string, ProactiveWorkItem> = new Map();

/**
 * Build a work item from a trigger.
 */
function buildWorkItem(trigger: ProactiveTrigger): ProactiveWorkItem {
  let recommendation_count = 0;
  if (trigger.investigation_id) {
    const investigation = getInvestigation(trigger.investigation_id);
    if (investigation) {
      recommendation_count = investigation.recommendations.length;
    }
  }

  const statusLabels: Record<string, string> = {
    PENDING: "Awaiting investigation",
    INVESTIGATING: "Investigation in progress",
    COMPLETED: "Investigation complete",
    DISMISSED: "Dismissed",
    EXPIRED: "Expired",
    FAILED: "Investigation failed",
  };

  return {
    trigger,
    event: trigger.event,
    investigation_id: trigger.investigation_id,
    recommendation_count,
    status_label: statusLabels[trigger.status] ?? trigger.status,
  };
}

/**
 * Refresh the work queue for a business.
 */
export function refreshWorkQueue(business_id: string): ProactiveWorkItem[] {
  // Clear existing items for this business
  for (const [key, item] of workQueue) {
    if (item.event.business_id === business_id) {
      workQueue.delete(key);
    }
  }

  // Get active triggers
  const activeTriggers = getActiveTriggers(business_id);

  // Build work items
  const items: ProactiveWorkItem[] = [];
  for (const trigger of activeTriggers) {
    const item = buildWorkItem(trigger);
    workQueue.set(trigger.id, item);
    items.push(item);
  }

  return items;
}

/**
 * Get the current work queue for a business.
 */
export function getWorkQueue(business_id: string): ProactiveWorkItem[] {
  // Return existing items or refresh
  const existing = Array.from(workQueue.values())
    .filter((item) => item.event.business_id === business_id);

  if (existing.length > 0) return existing;

  return refreshWorkQueue(business_id);
}

/**
 * Get work queue summary for Today's Focus.
 */
export function getWorkQueueSummary(business_id: string): {
  total: number;
  critical: number;
  important: number;
  upcoming: number;
  routine: number;
  items: ProactiveWorkItem[];
} {
  const items = getWorkQueue(business_id);

  return {
    total: items.length,
    critical: items.filter((i) => i.trigger.priority === "CRITICAL").length,
    important: items.filter((i) => i.trigger.priority === "IMPORTANT").length,
    upcoming: items.filter((i) => i.trigger.priority === "UPCOMING").length,
    routine: items.filter((i) => i.trigger.priority === "ROUTINE").length,
    items,
  };
}

/**
 * Remove a completed/dismissed/expired item from the queue.
 */
export function removeFromQueue(trigger_id: string): void {
  workQueue.delete(trigger_id);
}

/**
 * Clear the entire queue for a business.
 */
export function clearWorkQueue(business_id: string): void {
  for (const [key, item] of workQueue) {
    if (item.event.business_id === business_id) {
      workQueue.delete(key);
    }
  }
}
