/**
 * SALAM LIT — Zue Orchestration Engine
 *
 * Zue is the Chief AI Officer and orchestrator.
 * She analyzes user requests, routes to specialists, collects findings,
 * generates insights, and produces recommendations.
 *
 * Phase 9: Investigation & Intelligence Engine
 *
 * FLOW:
 * USER REQUEST → CONTEXT RESOLUTION → ZUE → INVESTIGATION
 * → SPECIALIST ROUTING → EVIDENCE RETRIEVAL → AGENT FINDINGS
 * → INSIGHT GENERATION → RECOMMENDATION GENERATION
 * → SYNTHESIS → USER
 *
 * STOP BEFORE: DECISION → APPROVAL → EXECUTION
 */

import type { AgentKey } from "../agents/definitions";
import { getAgentDefinition, getSpecialistAgents } from "../agents/definitions";
import { agentStateStore } from "../state/agent-state";
import { officeEventStore } from "../events/office-events";
import { invokeAgent, getFindingsByInvestigation } from "../runtime/agent-runtime";
import { retrieveAgentContext } from "../runtime/context-retrieval";
import { constructPrompt, validateAgentOutput } from "../runtime/prompts";
import { requestModelCompletion, isAIAvailable } from "../runtime/model-gateway";
import { generateInsights, getInsightsByInvestigation } from "../intelligence/insight-engine";
import { generateRecommendations, getRecommendationsByInvestigation } from "../intelligence/recommendation-engine";
import type {
  Investigation,
  InvestigationPlan,
  InvestigationResult,
  OrchestrationDecision,
  OrchestrationResult,
  AgentFinding,
  Insight,
  Recommendation,
  InvestigationPriority,
} from "../runtime/types";
import { AGENT_OUTPUT_SCHEMA } from "../runtime/prompts";

/**
 * In-memory investigation store.
 */
const investigations: Map<string, Investigation> = new Map();

/**
 * Keyword-to-specialist routing map with weights.
 * Higher weight = more relevant to the topic.
 */
const SPECIALIST_ROUTING: Record<string, Array<{ agent: AgentKey; weight: number }>> = {
  // Financial topics
  revenue: [{ agent: "carol", weight: 3 }, { agent: "erni", weight: 2 }],
  profit: [{ agent: "carol", weight: 3 }],
  cash: [{ agent: "carol", weight: 3 }],
  cashflow: [{ agent: "carol", weight: 3 }, { agent: "eddy", weight: 1 }],
  margin: [{ agent: "carol", weight: 3 }],
  expense: [{ agent: "carol", weight: 3 }],
  financial: [{ agent: "carol", weight: 3 }, { agent: "erni", weight: 2 }],
  budget: [{ agent: "carol", weight: 3 }],
  accounting: [{ agent: "carol", weight: 3 }],
  tax: [{ agent: "carol", weight: 3 }],

  // Sales topics
  sales: [{ agent: "eddy", weight: 3 }],
  customer: [{ agent: "eddy", weight: 2 }, { agent: "sheera", weight: 2 }],
  pipeline: [{ agent: "eddy", weight: 3 }],
  conversion: [{ agent: "eddy", weight: 3 }],
  deal: [{ agent: "eddy", weight: 3 }],
  lead: [{ agent: "eddy", weight: 3 }],
  churn: [{ agent: "eddy", weight: 3 }],
  retention: [{ agent: "eddy", weight: 2 }, { agent: "sheera", weight: 1 }],

  // Marketing topics
  marketing: [{ agent: "sheera", weight: 3 }],
  brand: [{ agent: "sheera", weight: 3 }],
  campaign: [{ agent: "sheera", weight: 3 }],
  content: [{ agent: "sheera", weight: 3 }],
  social: [{ agent: "sheera", weight: 3 }],
  advertising: [{ agent: "sheera", weight: 3 }],
  engagement: [{ agent: "sheera", weight: 3 }],

  // HR topics
  employee: [{ agent: "ayuni", weight: 3 }],
  team: [{ agent: "ayuni", weight: 2 }],
  hiring: [{ agent: "ayuni", weight: 3 }],
  workforce: [{ agent: "ayuni", weight: 3 }],
  culture: [{ agent: "ayuni", weight: 3 }],
  payroll: [{ agent: "ayuni", weight: 3 }],

  // Funding topics
  funding: [{ agent: "alex", weight: 3 }],
  investment: [{ agent: "alex", weight: 3 }],
  loan: [{ agent: "alex", weight: 3 }],
  grant: [{ agent: "alex", weight: 3 }],
  investor: [{ agent: "alex", weight: 3 }],
  capital: [{ agent: "alex", weight: 3 }],

  // Operations topics
  operations: [{ agent: "tehna", weight: 3 }],
  process: [{ agent: "tehna", weight: 3 }],
  supply: [{ agent: "tehna", weight: 3 }],
  inventory: [{ agent: "tehna", weight: 3 }],
  logistics: [{ agent: "tehna", weight: 3 }],

  // Strategy topics
  strategy: [{ agent: "erni", weight: 3 }],
  growth: [{ agent: "erni", weight: 2 }, { agent: "eddy", weight: 2 }],
  market: [{ agent: "erni", weight: 2 }, { agent: "sheera", weight: 2 }],
  competitor: [{ agent: "erni", weight: 3 }],
  analysis: [{ agent: "erni", weight: 3 }],
  trend: [{ agent: "erni", weight: 3 }],
};

/**
 * Create a new investigation.
 */
export function createInvestigation(params: {
  business_id: string;
  initiated_by: AgentKey;
  trigger_type: "USER_REQUEST" | "PROACTIVE" | "EVENT" | "ORCHESTRATION";
  trigger_source: string;
  title: string;
  description: string;
  objective?: string;
}): Investigation {
  const investigation: Investigation = {
    id: crypto.randomUUID(),
    business_id: params.business_id,
    initiated_by: params.initiated_by,
    trigger_type: params.trigger_type,
    trigger_source: params.trigger_source,
    title: params.title,
    description: params.description,
    objective: params.objective ?? params.description,
    status: "CREATED",
    plan: null,
    assigned_agents: [],
    findings: [],
    insights: [],
    recommendations: [],
    data_gaps: [],
    specialist_failures: [],
    started_at: null,
    completed_at: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  investigations.set(investigation.id, investigation);
  return investigation;
}

/**
 * Analyze a user request and determine routing.
 * Enhanced with weighted scoring and evidence-based routing.
 */
export async function analyzeAndRoute(params: {
  investigation: Investigation;
  user_request: string;
  business_id: string;
  user_id: string;
  workspace_id: string;
  specialist_scope?: AgentKey[];
}): Promise<OrchestrationResult> {
  const { investigation, user_request, business_id, user_id, workspace_id, specialist_scope } = params;

  // Update investigation status
  investigation.status = "PLANNING";
  investigation.updated_at = new Date().toISOString();

  // Emit Zue thinking event
  officeEventStore.emit({
    type: "AGENT_THINKING",
    agent_key: "zue",
    summary: "Analyzing request and planning investigation...",
    speech_text: "Analyzing request and planning investigation...",
  });

  // Route based on weighted keywords
  const decision = routeByKeywords(user_request);
  if (specialist_scope && specialist_scope.length > 0) {
    decision.agent_keys = [...specialist_scope];
    decision.reason = `Explicit first-proof specialist scope: ${specialist_scope.join(", ")}`;
  }

  // Create investigation plan
  const plan: InvestigationPlan = {
    specialist_keys: decision.agent_keys,
    scope: decision.scope,
    required_context_types: determineContextTypes(decision.agent_keys),
    priority: decision.priority,
    estimated_duration_ms: decision.agent_keys.length * 10000,
  };

  investigation.plan = plan;
  investigation.assigned_agents = decision.agent_keys;
  investigation.status = "IN_PROGRESS";
  investigation.started_at = new Date().toISOString();
  investigation.updated_at = new Date().toISOString();

  // Emit routing event
  officeEventStore.emit({
    type: "AGENT_HANDOFF",
    agent_key: "zue",
    summary: `Routing to: ${decision.agent_keys.map((k) => getAgentDefinition(k).default_display_name).join(", ")}`,
    speech_text: `Routing to: ${decision.agent_keys.map((k) => getAgentDefinition(k).default_display_name).join(", ")}`,
  });

  return {
    investigation_id: investigation.id,
    decision,
    routed_agents: decision.agent_keys,
    synthesis: null,
    status: "DISPATCHING",
  };
}

/**
 * Route a user request to specialists using weighted keyword scoring.
 */
function routeByKeywords(user_request: string): OrchestrationDecision {
  const lowerRequest = user_request.toLowerCase();
  const agentScores = new Map<AgentKey, number>();

  // Score each specialist by weighted keyword matches
  for (const [keyword, agents] of Object.entries(SPECIALIST_ROUTING)) {
    if (lowerRequest.includes(keyword)) {
      for (const { agent, weight } of agents) {
        const currentScore = agentScores.get(agent) ?? 0;
        agentScores.set(agent, currentScore + weight);
      }
    }
  }

  // If no matches, default to Erni for general analysis
  if (agentScores.size === 0) {
    return {
      action: "INVESTIGATE",
      agent_keys: ["erni"],
      reason: "No specific specialist matched — routing to BI/Strategy for general analysis",
      priority: "MEDIUM",
      scope: "General business analysis",
    };
  }

  // Sort by score and take top specialists (max 4 for cross-functional issues)
  const sortedAgents = Array.from(agentScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([agent]) => agent);

  // Determine priority based on keywords
  let priority: InvestigationPriority = "MEDIUM";
  if (lowerRequest.includes("urgent") || lowerRequest.includes("asap") || lowerRequest.includes("critical") || lowerRequest.includes("jatuh")) {
    priority = "URGENT";
  } else if (lowerRequest.includes("important") || lowerRequest.includes("soon") || lowerRequest.includes("drop")) {
    priority = "HIGH";
  }

  return {
    action: "INVESTIGATE",
    agent_keys: sortedAgents,
    reason: `Matched specialists based on weighted keywords: ${sortedAgents.map((k) => getAgentDefinition(k).default_display_name).join(", ")}`,
    priority,
    scope: `Investigation of: ${user_request.slice(0, 100)}`,
  };
}

/**
 * Determine what context types are needed for given specialists.
 */
function determineContextTypes(agent_keys: AgentKey[]): string[] {
  const contextTypes = new Set<string>();

  for (const key of agent_keys) {
    switch (key) {
      case "carol":
        contextTypes.add("financial");
        contextTypes.add("facts");
        contextTypes.add("metrics");
        break;
      case "eddy":
        contextTypes.add("sales");
        contextTypes.add("facts");
        contextTypes.add("metrics");
        break;
      case "sheera":
        contextTypes.add("marketing");
        contextTypes.add("facts");
        break;
      case "ayuni":
        contextTypes.add("hr");
        contextTypes.add("facts");
        break;
      case "alex":
        contextTypes.add("financial");
        contextTypes.add("funding");
        break;
      case "tehna":
        contextTypes.add("operations");
        contextTypes.add("facts");
        break;
      default:
        contextTypes.add("general");
    }
  }

  return Array.from(contextTypes);
}

/**
 * Execute a full investigation lifecycle.
 * Dispatches to specialists, generates insights, generates recommendations.
 */
export async function executeInvestigation(
  investigation_id: string,
  user_id: string,
  workspace_id: string
): Promise<OrchestrationResult> {
  const investigation = investigations.get(investigation_id);
  if (!investigation) {
    return {
      investigation_id,
      decision: { action: "DECLINE", agent_keys: [], reason: "Investigation not found", priority: "LOW", scope: "" },
      routed_agents: [],
      synthesis: null,
      status: "ERROR",
    };
  }

  if (!investigation.plan) {
    return {
      investigation_id,
      decision: { action: "DECLINE", agent_keys: [], reason: "No investigation plan", priority: "LOW", scope: "" },
      routed_agents: [],
      synthesis: null,
      status: "ERROR",
    };
  }

  // Phase 1: Dispatch to specialists and collect findings
  const allFindings: AgentFinding[] = [];
  const specialistFailures: Array<{ agent_key: AgentKey; error: string }> = [];

  for (const agentKey of investigation.plan.specialist_keys) {
    const invocationResult = await invokeAgent({
      agent_key: agentKey,
      business_id: investigation.business_id,
      user_id,
      workspace_id,
      task: investigation.description,
      investigation_id: investigation.id,
      previous_findings: allFindings,
    });

    if (invocationResult.success && invocationResult.invocation.output) {
      allFindings.push(...invocationResult.invocation.output.findings);
    } else {
      specialistFailures.push({
        agent_key: agentKey,
        error: invocationResult.error ?? "Unknown error",
      });
    }
  }

  investigation.findings = allFindings;
  investigation.specialist_failures = specialistFailures;

  // Phase 2: Identify data gaps
  investigation.data_gaps = identifyDataGaps(allFindings, investigation.plan.specialist_keys);

  // Phase 3: Generate insights from findings
  let generatedInsights: Insight[] = [];
  if (allFindings.length > 0) {
    try {
      generatedInsights = await generateInsights({
        investigation_id: investigation.id,
        business_id: investigation.business_id,
        user_id,
        workspace_id,
        findings: allFindings,
        business_context: {},
      });
    } catch {
      // Insight generation failed — continue with findings only
    }
  }
  investigation.insights = generatedInsights;

  // Phase 4: Generate recommendations from insights
  let generatedRecommendations: Recommendation[] = [];
  if (generatedInsights.length > 0) {
    try {
      generatedRecommendations = await generateRecommendations({
        investigation_id: investigation.id,
        business_id: investigation.business_id,
        user_id,
        workspace_id,
        insights: generatedInsights,
        findings: allFindings,
        business_context: {},
      });
    } catch {
      // Recommendation generation failed — continue without recommendations
    }
  }
  investigation.recommendations = generatedRecommendations;

  // Phase 5: Synthesize findings into a coherent summary
  const synthesis = await synthesizeFindings(investigation, allFindings, generatedInsights, generatedRecommendations, user_id, workspace_id);

  // Update investigation status
  investigation.status = "COMPLETED";
  investigation.completed_at = new Date().toISOString();
  investigation.updated_at = new Date().toISOString();

  return {
    investigation_id: investigation.id,
    decision: {
      action: "SYNTHESIZE",
      agent_keys: investigation.plan.specialist_keys,
      reason: "Investigation complete — findings, insights, and recommendations generated",
      priority: investigation.plan.priority,
      scope: investigation.plan.scope,
    },
    routed_agents: investigation.plan.specialist_keys,
    synthesis,
    status: "COMPLETED",
  };
}

/**
 * Identify data gaps based on missing evidence from specialists.
 */
function identifyDataGaps(
  findings: AgentFinding[],
  assignedAgents: AgentKey[]
): string[] {
  const gaps: string[] = [];

  // Check for agents that produced no findings
  const agentsWithFindings = new Set(findings.map((f) => f.agent_key));
  for (const agent of assignedAgents) {
    if (!agentsWithFindings.has(agent)) {
      gaps.push(`${getAgentDefinition(agent).default_display_name} did not produce any findings`);
    }
  }

  // Check for findings with weak/no evidence
  const weakFindings = findings.filter(
    (f) => f.evidence_strength === "NONE" || f.evidence_strength === "WEAK"
  );
  if (weakFindings.length > 0) {
    gaps.push(`${weakFindings.length} finding(s) have weak or no supporting evidence`);
  }

  // Check for high-uncertainty findings
  const uncertainFindings = findings.filter((f) => f.uncertainty.length > 2);
  if (uncertainFindings.length > 0) {
    gaps.push(`${uncertainFindings.length} finding(s) have high uncertainty`);
  }

  return gaps;
}

/**
 * Synthesize findings, insights, and recommendations into a coherent summary.
 */
async function synthesizeFindings(
  investigation: Investigation,
  findings: AgentFinding[],
  insights: Insight[],
  recommendations: Recommendation[],
  userId: string,
  workspaceId: string,
): Promise<string> {
  if (findings.length === 0) {
    return "No findings from the investigation. The specialists did not find sufficient data to provide insights.";
  }

  // If AI is available, use it for rich synthesis
  if (await isAIAvailable()) {
    try {
      return await synthesizeWithAI(investigation, findings, insights, recommendations, userId, workspaceId);
    } catch {
      // Fall through to structured synthesis
    }
  }

  // Structured synthesis without AI
  return synthesizeStructured(findings, insights, recommendations, investigation.specialist_failures);
}

/**
 * Synthesize using AI model.
 */
async function synthesizeWithAI(
  investigation: Investigation,
  findings: AgentFinding[],
  insights: Insight[],
  recommendations: Recommendation[],
  userId: string,
  workspaceId: string,
): Promise<string> {
  const context = await retrieveAgentContext({
    agent_key: "zue",
    business_id: investigation.business_id,
    user_id: userId,
    workspace_id: workspaceId,
    previous_findings: findings,
  });

  const findingSummaries = findings.map((f) => {
    const agent = getAgentDefinition(f.agent_key);
    return `[${agent.default_display_name}] ${f.title} (${f.epistemic_type}, confidence: ${f.confidence}): ${f.summary}`;
  });

  const insightSummaries = insights.map((i) =>
    `[Insight] ${i.title}: ${i.description}`
  );

  const recommendationSummaries = recommendations.map((r) =>
    `[Recommendation] ${r.title}: ${r.description}`
  );

  const prompt = constructPrompt({
    agent_key: "zue",
    task: `Synthesize the investigation results into a clear, concise business summary for the owner.

INVESTIGATION: ${investigation.title}
OBJECTIVE: ${investigation.objective}

FINDINGS (${findings.length}):
${findingSummaries.join("\n\n")}

INSIGHTS (${insights.length}):
${insightSummaries.join("\n") || "None generated"}

RECOMMENDATIONS (${recommendations.length}):
${recommendationSummaries.join("\n") || "None generated"}

${investigation.data_gaps.length > 0 ? `DATA GAPS:\n${investigation.data_gaps.join("\n")}` : ""}
${investigation.specialist_failures.length > 0 ? `SPECIALIST FAILURES:\n${investigation.specialist_failures.map((f) => `${f.agent_key}: ${f.error}`).join("\n")}` : ""}

Provide a concise synthesis that:
1. Summarizes what was found (key findings)
2. Explains what it means (key insights)
3. Recommends what to do (key recommendations)
4. Notes any data gaps or limitations
5. Uses clear, non-technical language for the business owner`,
    context,
  });

  const result = await requestModelCompletion({
    agent_key: "zue",
    business_id: investigation.business_id,
    user_id: userId,
    workspace_id: workspaceId,
    investigation_id: investigation.id,
    invocation_id: crypto.randomUUID(),
    system_prompt: prompt.system,
    user_prompt: prompt.user,
    task_type: "SYNTHESIS",
    risk_level: "L1",
    required_capabilities: ["analysis", "generation"],
    structured_output_required: false,
    output_schema: AGENT_OUTPUT_SCHEMA,
  });

  if (result.success && result.response) {
    return result.response;
  }

  return synthesizeStructured(findings, insights, recommendations, investigation.specialist_failures);
}

/**
 * Generate a structured synthesis without AI.
 */
function synthesizeStructured(
  findings: AgentFinding[],
  insights: Insight[],
  recommendations: Recommendation[],
  specialistFailures: Array<{ agent_key: AgentKey; error: string }>
): string {
  const parts: string[] = [];

  // Summary line
  parts.push(`Investigation complete. ${findings.length} finding(s), ${insights.length} insight(s), ${recommendations.length} recommendation(s).`);

  // Group findings by agent
  const byAgent = new Map<AgentKey, AgentFinding[]>();
  for (const f of findings) {
    if (!byAgent.has(f.agent_key)) byAgent.set(f.agent_key, []);
    byAgent.get(f.agent_key)!.push(f);
  }

  for (const [agentKey, agentFindings] of byAgent) {
    const agent = getAgentDefinition(agentKey);
    parts.push(`\n${agent.default_display_name}:`);
    for (const f of agentFindings) {
      const typeLabel = f.epistemic_type === "FACT" ? "[Fact]" : f.epistemic_type === "INFERENCE" ? "[Inference]" : "[Hypothesis]";
      parts.push(`  ${typeLabel} ${f.title}: ${f.summary}`);
    }
  }

  // Insights
  if (insights.length > 0) {
    parts.push(`\nKey Insights:`);
    for (const i of insights) {
      parts.push(`  • ${i.title}: ${i.description}`);
    }
  }

  // Recommendations
  if (recommendations.length > 0) {
    parts.push(`\nRecommendations:`);
    for (const r of recommendations) {
      const approvalNote = r.requires_approval ? " (requires approval)" : "";
      parts.push(`  → ${r.title}${approvalNote}: ${r.description}`);
    }
  }

  // Data gaps
  if (specialistFailures.length > 0) {
    parts.push(`\nNote: ${specialistFailures.length} specialist(s) failed to complete.`);
  }

  return parts.join("\n");
}

/**
 * Get an investigation by ID.
 */
export function getInvestigation(id: string): Investigation | null {
  return investigations.get(id) ?? null;
}

/**
 * Get all investigations for a business.
 */
export function getInvestigationsByBusiness(
  business_id: string,
  limit: number = 50
): Investigation[] {
  return Array.from(investigations.values())
    .filter((i) => i.business_id === business_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/**
 * Get full investigation result with all details.
 */
export function getInvestigationResult(investigation_id: string): InvestigationResult | null {
  const investigation = investigations.get(investigation_id);
  if (!investigation) return null;

  return {
    investigation,
    findings: investigation.findings,
    insights: investigation.insights,
    recommendations: investigation.recommendations,
    synthesis: "", // Synthesis is generated during execution
    data_gaps: investigation.data_gaps,
    specialist_failures: investigation.specialist_failures,
  };
}
