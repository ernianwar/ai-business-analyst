/**
 * SALAM LIT — Database Types
 *
 * TypeScript types for all database tables.
 * These types mirror the SQL schema defined in migrations.
 *
 * Phase 4: Business Context + Business Truth Foundation
 */

// ============================================================
// Classification Types
// ============================================================

export type Classification =
  | "PUBLIC"
  | "INTERNAL"
  | "CONFIDENTIAL"
  | "SENSITIVE"
  | "RESTRICTED";

// ============================================================
// v1.1 Core Foundation Types
// ============================================================

export interface User {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  locale: string;
  timezone: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  created_at: string;
  updated_at: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
  status: "ACTIVE" | "INACTIVE" | "PENDING";
  invited_by: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface Business {
  id: string;
  workspace_id: string;
  name: string;
  ssm_registration_no: string | null;
  ssm_registered_address: string | null;
  office_phone: string | null;
  nature_of_business: string | null;
  business_type: string | null;
  industry: string | null;
  location: string | null;
  description: string | null;
  years_operating: number | null;
  business_stage: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  created_at: string;
  updated_at: string;
}

// ============================================================
// Business Context Types
// ============================================================

export interface BusinessJurisdiction {
  id: string;
  business_id: string;
  registered_country: string;
  operating_country: string;
  business_jurisdiction: string;
  user_country: string;
  created_at: string;
  updated_at: string;
}

export interface MarketProfile {
  id: string;
  business_id: string;
  country: string;
  region: string | null;
  locale: string;
  language: string;
  currency: string;
  timezone: string;
  date_format: string;
  number_format: string;
  measurement_system: string;
  target_audience: string | null;
  marketing_preferences: Record<string, unknown>;
  tax_jurisdiction: string | null;
  market_status: "ACTIVE" | "TARGETED" | "INACTIVE";
  created_at: string;
  updated_at: string;
}

export interface CurrencyContext {
  id: string;
  business_id: string;
  default_currency: string;
  display_currency: string | null;
  created_at: string;
  updated_at: string;
}

export interface BusinessGoal {
  id: string;
  business_id: string;
  goal: string;
  target: string | null;
  timeline: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "COMPLETED" | "ABANDONED" | "PAUSED";
  created_at: string;
  updated_at: string;
}

export interface BusinessConstraint {
  id: string;
  business_id: string;
  constraint_type:
    | "BUDGET"
    | "TEAM_CAPACITY"
    | "TIME"
    | "SKILLS"
    | "TECHNOLOGY"
    | "CASH"
    | "OPERATIONAL"
    | "OTHER";
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "ACTIVE" | "RESOLVED" | "RELAXED";
  created_at: string;
  updated_at: string;
}

export interface AiReadiness {
  id: string;
  business_id: string;
  dimension:
    | "TECHNOLOGY"
    | "PEOPLE"
    | "PROCESS"
    | "DATA"
    | "LEADERSHIP"
    | "BUDGET";
  status:
    | "UNKNOWN"
    | "INSUFFICIENT_DATA"
    | "LOW"
    | "MEDIUM"
    | "HIGH";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================
// v1.2 Business Truth Layer Types
// ============================================================

export interface DataSource {
  id: string;
  business_id: string;
  source_type: "USER_INPUT" | "DOCUMENT" | "API" | "INTEGRATION" | "EXTERNAL";
  provider: string | null;
  name: string;
  external_reference: string | null;
  status: "ACTIVE" | "INACTIVE" | "ERROR" | "SYNCING";
  trust_level: "HIGH" | "MEDIUM" | "LOW" | "UNTRUSTED";
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export type DocumentStatus =
  | "UPLOADED"
  | "VALIDATING"
  | "QUEUED"
  | "PROCESSING"
  | "PROCESSED"
  | "PARTIALLY_PROCESSED"
  | "FAILED"
  | "REJECTED"
  | "ARCHIVED";

export interface Document {
  id: string;
  business_id: string;
  data_source_id: string | null;
  file_name: string;
  mime_type: string | null;
  storage_key: string | null;
  file_size: number | null;
  file_hash: string | null;
  classification:
    | "PUBLIC"
    | "INTERNAL"
    | "CONFIDENTIAL"
    | "SENSITIVE"
    | "RESTRICTED";
  status: DocumentStatus;
  uploaded_by: string | null;
  processing_error: string | null;
  processing_started_at: string | null;
  processing_completed_at: string | null;
  evidence_count: number;
  created_at: string;
  updated_at: string;
}

export interface Evidence {
  id: string;
  business_id: string;
  data_source_id: string;
  document_id: string | null;
  evidence_type:
    | "DOCUMENT_EXCERPT"
    | "API_RESPONSE"
    | "USER_STATEMENT"
    | "EXTERNAL_RESEARCH"
    | "SYSTEM_RECORD"
    | "OTHER";
  content_reference: string;
  excerpt: string | null;
  source_timestamp: string | null;
  retrieved_at: string;
  classification:
    | "PUBLIC"
    | "INTERNAL"
    | "CONFIDENTIAL"
    | "SENSITIVE"
    | "RESTRICTED";
  source_reliability: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  content_hash: string | null;
  status: "ACTIVE" | "SUPERSEDED" | "RETRACTED";
  created_at: string;
}

export type FactType =
  | "REVENUE"
  | "COGS"
  | "GROSS_PROFIT"
  | "OPERATING_EXPENSES"
  | "NET_PROFIT"
  | "ACCOUNTS_RECEIVABLE"
  | "ACCOUNTS_PAYABLE"
  | "CASH"
  | "ASSETS"
  | "LIABILITIES"
  | "LOANS"
  | "INVENTORY"
  | "CUSTOMER_COUNT"
  | "EMPLOYEE_COUNT"
  | "OTHER";

export type FactLifecycleStatus =
  | "ACTIVE"
  | "SUPERSEDED"
  | "HISTORICAL"
  | "EXPIRED"
  | "RETRACTED"
  | "CONFLICTED";

export type FreshnessStatus =
  | "CURRENT"
  | "STALE"
  | "UNKNOWN"
  | "UNAVAILABLE"
  | "SYNC_ERROR";

export type EvidenceStrength = "STRONG" | "MODERATE" | "WEAK" | "NONE";

export type CreatedByType = "USER" | "SYSTEM" | "AGENT" | "IMPORT";

export interface BusinessFact {
  id: string;
  business_id: string;
  fact_type: FactType;
  subject: string;
  value: Record<string, unknown>;
  unit: string | null;
  period_start: string | null;
  period_end: string | null;
  valid_from: string;
  valid_to: string | null;
  source_type: CreatedByType;
  confidence: number;
  evidence_strength: EvidenceStrength;
  freshness_status: FreshnessStatus;
  lifecycle_status: FactLifecycleStatus;
  created_by_type: CreatedByType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type FactEvidenceRelationship = "PRIMARY" | "SUPPORTING" | "CONFLICTING";

export interface FactEvidence {
  id: string;
  fact_id: string;
  evidence_id: string;
  relationship_type: FactEvidenceRelationship;
  created_at: string;
}

// ============================================================
// Phase 6: Business Metrics & Financial Foundation Types
// ============================================================

export type MetricKey =
  | "revenue"
  | "cogs"
  | "gross_profit"
  | "gross_margin"
  | "operating_expenses"
  | "operating_expense_ratio"
  | "net_profit"
  | "net_margin"
  | "cash_position"
  | "accounts_receivable"
  | "accounts_payable"
  | "cash_inflow"
  | "cash_outflow"
  | "net_cash_movement"
  | "opening_cash"
  | "closing_cash"
  | "mom_revenue_change"
  | "yoy_revenue_change";

export type MetricStatus =
  | "VALID"
  | "PARTIAL"
  | "INSUFFICIENT_DATA"
  | "CONFLICTED"
  | "STALE"
  | "UNAVAILABLE"
  | "ERROR";

export type ComparisonType =
  | "MOM"
  | "YOY"
  | "PREVIOUS_PERIOD"
  | "CUSTOM";

export type FinancialPeriod =
  | "DAILY"
  | "WEEKLY"
  | "MONTHLY"
  | "QUARTERLY"
  | "YEARLY"
  | "CUSTOM";

export interface MetricDefinition {
  metric_key: MetricKey;
  display_name: string;
  description: string;
  unit: "currency" | "percentage" | "count" | "ratio";
  formula: string;
  required_fact_types: FactType[];
  optional_fact_types: FactType[];
  calculation_version: string;
  is_composable: boolean;
  depends_on: MetricKey[];
}

export interface BusinessMetric {
  id: string;
  business_id: string;
  metric_type: string;
  metric_name: string;
  metric_key: MetricKey;
  value: Record<string, unknown>;
  numeric_value: number | null;
  unit: string | null;
  currency: string | null;
  period_start: string | null;
  period_end: string | null;
  period_type: FinancialPeriod;
  calculation_method: string | null;
  calculation_version: string;
  source_facts: string[];
  status: MetricStatus;
  confidence: number;
  freshness_status: FreshnessStatus;
  created_at: string;
  updated_at: string;
}

export interface MetricSource {
  id: string;
  metric_id: string;
  fact_id: string;
  contribution_weight: number;
  contribution_value: number | null;
  created_at: string;
}

export interface MetricComparison {
  id: string;
  metric_key: MetricKey;
  business_id: string;
  current_period_start: string;
  current_period_end: string;
  previous_period_start: string;
  previous_period_end: string;
  current_value: number | null;
  previous_value: number | null;
  absolute_change: number | null;
  percentage_change: number | null;
  comparison_type: ComparisonType;
  status: MetricStatus;
  currency: string | null;
  calculated_at: string;
}

export interface MetricWithProvenance extends BusinessMetric {
  sources: Array<{
    metric_source: MetricSource;
    fact: BusinessFact;
    evidence_count: number;
  }>;
  definition: MetricDefinition | null;
}

export interface FinancialDataQuality {
  business_id: string;
  period_start: string;
  period_end: string;
  checks: DataQualityCheck[];
  overall_status: "COMPLETE" | "PARTIAL" | "INSUFFICIENT" | "CONFLICTED";
  completeness_score: number;
}

export interface DataQualityCheck {
  check_type: string;
  status: "PASS" | "WARN" | "FAIL" | "MISSING";
  message: string;
  affected_field: string | null;
}

export interface MetricCalculationResult {
  metric: BusinessMetric;
  sources: MetricSource[];
  quality: DataQualityCheck[];
  warnings: string[];
}

export interface PeriodRange {
  start: string;
  end: string;
  type: FinancialPeriod;
}

// ============================================================
// Context Resolution Types
// ============================================================

export interface ResolvedContext {
  id: string;
  business_id: string;
  user_id: string;
  context_type: string;
  context_data: Record<string, unknown>;
  resolved_at: string;
  expires_at: string | null;
  created_at: string;
}

// ============================================================
// Extended Types for API/Service Layer
// ============================================================

export interface BusinessWithJurisdiction extends Business {
  jurisdiction?: BusinessJurisdiction;
  currency_context?: CurrencyContext;
  market_profiles?: MarketProfile[];
}

export interface BusinessFactWithProvenance extends BusinessFact {
  evidence?: Array<{
    evidence: Evidence;
    relationship_type: FactEvidenceRelationship;
  }>;
  data_source?: DataSource;
}

export interface BusinessContextBundle {
  business: Business;
  jurisdiction: BusinessJurisdiction | null;
  currency: CurrencyContext | null;
  market_profiles: MarketProfile[];
  goals: BusinessGoal[];
  constraints: BusinessConstraint[];
  ai_readiness: AiReadiness[];
}
