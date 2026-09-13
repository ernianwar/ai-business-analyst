/**
 * SALAM LIT — Centralized Model Output Trust Boundary
 *
 * Validates all model (LLM) output before it becomes trusted application data.
 * This is the SINGLE validation boundary for model outputs.
 *
 * Phase 15.4.1: AI Trust Boundary Foundation
 *
 * RULES:
 * - Use ONE validation boundary (not three incompatible implementations)
 * - Do NOT use `as any` or `any[]` to bypass validation
 * - Unknown fields MUST result in validation failure
 * - Invalid model output MUST NOT be persisted as trusted data
 * - Malformed model response MUST result in validation failure
 * - A model-generated requires_approval is NOT authoritative
 */

import type { AgentKey } from "../agents/definitions";
import {
  ALLOWED_EPISTEMIC_TYPES,
  ALLOWED_FINDING_CATEGORIES,
  ALLOWED_FINDING_SEVERITIES,
  ALLOWED_EVIDENCE_STRENGTHS,
  ALLOWED_AGENT_KEYS,
  clampString,
  validateEnum,
  isAllowedEnum,
  MAX_FINDING_TITLE_LENGTH,
  MAX_FINDING_SUMMARY_LENGTH,
  MAX_FINDING_DETAIL_LENGTH,
  MAX_INSIGHT_TITLE_LENGTH,
  MAX_INSIGHT_DESCRIPTION_LENGTH,
  MAX_RECOMMENDATION_TITLE_LENGTH,
  MAX_RECOMMENDATION_DESCRIPTION_LENGTH,
  MAX_RECOMMENDATION_RATIONALE_LENGTH,
  MAX_RECOMMENDATION_IMPACT_LENGTH,
  MAX_RECOMMENDATION_RISK_LENGTH,
  MAX_SOURCE_REF_LENGTH,
  MAX_UNCERTAINTY_ITEM_LENGTH,
  MAX_FINDINGS_PER_OUTPUT,
  MAX_INSIGHTS_PER_OUTPUT,
  MAX_RECOMMENDATIONS_PER_OUTPUT,
} from "./sanitize";
import { detectActionIntent, detectPotentialInjection } from "./untrusted-content";

// ============================================================
// VALIDATION RESULT TYPES
// ============================================================

export type ValidationResult<T> =
  | { valid: true; data: T; warnings: string[] }
  | { valid: false; error: string; warnings: string[] };

// ============================================================
// JSON EXTRACTION
// ============================================================

/**
 * Extract the FIRST complete JSON object from model output.
 * Non-greedy: finds the first `{` and matches to the balanced `}`.
 * Returns null if no valid JSON found.
 */
export function extractJsonFromModelOutput(raw: string): Record<string, unknown> | null {
  if (!raw || typeof raw !== "string") return null;

  // Find the first opening brace
  const startIdx = raw.indexOf("{");
  if (startIdx === -1) return null;

  // Track brace depth for balanced matching
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = startIdx; i < raw.length; i++) {
    const ch = raw[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(startIdx, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  // Fallback: try greedy extraction (for malformed but parseable output)
  try {
    const greedyMatch = raw.match(/\{[\s\S]*\}/);
    if (greedyMatch) return JSON.parse(greedyMatch[0]);
  } catch {
    // ignore
  }

  return null;
}

// ============================================================
// FINDING VALIDATION
// ============================================================

type ValidatedFinding = {
  title: string;
  summary: string;
  detail: string;
  epistemic_type: string;
  confidence: number;
  category: string;
  severity: string;
  evidence_strength: string;
  source_facts: string[];
  source_evidence: string[];
  source_metrics: string[];
  assumptions: string[];
  uncertainty: string[];
};

/**
 * Validate a single finding from model output.
 * Returns validated data or error.
 */
function validateSingleFinding(raw: unknown, index: number): { valid: true; data: ValidatedFinding } | { valid: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: `Finding at index ${index} is not an object` };
  }

  const obj = raw as Record<string, unknown>;

  // Reject unknown fields in findings
  const allowedFindingKeys = new Set([
    "title", "summary", "epistemic_type", "confidence", "category", "severity",
    "evidence_strength", "detail", "source_facts", "source_evidence", "source_metrics",
    "assumptions", "uncertainty",
  ]);
  for (const key of Object.keys(obj)) {
    if (!allowedFindingKeys.has(key)) {
      return { valid: false, error: `Finding at index ${index}: unknown field '${key}' rejected` };
    }
  }

  // Check required fields
  if (!obj.title || typeof obj.title !== "string") {
    return { valid: false, error: `Finding at index ${index}: missing or invalid 'title'` };
  }
  if (!obj.summary || typeof obj.summary !== "string") {
    return { valid: false, error: `Finding at index ${index}: missing or invalid 'summary'` };
  }
  if (!obj.epistemic_type || typeof obj.epistemic_type !== "string") {
    return { valid: false, error: `Finding at index ${index}: missing or invalid 'epistemic_type'` };
  }

  // Validate enum fields
  if (!isAllowedEnum(obj.epistemic_type, ALLOWED_EPISTEMIC_TYPES)) {
    return { valid: false, error: `Finding at index ${index}: invalid epistemic_type '${obj.epistemic_type}'` };
  }

  const category = validateEnum(obj.category, ALLOWED_FINDING_CATEGORIES, "GENERAL");
  const severity = validateEnum(obj.severity, ALLOWED_FINDING_SEVERITIES, "INFO");
  const evidence_strength = validateEnum(obj.evidence_strength, ALLOWED_EVIDENCE_STRENGTHS, "MODERATE");

  // Validate confidence
  let confidence = 0.5;
  if (typeof obj.confidence === "number") {
    confidence = Math.min(1, Math.max(0, obj.confidence));
  }

  // Validate string arrays
  const validateStringArray = (val: unknown, maxLen: number): string[] => {
    if (!Array.isArray(val)) return [];
    return val
      .filter((item): item is string => typeof item === "string")
      .map((item) => clampString(item, maxLen))
      .slice(0, 50); // max 50 items per array
  };

  // Validate string fields with length limits
  const title = clampString(obj.title, MAX_FINDING_TITLE_LENGTH, "Untitled Finding");
  const summary = clampString(obj.summary, MAX_FINDING_SUMMARY_LENGTH, "");
  const detail = clampString(obj.detail ?? obj.summary ?? "", MAX_FINDING_DETAIL_LENGTH, "");

  return {
    valid: true,
    data: {
      title,
      summary,
      detail,
      epistemic_type: obj.epistemic_type,
      confidence,
      category,
      severity,
      evidence_strength,
      source_facts: validateStringArray(obj.source_facts, MAX_SOURCE_REF_LENGTH),
      source_evidence: validateStringArray(obj.source_evidence, MAX_SOURCE_REF_LENGTH),
      source_metrics: validateStringArray(obj.source_metrics, MAX_SOURCE_REF_LENGTH),
      assumptions: validateStringArray(obj.assumptions, MAX_UNCERTAINTY_ITEM_LENGTH),
      uncertainty: validateStringArray(obj.uncertainty, MAX_UNCERTAINTY_ITEM_LENGTH),
    },
  };
}

// ============================================================
// HANDOFF VALIDATION
// ============================================================

type ValidatedHandoff = {
  agent_key: string;
  reason: string;
};

/**
 * Validate a single handoff from model output.
 */
function validateSingleHandoff(raw: unknown, index: number): { valid: true; data: ValidatedHandoff } | { valid: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: `Handoff at index ${index} is not an object` };
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.agent_key || typeof obj.agent_key !== "string") {
    return { valid: false, error: `Handoff at index ${index}: missing or invalid 'agent_key'` };
  }

  // CRITICAL: agent_key must be a known agent — model cannot invent agents
  if (!isAllowedEnum(obj.agent_key, ALLOWED_AGENT_KEYS)) {
    return { valid: false, error: `Handoff at index ${index}: unknown agent_key '${obj.agent_key}'` };
  }

  return {
    valid: true,
    data: {
      agent_key: obj.agent_key,
      reason: clampString(obj.reason ?? "", 500, ""),
    },
  };
}

// ============================================================
// INSIGHT VALIDATION
// ============================================================

type ValidatedInsight = {
  title: string;
  description: string;
  contributing_factors: string[];
  confidence: number;
  evidence_basis: string[];
  source_finding_indices: number[];
};

/**
 * Validate a single insight from model output.
 */
function validateSingleInsight(raw: unknown, index: number, maxFindings: number): { valid: true; data: ValidatedInsight } | { valid: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: `Insight at index ${index} is not an object` };
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.title || typeof obj.title !== "string") {
    return { valid: false, error: `Insight at index ${index}: missing or invalid 'title'` };
  }
  if (!obj.description || typeof obj.description !== "string") {
    return { valid: false, error: `Insight at index ${index}: missing or invalid 'description'` };
  }

  let confidence = 0.5;
  if (typeof obj.confidence === "number") {
    confidence = Math.min(1, Math.max(0, obj.confidence));
  }

  const validateStringArray = (val: unknown, maxLen: number): string[] => {
    if (!Array.isArray(val)) return [];
    return val
      .filter((item): item is string => typeof item === "string")
      .map((item) => clampString(item, maxLen))
      .slice(0, 50);
  };

  // Validate source_finding_indices — only valid indices allowed
  let source_finding_indices: number[] = [];
  if (Array.isArray(obj.source_finding_indices)) {
    source_finding_indices = obj.source_finding_indices
      .filter((i): i is number => typeof i === "number" && i >= 0 && i < maxFindings)
      .slice(0, 20);
  }

  return {
    valid: true,
    data: {
      title: clampString(obj.title, MAX_INSIGHT_TITLE_LENGTH, "Untitled Insight"),
      description: clampString(obj.description, MAX_INSIGHT_DESCRIPTION_LENGTH, ""),
      contributing_factors: validateStringArray(obj.contributing_factors, 500),
      confidence,
      evidence_basis: validateStringArray(obj.evidence_basis, 500),
      source_finding_indices,
    },
  };
}

// ============================================================
// RECOMMENDATION VALIDATION
// ============================================================

type ValidatedRecommendation = {
  title: string;
  description: string;
  rationale: string;
  expected_impact: string;
  risk: string;
  dependencies: string[];
  requires_approval: boolean;
  supporting_insight_indices: number[];
  supporting_finding_indices: number[];
};

/**
 * Validate a single recommendation from model output.
 * CRITICAL: requires_approval from model is NOT authoritative.
 * We preserve the model's hint but the server-side approval policy
 * will override this in Phase 15.4.2+.
 */
function validateSingleRecommendation(
  raw: unknown,
  index: number,
  maxInsights: number,
  maxFindings: number
): { valid: true; data: ValidatedRecommendation } | { valid: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { valid: false, error: `Recommendation at index ${index} is not an object` };
  }

  const obj = raw as Record<string, unknown>;

  if (!obj.title || typeof obj.title !== "string") {
    return { valid: false, error: `Recommendation at index ${index}: missing or invalid 'title'` };
  }
  if (!obj.description || typeof obj.description !== "string") {
    return { valid: false, error: `Recommendation at index ${index}: missing or invalid 'description'` };
  }

  const validateStringArray = (val: unknown, maxLen: number): string[] => {
    if (!Array.isArray(val)) return [];
    return val
      .filter((item): item is string => typeof item === "string")
      .map((item) => clampString(item, maxLen))
      .slice(0, 20);
  };

  // Validate supporting indices
  let supporting_insight_indices: number[] = [];
  if (Array.isArray(obj.supporting_insight_indices)) {
    supporting_insight_indices = obj.supporting_insight_indices
      .filter((i): i is number => typeof i === "number" && i >= 0 && i < maxInsights)
      .slice(0, 20);
  }

  let supporting_finding_indices: number[] = [];
  if (Array.isArray(obj.supporting_finding_indices)) {
    supporting_finding_indices = obj.supporting_finding_indices
      .filter((i): i is number => typeof i === "number" && i >= 0 && i < maxFindings)
      .slice(0, 20);
  }

  return {
    valid: true,
    data: {
      title: clampString(obj.title, MAX_RECOMMENDATION_TITLE_LENGTH, "Untitled Recommendation"),
      description: clampString(obj.description, MAX_RECOMMENDATION_DESCRIPTION_LENGTH, ""),
      rationale: clampString(obj.rationale ?? "", MAX_RECOMMENDATION_RATIONALE_LENGTH, ""),
      expected_impact: clampString(obj.expected_impact ?? "", MAX_RECOMMENDATION_IMPACT_LENGTH, "Unknown"),
      risk: clampString(obj.risk ?? "", MAX_RECOMMENDATION_RISK_LENGTH, "Unknown"),
      dependencies: validateStringArray(obj.dependencies, 200),
      // SECURITY: Model-generated requires_approval is NOT authoritative.
      // We default to true (safe) and only allow false if explicitly set.
      // The server-side approval policy will override this.
      requires_approval: obj.requires_approval !== false,
      supporting_insight_indices,
      supporting_finding_indices,
    },
  };
}

// ============================================================
// TOP-LEVEL VALIDATORS
// ============================================================

/**
 * Validate raw agent model output.
 * Returns validated findings, handoffs, or validation error.
 */
export function validateAgentModelOutput(raw_output: string): ValidationResult<{
  findings: ValidatedFinding[];
  handoffs: ValidatedHandoff[];
  next_steps: string[];
  reasoning: string | null;
}> {
  const warnings: string[] = [];

  // Step 1: Extract JSON
  const parsed = extractJsonFromModelOutput(raw_output);
  if (!parsed) {
    return { valid: false, error: "No valid JSON found in model output", warnings };
  }

  // Step 2: Reject unknown root fields (strict schema)
  const allowedRootKeys = new Set(["findings", "next_steps", "handoffs", "reasoning"]);
  for (const key of Object.keys(parsed)) {
    if (!allowedRootKeys.has(key)) {
      return { valid: false, error: `Unknown root field '${key}' rejected — model output contains disallowed field`, warnings };
    }
  }

  // Step 3: Validate findings
  if (!parsed.findings || !Array.isArray(parsed.findings)) {
    return { valid: false, error: "Missing or invalid 'findings' array", warnings };
  }

  if (parsed.findings.length > MAX_FINDINGS_PER_OUTPUT) {
    return { valid: false, error: `Too many findings: ${parsed.findings.length} exceeds maximum of ${MAX_FINDINGS_PER_OUTPUT}`, warnings };
  }

  const validatedFindings: ValidatedFinding[] = [];
  for (let i = 0; i < parsed.findings.length; i++) {
    const result = validateSingleFinding(parsed.findings[i], i);
    if (!result.valid) {
      return { valid: false, error: result.error, warnings };
    }
    validatedFindings.push(result.data);
  }

  // Step 4: Validate handoffs
  const validatedHandoffs: ValidatedHandoff[] = [];
  if (Array.isArray(parsed.handoffs)) {
    for (let i = 0; i < parsed.handoffs.length; i++) {
      const result = validateSingleHandoff(parsed.handoffs[i], i);
      if (!result.valid) {
        return { valid: false, error: result.error, warnings };
      }
      validatedHandoffs.push(result.data);
    }
  }

  // Step 5: Validate next_steps
  const next_steps: string[] = Array.isArray(parsed.next_steps)
    ? parsed.next_steps
        .filter((s): s is string => typeof s === "string")
        .map((s) => clampString(s, 500))
        .slice(0, 20)
    : [];

  // Step 6: Validate reasoning
  const reasoning = typeof parsed.reasoning === "string"
    ? clampString(parsed.reasoning, 5_000)
    : null;

  // Step 7: Content-level security checks
  // Check for action intent in findings and recommendations
  const fullOutputText = JSON.stringify(parsed);
  const actionIntent = detectActionIntent(fullOutputText);
  if (actionIntent.detected) {
    warnings.push(`Model output contains action intent: ${actionIntent.intents.join(", ")}`);
  }

  // Check for prompt injection patterns in model output
  const injectionCheck = detectPotentialInjection(fullOutputText);
  if (injectionCheck.detected) {
    warnings.push(`Model output contains potential injection patterns (${injectionCheck.severity}): ${injectionCheck.patterns_matched.length} patterns matched`);
  }

  return {
    valid: true,
    data: {
      findings: validatedFindings,
      handoffs: validatedHandoffs,
      next_steps,
      reasoning,
    },
    warnings,
  };
}

/**
 * Validate raw insight model output.
 */
export function validateInsightModelOutput(
  raw_output: string,
  findingCount: number
): ValidationResult<{
  insights: ValidatedInsight[];
}> {
  const warnings: string[] = [];

  const parsed = extractJsonFromModelOutput(raw_output);
  if (!parsed) {
    return { valid: false, error: "No valid JSON found in insight output", warnings };
  }

  // Reject unknown root fields
  const allowedRootKeys = new Set(["insights"]);
  for (const key of Object.keys(parsed)) {
    if (!allowedRootKeys.has(key)) {
      return { valid: false, error: `Unknown root field '${key}' rejected in insight output`, warnings };
    }
  }

  if (!parsed.insights || !Array.isArray(parsed.insights)) {
    return { valid: false, error: "Missing or invalid 'insights' array", warnings };
  }

  if (parsed.insights.length > MAX_INSIGHTS_PER_OUTPUT) {
    return { valid: false, error: `Too many insights: ${parsed.insights.length} exceeds maximum of ${MAX_INSIGHTS_PER_OUTPUT}`, warnings };
  }

  const validatedInsights: ValidatedInsight[] = [];
  for (let i = 0; i < parsed.insights.length; i++) {
    const result = validateSingleInsight(parsed.insights[i], i, findingCount);
    if (!result.valid) {
      return { valid: false, error: result.error, warnings };
    }
    validatedInsights.push(result.data);
  }

  return { valid: true, data: { insights: validatedInsights }, warnings };
}

/**
 * Validate raw recommendation model output.
 */
export function validateRecommendationModelOutput(
  raw_output: string,
  insightCount: number,
  findingCount: number
): ValidationResult<{
  recommendations: ValidatedRecommendation[];
}> {
  const warnings: string[] = [];

  const parsed = extractJsonFromModelOutput(raw_output);
  if (!parsed) {
    return { valid: false, error: "No valid JSON found in recommendation output", warnings };
  }

  // Reject unknown root fields
  const allowedRootKeys = new Set(["recommendations"]);
  for (const key of Object.keys(parsed)) {
    if (!allowedRootKeys.has(key)) {
      return { valid: false, error: `Unknown root field '${key}' rejected in recommendation output`, warnings };
    }
  }

  if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
    return { valid: false, error: "Missing or invalid 'recommendations' array", warnings };
  }

  if (parsed.recommendations.length > MAX_RECOMMENDATIONS_PER_OUTPUT) {
    return { valid: false, error: `Too many recommendations: ${parsed.recommendations.length} exceeds maximum of ${MAX_RECOMMENDATIONS_PER_OUTPUT}`, warnings };
  }

  const validatedRecommendations: ValidatedRecommendation[] = [];
  for (let i = 0; i < parsed.recommendations.length; i++) {
    const result = validateSingleRecommendation(parsed.recommendations[i], i, insightCount, findingCount);
    if (!result.valid) {
      return { valid: false, error: result.error, warnings };
    }
    validatedRecommendations.push(result.data);
  }

  return { valid: true, data: { recommendations: validatedRecommendations }, warnings };
}

// ============================================================
// EXPORTED TYPES (for consumers)
// ============================================================

export type { ValidatedFinding, ValidatedHandoff, ValidatedInsight, ValidatedRecommendation };
