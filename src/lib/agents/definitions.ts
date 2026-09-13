/**
 * SALAM LIT — Master Agent Definitions
 *
 * These are the stable, immutable agent identities.
 * Display names, avatars, and configurations are separate.
 *
 * Architecture:
 *   Master Agent Definition (this file)
 *       ↓
 *   Business-specific Agent Configuration (business_agents table)
 *       ↓
 *   Runtime Agent State (ephemeral)
 *       ↓
 *   Office Representation (UI)
 */

export type AgentKey =
  | "zue"
  | "erni"
  | "sheera"
  | "eddy"
  | "carol"
  | "ayuni"
  | "alex"
  | "tehna"
  | "kopi"
  | "adik";

export type AgentRole =
  | "orchestrator"
  | "business_intelligence"
  | "marketing"
  | "sales"
  | "finance"
  | "hr"
  | "funding"
  | "operations"
  | "security"
  | "companion";

export interface AgentDefinition {
  agent_key: AgentKey;
  default_display_name: string;
  role: AgentRole;
  description: string;
  capabilities: string[];
  cannot: string[];
  category: "core" | "specialist" | "support";
}

/**
 * Master agent definitions — the source of truth for agent identity.
 * These never change. Display names and avatars are configurable per business.
 */
export const AGENT_DEFINITIONS: Record<AgentKey, AgentDefinition> = {
  zue: {
    agent_key: "zue",
    default_display_name: "Zue",
    role: "orchestrator",
    description: "AI Workforce Manager & Orchestrator",
    capabilities: [
      "understand",
      "plan",
      "route",
      "coordinate",
      "synthesize",
      "prioritize",
      "present",
      "monitor",
    ],
    cannot: [
      "bypass_permissions",
      "approve_own_actions",
      "invent_evidence",
      "access_unrestricted_sensitive_data",
      "execute_arbitrary_tools",
    ],
    category: "core",
  },
  erni: {
    agent_key: "erni",
    default_display_name: "Erni",
    role: "business_intelligence",
    description: "Business Intelligence & Strategy Specialist",
    capabilities: [
      "business_diagnosis",
      "root_cause_analysis",
      "swot",
      "bmc",
      "usp",
      "business_health_analysis",
      "opportunity_identification",
      "strategy",
      "ai_adoption_readiness",
      "business_intelligence",
    ],
    cannot: [],
    category: "specialist",
  },
  sheera: {
    agent_key: "sheera",
    default_display_name: "Sheera",
    role: "marketing",
    description: "Marketing, Creative & Social Media Manager",
    capabilities: [
      "market_intelligence",
      "customer_trends",
      "competitor_marketing",
      "positioning",
      "messaging",
      "campaigns",
      "content_strategy",
      "content_calendar",
      "copy",
      "creative_briefs",
      "social_media",
      "advertising",
      "analytics",
      "paid_campaign_planning",
    ],
    cannot: [],
    category: "specialist",
  },
  eddy: {
    agent_key: "eddy",
    default_display_name: "Eddy",
    role: "sales",
    description: "Sales & Opportunity Intelligence Specialist",
    capabilities: [
      "lead_strategy",
      "qualification",
      "follow_up",
      "funnel_analysis",
      "conversion_analysis",
      "forecasting",
      "reactivation",
      "objection_handling",
      "acquisition",
      "churn_signals",
      "upsell_cross_sell",
      "opportunity_discovery",
    ],
    cannot: [],
    category: "specialist",
  },
  carol: {
    agent_key: "carol",
    default_display_name: "Carol",
    role: "finance",
    description: "Finance & Accounting Intelligence Specialist",
    capabilities: [
      "revenue_analysis",
      "cogs_analysis",
      "profit_margin",
      "operating_expenses",
      "cash_flow",
      "ar_ap",
      "financial_trends",
      "invoice_patterns",
      "reconciliation_support",
      "month_end_prep",
      "audit_readiness",
      "tax_prep_support",
      "payroll_reminders",
    ],
    cannot: [
      "replace_licensed_accountants",
      "replace_auditors",
      "replace_tax_professionals",
      "replace_statutory_accounting",
    ],
    category: "specialist",
  },
  ayuni: {
    agent_key: "ayuni",
    default_display_name: "Ayuni",
    role: "hr",
    description: "HR & People Operations Specialist",
    capabilities: [
      "employee_records",
      "onboarding",
      "offboarding",
      "probation",
      "leave_management",
      "attendance",
      "hr_documents",
      "workforce_capacity",
      "headcount_planning",
      "job_descriptions",
      "recruitment",
      "candidate_pipeline",
      "interview_coordination",
      "employee_lifecycle",
      "performance_reminders",
      "hr_policy",
    ],
    cannot: ["depend_on_hi_lit"],
    category: "specialist",
  },
  alex: {
    agent_key: "alex",
    default_display_name: "Alex",
    role: "funding",
    description: "Funding & Growth Intelligence Specialist",
    capabilities: [
      "grant_discovery",
      "funding_opportunities",
      "eligibility_analysis",
      "funding_readiness",
      "capital_strategy",
      "loan_analysis",
      "equity_analysis",
      "investor_analysis",
      "growth_financing",
      "expansion_opportunities",
      "application_preparation",
    ],
    cannot: [],
    category: "specialist",
  },
  tehna: {
    agent_key: "tehna",
    default_display_name: "Tehna",
    role: "operations",
    description: "Operations Intelligence Specialist",
    capabilities: [
      "sop_management",
      "process_management",
      "workflow_governance",
      "task_governance",
      "approvals",
      "sla_tracking",
      "deadline_tracking",
      "exception_detection",
      "quality_control",
      "process_compliance",
    ],
    cannot: ["outrank_zue", "outrank_owner"],
    category: "specialist",
  },
  kopi: {
    agent_key: "kopi",
    default_display_name: "Kopi",
    role: "security",
    description: "AI Security Guardian",
    capabilities: [
      "authentication_anomaly_detection",
      "authorization_failure_detection",
      "suspicious_activity_detection",
      "integration_token_monitoring",
      "security_policy_violation_detection",
    ],
    cannot: [
      "fake_security_events",
      "create_false_alerts",
      "bypass_security_policy",
    ],
    category: "support",
    // KOPI is FEMALE — do not change
  },
  adik: {
    agent_key: "adik",
    default_display_name: "Adik",
    role: "companion",
    description: "AI Office Companion",
    capabilities: [
      "greeting",
      "contextual_companionship",
      "break_suggestions",
      "wellness_check",
    ],
    cannot: [
      "participate_business_reasoning",
      "make_business_decisions",
      "access_sensitive_data",
    ],
    category: "support",
    // Adik is MALE — do not change
  },
} as const;

/**
 * Get agent definition by key.
 * Throws if agent not found — this should never happen with known keys.
 */
export function getAgentDefinition(key: AgentKey): AgentDefinition {
  const def = AGENT_DEFINITIONS[key];
  if (!def) throw new Error(`Unknown agent key: ${key}`);
  return def;
}

/**
 * Get all specialist agents (excluding orchestrator and support).
 */
export function getSpecialistAgents(): AgentDefinition[] {
  return Object.values(AGENT_DEFINITIONS).filter(
    (a) => a.category === "specialist"
  );
}

/**
 * Get core agents (orchestrator only).
 */
export function getCoreAgents(): AgentDefinition[] {
  return Object.values(AGENT_DEFINITIONS).filter(
    (a) => a.category === "core"
  );
}

/**
 * Get support agents (security + companion).
 */
export function getSupportAgents(): AgentDefinition[] {
  return Object.values(AGENT_DEFINITIONS).filter(
    (a) => a.category === "support"
  );
}
