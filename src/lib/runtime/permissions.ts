/**
 * SALAM LIT — Agent Permission Enforcement
 *
 * Enforces data scope, action scope, and business isolation for agents.
 *
 * Phase 7: AI Workforce Runtime + Zue
 *
 * RULES:
 * - Every agent request must resolve USER → WORKSPACE → BUSINESS
 * - An agent must not access data outside its authorized scope
 * - Zue must not bypass specialist permissions
 * - Business isolation must be enforced in application logic
 */

import type { AgentKey } from "../agents/definitions";
import type {
  AgentPermissions,
  DataScope,
  ActionScope,
  ActionType,
} from "./types";

/**
 * Default permissions for each agent role.
 * These are the MINIMUM permissions — production will use database-stored permissions.
 */
const AGENT_PERMISSIONS: Record<AgentKey, AgentPermissions> = {
  // ─── Core / Orchestrator ───
  zue: {
    agent_key: "zue",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_FACTS",
      "READ_EVIDENCE",
      "READ_METRICS",
      "READ_CONTEXT",
      "CREATE_FINDING",
      "INVESTIGATE",
      "RECOMMEND",
    ],
    max_confidence_threshold: 0.9,
    // H2: Server-owned approval policy — ALL consequential action types require approval
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },

  // ─── BI / Strategy ───
  erni: {
    agent_key: "erni",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_FACTS",
      "READ_EVIDENCE",
      "READ_METRICS",
      "READ_CONTEXT",
      "CREATE_FINDING",
      "RECOMMEND",
    ],
    max_confidence_threshold: 0.85,
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },

  // ─── Marketing / Creative ───
  sheera: {
    agent_key: "sheera",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_FACTS",
      "READ_EVIDENCE",
      "READ_METRICS",
      "READ_CONTEXT",
      "CREATE_FINDING",
      "RECOMMEND",
    ],
    max_confidence_threshold: 0.85,
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },

  // ─── Sales ───
  eddy: {
    agent_key: "eddy",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_FACTS",
      "READ_EVIDENCE",
      "READ_METRICS",
      "READ_CONTEXT",
      "CREATE_FINDING",
      "RECOMMEND",
    ],
    max_confidence_threshold: 0.85,
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },

  // ─── Finance ───
  carol: {
    agent_key: "carol",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_FACTS",
      "READ_EVIDENCE",
      "READ_METRICS",
      "READ_CONTEXT",
      "CREATE_FINDING",
      "RECOMMEND",
    ],
    max_confidence_threshold: 0.9,
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },

  // ─── HR ───
  ayuni: {
    agent_key: "ayuni",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_FACTS",
      "READ_EVIDENCE",
      "READ_CONTEXT",
      "CREATE_FINDING",
      "RECOMMEND",
    ],
    max_confidence_threshold: 0.85,
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },

  // ─── Funding ───
  alex: {
    agent_key: "alex",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_FACTS",
      "READ_EVIDENCE",
      "READ_METRICS",
      "READ_CONTEXT",
      "CREATE_FINDING",
      "RECOMMEND",
    ],
    max_confidence_threshold: 0.85,
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },

  // ─── Operations ───
  tehna: {
    agent_key: "tehna",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_FACTS",
      "READ_EVIDENCE",
      "READ_CONTEXT",
      "CREATE_FINDING",
      "RECOMMEND",
    ],
    max_confidence_threshold: 0.85,
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },

  // ─── Security Guardian ───
  kopi: {
    agent_key: "kopi",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_FACTS",
      "READ_EVIDENCE",
      "READ_METRICS",
      "READ_CONTEXT",
    ],
    max_confidence_threshold: 0.95,
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },

  // ─── Office Companion ───
  adik: {
    agent_key: "adik",
    data_scope: "OWN_BUSINESS",
    action_scopes: [
      "READ_CONTEXT",
    ],
    max_confidence_threshold: 0.7,
    requires_approval_for: [
      "PAYMENT", "TRANSFER", "AD_SPEND", "PURCHASE", "REFUND",
      "FINANCIAL_COMMITMENT", "CONTRACT", "HIRING", "FIRING",
      "CAMPAIGN_PUBLISH", "SYSTEM_CHANGE",
    ],
  },
};

/**
 * Get permissions for an agent.
 */
export function getAgentPermissions(agent_key: AgentKey): AgentPermissions {
  return AGENT_PERMISSIONS[agent_key];
}

/**
 * Check if an agent has a specific action scope.
 */
export function hasActionScope(
  agent_key: AgentKey,
  action: ActionScope
): boolean {
  const permissions = getAgentPermissions(agent_key);
  return permissions.action_scopes.includes(action);
}

/**
 * Check if an agent can access the given business.
 * Enforces AUTH → WORKSPACE → BUSINESS isolation.
 */
export function canAccessBusiness(
  agent_key: AgentKey,
  user_business_id: string,
  target_business_id: string
): boolean {
  const permissions = getAgentPermissions(agent_key);

  switch (permissions.data_scope) {
    case "OWN_BUSINESS":
      return user_business_id === target_business_id;
    case "ASSIGNED_BUSINESS":
      // In production, check assignment table
      return user_business_id === target_business_id;
    case "ALL_BUSINESSES":
      return true;
    case "NONE":
      return false;
    default:
      return false;
  }
}

/**
 * Validate agent context access.
 * Returns true if access is allowed, false otherwise.
 */
export function validateAgentAccess(params: {
  agent_key: AgentKey;
  user_id: string;
  workspace_id: string;
  business_id: string;
  target_business_id: string;
  required_action: ActionScope;
}): { allowed: boolean; reason: string } {
  const { agent_key, business_id, target_business_id, required_action } = params;

  // Check business isolation
  if (!canAccessBusiness(agent_key, business_id, target_business_id)) {
    return {
      allowed: false,
      reason: `Agent ${agent_key} cannot access business ${target_business_id} (scope: ${getAgentPermissions(agent_key).data_scope})`,
    };
  }

  // Check action scope
  if (!hasActionScope(agent_key, required_action)) {
    return {
      allowed: false,
      reason: `Agent ${agent_key} does not have action scope: ${required_action}`,
    };
  }

  return { allowed: true, reason: "Access granted" };
}

/**
 * Get the minimum context an agent needs.
 * Follows principle of least privilege.
 */
export function getMinimumContext(agent_key: AgentKey): {
  include_facts: boolean;
  include_evidence: boolean;
  include_metrics: boolean;
  include_context: boolean;
  fact_types: string[];
  max_facts: number;
  max_evidence: number;
  max_metrics: number;
} {
  const permissions = getAgentPermissions(agent_key);
  const actions = permissions.action_scopes;

  return {
    include_facts: actions.includes("READ_FACTS"),
    include_evidence: actions.includes("READ_EVIDENCE"),
    include_metrics: actions.includes("READ_METRICS"),
    include_context: actions.includes("READ_CONTEXT"),
    fact_types: getRelevantFactTypes(agent_key),
    max_facts: agent_key === "carol" ? 50 : 20,
    max_evidence: agent_key === "carol" ? 30 : 15,
    max_metrics: agent_key === "carol" ? 20 : 10,
  };
}

/**
 * Get relevant fact types for an agent.
 */
function getRelevantFactTypes(agent_key: AgentKey): string[] {
  switch (agent_key) {
    case "carol":
      return ["REVENUE", "COGS", "OPERATING_EXPENSES", "CASH", "ACCOUNTS_RECEIVABLE", "ACCOUNTS_PAYABLE"];
    case "erni":
      return ["REVENUE", "CUSTOMER_COUNT", "EMPLOYEE_COUNT"];
    case "eddy":
      return ["REVENUE", "CUSTOMER_COUNT"];
    case "sheera":
      return ["REVENUE", "CUSTOMER_COUNT"];
    case "alex":
      return ["REVENUE", "ASSETS", "LIABILITIES", "LOANS"];
    case "ayuni":
      return ["EMPLOYEE_COUNT"];
    case "tehna":
      return ["OPERATING_EXPENSES", "INVENTORY"];
    default:
      return [];
  }
}
