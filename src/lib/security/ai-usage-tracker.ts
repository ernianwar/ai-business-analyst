/**
 * SALAM LIT — AI Usage & Cost Governance
 *
 * PostgreSQL-authoritative usage tracking for AI requests.
 * Records every AI interaction with full provenance for
 * cost analysis, budget enforcement, and security telemetry.
 *
 * Phase 15.4.3.1: AI Runtime Security Enforcement
 *
 * SECURITY RULES:
 * - PostgreSQL is the authoritative source for usage records
 * - Do not fabricate cost data
 * - If provider does not provide token/cost info, store null (UNKNOWN)
 * - Never report zero cost merely because cost data is unavailable
 * - Database failure must be observable, not silently swallowed
 * - Server restart must not erase usage history
 */

import { getSupabaseClient } from "../db/supabase-client";

// ============================================================
// USAGE RECORD STRUCTURE
// ============================================================

export type AIRequestStatus = "SUCCESS" | "FAILURE" | "RATE_LIMITED" | "TIMEOUT" | "UNKNOWN";

export type AIFailureType =
  | "AUTH_ERROR"
  | "INVALID_REQUEST"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "RESPONSE_INVALID"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "FALLBACK_EXHAUSTED"
  | "NOT_CONFIGURED"
  | "UNKNOWN";

export interface AIUsageRecord {
  id: string;
  timestamp: string;
  correlation_id: string;
  user_id: string;
  workspace_id: string;
  business_id: string;
  agent_key: string;
  endpoint: string;
  provider: string;
  model: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_cost: number | null;
  status: AIRequestStatus;
  failure_type: AIFailureType | null;
  duration_ms: number;
  is_fallback: boolean;
  provider_transitions: number;
  retry_count: number;
}

// ============================================================
// POSTGRESQL-AUTHORITATIVE USAGE RECORDING
// ============================================================

/**
 * Record an AI usage event to PostgreSQL.
 * This is the authoritative record for cost tracking.
 * Database failure is logged but does not block the AI request.
 */
export async function recordAIUsage(params: {
  correlation_id: string;
  user_id: string;
  workspace_id: string;
  business_id: string;
  agent_key: string;
  endpoint: string;
  provider: string;
  model: string;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  estimated_cost?: number | null;
  status: AIRequestStatus;
  failure_type?: AIFailureType | null;
  duration_ms: number;
  is_fallback?: boolean;
  provider_transitions?: number;
  retry_count?: number;
}): Promise<{ id: string; persisted: boolean }> {
  const id = crypto.randomUUID();
  const client = getSupabaseClient();

  if (!client) {
    console.error(`[AI_USAGE] Database unavailable — usage record ${id} NOT persisted`);
    return { id, persisted: false };
  }

  try {
    const { error } = await client.from("ai_usage_records").insert({
      id,
      correlation_id: params.correlation_id,
      user_id: params.user_id,
      workspace_id: params.workspace_id,
      business_id: params.business_id,
      agent_key: params.agent_key,
      endpoint: params.endpoint,
      provider: params.provider,
      model: params.model,
      input_tokens: params.input_tokens ?? null,
      output_tokens: params.output_tokens ?? null,
      total_tokens: params.total_tokens ?? null,
      estimated_cost: params.estimated_cost ?? null,
      status: params.status,
      failure_type: params.failure_type ?? null,
      duration_ms: params.duration_ms,
      is_fallback: params.is_fallback ?? false,
      provider_transitions: params.provider_transitions ?? 0,
      retry_count: params.retry_count ?? 0,
    });

    if (error) {
      console.error(`[AI_USAGE] Insert error for ${id}: ${error.message}`);
      return { id, persisted: false };
    }

    return { id, persisted: true };
  } catch (err) {
    console.error(`[AI_USAGE] Exception recording ${id}: ${err}`);
    return { id, persisted: false };
  }
}

/**
 * Query usage records from PostgreSQL with filters.
 */
export async function queryAIUsage(filters: {
  user_id?: string;
  workspace_id?: string;
  business_id?: string;
  agent_key?: string;
  provider?: string;
  endpoint?: string;
  status?: AIRequestStatus;
  since?: string;
  limit?: number;
}): Promise<AIUsageRecord[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    let query = client.from("ai_usage_records").select("*");

    if (filters.user_id) query = query.eq("user_id", filters.user_id);
    if (filters.workspace_id) query = query.eq("workspace_id", filters.workspace_id);
    if (filters.business_id) query = query.eq("business_id", filters.business_id);
    if (filters.agent_key) query = query.eq("agent_key", filters.agent_key);
    if (filters.provider) query = query.eq("provider", filters.provider);
    if (filters.endpoint) query = query.eq("endpoint", filters.endpoint);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.since) query = query.gte("created_at", filters.since);

    query = query.order("created_at", { ascending: false });
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) {
      console.error(`[AI_USAGE] Query error: ${error.message}`);
      return [];
    }

    return (data ?? []).map((r) => ({
      id: r.id,
      timestamp: r.created_at,
      correlation_id: r.correlation_id,
      user_id: r.user_id,
      workspace_id: r.workspace_id,
      business_id: r.business_id,
      agent_key: r.agent_key,
      endpoint: r.endpoint,
      provider: r.provider,
      model: r.model,
      input_tokens: r.input_tokens,
      output_tokens: r.output_tokens,
      total_tokens: r.total_tokens,
      estimated_cost: r.estimated_cost,
      status: r.status,
      failure_type: r.failure_type,
      duration_ms: r.duration_ms,
      is_fallback: r.is_fallback,
      provider_transitions: r.provider_transitions,
      retry_count: r.retry_count,
    }));
  } catch (err) {
    console.error(`[AI_USAGE] Exception querying: ${err}`);
    return [];
  }
}

/**
 * Get usage summary for a business from PostgreSQL.
 * Returns aggregated metrics for cost analysis.
 */
export async function getAIUsageSummary(business_id: string, since?: string) {
  const records = await queryAIUsage({ business_id, since, limit: 10000 });

  const totalInputTokens = records.reduce((sum, r) => sum + (r.input_tokens ?? 0), 0);
  const totalOutputTokens = records.reduce((sum, r) => sum + (r.output_tokens ?? 0), 0);
  const totalTokens = records.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0);
  const totalEstimatedCost = records.reduce((sum, r) => sum + (r.estimated_cost ?? 0), 0);
  const hasCostData = records.some((r) => r.estimated_cost !== null);

  return {
    total_requests: records.length,
    successful: records.filter((r) => r.status === "SUCCESS").length,
    failed: records.filter((r) => r.status === "FAILURE").length,
    rate_limited: records.filter((r) => r.status === "RATE_LIMITED").length,
    total_input_tokens: totalInputTokens,
    total_output_tokens: totalOutputTokens,
    total_tokens: totalTokens,
    total_estimated_cost: hasCostData ? totalEstimatedCost : null,
    cost_available: hasCostData,
    avg_duration_ms: records.length > 0
      ? records.reduce((sum, r) => sum + r.duration_ms, 0) / records.length
      : 0,
    by_agent: records.reduce<Record<string, { requests: number; tokens: number; cost: number | null }>>((acc, r) => {
      acc[r.agent_key] ??= { requests: 0, tokens: 0, cost: null };
      acc[r.agent_key].requests++;
      acc[r.agent_key].tokens += r.total_tokens ?? 0;
      if (r.estimated_cost !== null) {
        acc[r.agent_key].cost = (acc[r.agent_key].cost ?? 0) + r.estimated_cost;
      }
      return acc;
    }, {}),
    by_provider: records.reduce<Record<string, { requests: number; tokens: number; cost: number | null }>>((acc, r) => {
      acc[r.provider] ??= { requests: 0, tokens: 0, cost: null };
      acc[r.provider].requests++;
      acc[r.provider].tokens += r.total_tokens ?? 0;
      if (r.estimated_cost !== null) {
        acc[r.provider].cost = (acc[r.provider].cost ?? 0) + r.estimated_cost;
      }
      return acc;
    }, {}),
  };
}

/**
 * Check if a business has exceeded its daily cost limit.
 * Returns null if cost data is unavailable (UNKNOWN).
 */
export async function checkCostThreshold(
  business_id: string,
  dailyLimit: number
): Promise<{ exceeded: boolean; current_cost: number | null; limit: number }> {
  const today = new Date().toISOString().split("T")[0];
  const records = await queryAIUsage({ business_id, since: today, limit: 10000 });

  const hasCostData = records.some((r) => r.estimated_cost !== null);
  if (!hasCostData) {
    return { exceeded: false, current_cost: null, limit: dailyLimit };
  }

  const totalCost = records.reduce((sum, r) => sum + (r.estimated_cost ?? 0), 0);
  return { exceeded: totalCost >= dailyLimit, current_cost: totalCost, limit: dailyLimit };
}

/**
 * Clear usage records for testing only.
 */
export async function clearAIUsageRecords(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from("ai_usage_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
