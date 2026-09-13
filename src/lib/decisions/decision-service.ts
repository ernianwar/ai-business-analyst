/**
 * SALAM LIT — Decision Center Service
 *
 * Manages the lifecycle of owner decisions.
 * Provides CRUD operations, decision memory, and evidence traceability.
 *
 * Phase 11: Recommendation + Decision Center
 *
 * CRITICAL:
 * - RECOMMENDATION ≠ DECISION ≠ APPROVAL ≠ EXECUTION
 * - This service manages OWNER DECISIONS only
 * - Recommendations come from the intelligence layer
 * - Execution is handled by a separate engine (future phase)
 */

import type {
  Decision,
  DecisionType,
  DecisionStatus,
  DecisionMemory,
  DecisionCenterItem,
  Recommendation,
  AgentFinding,
  Insight,
  ActionType,
  ApprovalScope,
} from "../runtime/types";
import { getRecommendation, getRecommendationsByBusiness } from "../intelligence/recommendation-engine";
import { getInvestigation, getInvestigationsByBusiness } from "../orchestration/zue";
import { getInsightsByInvestigation } from "../intelligence/insight-engine";
import { createApprovalRequest } from "../approval/approval-service";
import { determineRiskLevel } from "../approval/approval-service";
import { getDecisionRepository } from "./decision-repository";

/**
 * In-memory decision memory store.
 * Decision memory is NOT business-critical; kept in-memory only.
 */
const decisionMemory: Map<string, DecisionMemory> = new Map();

// ──────────────────────────────────────────────────────────────────────
// DECISION CRUD
// ──────────────────────────────────────────────────────────────────────

/**
 * Create a new decision.
 * Validates that the recommendation exists and has no active decision.
 */
export function createDecision(params: {
  business_id: string;
  recommendation_id: string;
  decision_type: DecisionType;
  decision_maker: string;
  reason: string;
  modified_scope?: string;
  trigger_id?: string;
}): { success: boolean; decision?: Decision; error?: string } {
  const recommendation = getRecommendation(params.recommendation_id);
  if (!recommendation) {
    return { success: false, error: "Recommendation not found" };
  }

  // Check for existing active decision on this recommendation
  const existingDecision = getActiveDecisionByRecommendation(params.recommendation_id);
  if (existingDecision) {
    return {
      success: false,
      error: `Active decision already exists: ${existingDecision.decision_type}. Supersede it first.`,
    };
  }

  const investigation_id = recommendation.investigation_id;

  const decision: Decision = {
    id: crypto.randomUUID(),
    business_id: params.business_id,
    recommendation_id: params.recommendation_id,
    investigation_id,
    trigger_id: params.trigger_id ?? null,
    decision_type: params.decision_type,
    decision_maker: params.decision_maker,
    reason: params.reason,
    original_scope: recommendation.title,
    modified_scope: params.modified_scope ?? null,
    status: "ACTIVE",
    superseded_by: null,
    decision_context: {
      recommendation_title: recommendation.title,
      recommendation_description: recommendation.description,
      recommendation_confidence: recommendation.expected_impact ? 0.5 : 0,
      recommendation_impact: recommendation.expected_impact ?? "Unknown",
      recommendation_risk: recommendation.risk ?? "Unknown",
    },
    decided_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  getDecisionRepository().create(decision);

  // Create decision memory
  createDecisionMemory({
    business_id: params.business_id,
    decision_id: decision.id,
    decision_type: params.decision_type,
    decision_summary: `${params.decision_type}: ${recommendation.title}`,
    decision_reason: params.reason,
    decision_scope: params.modified_scope ?? recommendation.title,
    related_recommendation_title: recommendation.title,
    related_investigation_id: investigation_id,
  });

  // Phase 12 Integration: Create approval request when decision is APPROVE or APPROVE_WITH_CHANGES
  // DECISION ≠ APPROVAL — the owner's decision triggers an approval request that must be granted
  if (params.decision_type === "APPROVE" || params.decision_type === "APPROVE_WITH_CHANGES") {
    // Determine action type from recommendation context
    const actionType = inferActionTypeFromRecommendation(recommendation);
    
    // Build scope from decision
    const scope: ApprovalScope = {
      business_id: params.business_id,
      action_type: actionType,
      max_amount: extractAmountFromRecommendation(recommendation),
      currency: "MYR",
      vendor_payee: extractVendorFromRecommendation(recommendation),
      vendor_category: null,
      frequency: "one_time",
      time_period: "immediate",
      resource: null,
      authorized_agent: null,
    };

    createApprovalRequest({
      business_id: params.business_id,
      requested_by: params.decision_maker,
      requested_by_type: "USER",
      action_type: actionType,
      action_description: `Owner decision: ${params.decision_type} - ${recommendation.title}`,
      scope,
      decision_id: decision.id,
    });
  }

  return { success: true, decision };
}

/**
 * Get a decision by ID.
 */
export function getDecision(id: string): Decision | null {
  return getDecisionRepository().getById(id);
}

/**
 * Get all decisions for a business.
 */
export function getDecisionsByBusiness(business_id: string, limit: number = 50): Decision[] {
  return getDecisionRepository().getByBusiness(business_id, limit);
}

/**
 * Get the active decision for a recommendation.
 */
export function getActiveDecisionByRecommendation(recommendation_id: string): Decision | null {
  return getDecisionRepository().getActiveByRecommendation(recommendation_id);
}

/**
 * Supersede a decision with a new one.
 */
export function supersedeDecision(
  old_decision_id: string,
  new_decision: Decision
): Decision | null {
  const repo = getDecisionRepository();
  const oldDecision = repo.getById(old_decision_id);
  if (!oldDecision || oldDecision.status !== "ACTIVE") return null;

  repo.update(old_decision_id, { status: "SUPERSEDED", superseded_by: new_decision.id });
  return { ...oldDecision, status: "SUPERSEDED", superseded_by: new_decision.id };
}

/**
 * Cancel a decision.
 */
export function cancelDecision(decision_id: string): Decision | null {
  const repo = getDecisionRepository();
  const decision = repo.getById(decision_id);
  if (!decision || decision.status !== "ACTIVE") return null;

  repo.update(decision_id, { status: "CANCELLED" });
  return { ...decision, status: "CANCELLED" };
}

// ──────────────────────────────────────────────────────────────────────
// DECISION MEMORY
// ──────────────────────────────────────────────────────────────────────

/**
 * Create a decision memory record.
 */
function createDecisionMemory(params: {
  business_id: string;
  decision_id: string;
  decision_type: DecisionType;
  decision_summary: string;
  decision_reason: string;
  decision_scope: string | null;
  related_recommendation_title: string;
  related_investigation_id: string | null;
}): DecisionMemory {
  const memory: DecisionMemory = {
    id: crypto.randomUUID(),
    business_id: params.business_id,
    decision_id: params.decision_id,
    decision_type: params.decision_type,
    decision_summary: params.decision_summary,
    decision_reason: params.decision_reason,
    decision_scope: params.decision_scope,
    related_recommendation_title: params.related_recommendation_title,
    related_investigation_id: params.related_investigation_id,
    created_at: new Date().toISOString(),
  };

  decisionMemory.set(memory.id, memory);
  return memory;
}

/**
 * Get decision memory for a business.
 * Used by future investigations to retrieve relevant past decisions.
 */
export function getDecisionMemoryByBusiness(business_id: string): DecisionMemory[] {
  return Array.from(decisionMemory.values())
    .filter((m) => m.business_id === business_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Search decision memory for relevant past decisions.
 * Used by Zue to retrieve context for new investigations.
 */
export function searchDecisionMemory(
  business_id: string,
  keywords: string[]
): DecisionMemory[] {
  const allMemory = getDecisionMemoryByBusiness(business_id);
  const lowerKeywords = keywords.map((k) => k.toLowerCase());

  return allMemory.filter((m) => {
    const searchable = `${m.decision_summary} ${m.decision_reason} ${m.related_recommendation_title}`.toLowerCase();
    return lowerKeywords.some((kw) => searchable.includes(kw));
  });
}

// ──────────────────────────────────────────────────────────────────────
// DECISION CENTER BUILDER
// ──────────────────────────────────────────────────────────────────────

/**
 * Build a Decision Center item from a recommendation.
 * Assembles all evidence, findings, insights, and context.
 */
export function buildDecisionCenterItem(
  recommendation_id: string
): DecisionCenterItem | null {
  const recommendation = getRecommendation(recommendation_id);
  if (!recommendation) return null;

  // Get investigation context
  const investigation = recommendation.investigation_id
    ? getInvestigation(recommendation.investigation_id)
    : null;

  // Get findings
  const findings = investigation?.findings ?? [];

  // Get insights
  const insights = recommendation.investigation_id
    ? getInsightsByInvestigation(recommendation.investigation_id)
    : [];

  // Build evidence list
  const evidence: Array<{ id: string; type: string; summary: string; source: string }> = [];
  for (const finding of findings) {
    for (const sourceFact of finding.source_facts) {
      evidence.push({
        id: `fact-${sourceFact}`,
        type: "FACT",
        summary: `Fact reference: ${sourceFact}`,
        source: finding.title,
      });
    }
    for (const sourceMetric of finding.source_metrics) {
      evidence.push({
        id: `metric-${sourceMetric}`,
        type: "METRIC",
        summary: `Metric reference: ${sourceMetric}`,
        source: finding.title,
      });
    }
  }

  // Get existing decision
  const existingDecision = getActiveDecisionByRecommendation(recommendation_id);

  // Get decision memory
  const memory = getDecisionMemoryByBusiness(recommendation.business_id);

  return {
    recommendation,
    investigation: investigation
      ? {
          id: investigation.id,
          title: investigation.title,
          description: investigation.description,
          findings_count: investigation.findings.length,
          insights_count: investigation.insights.length,
        }
      : null,
    findings,
    insights,
    evidence,
    existing_decision: existingDecision,
    decision_memory: memory.slice(0, 10), // Limit to recent 10
  };
}

/**
 * Get all pending decisions for a business.
 * Recommendations that have no active decision yet.
 */
export function getPendingDecisions(business_id: string): DecisionCenterItem[] {
  const recommendations = getRecommendationsByBusiness(business_id);
  const pendingItems: DecisionCenterItem[] = [];

  for (const rec of recommendations) {
    const existingDecision = getActiveDecisionByRecommendation(rec.id);
    if (!existingDecision) {
      const item = buildDecisionCenterItem(rec.id);
      if (item) {
        pendingItems.push(item);
      }
    }
  }

  return pendingItems;
}

/**
 * Get all decided items for a business.
 * Recommendations that have an active decision.
 */
export function getDecidedItems(business_id: string): DecisionCenterItem[] {
  const allDecisions = getDecisionsByBusiness(business_id);
  const decidedItems: DecisionCenterItem[] = [];

  for (const decision of allDecisions) {
    if (decision.status === "ACTIVE") {
      const item = buildDecisionCenterItem(decision.recommendation_id);
      if (item) {
        decidedItems.push(item);
      }
    }
  }

  return decidedItems;
}

/**
 * Get decision center summary.
 */
export function getDecisionCenterSummary(business_id: string): {
  total_recommendations: number;
  pending_decisions: number;
  approved: number;
  approved_with_changes: number;
  rejected: number;
  investigate_further: number;
} {
  const recommendations = getRecommendationsByBusiness(business_id);
  const allDecisions = getDecisionsByBusiness(business_id);

  return {
    total_recommendations: recommendations.length,
    pending_decisions: recommendations.length - allDecisions.filter((d) => d.status === "ACTIVE").length,
    approved: allDecisions.filter((d) => d.status === "ACTIVE" && d.decision_type === "APPROVE").length,
    approved_with_changes: allDecisions.filter((d) => d.status === "ACTIVE" && d.decision_type === "APPROVE_WITH_CHANGES").length,
    rejected: allDecisions.filter((d) => d.status === "ACTIVE" && d.decision_type === "REJECT").length,
    investigate_further: allDecisions.filter((d) => d.status === "ACTIVE" && d.decision_type === "INVESTIGATE_FURTHER").length,
  };
}

/**
 * Infer action type from recommendation title/description.
 */
function inferActionTypeFromRecommendation(recommendation: Recommendation): ActionType {
  const text = `${recommendation.title} ${recommendation.description}`.toLowerCase();
  
  if (text.includes("spend") || text.includes("ad") || text.includes("advertising")) return "AD_SPEND";
  if (text.includes("payment") || text.includes("pay ")) return "PAYMENT";
  if (text.includes("transfer")) return "TRANSFER";
  if (text.includes("purchase") || text.includes("buy ")) return "PURCHASE";
  if (text.includes("refund")) return "REFUND";
  if (text.includes("commit") || text.includes("financial")) return "FINANCIAL_COMMITMENT";
  if (text.includes("contract")) return "CONTRACT";
  if (text.includes("hire")) return "HIRING";
  if (text.includes("fire") || text.includes("terminate")) return "FIRING";
  if (text.includes("campaign") && text.includes("publish")) return "CAMPAIGN_PUBLISH";
  if (text.includes("message") || text.includes("notify") || text.includes("email")) return "CUSTOMER_MESSAGE";
  if (text.includes("export") || text.includes("data")) return "DATA_EXPORT";
  if (text.includes("system") || text.includes("config")) return "SYSTEM_CHANGE";
  
  return "OTHER";
}

/**
 * Extract amount from recommendation.
 */
function extractAmountFromRecommendation(recommendation: Recommendation): number | null {
  const text = `${recommendation.title} ${recommendation.description} ${recommendation.expected_impact ?? ""}`;
  
  const rmMatch = text.match(/(?:RM|MYR)\s*([\d,]+\.?\d*)/i);
  if (rmMatch) return parseFloat(rmMatch[1].replace(/,/g, ""));
  
  const numMatch = text.match(/\b(\d{1,3}(?:,\d{3})*(?:\.\d+)?)\b/);
  if (numMatch) return parseFloat(numMatch[1].replace(/,/g, ""));
  
  return null;
}

/**
 * Extract vendor/payee from recommendation.
 */
function extractVendorFromRecommendation(recommendation: Recommendation): string | null {
  const text = `${recommendation.title} ${recommendation.description}`.toLowerCase();
  
  const vendorPatterns = [
    /vendor[:\s]+([a-zA-Z0-9\s]+)/i,
    /supplier[:\s]+([a-zA-Z0-9\s]+)/i,
    /payee[:\s]+([a-zA-Z0-9\s]+)/i,
    /to\s+([A-Z][a-zA-Z0-9\s]{2,30})/,
  ];
  
  for (const pattern of vendorPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}
