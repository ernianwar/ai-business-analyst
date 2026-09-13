/**
 * SALAM LIT — AI Security Events
 *
 * PostgreSQL-authoritative security telemetry for the AI runtime.
 * Records security-relevant events for monitoring, alerting,
 * and KOPI integration.
 *
 * Phase 15.4.3.1: AI Runtime Security Enforcement
 *
 * SECURITY RULES:
 * - PostgreSQL is the authoritative source for security events
 * - Raw sensitive prompts are NEVER stored
 * - Security logs must not become a new data-leak surface
 * - Events follow PDPA data classification principles
 * - Correlation IDs enable cross-event analysis
 * - Database failure is logged but does not block AI requests
 */

import { getSupabaseClient } from "../db/supabase-client";

// ============================================================
// EVENT TYPES
// ============================================================

export type AISecurityEventType =
  | "AI_REQUEST"
  | "AI_SUCCESS"
  | "AI_FAILURE"
  | "AI_RATE_LIMITED"
  | "AI_INPUT_REJECTED"
  | "AI_OUTPUT_REJECTED"
  | "PROMPT_INJECTION_DETECTED"
  | "AI_COST_THRESHOLD"
  | "AI_PROVIDER_FALLBACK"
  | "AI_RETRY_LIMIT_REACHED"
  | "AI_UNTRUSTED_CONTENT_ESCALATION"
  | "AI_CROSS_AGENT_TRUST_VIOLATION"
  | "AI_ACTION_INTENT_DETECTED"
  | "AI_CIRCUIT_OPENED"
  | "AI_CIRCUIT_RECOVERED"
  | "AI_USAGE_PERSISTENCE_FAILURE"
  | "AI_UNAUTHORIZED_ACCESS_ATTEMPT";

export type AISecuritySeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// ============================================================
// EVENT STRUCTURE
// ============================================================

export interface AISecurityEvent {
  event_id: string;
  timestamp: string;
  event_type: AISecurityEventType;
  severity: AISecuritySeverity;
  user_id: string | null;
  workspace_id: string | null;
  business_id: string | null;
  agent_key: string | null;
  endpoint: string | null;
  provider: string | null;
  model: string | null;
  correlation_id: string;
  reason: string;
  metadata: Record<string, unknown>;
}

// ============================================================
// METADATA SANITIZATION
// ============================================================

/**
 * Sanitize metadata to ensure no raw prompts are stored.
 * Truncates string values and removes sensitive keys.
 */
function sanitizeMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  const blockedKeys = new Set([
    "prompt", "system_prompt", "user_prompt", "raw_prompt",
    "content", "raw_content", "raw_response",
    "api_key", "secret", "token", "password",
  ]);

  for (const [key, value] of Object.entries(metadata)) {
    if (blockedKeys.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    if (typeof value === "string") {
      sanitized[key] = value.length > 200 ? value.slice(0, 200) + "..." : value;
    } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value;
    } else {
      sanitized[key] = String(value).slice(0, 200);
    }
  }

  return sanitized;
}

// ============================================================
// POSTGRESQL-AUTHORITATIVE EVENT RECORDING
// ============================================================

/**
 * Record an AI security event to PostgreSQL.
 * Raw prompts are NEVER stored. Only metadata and truncated summaries.
 * Database failure is logged but does not block the AI request.
 */
export async function recordAISecurityEvent(params: {
  event_type: AISecurityEventType;
  severity: AISecuritySeverity;
  user_id?: string | null;
  workspace_id?: string | null;
  business_id?: string | null;
  agent_key?: string | null;
  endpoint?: string | null;
  provider?: string | null;
  model?: string | null;
  correlation_id: string;
  reason: string;
  metadata?: Record<string, unknown>;
}): Promise<{ event_id: string; persisted: boolean }> {
  const event_id = crypto.randomUUID();
  const client = getSupabaseClient();

  // Log to console for server-side monitoring (always, even if DB fails)
  const logLevel = params.severity === "HIGH" || params.severity === "CRITICAL" ? "error" : "log";
  console[logLevel](`[AI SECURITY] ${params.event_type} (${params.severity}): ${params.reason}`, {
    event_id,
    correlation_id: params.correlation_id,
    user_id: params.user_id,
    business_id: params.business_id,
    agent_key: params.agent_key,
  });

  if (!client) {
    console.error(`[AI_SECURITY] Database unavailable — event ${event_id} NOT persisted`);
    return { event_id, persisted: false };
  }

  try {
    const { error } = await client.from("ai_security_events").insert({
      id: event_id,
      event_type: params.event_type,
      severity: params.severity,
      user_id: params.user_id ?? null,
      workspace_id: params.workspace_id ?? null,
      business_id: params.business_id ?? null,
      agent_key: params.agent_key ?? null,
      endpoint: params.endpoint ?? null,
      provider: params.provider ?? null,
      model: params.model ?? null,
      correlation_id: params.correlation_id,
      reason: params.reason,
      metadata: sanitizeMetadata(params.metadata ?? {}),
    });

    if (error) {
      console.error(`[AI_SECURITY] Insert error for ${event_id}: ${error.message}`);
      return { event_id, persisted: false };
    }

    return { event_id, persisted: true };
  } catch (err) {
    console.error(`[AI_SECURITY] Exception recording ${event_id}: ${err}`);
    return { event_id, persisted: false };
  }
}

/**
 * Query security events from PostgreSQL with filters.
 */
export async function querySecurityEvents(filters: {
  event_type?: AISecurityEventType;
  severity?: AISecuritySeverity;
  user_id?: string;
  business_id?: string;
  agent_key?: string;
  correlation_id?: string;
  since?: string;
  limit?: number;
}): Promise<AISecurityEvent[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    let query = client.from("ai_security_events").select("*");

    if (filters.event_type) query = query.eq("event_type", filters.event_type);
    if (filters.severity) query = query.eq("severity", filters.severity);
    if (filters.user_id) query = query.eq("user_id", filters.user_id);
    if (filters.business_id) query = query.eq("business_id", filters.business_id);
    if (filters.agent_key) query = query.eq("agent_key", filters.agent_key);
    if (filters.correlation_id) query = query.eq("correlation_id", filters.correlation_id);
    if (filters.since) query = query.gte("created_at", filters.since);

    query = query.order("created_at", { ascending: false });
    if (filters.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) {
      console.error(`[AI_SECURITY] Query error: ${error.message}`);
      return [];
    }

    return (data ?? []).map((e) => ({
      event_id: e.id,
      timestamp: e.created_at,
      event_type: e.event_type,
      severity: e.severity,
      user_id: e.user_id,
      workspace_id: e.workspace_id,
      business_id: e.business_id,
      agent_key: e.agent_key,
      endpoint: e.endpoint,
      provider: e.provider,
      model: e.model,
      correlation_id: e.correlation_id,
      reason: e.reason,
      metadata: e.metadata ?? {},
    }));
  } catch (err) {
    console.error(`[AI_SECURITY] Exception querying: ${err}`);
    return [];
  }
}

/**
 * Get security event summary for a business.
 */
export async function getSecurityEventSummary(business_id: string, since?: string) {
  const events = await querySecurityEvents({ business_id, since, limit: 1000 });
  return {
    total: events.length,
    by_type: events.reduce<Record<string, number>>((acc, e) => {
      acc[e.event_type] = (acc[e.event_type] ?? 0) + 1;
      return acc;
    }, {}),
    by_severity: events.reduce<Record<string, number>>((acc, e) => {
      acc[e.severity] = (acc[e.severity] ?? 0) + 1;
      return acc;
    }, {}),
    high_severity_count: events.filter((e) => e.severity === "HIGH" || e.severity === "CRITICAL").length,
    injection_detections: events.filter((e) => e.event_type === "PROMPT_INJECTION_DETECTED").length,
    rate_limit_events: events.filter((e) => e.event_type === "AI_RATE_LIMITED").length,
  };
}

/**
 * Generate a correlation ID for request tracing.
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}
