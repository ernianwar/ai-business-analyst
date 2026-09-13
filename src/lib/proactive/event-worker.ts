/**
 * SALAM LIT — Event Evaluation Worker
 *
 * Scans business data against deterministic rules.
 * Creates triggers and hands off to Zue for investigation.
 *
 * Phase 10: Proactive Work Engine
 *
 * This is a simple server-side worker — not a massive queue infrastructure.
 * For MVP: evaluates rules on-demand or via simple interval.
 */

import type {
  ProactiveTrigger,
  BusinessEvent,
} from "../runtime/types";
import type { AgentKey } from "../agents/definitions";
import { getEnabledRules, evaluateRule } from "./rule-engine";
import { createTrigger, transitionTrigger } from "./trigger-manager";
import { refreshWorkQueue } from "./work-queue";
import { createInvestigation, executeInvestigation, analyzeAndRoute } from "../orchestration/zue";
import { officeEventStore } from "../events/office-events";
import { businessTruthService } from "../db/services/business-truth";
import { agentStateStore } from "../state/agent-state";

/**
 * Whether the worker is currently running.
 */
let isRunning = false;

/**
 * Last evaluation timestamp.
 */
let lastEvaluationAt: Date | null = null;

/**
 * Evaluate rules for a specific business.
 * Creates triggers for any rules that fire.
 */
export async function evaluateBusinessRules(
  business_id: string
): Promise<ProactiveTrigger[]> {
  const newTriggers: ProactiveTrigger[] = [];

  // Get enabled rules
  const enabledRules = getEnabledRules();
  if (enabledRules.length === 0) return newTriggers;

  // Get business metrics
  const metrics = await businessTruthService.getMetricsByBusiness(business_id);
  const metricData = metrics.map((m) => ({
    key: m.metric_key,
    value: m.numeric_value,
    status: m.status,
  }));

  // Get business facts
  const facts = await businessTruthService.getActiveFactsByBusiness(business_id);
  const factData = facts.map((f) => ({
    id: f.id,
    type: f.fact_type,
    value: f.value,
    period: f.period_start && f.period_end ? `${f.period_start}/${f.period_end}` : "unknown",
  }));

  // Evaluate each rule
  for (const rule of enabledRules) {
    const event = evaluateRule(rule, business_id, metricData, factData);
    if (!event) continue;

    // Create trigger
    const trigger = createTrigger(
      event,
      rule.id,
      rule.name,
      rule.priority,
      rule.agent_keys
    );

    if (trigger) {
      newTriggers.push(trigger);

      // Emit business event detected
      officeEventStore.emit({
        type: "BUSINESS_EVENT_DETECTED",
        agent_key: "zue",
        summary: `Detected: ${rule.name}`,
        detail: rule.description,
        entity_type: "proactive_trigger",
        entity_id: trigger.id,
        severity: event.severity,
      });
    }
  }

  // Refresh work queue
  refreshWorkQueue(business_id);

  return newTriggers;
}

/**
 * Hand off a trigger to Zue for investigation.
 * Creates an investigation and executes it.
 */
export async function handOffToZue(
  trigger: ProactiveTrigger,
  user_id: string = "system",
  workspace_id: string = "system",
  specialist_scope?: AgentKey[]
): Promise<{ success: boolean; investigation_id: string | null; error: string | null }> {
  // Transition trigger to INVESTIGATING
  transitionTrigger(trigger.id, "INVESTIGATING");

  // Emit Zue thinking event
  officeEventStore.emit({
    type: "AGENT_THINKING",
    agent_key: "zue",
    summary: `Investigating: ${trigger.rule_name}`,
    speech_text: `I've detected ${trigger.event.summary.toLowerCase()}. Let me investigate...`,
  });

  try {
    // Create investigation
    const investigation = createInvestigation({
      business_id: trigger.business_id,
      initiated_by: "zue",
      trigger_type: "PROACTIVE",
      trigger_source: trigger.event.summary,
      title: trigger.event.summary,
      description: trigger.event.description,
      objective: `Investigate ${trigger.event.summary}: ${trigger.event.description}`,
    });

    // Link trigger to investigation
    transitionTrigger(trigger.id, "INVESTIGATING", {
      investigation_id: investigation.id,
    });

    // Analyze and route
    await analyzeAndRoute({
      investigation,
      user_request: trigger.event.description,
      business_id: trigger.business_id,
      user_id,
      workspace_id,
      specialist_scope,
    });

    // Execute investigation
    const result = await executeInvestigation(investigation.id, user_id, workspace_id);

    if (result.status === "COMPLETED") {
      transitionTrigger(trigger.id, "COMPLETED");

      // Emit completion event
      officeEventStore.emit({
        type: "AGENT_COMPLETED_WORK",
        agent_key: "zue",
        summary: `Completed investigation: ${trigger.rule_name}`,
        speech_text: `Investigation complete. ${investigation.findings.length} finding(s), ${investigation.recommendations.length} recommendation(s).`,
        entity_type: "investigation",
        entity_id: investigation.id,
      });

      return {
        success: true,
        investigation_id: investigation.id,
        error: null,
      };
    } else {
      transitionTrigger(trigger.id, "FAILED", {
        error: result.synthesis ?? "Investigation did not complete successfully",
      });

      return {
        success: false,
        investigation_id: investigation.id,
        error: result.synthesis ?? "Investigation failed",
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    transitionTrigger(trigger.id, "FAILED", { error: errorMessage });

    officeEventStore.emit({
      type: "AGENT_ERROR",
      agent_key: "zue",
      summary: `Failed to investigate: ${trigger.rule_name}`,
      speech_text: `I encountered an issue while investigating. ${errorMessage}`,
    });

    return {
      success: false,
      investigation_id: null,
      error: errorMessage,
    };
  }
}

/**
 * Run a full evaluation cycle for all businesses.
 * This is the main worker function.
 */
export async function runEvaluationCycle(params: {
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
  if (isRunning) {
    return { businesses_evaluated: 0, triggers_created: 0, investigations_started: 0 };
  }

  isRunning = true;
  let businessesEvaluated = 0;
  let triggersCreated = 0;
  let investigationsStarted = 0;

  try {
    const { business_id, user_id, workspace_id, specialist_scope } = params;

    const metrics = await businessTruthService.getMetricsByBusiness(business_id);
    const facts = await businessTruthService.getActiveFactsByBusiness(business_id);
    if (metrics.length === 0 && facts.length === 0) {
      lastEvaluationAt = new Date();
      return {
        businesses_evaluated: 1,
        triggers_created: 0,
        investigations_started: 0,
        status: "INSUFFICIENT_BUSINESS_DATA",
      };
    }

    // Evaluate rules
    const newTriggers = await evaluateBusinessRules(business_id);
    triggersCreated = newTriggers.length;
    businessesEvaluated = 1;

    // Hand off new triggers to Zue (limit to prevent overload)
    const maxInvestigationsPerCycle = 3;
    let investigationsThisCycle = 0;

    for (const trigger of newTriggers) {
      if (investigationsThisCycle >= maxInvestigationsPerCycle) break;

      // Only investigate CRITICAL and IMPORTANT triggers automatically
      if (trigger.priority === "CRITICAL" || trigger.priority === "IMPORTANT") {
        const result = await handOffToZue(trigger, user_id, workspace_id, specialist_scope);
        if (result.success) {
          investigationsStarted++;
          investigationsThisCycle++;
        }
      }
    }

    lastEvaluationAt = new Date();
  } finally {
    isRunning = false;
  }

  return {
    businesses_evaluated: businessesEvaluated,
    triggers_created: triggersCreated,
    investigations_started: investigationsStarted,
    status: "COMPLETED",
  };
}

/**
 * Get worker status.
 */
export function getWorkerStatus(): {
  is_running: boolean;
  last_evaluation_at: string | null;
} {
  return {
    is_running: isRunning,
    last_evaluation_at: lastEvaluationAt?.toISOString() ?? null,
  };
}
