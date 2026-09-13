/**
 * SALAM LIT — Agent Runtime Service
 *
 * Orchestrates agent invocations with context, permissions, and error handling.
 *
 * Phase 7: AI Workforce Runtime + Zue
 *
 * RULES:
 * - Every invocation resolves context and validates permissions
 * - Agent output is validated before acceptance
 * - Failures are handled gracefully
 * - Idempotency is maintained
 * - No fabricated results
 */

import type { AgentKey } from "../agents/definitions";
import { getAgentDefinition } from "../agents/definitions";
import { agentStateStore } from "../state/agent-state";
import { officeEventStore } from "../events/office-events";
import { retrieveAgentContext } from "./context-retrieval";
import { validateAgentAccess, getAgentPermissions } from "./permissions";
import { AGENT_OUTPUT_SCHEMA, constructPrompt } from "./prompts";
import { requestModelCompletion, isAIAvailable } from "./model-gateway";
import { validateAgentModelOutput } from "../security/model-output-validator";
import type {
  AgentInvocation,
  AgentOutput,
  AgentFinding,
  AgentContext,
  RuntimeEvent,
} from "./types";

/**
 * In-memory invocation store.
 */
const invocations: Map<string, AgentInvocation> = new Map();

/**
 * In-memory findings store.
 */
const findings: Map<string, AgentFinding> = new Map();

/**
 * Idempotency key store — prevents duplicate invocations.
 */
const idempotencyKeys: Map<string, string> = new Map();

/**
 * Default timeout for agent invocations (60 seconds).
 */
const DEFAULT_TIMEOUT_MS = 60000;

/**
 * Generate an idempotency key for an invocation.
 */
function generateIdempotencyKey(
  agent_key: AgentKey,
  business_id: string,
  task: string
): string {
  return `${agent_key}:${business_id}:${task.slice(0, 100)}`;
}

/**
 * Invoke an agent with full context, permissions, and error handling.
 */
export async function invokeAgent(params: {
  agent_key: AgentKey;
  business_id: string;
  user_id: string;
  workspace_id: string;
  task: string;
  investigation_id?: string;
  previous_findings?: AgentFinding[];
  timeout_ms?: number;
  idempotency_key?: string;
}): Promise<{
  success: boolean;
  invocation: AgentInvocation;
  error: string | null;
}> {
  const {
    agent_key,
    business_id,
    user_id,
    workspace_id,
    task,
    investigation_id = null,
    previous_findings = [],
    timeout_ms = DEFAULT_TIMEOUT_MS,
    idempotency_key,
  } = params;

  // Check idempotency
  const idemKey = idempotency_key ?? generateIdempotencyKey(agent_key, business_id, task);
  if (idempotencyKeys.has(idemKey)) {
    const existingInvocationId = idempotencyKeys.get(idemKey)!;
    const existingInvocation = invocations.get(existingInvocationId);
    if (existingInvocation) {
      return {
        success: existingInvocation.status === "COMPLETED",
        invocation: existingInvocation,
        error: existingInvocation.error,
      };
    }
  }

  // Create invocation record
  const invocation: AgentInvocation = {
    id: crypto.randomUUID(),
    agent_key,
    investigation_id: investigation_id ?? "",
    business_id,
    status: "PENDING",
    input_prompt: task,
    context: {
      business_id,
      user_id,
      workspace_id,
      business_context: {},
      facts: [],
      evidence: [],
      metrics: [],
      previous_findings,
    },
    output: null,
    error: null,
    started_at: null,
    completed_at: null,
    duration_ms: null,
    model_used: null,
    tokens_used: null,
    created_at: new Date().toISOString(),
  };

  invocations.set(invocation.id, invocation);
  idempotencyKeys.set(idemKey, invocation.id);

  // Emit started event
  emitRuntimeEvent({
    type: "INVOCATION_STARTED",
    agent_key,
    business_id,
    investigation_id,
    invocation_id: invocation.id,
    data: { task: task.slice(0, 200) },
  });

  // Update agent state
  agentStateStore.markWorking(agent_key, `Investigating: ${task.slice(0, 50)}`);

  // Emit speech bubble
  officeEventStore.emit({
    type: "AGENT_STARTED_WORK",
    agent_key,
    summary: `Working on: ${task.slice(0, 80)}...`,
    speech_text: `Working on: ${task.slice(0, 80)}...`,
  });

  try {
    // Check AI availability
    if (!(await isAIAvailable())) {
      throw new Error("AI provider not configured");
    }

    // Validate permissions
    const accessCheck = validateAgentAccess({
      agent_key,
      user_id,
      workspace_id,
      business_id,
      target_business_id: business_id,
      required_action: "INVESTIGATE",
    });

    if (!accessCheck.allowed) {
      throw new Error(`Permission denied: ${accessCheck.reason}`);
    }

    // Retrieve scoped context
    const context = await retrieveAgentContext({
      agent_key,
      business_id,
      user_id,
      workspace_id,
      previous_findings,
    });

    invocation.context = context;
    invocation.status = "RUNNING";
    invocation.started_at = new Date().toISOString();

    // Update state
    agentStateStore.markThinking(agent_key, "Analyzing context");

    // Construct prompt
    const prompt = constructPrompt({ agent_key, task, context });

    // Emit thinking event
    officeEventStore.emit({
      type: "AGENT_THINKING",
      agent_key,
      summary: "Analyzing business data...",
      speech_text: "Analyzing business data...",
    });

    // Request model completion
    const modelResult = await requestModelCompletion({
      agent_key,
      business_id,
      user_id,
      workspace_id,
      investigation_id,
      invocation_id: invocation.id,
      system_prompt: prompt.system,
      user_prompt: prompt.user,
      timeout_ms,
      task_type: "SPECIALIST_ANALYSIS",
      risk_level: "L1",
      required_capabilities: ["analysis"],
      structured_output_required: true,
      output_schema: AGENT_OUTPUT_SCHEMA,
    });

    if (!modelResult.success) {
      throw new Error(modelResult.error ?? "Model request failed");
    }

    // Validate output using centralized trust boundary
    const validation = validateAgentModelOutput(modelResult.response!);
    if (!validation.valid) {
      throw new Error(`Invalid model output: ${validation.error}`);
    }

    // Parse validated output
    const validated = validation.data;
    // Validated findings are partial — full AgentFinding objects created below
    const agentOutput: AgentOutput = {
      findings: validated.findings.map((f) => ({
        ...f,
        id: "",
        agent_key: agent_key,
        investigation_id: "",
        business_id: business_id,
        freshness_status: "CURRENT" as const,
        created_at: "",
      })) as AgentFinding[],
      raw_response: modelResult.response!,
      structured_data: { findings: validated.findings },
      reasoning: validated.reasoning,
      next_steps: validated.next_steps,
      handoffs: validated.handoffs.map((h) => ({ agent_key: h.agent_key as AgentKey, reason: h.reason })),
    };

    // Process and store findings from validated output
    const processedFindings: AgentFinding[] = [];
    for (const rawFinding of agentOutput.findings) {
      const finding: AgentFinding = {
        id: crypto.randomUUID(),
        agent_key,
        investigation_id: invocation.id,
        business_id,
        epistemic_type: (rawFinding.epistemic_type as AgentFinding["epistemic_type"]) ?? "INFERENCE",
        category: (rawFinding.category as AgentFinding["category"]) ?? "GENERAL",
        severity: (rawFinding.severity as AgentFinding["severity"]) ?? "INFO",
        title: rawFinding.title ?? "Untitled Finding",
        summary: rawFinding.summary ?? "",
        detail: rawFinding.detail ?? rawFinding.summary ?? "",
        confidence: Math.min(1, Math.max(0, rawFinding.confidence ?? 0.5)),
        evidence_strength: (rawFinding.evidence_strength as AgentFinding["evidence_strength"]) ?? "MODERATE",
        freshness_status: "CURRENT",
        source_facts: rawFinding.source_facts ?? [],
        source_evidence: rawFinding.source_evidence ?? [],
        source_metrics: rawFinding.source_metrics ?? [],
        assumptions: rawFinding.assumptions ?? [],
        uncertainty: rawFinding.uncertainty ?? [],
        created_at: new Date().toISOString(),
      };

      findings.set(finding.id, finding);
      processedFindings.push(finding);

      // Emit finding event
      emitRuntimeEvent({
        type: "FINDING_CREATED",
        agent_key,
        business_id,
        investigation_id,
        invocation_id: invocation.id,
        data: { finding_id: finding.id, title: finding.title, epistemic_type: finding.epistemic_type },
      });
    }

    agentOutput.findings = processedFindings;

    // Update invocation
    invocation.output = agentOutput;
    invocation.status = "COMPLETED";
    invocation.completed_at = new Date().toISOString();
    invocation.duration_ms = Date.now() - new Date(invocation.started_at).getTime();
    invocation.model_used = modelResult.model_used;
    invocation.tokens_used = modelResult.tokens_used;

    // Update state
    agentStateStore.markCompleted(agent_key, `Completed: ${task.slice(0, 50)}`);

    // Emit completion event
    officeEventStore.emit({
      type: "AGENT_COMPLETED_WORK",
      agent_key,
      summary: `Found ${processedFindings.length} insight(s)`,
      speech_text: `Found ${processedFindings.length} insight(s)`,
    });

    emitRuntimeEvent({
      type: "INVOCATION_COMPLETED",
      agent_key,
      business_id,
      investigation_id,
      invocation_id: invocation.id,
      data: {
        findings_count: processedFindings.length,
        duration_ms: invocation.duration_ms,
        model_used: modelResult.model_used,
      },
    });

    return {
      success: true,
      invocation,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    invocation.status = "FAILED";
    invocation.error = errorMessage;
    invocation.completed_at = new Date().toISOString();
    invocation.duration_ms = Date.now() - new Date(invocation.started_at ?? invocation.created_at).getTime();

    // Update state
    agentStateStore.markError(agent_key, errorMessage);

    // Emit error event
    officeEventStore.emit({
      type: "AGENT_ERROR",
      agent_key,
      summary: "Encountered an issue while investigating",
      speech_text: "Encountered an issue while investigating",
    });

    emitRuntimeEvent({
      type: "INVOCATION_FAILED",
      agent_key,
      business_id,
      investigation_id,
      invocation_id: invocation.id,
      data: { error: errorMessage },
    });

    return {
      success: false,
      invocation,
      error: errorMessage,
    };
  }
}

/**
 * Get an invocation by ID.
 */
export function getInvocation(id: string): AgentInvocation | null {
  return invocations.get(id) ?? null;
}

/**
 * Get all invocations for a business.
 */
export function getInvocationsByBusiness(
  business_id: string,
  limit: number = 50
): AgentInvocation[] {
  return Array.from(invocations.values())
    .filter((i) => i.business_id === business_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/**
 * Get all invocations for an investigation.
 */
export function getInvocationsByInvestigation(
  investigation_id: string
): AgentInvocation[] {
  return Array.from(invocations.values())
    .filter((i) => i.investigation_id === investigation_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Get a finding by ID.
 */
export function getFinding(id: string): AgentFinding | null {
  return findings.get(id) ?? null;
}

/**
 * Get all findings for a business.
 */
export function getFindingsByBusiness(
  business_id: string,
  limit: number = 100
): AgentFinding[] {
  return Array.from(findings.values())
    .filter((f) => f.business_id === business_id)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

/**
 * Get all findings for an investigation.
 */
export function getFindingsByInvestigation(
  investigation_id: string
): AgentFinding[] {
  return Array.from(findings.values())
    .filter((f) => f.investigation_id === investigation_id)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Emit a runtime event.
 */
function emitRuntimeEvent(event: Omit<RuntimeEvent, "id" | "timestamp">): void {
  // Store in office events for ActivityFeed
  officeEventStore.emit({
    type: event.type as any,
    agent_key: event.agent_key ?? "zue",
    summary: String(event.data?.task ?? event.type),
  });
}
