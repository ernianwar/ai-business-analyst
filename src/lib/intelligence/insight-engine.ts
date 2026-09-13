/**
 * SALAM LIT — Insight Generation Engine
 *
 * Generates structured insights from validated findings.
 * An insight explains what is happening and why it matters.
 *
 * Phase 9: Investigation & Intelligence Engine
 *
 * RULES:
 * - Insights are derived from findings, not invented
 * - Confidence reflects evidence quality, not wishful thinking
 * - Conflicting findings remain conflicted
 * - Missing data stays UNKNOWN
 * - Never expose chain-of-thought
 */

import type { AgentKey } from "../agents/definitions";
import { getAgentDefinition } from "../agents/definitions";
import { retrieveAgentContext } from "../runtime/context-retrieval";
import { constructPrompt } from "../runtime/prompts";
import { requestModelCompletion, isAIAvailable } from "../runtime/model-gateway";
import type { AgentFinding, Insight, InsightInput } from "../runtime/types";
import { AGENT_OUTPUT_SCHEMA } from "../runtime/prompts";
import { validateInsightModelOutput } from "../security/model-output-validator";

/**
 * In-memory insight store.
 */
const insights: Map<string, Insight> = new Map();

/**
 * Generate insights from validated findings.
 * Uses AI when available, falls back to deterministic generation.
 */
export async function generateInsights(input: InsightInput): Promise<Insight[]> {
  const { investigation_id, business_id, user_id, workspace_id, findings, business_context } = input;

  if (findings.length === 0) return [];

  // Try AI-powered insight generation
  if (await isAIAvailable()) {
    try {
      return await generateInsightsWithAI(input);
    } catch {
      // Fall through to deterministic generation
    }
  }

  // Deterministic insight generation
  return generateInsightsDeterministic(input);
}

/**
 * Generate insights using AI model.
 */
async function generateInsightsWithAI(input: InsightInput): Promise<Insight[]> {
  const { investigation_id, business_id, user_id, workspace_id, findings, business_context } = input;

  const context = await retrieveAgentContext({
    agent_key: "erni",
    business_id,
    user_id,
    workspace_id,
  });

  const findingSummaries = findings.map((f) => {
    const agent = getAgentDefinition(f.agent_key);
    return `[${agent.default_display_name}] ${f.title} (${f.epistemic_type}, confidence: ${f.confidence}): ${f.summary}`;
  });

  const prompt = constructPrompt({
    agent_key: "erni",
    task: `Analyze the following findings and generate structured business insights.

FINDINGS:
${findingSummaries.join("\n\n")}

Generate insights that:
1. Identify what is happening (the pattern or trend)
2. Explain why it matters (business impact)
3. List contributing factors
4. Assess overall confidence based on evidence quality
5. Reference the specific findings that support each insight

Return a JSON object:
{
  "insights": [
    {
      "title": "Short insight title",
      "description": "What is happening and why it matters",
      "contributing_factors": ["factor 1", "factor 2"],
      "confidence": 0.0-1.0,
      "evidence_basis": ["finding title 1", "finding title 2"],
      "source_finding_indices": [0, 1]
    }
  ]
}

RULES:
- Base insights ONLY on the provided findings
- Do not invent business data
- If findings conflict, note the conflict
- Confidence must reflect evidence strength
- Do not fabricate contributing factors`,
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
    task_type: "INSIGHT_GENERATION",
    risk_level: "L1",
    required_capabilities: ["analysis"],
    structured_output_required: true,
    output_schema: {
      ...AGENT_OUTPUT_SCHEMA,
      properties: { insights: { type: "array" } },
      required: ["insights"],
    },
  });

  if (!result.success || !result.response) {
    throw new Error(result.error ?? "AI insight generation failed");
  }

  // Validate using centralized trust boundary
  const validation = validateInsightModelOutput(result.response, findings.length);
  if (!validation.valid) {
    throw new Error(`Invalid insight output: ${validation.error}`);
  }

  const generatedInsights: Insight[] = [];

  for (const raw of validation.data.insights) {
    const sourceFindingIds = raw.source_finding_indices
      .map((i) => findings[i].id);

    const insight: Insight = {
      id: crypto.randomUUID(),
      investigation_id,
      business_id,
      title: raw.title,
      description: raw.description,
      contributing_factors: raw.contributing_factors,
      confidence: raw.confidence,
      evidence_basis: raw.evidence_basis,
      source_findings: sourceFindingIds,
      created_at: new Date().toISOString(),
    };

    insights.set(insight.id, insight);
    generatedInsights.push(insight);
  }

  return generatedInsights;
}

/**
 * Generate insights deterministically from findings.
 * Groups findings by category and generates basic insights.
 */
function generateInsightsDeterministic(input: InsightInput): Insight[] {
  const { investigation_id, business_id, findings } = input;
  const generatedInsights: Insight[] = [];

  // Group findings by category
  const byCategory = new Map<string, AgentFinding[]>();
  for (const f of findings) {
    const cat = f.category ?? "GENERAL";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(f);
  }

  // Generate one insight per category with multiple findings
  for (const [category, catFindings] of byCategory) {
    if (catFindings.length === 0) continue;

    const factFindings = catFindings.filter((f) => f.epistemic_type === "FACT");
    const inferenceFindings = catFindings.filter((f) => f.epistemic_type === "INFERENCE");

    // Calculate aggregate confidence
    const avgConfidence = catFindings.reduce((sum, f) => sum + f.confidence, 0) / catFindings.length;

    // Determine evidence strength
    const hasStrongEvidence = catFindings.some((f) => f.evidence_strength === "STRONG");
    const evidenceStrength = hasStrongEvidence ? "STRONG" : catFindings.some((f) => f.evidence_strength === "MODERATE") ? "MODERATE" : "WEAK";

    const insight: Insight = {
      id: crypto.randomUUID(),
      investigation_id,
      business_id,
      title: `${category.toLowerCase().replace(/_/g, " ")} analysis`,
      description: `Analysis of ${catFindings.length} finding(s) in ${category}. ${factFindings.length} factual, ${inferenceFindings.length} inferential.`,
      contributing_factors: catFindings.map((f) => f.title),
      confidence: avgConfidence,
      evidence_basis: catFindings.map((f) => f.title),
      source_findings: catFindings.map((f) => f.id),
      created_at: new Date().toISOString(),
    };

    insights.set(insight.id, insight);
    generatedInsights.push(insight);
  }

  return generatedInsights;
}

/**
 * Get an insight by ID.
 */
export function getInsight(id: string): Insight | null {
  return insights.get(id) ?? null;
}

/**
 * Get all insights for an investigation.
 */
export function getInsightsByInvestigation(investigation_id: string): Insight[] {
  return Array.from(insights.values())
    .filter((i) => i.investigation_id === investigation_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Get all insights for a business.
 */
export function getInsightsByBusiness(business_id: string, limit: number = 100): Insight[] {
  return Array.from(insights.values())
    .filter((i) => i.business_id === business_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}
