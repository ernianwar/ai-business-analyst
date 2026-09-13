/**
 * SALAM LIT — Deterministic Rule Engine
 *
 * Evaluates business data against deterministic rules.
 * No LLM involvement — pure condition evaluation.
 *
 * Phase 10: Proactive Work Engine
 *
 * RULES:
 * - Rules are evaluated deterministically
 * - No LLM as primary trigger engine
 * - Rules support conditions, thresholds, comparisons
 * - Rules can be enabled/disabled
 * - Rules have effective dates
 */

import type {
  ProactiveRule,
  RuleCondition,
  BusinessEvent,
  BusinessEventType,
  TriggerPriority,
} from "../runtime/types";

/**
 * In-memory rule store.
 */
const rules: Map<string, ProactiveRule> = new Map();

/**
 * Default rules for common business events.
 */
const DEFAULT_RULES: ProactiveRule[] = [
  {
    id: "rule-overdue-invoice",
    name: "Overdue Invoice Detection",
    description: "Detects invoices that are past their due date",
    event_type: "OVERDUE_INVOICE",
    enabled: true,
    priority: "IMPORTANT",
    conditions: [
      { type: "STATE_CHECK", fact_type: "invoice_status", state_value: "overdue" },
    ],
    agent_keys: ["carol", "eddy"],
    cooldown_ms: 86400000, // 24 hours
    effective_from: null,
    effective_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rule-sales-decline",
    name: "Sales Decline Detection",
    description: "Detects significant sales decline compared to previous period",
    event_type: "SALES_DECLINE",
    enabled: true,
    priority: "IMPORTANT",
    conditions: [
      { type: "PERIOD_COMPARISON", metric_key: "revenue", comparison: "lt", period_days: 30 },
    ],
    agent_keys: ["eddy", "erni", "carol"],
    cooldown_ms: 604800000, // 7 days
    effective_from: null,
    effective_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rule-expense-increase",
    name: "Unusual Expense Increase",
    description: "Detects expense increases above normal threshold",
    event_type: "EXPENSE_INCREASE",
    enabled: true,
    priority: "UPCOMING",
    conditions: [
      { type: "PERIOD_COMPARISON", metric_key: "operating_expenses", comparison: "gt", period_days: 30 },
    ],
    agent_keys: ["carol", "erni"],
    cooldown_ms: 604800000,
    effective_from: null,
    effective_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rule-cashflow-warning",
    name: "Cashflow Warning",
    description: "Detects low cash position relative to expenses",
    event_type: "CASHFLOW_WARNING",
    enabled: true,
    priority: "CRITICAL",
    conditions: [
      { type: "THRESHOLD_BELOW", metric_key: "cash_position", threshold: 0 },
    ],
    agent_keys: ["carol", "alex", "erni"],
    cooldown_ms: 86400000,
    effective_from: null,
    effective_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rule-metric-threshold",
    name: "Metric Threshold Alert",
    description: "Generic threshold-based alert for any metric",
    event_type: "METRIC_THRESHOLD",
    enabled: true,
    priority: "ROUTINE",
    conditions: [
      { type: "THRESHOLD_BELOW", metric_key: "net_profit_margin", threshold: 0 },
    ],
    agent_keys: ["carol", "erni"],
    cooldown_ms: 259200000, // 3 days
    effective_from: null,
    effective_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "rule-dormant-customer",
    name: "Dormant Customer Detection",
    description: "Detects customers with no recent activity",
    event_type: "DORMANT_CUSTOMER",
    enabled: true,
    priority: "ROUTINE",
    conditions: [
      { type: "STATE_CHECK", fact_type: "customer_activity", state_value: "dormant" },
    ],
    agent_keys: ["eddy", "sheera"],
    cooldown_ms: 604800000,
    effective_from: null,
    effective_until: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/**
 * Initialize default rules.
 */
export function initializeDefaultRules(): void {
  for (const rule of DEFAULT_RULES) {
    if (!rules.has(rule.id)) {
      rules.set(rule.id, rule);
    }
  }
}

/**
 * Register a custom rule.
 */
export function registerRule(rule: ProactiveRule): void {
  rules.set(rule.id, rule);
}

/**
 * Get a rule by ID.
 */
export function getRule(id: string): ProactiveRule | null {
  return rules.get(id) ?? null;
}

/**
 * Get all enabled rules.
 */
export function getEnabledRules(): ProactiveRule[] {
  const now = new Date();
  return Array.from(rules.values()).filter((rule) => {
    if (!rule.enabled) return false;
    if (rule.effective_from && new Date(rule.effective_from) > now) return false;
    if (rule.effective_until && new Date(rule.effective_until) < now) return false;
    return true;
  });
}

/**
 * Get all rules.
 */
export function getAllRules(): ProactiveRule[] {
  return Array.from(rules.values());
}

/**
 * Enable or disable a rule.
 */
export function setRuleEnabled(rule_id: string, enabled: boolean): void {
  const rule = rules.get(rule_id);
  if (rule) {
    rule.enabled = enabled;
    rule.updated_at = new Date().toISOString();
  }
}

/**
 * Evaluate a single condition against business data.
 */
function evaluateCondition(
  condition: RuleCondition,
  metrics: Array<{ key: string; value: number | null; status: string }>,
  facts: Array<{ id: string; type: string; value: unknown; period: string }>
): boolean {
  switch (condition.type) {
    case "THRESHOLD_ABOVE": {
      if (!condition.metric_key || condition.threshold === undefined) return false;
      const metric = metrics.find((m) => m.key === condition.metric_key);
      if (!metric || metric.value === null) return false;
      return metric.value > condition.threshold;
    }

    case "THRESHOLD_BELOW": {
      if (!condition.metric_key || condition.threshold === undefined) return false;
      const metric = metrics.find((m) => m.key === condition.metric_key);
      if (!metric || metric.value === null) return false;
      return metric.value < condition.threshold;
    }

    case "THRESHOLD_EQUALS": {
      if (!condition.metric_key || condition.threshold === undefined) return false;
      const metric = metrics.find((m) => m.key === condition.metric_key);
      if (!metric || metric.value === null) return false;
      return metric.value === condition.threshold;
    }

    case "STATE_CHECK": {
      if (!condition.fact_type || !condition.state_value) return false;
      const matchingFacts = facts.filter((f) => f.type === condition.fact_type);
      if (matchingFacts.length === 0) return false;
      // Check if any fact's value matches the expected state
      return matchingFacts.some((f) => {
        if (typeof f.value === "string") return f.value === condition.state_value;
        if (typeof f.value === "object" && f.value !== null && "status" in f.value) {
          return (f.value as { status: string }).status === condition.state_value;
        }
        return false;
      });
    }

    case "DATA_ABSENT": {
      if (!condition.fact_type && !condition.metric_key) return false;
      if (condition.fact_type) {
        const matchingFacts = facts.filter((f) => f.type === condition.fact_type);
        return matchingFacts.length === 0;
      }
      if (condition.metric_key) {
        const metric = metrics.find((m) => m.key === condition.metric_key);
        return !metric || metric.value === null;
      }
      return false;
    }

    case "TIME_BASED": {
      // Time-based conditions are evaluated at the rule level
      return true;
    }

    case "PERIOD_COMPARISON": {
      // Period comparison requires historical data — simplified check
      if (!condition.metric_key) return false;
      const metric = metrics.find((m) => m.key === condition.metric_key);
      if (!metric || metric.value === null) return false;
      // For MVP: check if metric exists and is valid
      return metric.status === "VALID";
    }

    default:
      return false;
  }
}

/**
 * Evaluate a rule against business data.
 * Returns a BusinessEvent if the rule triggers.
 */
export function evaluateRule(
  rule: ProactiveRule,
  business_id: string,
  metrics: Array<{ key: string; value: number | null; status: string }>,
  facts: Array<{ id: string; type: string; value: unknown; period: string }>
): BusinessEvent | null {
  if (!rule.enabled) return null;

  // Evaluate all conditions — ALL must be true (AND logic)
  const allConditionsMet = rule.conditions.every((condition) =>
    evaluateCondition(condition, metrics, facts)
  );

  if (!allConditionsMet) return null;

  // Generate business event
  const event: BusinessEvent = {
    id: crypto.randomUUID(),
    type: rule.event_type,
    business_id,
    summary: rule.name,
    description: rule.description,
    severity: rule.priority === "CRITICAL" ? "critical" : rule.priority === "IMPORTANT" ? "warning" : "info",
    source_data: {
      metric_keys: rule.conditions.filter((c) => c.metric_key).map((c) => c.metric_key!),
      fact_ids: facts.filter((f) => rule.conditions.some((c) => c.fact_type === f.type)).map((f) => f.id),
    },
    metadata: {
      rule_id: rule.id,
      rule_name: rule.name,
      conditions_evaluated: rule.conditions.length,
    },
    detected_at: new Date().toISOString(),
  };

  return event;
}
