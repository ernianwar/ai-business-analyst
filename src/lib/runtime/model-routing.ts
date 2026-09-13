/**
 * SALAM LIT deterministic model-routing policy.
 *
 * This module selects from configured candidates. It never asks an LLM to
 * select another LLM, and it does not contain a catalogue of free models.
 */

import type {
  AIModelConfig,
  AIProvider,
  ModelCapability,
  ModelTaskType,
  ModelTier,
} from "../ai-gateway/types";
import { getAllModels } from "../ai-gateway/registry";

export const ROUTING_POLICY_VERSION = "13C.1";

export interface RoutingRequest {
  agent_key: string;
  task_type: ModelTaskType;
  risk_level?: "L0" | "L1" | "L2" | "L3" | "L4";
  required_capabilities?: ModelCapability[];
  structured_output_required?: boolean;
  context_tokens?: number;
  cost_policy?: ModelTier;
  latency_policy?: "LOW" | "NORMAL" | "UNBOUNDED";
  requested_model?: string;
  preferred_provider?: AIProvider;
}

export interface RoutingCandidate {
  provider: AIProvider;
  model: string;
  config: AIModelConfig;
  tier: ModelTier;
}

export interface RoutingDecision {
  selected_provider: AIProvider | null;
  selected_model: string | null;
  candidate_list: RoutingCandidate[];
  routing_policy_version: string;
  reason: string;
  fallback_allowed: boolean;
}

const TIER_ORDER: Record<ModelTier, number> = {
  EXPERIMENTATION: 0,
  LOW_COST: 1,
  HIGH_QUALITY: 2,
  HIGH_TRUST: 3,
};

function inferTier(config: AIModelConfig): ModelTier {
  if (config.tier) return config.tier;
  if (config.provider === "deepseek") return "LOW_COST";
  if (config.provider === "openrouter" && config.model_id.endsWith(":free")) return "EXPERIMENTATION";
  if (config.provider === "anthropic" || config.provider === "openai") return "HIGH_QUALITY";
  return "LOW_COST";
}

function isEligible(config: AIModelConfig, request: RoutingRequest): boolean {
  const tier = inferTier(config);
  const required = request.required_capabilities ?? [];
  const hasCapabilities = required.every((capability) => config.capabilities.includes(capability));
  const hasContext = !request.context_tokens || config.max_input_tokens >= request.context_tokens;
  const structured = !request.structured_output_required || config.structured_output === true;
  const risk = request.risk_level ?? "L1";
  const noFreeForHighTrust = risk === "L3" || risk === "L4";
  const tierAllowed = request.cost_policy
    ? TIER_ORDER[tier] <= TIER_ORDER[request.cost_policy]
    : true;

  return config.enabled && hasCapabilities && hasContext && structured && tierAllowed &&
    !(noFreeForHighTrust && tier === "EXPERIMENTATION");
}

function score(config: AIModelConfig, request: RoutingRequest): number {
  const tier = inferTier(config);
  let value = TIER_ORDER[tier] * 100;
  if (request.task_type === "SYNTHESIS" || request.task_type === "RECOMMENDATION_GENERATION") {
    value += config.capabilities.includes("reasoning") ? 20 : 0;
  }
  if (request.latency_policy === "LOW") {
    value -= (config.cost_per_1m_output ?? 1) * 2;
  }
  return value;
}

/** Select a deterministic ordered candidate list from currently available models. */
export async function selectModelCandidates(request: RoutingRequest): Promise<RoutingDecision> {
  const models = await getAllModels();
  const candidates = models
    .filter((config) => isEligible(config, request))
    .filter((config) => !request.requested_model || config.model_id === request.requested_model)
    .filter((config) => !request.preferred_provider || config.provider === request.preferred_provider)
    .sort((a, b) => score(b, request) - score(a, request) || a.provider.localeCompare(b.provider) || a.model_id.localeCompare(b.model_id))
    .map((config) => ({
      provider: config.provider,
      model: config.model_id,
      config,
      tier: inferTier(config),
    }));

  const selected = candidates[0] ?? null;
  const reason = selected
    ? `Selected ${selected.provider}/${selected.model} for ${request.task_type}; candidates are ordered deterministically by policy.`
    : `No configured model satisfies ${request.task_type} requirements.`;

  return {
    selected_provider: selected?.provider ?? null,
    selected_model: selected?.model ?? null,
    candidate_list: candidates,
    routing_policy_version: ROUTING_POLICY_VERSION,
    reason,
    fallback_allowed: candidates.length > 1 && request.risk_level !== "L4",
  };
}

export function filterCandidatesForAgent(
  candidates: RoutingCandidate[],
  agent_key: string,
  task_type: ModelTaskType
): RoutingCandidate[] {
  // Keep this explicit and auditable while allowing future per-agent policy.
  if (agent_key === "erni" && task_type === "SPECIALIST_ANALYSIS") return candidates;
  return candidates;
}
