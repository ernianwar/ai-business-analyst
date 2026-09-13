/**
 * SALAM LIT — Agent Runtime Types
 *
 * Types for the AI Workforce Runtime.
 *
 * Phase 7: AI Workforce Runtime + Zue
 * Phase 9: Investigation & Intelligence Engine
 */

import type { AgentKey } from "../agents/definitions";

// ============================================================
// Epistemic Types
// ============================================================

/**
 * Epistemic classification for agent outputs.
 * FACT = deterministic, verifiable business data
 * INFERENCE = AI interpretation based on facts
 * COMPUTED_INFERENCE = deterministic calculation from facts
 * HYPOTHESIS = AI speculation, unverified
 */
export type EpistemicType = "FACT" | "INFERENCE" | "COMPUTED_INFERENCE" | "HYPOTHESIS";

// ============================================================
// Finding Types
// ============================================================

export type FindingSeverity = "INFO" | "WARNING" | "CRITICAL" | "OPPORTUNITY";
export type FindingCategory =
  | "FINANCIAL"
  | "SALES"
  | "MARKETING"
  | "OPERATIONS"
  | "HR"
  | "FUNDING"
  | "COMPLIANCE"
  | "STRATEGY"
  | "GENERAL";

export interface AgentFinding {
  id: string;
  agent_key: AgentKey;
  investigation_id: string;
  business_id: string;
  epistemic_type: EpistemicType;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  summary: string;
  detail: string;
  confidence: number;
  evidence_strength: "STRONG" | "MODERATE" | "WEAK" | "NONE";
  freshness_status: "CURRENT" | "STALE" | "UNKNOWN" | "UNAVAILABLE";
  source_facts: string[];
  source_evidence: string[];
  source_metrics: string[];
  assumptions: string[];
  uncertainty: string[];
  created_at: string;
}

// ============================================================
// Investigation Types
// ============================================================

export type InvestigationStatus =
  | "CREATED"
  | "PLANNING"
  | "IN_PROGRESS"
  | "WAITING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type InvestigationPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface InvestigationPlan {
  specialist_keys: AgentKey[];
  scope: string;
  required_context_types: string[];
  priority: InvestigationPriority;
  estimated_duration_ms: number;
}

export interface Investigation {
  id: string;
  business_id: string;
  initiated_by: AgentKey;
  trigger_type: "USER_REQUEST" | "PROACTIVE" | "EVENT" | "ORCHESTRATION";
  trigger_source: string;
  title: string;
  description: string;
  objective: string;
  status: InvestigationStatus;
  plan: InvestigationPlan | null;
  assigned_agents: AgentKey[];
  findings: AgentFinding[];
  insights: Insight[];
  recommendations: Recommendation[];
  data_gaps: string[];
  specialist_failures: Array<{ agent_key: AgentKey; error: string }>;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Agent Invocation Types
// ============================================================

export type AgentInvocationStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "TIMEOUT"
  | "CANCELLED";

export interface AgentContext {
  business_id: string;
  user_id: string;
  workspace_id: string;
  business_context: Record<string, unknown>;
  facts: Array<{ id: string; type: string; value: unknown; period: string }>;
  evidence: Array<{ id: string; type: string; excerpt: string }>;
  metrics: Array<{ key: string; value: number | null; status: string }>;
  previous_findings: AgentFinding[];
}

export interface AgentInvocation {
  id: string;
  agent_key: AgentKey;
  investigation_id: string;
  business_id: string;
  status: AgentInvocationStatus;
  input_prompt: string;
  context: AgentContext;
  output: AgentOutput | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  model_used: string | null;
  tokens_used: number | null;
  created_at: string;
}

export interface AgentOutput {
  findings: AgentFinding[];
  raw_response: string;
  structured_data: Record<string, unknown>;
  reasoning: string | null;
  next_steps: string[];
  handoffs: Array<{ agent_key: AgentKey; reason: string }>;
}

// ============================================================
// Zue Orchestration Types
// ============================================================

export type OrchestrationStatus =
  | "IDLE"
  | "ANALYZING"
  | "PLANNING"
  | "DISPATCHING"
  | "MONITORING"
  | "SYNTHESIZING"
  | "COMPLETED"
  | "ERROR";

export interface OrchestrationDecision {
  action: "ROUTE_TO_SPECIALIST" | "INVESTIGATE" | "SYNTHESIZE" | "ESCALATE" | "DECLINE";
  agent_keys: AgentKey[];
  reason: string;
  priority: InvestigationPriority;
  scope: string;
}

export interface OrchestrationResult {
  investigation_id: string;
  decision: OrchestrationDecision;
  routed_agents: AgentKey[];
  synthesis: string | null;
  status: OrchestrationStatus;
}

// ============================================================
// Permission Types
// ============================================================

export type DataScope =
  | "OWN_BUSINESS"
  | "ASSIGNED_BUSINESS"
  | "ALL_BUSINESSES"
  | "NONE";

export type ActionScope =
  | "READ_FACTS"
  | "READ_EVIDENCE"
  | "READ_METRICS"
  | "READ_CONTEXT"
  | "CREATE_FINDING"
  | "INVESTIGATE"
  | "RECOMMEND"
  | "APPROVE"
  | "EXECUTE";

export interface AgentPermissions {
  agent_key: AgentKey;
  data_scope: DataScope;
  action_scopes: ActionScope[];
  max_confidence_threshold: number;
  // H2: Server-owned approval policy — ActionType values that always require human approval
  requires_approval_for: ActionType[];
}

// ============================================================
// Runtime Event Types
// ============================================================

export type RuntimeEventType =
  | "INVOCATION_STARTED"
  | "INVOCATION_COMPLETED"
  | "INVOCATION_FAILED"
  | "INVOCATION_TIMEOUT"
  | "FINDING_CREATED"
  | "INVESTIGATION_STARTED"
  | "INVESTIGATION_COMPLETED"
  | "INVESTIGATION_FAILED"
  | "ZUE_ROUTING"
  | "ZUE_SYNTHESIS"
  | "AGENT_HANDOFF"
  | "PERMISSION_DENIED"
  | "CONTEXT_RESOLVED"
  | "MODEL_REQUEST"
  | "MODEL_RESPONSE"
  | "MODEL_ERROR";

export interface RuntimeEvent {
  id: string;
  type: RuntimeEventType;
  agent_key: AgentKey | null;
  business_id: string;
  investigation_id: string | null;
  invocation_id: string | null;
  data: Record<string, unknown>;
  timestamp: string;
}

// ============================================================
// Usage Tracking Types
// ============================================================

export interface AIUsageRecord {
  id: string;
  agent_key: AgentKey;
  business_id: string;
  investigation_id: string | null;
  invocation_id: string | null;
  model: string;
  provider: string;
  requested_provider?: string | null;
  requested_model?: string | null;
  actual_provider?: string | null;
  actual_model?: string | null;
  candidate_models?: string[];
  selected_candidate_index?: number | null;
  fallback_count?: number;
  retry_count?: number;
  task_type?: string;
  risk_level?: string | null;
  required_capabilities?: string[];
  structured_output_required?: boolean;
  routing_policy_version?: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  duration_ms: number;
  success: boolean;
  error: string | null;
  created_at: string;
}

// ============================================================
// Agent Prompt Types
// ============================================================

export interface AgentPromptTemplate {
  agent_key: AgentKey;
  system_prompt: string;
  task_prompt_template: string;
  output_format: string;
  constraints: string[];
}

export interface ConstructedPrompt {
  system: string;
  user: string;
  context_summary: string;
}

// ============================================================
// Insight Types (Phase 9)
// ============================================================

/**
 * An insight derived from validated findings.
 * Explains what is happening and why it matters.
 */
export interface Insight {
  id: string;
  investigation_id: string;
  business_id: string;
  title: string;
  description: string;
  contributing_factors: string[];
  confidence: number;
  evidence_basis: string[];
  source_findings: string[];
  created_at: string;
}

/**
 * Input for generating an insight from findings.
 */
export interface InsightInput {
  investigation_id: string;
  business_id: string;
  user_id: string;
  workspace_id: string;
  findings: AgentFinding[];
  business_context: Record<string, unknown>;
}

// ============================================================
// Recommendation Types (Phase 9)
// ============================================================

/**
 * An evidence-backed recommendation.
 * Recommendation ≠ Decision. Does NOT approve or execute.
 */
export interface Recommendation {
  id: string;
  investigation_id: string;
  business_id: string;
  title: string;
  description: string;
  rationale: string;
  expected_impact: string;
  risk: string;
  dependencies: string[];
  requires_approval: boolean;
  supporting_insights: string[];
  supporting_findings: string[];
  created_at: string;
}

/**
 * Input for generating recommendations from insights.
 */
export interface RecommendationInput {
  investigation_id: string;
  business_id: string;
  user_id: string;
  workspace_id: string;
  insights: Insight[];
  findings: AgentFinding[];
  business_context: Record<string, unknown>;
}

// ============================================================
// Investigation Result (Phase 9)
// ============================================================

/**
 * Complete investigation result returned to Zue.
 */
export interface InvestigationResult {
  investigation: Investigation;
  findings: AgentFinding[];
  insights: Insight[];
  recommendations: Recommendation[];
  synthesis: string;
  data_gaps: string[];
  specialist_failures: Array<{ agent_key: AgentKey; error: string }>;
}

// ============================================================
// Proactive Work Engine Types (Phase 10)
// ============================================================

/**
 * Business event types that can trigger proactive work.
 */
export type BusinessEventType =
  | "OVERDUE_INVOICE"
  | "SALES_DECLINE"
  | "EXPENSE_INCREASE"
  | "DORMANT_CUSTOMER"
  | "APPROACHING_DEADLINE"
  | "CASHFLOW_WARNING"
  | "CAMPAIGN_PERFORMANCE_CHANGE"
  | "SOP_EXCEPTION"
  | "FUNDING_OPPORTUNITY"
  | "METRIC_THRESHOLD"
  | "PATTERN_ANOMALY"
  | "TIME_BASED_CHECK"
  | "CUSTOM";

/**
 * A detected business event.
 */
export interface BusinessEvent {
  id: string;
  type: BusinessEventType;
  business_id: string;
  summary: string;
  description: string;
  severity: "info" | "warning" | "critical";
  source_data: {
    fact_ids?: string[];
    metric_keys?: string[];
    evidence_ids?: string[];
    document_ids?: string[];
  };
  metadata: Record<string, unknown>;
  detected_at: string;
}

/**
 * Rule condition types.
 */
export type RuleConditionType =
  | "THRESHOLD_ABOVE"
  | "THRESHOLD_BELOW"
  | "THRESHOLD_EQUALS"
  | "PERIOD_COMPARISON"
  | "PATTERN_MATCH"
  | "STATE_CHECK"
  | "TIME_BASED"
  | "DATA_ABSENT";

/**
 * A deterministic rule for detecting business events.
 */
export interface ProactiveRule {
  id: string;
  name: string;
  description: string;
  event_type: BusinessEventType;
  enabled: boolean;
  priority: TriggerPriority;
  conditions: RuleCondition[];
  agent_keys: AgentKey[];
  cooldown_ms: number;
  effective_from: string | null;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A single rule condition.
 */
export interface RuleCondition {
  type: RuleConditionType;
  metric_key?: string;
  fact_type?: string;
  threshold?: number;
  comparison?: "gt" | "lt" | "eq" | "gte" | "lte";
  period_days?: number;
  state_value?: string;
  pattern?: string;
}

/**
 * Trigger priority levels.
 */
export type TriggerPriority = "CRITICAL" | "IMPORTANT" | "UPCOMING" | "ROUTINE" | "INFO";

/**
 * Trigger lifecycle status.
 */
export type TriggerStatus =
  | "PENDING"
  | "INVESTIGATING"
  | "COMPLETED"
  | "DISMISSED"
  | "EXPIRED"
  | "FAILED";

/**
 * A proactive trigger — links a detected event to an investigation.
 */
export interface ProactiveTrigger {
  id: string;
  business_id: string;
  rule_id: string;
  rule_name: string;
  event: BusinessEvent;
  priority: TriggerPriority;
  status: TriggerStatus;
  investigation_id: string | null;
  assigned_agents: AgentKey[];
  deduplication_key: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  completed_at: string | null;
  expires_at: string | null;
  error: string | null;
}

/**
 * Proactive work queue item — what Zue sees.
 */
export interface ProactiveWorkItem {
  trigger: ProactiveTrigger;
  event: BusinessEvent;
  investigation_id: string | null;
  recommendation_count: number;
  status_label: string;
}

/**
 * Deduplication record — prevents duplicate triggers.
 */
export interface DeduplicationRecord {
  key: string;
  trigger_id: string;
  created_at: string;
  expires_at: string;
}

// ──────────────────────────────────────────────────────────────────────
// PHASE 11 — DECISION CENTER TYPES
// ──────────────────────────────────────────────────────────────────────

/**
 * Decision types — what the owner can do with a recommendation.
 */
export type DecisionType =
  | "APPROVE"
  | "APPROVE_WITH_CHANGES"
  | "REJECT"
  | "INVESTIGATE_FURTHER";

/**
 * Decision status — lifecycle of a decision.
 */
export type DecisionStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "CANCELLED";

/**
 * A decision record — the owner's explicit choice on a recommendation.
 *
 * DECISION ≠ APPROVAL ≠ EXECUTION.
 * This records the owner's intent, not the outcome.
 */
export interface Decision {
  id: string;
  business_id: string;
  recommendation_id: string;
  investigation_id: string | null;
  trigger_id: string | null;

  // Owner's choice
  decision_type: DecisionType;
  decision_maker: string; // user_id
  reason: string;

  // Owner's modified scope (only for APPROVE_WITH_CHANGES)
  original_scope: string | null; // original recommendation scope
  modified_scope: string | null; // owner's actual scope

  // Status
  status: DecisionStatus;
  superseded_by: string | null; // id of newer decision

  // Context
  decision_context: {
    recommendation_title: string;
    recommendation_description: string;
    recommendation_confidence: number;
    recommendation_impact: string;
    recommendation_risk: string;
  };

  // Timestamps
  decided_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Decision memory — historical context for future investigations.
 */
export interface DecisionMemory {
  id: string;
  business_id: string;
  decision_id: string;
  decision_type: DecisionType;
  decision_summary: string;
  decision_reason: string;
  decision_scope: string | null;
  related_recommendation_title: string;
  related_investigation_id: string | null;
  created_at: string;
}

/**
 * Decision Center item — what the UI displays.
 */
export interface DecisionCenterItem {
  recommendation: Recommendation;
  investigation: {
    id: string;
    title: string;
    description: string;
    findings_count: number;
    insights_count: number;
  } | null;
  findings: AgentFinding[];
  insights: Insight[];
  evidence: Array<{
    id: string;
    type: string;
    summary: string;
    source: string;
  }>;
  existing_decision: Decision | null;
  decision_memory: DecisionMemory[];
}

// ──────────────────────────────────────────────────────────────────────
// PHASE 12 — APPROVAL + AUTHORIZATION TYPES
// ──────────────────────────────────────────────────────────────────────

/**
 * Risk levels for actions.
 * L0 = cognitive/internal analysis (no external effect)
 * L1 = low-risk internal action/notification
 * L2 = consequential business action
 * L3 = high-impact financial/sensitive/irreversible action
 * L4 = enhanced cryptographic/enterprise trust
 */
export type RiskLevel = "L0" | "L1" | "L2" | "L3" | "L4";

/**
 * Approval status — lifecycle of an approval.
 */
export type ApprovalStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "REVOKED";

/**
 * Action categories for approval.
 */
export type ActionType =
  | "PAYMENT"
  | "TRANSFER"
  | "AD_SPEND"
  | "PURCHASE"
  | "REFUND"
  | "FINANCIAL_COMMITMENT"
  | "CONTRACT"
  | "HIRING"
  | "FIRING"
  | "CAMPAIGN_PUBLISH"
  | "CUSTOMER_MESSAGE"
  | "DATA_EXPORT"
  | "SYSTEM_CHANGE"
  | "OTHER";

/**
 * Scope attributes for scoped approval.
 */
export interface ApprovalScope {
  business_id: string;
  action_type: ActionType;
  max_amount: number | null;
  currency: string | null;
  vendor_payee: string | null;
  vendor_category: string | null;
  frequency: string | null;
  time_period: string | null;
  resource: string | null;
  authorized_agent: string | null;
}

/**
 * An approval record — authorizes a specific consequential action.
 *
 * APPROVAL ≠ DECISION ≠ EXECUTION.
 * This records that an action was authorized, not that it was executed.
 */
export interface Approval {
  id: string;
  business_id: string;
  decision_id: string | null;

  // Request
  requested_by: string; // user_id or agent_key
  requested_by_type: "USER" | "AGENT";
  action_type: ActionType;
  action_description: string;
  scope: ApprovalScope;

  // Risk
  risk_level: RiskLevel;

  // Approval
  status: ApprovalStatus;
  approver_id: string | null; // user_id who approved
  approval_reason: string | null;
  rejection_reason: string | null;

  // Standing authorization reference
  standing_authorization_id: string | null;

  // Timestamps
  requested_at: string;
  approved_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Standing authorization — narrowly scoped pre-approval.
 */
export interface StandingAuthorization {
  id: string;
  business_id: string;

  // Who
  authorized_by: string; // user_id (OWNER only)
  authorized_agent: string | null; // specific agent or null for all

  // What scope
  scope: ApprovalScope;

  // Limits
  max_amount_per_use: number;
  max_amount_per_period: number;
  period: string; // "daily" | "weekly" | "monthly" | "quarterly" | "yearly"
  max_uses_per_period: number | null;

  // Status
  active: boolean;
  revoked: boolean;
  revoked_at: string | null;
  revoked_by: string | null;

  // Timestamps
  effective_from: string;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Authorization check result.
 */
export interface AuthorizationResult {
  authorized: boolean;
  status:
    | "AUTHORIZED"
    | "REQUIRES_APPROVAL"
    | "DENIED"
    | "EXPIRED"
    | "REVOKED"
    | "SCOPE_MISMATCH"
    | "UNAUTHENTICATED"
    | "UNAUTHORIZED"
    | "RISK_VIOLATION"
    | "AGENT_NOT_AUTHORIZED"
    | "PAYMENT_REQUIRES_APPROVAL";
  reason: string;
  risk_level: RiskLevel;
  approval_required: boolean;
  approval_id: string | null;
  matched_standing_authorization_id: string | null;
}

/**
 * Proposed action — what needs authorization.
 */
export interface ProposedAction {
  business_id: string;
  requested_by: string;
  requested_by_type: "USER" | "AGENT";
  agent_key: string | null;
  action_type: ActionType;
  action_description: string;
  scope: ApprovalScope;
  risk_level: RiskLevel;
  decision_id: string | null;
}

/**
 * Audit event for approval-related actions.
 */
export interface ApprovalAuditEvent {
  id: string;
  business_id: string;
  approval_id: string | null;
  event_type:
    | "APPROVAL_REQUESTED"
    | "APPROVAL_GRANTED"
    | "APPROVAL_REJECTED"
    | "APPROVAL_REVOKED"
    | "APPROVAL_EXPIRED"
    | "AUTHORIZATION_DENIED"
    | "SCOPE_MISMATCH"
    | "EXPIRED_APPROVAL_USED"
    | "UNAUTHORIZED_ATTEMPT"
    | "STANDING_AUTH_CREATED"
    | "STANDING_AUTH_REVOKED"
    | "PAYMENT_REQUIRES_APPROVAL"
    | "AGENT_SELF_APPROVAL_BLOCKED";
  actor: string;
  actor_type: "USER" | "AGENT" | "SYSTEM";
  details: Record<string, unknown>;
  timestamp: string;
}

// ══════════════════════════════════════════════════════════════════════
// PHASE 13A — ACTION + EXECUTION ENGINE
// ══════════════════════════════════════════════════════════════════════

/**
 * Action lifecycle status.
 */
export type ActionStatus =
  | "PROPOSED"
  | "AUTHORIZED"
  | "QUEUED"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED"
  | "CANCELLED";

/**
 * An action — an authorized consequential operation to execute.
 */
export interface Action {
  id: string;
  business_id: string;
  decision_id: string | null;
  approval_id: string | null;
  recommendation_id: string | null;
  requested_by: string;
  requested_by_type: "USER" | "AGENT";
  agent_key: string | null;
  action_type: ActionType;
  action_description: string;
  target_type: string;
  target_reference: string | null;
  parameters: Record<string, unknown>;
  risk_level: RiskLevel;
  authorization_result: AuthorizationResult | null;
  status: ActionStatus;
  blocked_reason: string | null;
  failure_reason: string | null;
  created_at: string;
  authorized_at: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

/**
 * Execution lifecycle status.
 * UNKNOWN is a first-class state.
 */
export type ExecutionStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "UNKNOWN";

/**
 * An execution record — one attempt to execute an action via a provider.
 */
export interface Execution {
  id: string;
  business_id: string;
  action_id: string;
  provider: string;
  operation: string;
  idempotency_key: string;
  external_reference: string | null;
  status: ExecutionStatus;
  request_metadata: Record<string, unknown>;
  response_metadata: Record<string, unknown>;
  error_code: string | null;
  error_message: string | null;
  reconciliation_status: "NOT_REQUIRED" | "PENDING" | "RECONCILED" | "UNRESOLVED";
  reconciled_at: string | null;
  reconciliation_details: Record<string, unknown> | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
}

/**
 * Execution outcome — result of a successful execution.
 */
export interface ExecutionOutcome {
  id: string;
  business_id: string;
  action_id: string;
  execution_id: string;
  outcome_type: "SUCCESS" | "PARTIAL_SUCCESS" | "ROLLBACK_SUCCESS" | "ROLLBACK_FAILED";
  summary: string;
  details: Record<string, unknown>;
  financial_impact: number | null;
  currency: string | null;
  created_at: string;
}

/**
 * Action audit event — tracks action lifecycle.
 */
export interface ActionAuditEvent {
  id: string;
  business_id: string;
  action_id: string | null;
  execution_id: string | null;
  event_type:
    | "ACTION_CREATED"
    | "ACTION_AUTHORIZED"
    | "ACTION_AUTHORIZATION_FAILED"
    | "ACTION_BLOCKED"
    | "ACTION_QUEUED"
    | "ACTION_EXECUTING"
    | "ACTION_COMPLETED"
    | "ACTION_FAILED"
    | "ACTION_CANCELLED"
    | "EXECUTION_QUEUED"
    | "EXECUTION_STARTED"
    | "EXECUTION_SUCCEEDED"
    | "EXECUTION_FAILED"
    | "EXECUTION_UNKNOWN"
    | "EXECUTION_AUTHORIZATION_REVOKED"
    | "RECONCILIATION_ATTEMPTED"
    | "RECONCILIATION_RESULT"
    | "PROVIDER_TIMEOUT"
    | "IDEMPOTENCY_DUPLICATE";
  actor: string;
  actor_type: "USER" | "AGENT" | "SYSTEM";
  details: Record<string, unknown>;
  timestamp: string;
}
