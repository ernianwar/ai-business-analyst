/**
 * SALAM LIT — Recommendation Generation Engine
 *
 * Generates evidence-backed recommendations from insights.
 * Recommendation ≠ Decision. Does NOT approve or execute.
 *
 * Phase 9: Investigation & Intelligence Engine
 *
 * RULES:
 * - Recommendations are derived from insights, not invented
 * - Every recommendation must reference supporting insights/findings
 * - Requires approval is the default
 * - Never approve or execute in this phase
 * - Never fabricate expected impact or risk
 */

import type { AgentKey } from "../agents/definitions";
import { getAgentDefinition } from "../agents/definitions";
import { retrieveAgentContext } from "../runtime/context-retrieval";
import { constructPrompt } from "../runtime/prompts";
import { requestModelCompletion, isAIAvailable } from "../runtime/model-gateway";
import type { AgentFinding, Insight, Recommendation, RecommendationInput } from "../runtime/types";
import { AGENT_OUTPUT_SCHEMA } from "../runtime/prompts";
import { validateRecommendationModelOutput } from "../security/model-output-validator";

/**
 * In-memory recommendation store.
 */
const recommendations: Map<string, Recommendation> = new Map();

/**
 * Generate recommendations from insights.
 * Uses AI when available, falls back to deterministic generation.
 */
export async function generateRecommendations(input: RecommendationInput): Promise<Recommendation[]> {
  const { investigation_id, business_id, user_id, workspace_id, insights, findings, business_context } = input;

  if (insights.length === 0) return [];

  // Try AI-powered recommendation generation
  if (await isAIAvailable()) {
    try {
      return await generateRecommendationsWithAI(input);
    } catch {
      // Fall through to deterministic generation
    }
  }

  // Deterministic recommendation generation
  return generateRecommendationsDeterministic(input);
}

/**
 * Generate recommendations using AI model.
 */
async function generateRecommendationsWithAI(input: RecommendationInput): Promise<Recommendation[]> {
  const { investigation_id, business_id, user_id, workspace_id, insights, findings, business_context } = input;

  const context = await retrieveAgentContext({
    agent_key: "erni",
    business_id,
    user_id,
    workspace_id,
  });

  const insightSummaries = insights.map((i) =>
    `[Insight] ${i.title}: ${i.description} (confidence: ${i.confidence})`
  );

  const findingSummaries = findings.map((f) => {
    const agent = getAgentDefinition(f.agent_key);
    return `[${agent.default_display_name}] ${f.title} (${f.epistemic_type}): ${f.summary}`;
  });

  const prompt = constructPrompt({
    agent_key: "erni",
    task: `Based on the following insights and findings, generate actionable business recommendations.

INSIGHTS:
${insightSummaries.join("\n\n")}

SUPPORTING FINDINGS:
${findingSummaries.join("\n\n")}

Generate recommendations that:
1. Are directly supported by the insights
2. Include clear rationale
3. Assess expected impact
4. Identify risks
5. Note dependencies
6. Mark whether owner approval is required

Return a JSON object:
{
  "recommendations": [
    {
      "title": "Short recommendation title",
      "description": "What to do",
      "rationale": "Why this is recommended",
      "expected_impact": "What positive outcome to expect",
      "risk": "What could go wrong",
      "dependencies": ["prerequisite 1"],
      "requires_approval": true,
      "supporting_insight_indices": [0],
      "supporting_finding_indices": [0, 1]
    }
  ]
}

RULES:
- Every recommendation MUST reference at least one insight
- requires_approval defaults to true for consequential actions
- Do not fabricate impact or risk assessments
- If evidence is weak, note lower confidence
- Do not recommend actions outside the AI workforce scope`,
    context,
  });

  const result = await requestModelCompletion({
    agent_key: "erni",
    business_id,
    user_id,
    workspace_id,
    investigation_id,
    invocation_id: crypto.randomUUID(),
    system_prompt: prompt.system,
    user_prompt: prompt.user,
    task_type: "RECOMMENDATION_GENERATION",
    risk_level: "L2",
    required_capabilities: ["analysis", "generation"],
    structured_output_required: true,
    output_schema: {
      ...AGENT_OUTPUT_SCHEMA,
      properties: { recommendations: { type: "array" } },
      required: ["recommendations"],
    },
  });

  if (!result.success || !result.response) {
    throw new Error(result.error ?? "AI recommendation generation failed");
  }

  // Validate using centralized trust boundary
  const validation = validateRecommendationModelOutput(result.response, insights.length, findings.length);
  if (!validation.valid) {
    throw new Error(`Invalid recommendation output: ${validation.error}`);
  }

  const generatedRecommendations: Recommendation[] = [];

  for (const raw of validation.data.recommendations) {
    const supportingInsightIds = raw.supporting_insight_indices
      .map((i) => insights[i].id);

    const supportingFindingIds = raw.supporting_finding_indices
      .map((i) => findings[i].id);

    const recommendation: Recommendation = {
      id: crypto.randomUUID(),
      investigation_id,
      business_id,
      title: raw.title,
      description: raw.description,
      rationale: raw.rationale,
      expected_impact: raw.expected_impact,
      risk: raw.risk,
      dependencies: raw.dependencies,
      // H3/M8: requires_approval is NON-AUTHORITATIVE metadata only.
      // Server-side authorization engine (checkAuthorization + alwaysRequiresApproval + determineRiskLevel)
      // determines actual approval requirement. Model output is never used for authorization decisions.
      requires_approval: raw.requires_approval,
      supporting_insights: supportingInsightIds,
      supporting_findings: supportingFindingIds,
      created_at: new Date().toISOString(),
    };

    recommendations.set(recommendation.id, recommendation);
    generatedRecommendations.push(recommendation);
  }

  return generatedRecommendations;
}

/**
 * Generate recommendations deterministically from insights.
 */
function generateRecommendationsDeterministic(input: RecommendationInput): Recommendation[] {
  const { investigation_id, business_id, insights, findings } = input;
  const generatedRecommendations: Recommendation[] = [];

  for (const insight of insights) {
    // Generate a recommendation for each insight with sufficient confidence
    if (insight.confidence < 0.3) continue;

    const recommendation: Recommendation = {
      id: crypto.randomUUID(),
      investigation_id,
      business_id,
      title: `Address: ${insight.title}`,
      description: `Based on the analysis of ${insight.contributing_factors.length} factor(s), consider addressing: ${insight.description}`,
      rationale: `Supported by ${insight.source_findings.length} finding(s) with ${Math.round(insight.confidence * 100)}% confidence.`,
      expected_impact: "Positive improvement in the analyzed area",
      risk: "Impact depends on implementation quality and business context",
      dependencies: [],
      requires_approval: true,
      supporting_insights: [insight.id],
      supporting_findings: insight.source_findings,
      created_at: new Date().toISOString(),
    };

    recommendations.set(recommendation.id, recommendation);
    generatedRecommendations.push(recommendation);
  }

  return generatedRecommendations;
}

/**
 * Get a recommendation by ID.
 */
export function getRecommendation(id: string): Recommendation | null {
  return recommendations.get(id) ?? null;
}

/**
 * Get all recommendations for an investigation.
 */
export function getRecommendationsByInvestigation(investigation_id: string): Recommendation[] {
  return Array.from(recommendations.values())
    .filter((r) => r.investigation_id === investigation_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Get all recommendations for a business.
 */
export function getRecommendationsByBusiness(business_id: string, limit: number = 100): Recommendation[] {
  return Array.from(recommendations.values())
    .filter((r) => r.business_id === business_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}
