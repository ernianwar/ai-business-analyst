/**
 * SALAM LIT — Central Model Gateway
 *
 * Single choke point for ALL AI provider invocations.
 * Every request passes through: rate limit → circuit breaker → provider → usage + security.
 *
 * Rate limit ownership: Gateway-level enforcement (single increment per logical request).
 * API routes authenticate and authorize before calling the gateway.
 *
 * Phase 15.4.3.3: Production runtime security wiring.
 * Phase 15.4.3.1: PostgreSQL-backed enforcement modules.
 * Phase 15.4.3: Runtime security policy boundary.
 */

import type { AIProvider, AIGatewayRequest, ModelCapability, ModelTaskType } from "../ai-gateway/types";
import { getAvailableProviders, getProvider } from "../ai-gateway/registry";
import { initializeProviders } from "../ai-gateway/init";
import { AIError } from "../ai-gateway/errors";
import type { AgentKey } from "../agents/definitions";
import { selectModelCandidates } from "./model-routing";
import { MAX_PROVIDER_TRANSITIONS, MAX_TOTAL_ATTEMPTS } from "../security/sanitize";
import { checkAIRateLimit } from "../security/ai-rate-limiter";
import { recordAIUsage } from "../security/ai-usage-tracker";
import { recordAISecurityEvent, generateCorrelationId } from "../security/ai-security-events";
import { getSupabaseClient } from "../db/supabase-client";

const DEFAULT_TIMEOUT_MS = 30000;

// ============================================================
// PERSISTENT CIRCUIT BREAKER (PostgreSQL-backed)
// ============================================================

interface CircuitState {
  failures: number;
  last_failure: string;
  is_open: boolean;
}

const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60_000;

/** SQL return shape for get_circuit_state RPC. */
interface GetCircuitStateRow {
  open: boolean;
  failures: number;
  last_failure: string | null;
  cooldown_remaining_ms: number;
}

/** SQL return shape for record_circuit_failure RPC. */
interface RecordCircuitFailureRow {
  opened: boolean;
  failures: number;
}

/**
 * Get circuit state from PostgreSQL via RPC.
 * Falls back to allowing the request if DB is unavailable (safe default — provider call will fail and record).
 */
async function getCircuitState(provider: string): Promise<CircuitState> {
  const client = getSupabaseClient();
  if (!client) {
    // DB unavailable — allow request (provider will fail naturally if also down)
    return { failures: 0, last_failure: new Date(0).toISOString(), is_open: false };
  }

  try {
    const { data, error } = await client.rpc("get_circuit_state", {
      p_provider: provider,
    });

    if (error || !data) {
      return { failures: 0, last_failure: new Date(0).toISOString(), is_open: false };
    }

    const row = (Array.isArray(data) ? data[0] : data) as GetCircuitStateRow;
    return {
      failures: row.failures ?? 0,
      last_failure: row.last_failure ?? new Date(0).toISOString(),
      is_open: row.open ?? false,
    };
  } catch {
    return { failures: 0, last_failure: new Date(0).toISOString(), is_open: false };
  }
}

/**
 * Record a circuit failure via PostgreSQL RPC.
 * Opens circuit when threshold reached.
 */
async function recordCircuitFailure(
  provider: string,
  correlationId: string,
  userId: string,
  workspaceId: string,
  businessId: string,
): Promise<{ opened: boolean }> {
  const client = getSupabaseClient();
  if (!client) return { opened: false };

  try {
    const { data, error } = await client.rpc("record_circuit_failure", {
      p_provider: provider,
      p_threshold: CIRCUIT_FAILURE_THRESHOLD,
    });

    if (error || !data) return { opened: false };

    const row = (Array.isArray(data) ? data[0] : data) as RecordCircuitFailureRow;
    if (row.opened && row.failures === CIRCUIT_FAILURE_THRESHOLD) {
      await recordAISecurityEvent({
        event_type: "AI_CIRCUIT_OPENED",
        severity: "HIGH",
        user_id: userId,
        workspace_id: workspaceId,
        business_id: businessId,
        agent_key: null,
        provider,
        correlation_id: correlationId,
        reason: `Circuit opened for ${provider} after ${row.failures} failures`,
        metadata: { failure_count: row.failures, threshold: CIRCUIT_FAILURE_THRESHOLD },
      });
    }
    return { opened: row.opened };
  } catch {
    return { opened: false };
  }
}

/**
 * Reset circuit via PostgreSQL RPC.
 */
async function resetCircuit(
  provider: string,
  correlationId: string,
  userId: string,
  workspaceId: string,
  businessId: string,
): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  try {
    const prev = await getCircuitState(provider);
    await client.rpc("reset_circuit", { p_provider: provider });

    if (prev.is_open) {
      await recordAISecurityEvent({
        event_type: "AI_CIRCUIT_RECOVERED",
        severity: "INFO",
        user_id: userId,
        workspace_id: workspaceId,
        business_id: businessId,
        agent_key: null,
        provider,
        correlation_id: correlationId,
        reason: `Circuit recovered for ${provider}`,
      });
    }
  } catch {
    // Reset failure is non-critical — circuit will naturally reset
  }
}

// ============================================================
// GATEWAY INTERFACE
// ============================================================

export interface ModelCompletionParams {
  agent_key: AgentKey;
  business_id: string;
  user_id: string;
  workspace_id: string;
  investigation_id: string | null;
  invocation_id: string;
  system_prompt: string;
  user_prompt: string;
  model?: string | null;
  provider?: AIProvider;
  timeout_ms?: number;
  task_type?: ModelTaskType;
  risk_level?: "L0" | "L1" | "L2" | "L3" | "L4";
  required_capabilities?: ModelCapability[];
  structured_output_required?: boolean;
  output_schema?: Record<string, unknown>;
  endpoint?: string;
}

export async function requestModelCompletion(params: ModelCompletionParams): Promise<{
  success: boolean;
  response: string | null;
  model_used: string | null;
  provider_used: AIProvider | null;
  tokens_used: number | null;
  duration_ms: number;
  error: string | null;
  error_code: string | null;
}> {
  const {
    agent_key, business_id, user_id, workspace_id, investigation_id, invocation_id, system_prompt,
    user_prompt, model, provider: preferredProvider, timeout_ms = DEFAULT_TIMEOUT_MS,
    task_type = "SPECIALIST_ANALYSIS", risk_level = "L1",
    required_capabilities = ["analysis"], structured_output_required = true,
    output_schema, endpoint = "model-gateway",
  } = params;

  const correlationId = generateCorrelationId();
  const start = Date.now();
  initializeProviders();

  // ── SECURITY: Rate Limit Check ──
  const rateLimitResult = await checkAIRateLimit({
    user_id,
    business_id,
    endpoint,
  });

  if (!rateLimitResult.allowed) {
    await recordAISecurityEvent({
      event_type: "AI_RATE_LIMITED",
      severity: "MEDIUM",
      user_id,
      workspace_id,
      business_id,
      agent_key,
      endpoint,
      correlation_id: correlationId,
      reason: `Rate limit exceeded: denied by ${rateLimitResult.denied_by}`,
      metadata: {
        denied_by: rateLimitResult.denied_by,
        limit: rateLimitResult.limit,
        remaining: rateLimitResult.remaining,
      },
    });

    return {
      success: false,
      response: null,
      model_used: null,
      provider_used: null,
      tokens_used: null,
      duration_ms: Date.now() - start,
      error: "Rate limit exceeded. Please try again later.",
      error_code: "RATE_LIMITED",
    };
  }

  // ── SECURITY: Circuit Breaker Check ──
  const circuitState = await getCircuitState(preferredProvider ?? "any");
  if (circuitState.is_open) {
    await recordAISecurityEvent({
      event_type: "AI_INPUT_REJECTED",
      severity: "MEDIUM",
      user_id,
      workspace_id,
      business_id,
      agent_key,
      provider: preferredProvider ?? undefined,
      correlation_id: correlationId,
      reason: `Circuit open for provider ${preferredProvider ?? "any"}`,
      metadata: { provider: preferredProvider, failures: circuitState.failures },
    });

    return {
      success: false,
      response: null,
      model_used: null,
      provider_used: null,
      tokens_used: null,
      duration_ms: Date.now() - start,
      error: "AI provider is temporarily unavailable due to repeated failures.",
      error_code: "CIRCUIT_OPEN",
    };
  }

  // ── ROUTING ──
  const routing = await selectModelCandidates({
    agent_key,
    task_type,
    risk_level,
    required_capabilities,
    structured_output_required,
    requested_model: model?.trim() || undefined,
    preferred_provider: preferredProvider,
    latency_policy: "NORMAL",
  });
  const candidates = routing.candidate_list;

  if (candidates.length === 0) {
    await recordAIUsage({
      correlation_id: correlationId,
      user_id,
      workspace_id,
      business_id,
      agent_key,
      endpoint,
      provider: "none",
      model: "none",
      status: "FAILURE",
      failure_type: "NOT_CONFIGURED",
      duration_ms: Date.now() - start,
    });

    return {
      success: false, response: null, model_used: null, provider_used: null, tokens_used: null,
      duration_ms: Date.now() - start, error: "No eligible AI model configured.", error_code: "AI_NOT_CONFIGURED",
    };
  }

  // ── PROVIDER INVOCATION ──
  const available = new Set((await getAvailableProviders()).map((item) => item.provider));
  const errors: string[] = [];
  let providerTransitions = 0;
  let totalAttempts = 0;

  for (let index = 0; index < candidates.length; index++) {
    const candidate = candidates[index];

    if (providerTransitions >= MAX_PROVIDER_TRANSITIONS) break;
    if (totalAttempts >= MAX_TOTAL_ATTEMPTS) break;

    // Per-provider circuit check (skip providers whose circuit is open for this candidate)
    const providerCircuit = await getCircuitState(candidate.provider);
    if (providerCircuit.is_open) continue;

    if (!available.has(candidate.provider)) continue;
    const adapter = getProvider(candidate.provider);
    if (!adapter) continue;

    if (index > 0) providerTransitions++;
    totalAttempts++;

    try {
      const request: AIGatewayRequest = {
        model: candidate.model,
        prompt: user_prompt,
        system_message: system_prompt,
        temperature: 0.3,
        max_tokens: 2000,
        timeout_ms,
        output_schema: structured_output_required ? output_schema : undefined,
        metadata: {
          agent_key, task_type, business_id, risk_level, required_capabilities,
          structured_output_required,
          candidate_models: candidates.map((item) => item.model),
          routing_policy_version: routing.routing_policy_version,
        },
      };

      const response = await adapter.request(candidate.config, request);

      // Reset circuit on success
      await resetCircuit(candidate.provider, correlationId, user_id, workspace_id, business_id);

      // Record usage
      await recordAIUsage({
        correlation_id: correlationId,
        user_id,
        workspace_id,
        business_id,
        agent_key,
        endpoint,
        provider: response.provider,
        model: response.model_used,
        input_tokens: response.usage?.input_tokens ?? null,
        output_tokens: response.usage?.output_tokens ?? null,
        total_tokens: response.usage?.total_tokens ?? null,
        status: "SUCCESS",
        duration_ms: Date.now() - start,
        is_fallback: index > 0,
        provider_transitions: providerTransitions,
        retry_count: totalAttempts - 1,
      });

      return {
        success: true,
        response: response.content,
        model_used: response.model_used,
        provider_used: candidate.provider,
        tokens_used: response.usage?.total_tokens ?? null,
        duration_ms: Date.now() - start,
        error: null,
        error_code: null,
      };
    } catch (error) {
      const aiError = error instanceof AIError
        ? error
        : new AIError({ code: "AI_PROVIDER_ERROR", message: String(error), provider: candidate.provider });

      errors.push(`${candidate.provider}/${candidate.model}: ${aiError.message}`);

      // Record circuit failure
      await recordCircuitFailure(candidate.provider, correlationId, user_id, workspace_id, business_id);

      // Record usage for this attempt
      const failureType = mapErrorToFailureType(aiError.code);
      await recordAIUsage({
        correlation_id: correlationId,
        user_id,
        workspace_id,
        business_id,
        agent_key,
        endpoint,
        provider: candidate.provider,
        model: candidate.model,
        status: "FAILURE",
        failure_type: failureType,
        duration_ms: Date.now() - start,
        is_fallback: index > 0,
        provider_transitions: providerTransitions,
        retry_count: totalAttempts - 1,
      });

      // Emit security event for auth/config errors
      if (aiError.code === "AI_AUTH_ERROR") {
        await recordAISecurityEvent({
          event_type: "AI_FAILURE",
          severity: "HIGH",
          user_id,
          workspace_id,
          business_id,
          agent_key,
          provider: candidate.provider,
          correlation_id: correlationId,
          reason: `Provider authentication error: ${candidate.provider}`,
          metadata: { error_code: aiError.code, model: candidate.model },
        });
      }

      if (aiError.code === "AI_AUTH_ERROR" || aiError.code === "AI_INVALID_REQUEST" || aiError.code === "AI_RESPONSE_INVALID") {
        break;
      }
    }
  }

  // All providers exhausted
  const error = errors.join("; ") || "All routed providers were unavailable";

  await recordAIUsage({
    correlation_id: correlationId,
    user_id,
    workspace_id,
    business_id,
    agent_key,
    endpoint,
    provider: "none",
    model: model?.trim() || "none",
    status: "FAILURE",
    failure_type: "FALLBACK_EXHAUSTED",
    duration_ms: Date.now() - start,
    is_fallback: false,
    provider_transitions: providerTransitions,
    retry_count: totalAttempts,
  });

  await recordAISecurityEvent({
    event_type: "AI_RETRY_LIMIT_REACHED",
    severity: "MEDIUM",
    user_id,
    workspace_id,
    business_id,
    agent_key,
    correlation_id: correlationId,
    reason: `All ${candidates.length} routed providers exhausted after ${totalAttempts} attempts`,
    metadata: { candidates: candidates.length, attempts: totalAttempts, transitions: providerTransitions },
  });

  return {
    success: false,
    response: null,
    model_used: null,
    provider_used: null,
    tokens_used: null,
    duration_ms: Date.now() - start,
    error,
    error_code: "AI_FALLBACK_EXHAUSTED",
  };
}

function mapErrorToFailureType(code: string): "AUTH_ERROR" | "INVALID_REQUEST" | "PROVIDER_UNAVAILABLE" | "PROVIDER_ERROR" | "RESPONSE_INVALID" | "UNKNOWN" {
  switch (code) {
    case "AI_AUTH_ERROR": return "AUTH_ERROR";
    case "AI_INVALID_REQUEST": return "INVALID_REQUEST";
    case "AI_RESPONSE_INVALID": return "RESPONSE_INVALID";
    case "AI_PROVIDER_ERROR": return "PROVIDER_ERROR";
    default: return "UNKNOWN";
  }
}

export async function isAIAvailable(): Promise<boolean> {
  initializeProviders();
  return (await getAvailableProviders()).length > 0;
}

export function getAINotAvailableMessage(): string {
  return "AI provider not yet configured. Please configure an AI provider to enable the AI workforce.";
}

export { getAIUsageSummary as getUsageSummary } from "../security/ai-usage-tracker";
