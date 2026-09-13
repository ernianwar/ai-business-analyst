/**
 * SALAM LIT — Proactive Work Engine
 *
 * The central engine that drives agent activity.
 * Detects business events, creates triggers, and hands off to Zue.
 *
 * Phase 10: Proactive Work Engine
 *
 * Architecture:
 *   Business Data / State
 *       ↓
 *   Event Detection (rule-engine.ts)
 *       ↓
 *   Trigger Creation (trigger-manager.ts)
 *       ↓
 *   Work Queue (work-queue.ts)
 *       ↓
 *   Zue → Phase 9 Investigation Engine
 *       ↓
 *   Findings → Insights → Recommendations
 *       ↓
 *   Owner
 */

import type { AgentKey } from "../agents/definitions";
import type {
  ProactiveTrigger,
  ProactiveWorkItem,
  BusinessEvent,
  TriggerPriority,
} from "../runtime/types";
import {
  initializeDefaultRules,
  getEnabledRules,
  registerRule,
  evaluateRule,
  getRule,
  getAllRules,
  setRuleEnabled,
} from "./rule-engine";
import {
  createTrigger,
  transitionTrigger,
  getTrigger,
  getPendingTriggers,
  getActiveTriggers,
  dismissTrigger,
  expireOldTriggers,
  cleanupDeduplicationRecords,
} from "./trigger-manager";
import {
  refreshWorkQueue,
  getWorkQueue,
  getWorkQueueSummary,
  removeFromQueue,
  clearWorkQueue,
} from "./work-queue";
import {
  evaluateBusinessRules,
  handOffToZue,
  runEvaluationCycle,
  getWorkerStatus,
} from "./event-worker";

/**
 * Proactive Work Engine — main interface.
 */
export class ProactiveWorkEngine {
  /**
   * Initialize the engine with default rules.
   */
  initialize(): void {
    initializeDefaultRules();
  }

  /**
   * Evaluate rules for a business and create triggers.
   */
  async evaluateBusiness(business_id: string): Promise<ProactiveTrigger[]> {
    return evaluateBusinessRules(business_id);
  }

  /**
   * Hand off a trigger to Zue for investigation.
   */
  async handOffToZue(
    trigger: ProactiveTrigger,
    user_id?: string,
    workspace_id?: string
  ): Promise<{ success: boolean; investigation_id: string | null; error: string | null }> {
    return handOffToZue(trigger, user_id, workspace_id);
  }

  /**
   * Run a full evaluation cycle.
   */
  async runCycle(params: {
    business_id: string;
    user_id: string;
    workspace_id: string;
    specialist_scope?: AgentKey[];
  }): Promise<{
    businesses_evaluated: number;
    triggers_created: number;
    investigations_started: number;
    status?: "COMPLETED" | "INSUFFICIENT_BUSINESS_DATA";
  }> {
    return runEvaluationCycle(params);
  }

  /**
   * Get the proactive work queue for a business.
   */
  getWorkQueue(business_id: string): ProactiveWorkItem[] {
    return getWorkQueue(business_id);
  }

  /**
   * Get work queue summary for Today's Focus.
   */
  getWorkQueueSummary(business_id: string): {
    total: number;
    critical: number;
    important: number;
    upcoming: number;
    routine: number;
    items: ProactiveWorkItem[];
  } {
    return getWorkQueueSummary(business_id);
  }

  /**
   * Dismiss a trigger.
   */
  dismiss(trigger_id: string): ProactiveTrigger | null {
    return dismissTrigger(trigger_id);
  }

  /**
   * Get worker status.
   */
  getStatus(): { is_running: boolean; last_evaluation_at: string | null } {
    return getWorkerStatus();
  }

  /**
   * Get all rules.
   */
  getRules() {
    return getAllRules();
  }

  /**
   * Enable/disable a rule.
   */
  setRuleEnabled(rule_id: string, enabled: boolean): void {
    setRuleEnabled(rule_id, enabled);
  }

  /**
   * Cleanup expired data.
   */
  cleanup(): { expired_triggers: number; cleaned_dedup_records: number } {
    const expiredTriggers = expireOldTriggers();
    const cleanedDedup = cleanupDeduplicationRecords();
    return {
      expired_triggers: expiredTriggers,
      cleaned_dedup_records: cleanedDedup,
    };
  }
}

/**
 * Singleton proactive work engine.
 */
export const proactiveWorkEngine = new ProactiveWorkEngine();

// Re-export types and functions for convenience
export {
  initializeDefaultRules,
  getEnabledRules,
  registerRule,
  evaluateRule,
  getRule,
  getAllRules,
  setRuleEnabled,
} from "./rule-engine";

export {
  createTrigger,
  transitionTrigger,
  getTrigger,
  getPendingTriggers,
  getActiveTriggers,
  dismissTrigger,
  expireOldTriggers,
  cleanupDeduplicationRecords,
} from "./trigger-manager";

export {
  refreshWorkQueue,
  getWorkQueue,
  getWorkQueueSummary,
  removeFromQueue,
  clearWorkQueue,
} from "./work-queue";

export {
  evaluateBusinessRules,
  handOffToZue,
  runEvaluationCycle,
  getWorkerStatus,
} from "./event-worker";
