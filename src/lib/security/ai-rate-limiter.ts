/**
 * SALAM LIT — AI Rate Limiter
 *
 * PostgreSQL-authoritative server-side rate limiting for AI endpoints.
 * Prevents abuse, cost exhaustion, and provider rate limit violations.
 *
 * Phase 15.4.3.1: AI Runtime Security Enforcement
 *
 * SECURITY RULES:
 * - Identity comes from getAuthenticatedContext(), NOT client
 * - PostgreSQL is the authoritative source for rate-limit state
 * - Database failure → DENY (fail-closed)
 * - Atomic check-and-increment via RPC prevents race conditions
 * - Server restart does not reset counters
 * - Multiple application instances share the same limit state
 * - Do not leak internal quota state
 */

import { getSupabaseClient } from "../db/supabase-client";
import {
  RATE_LIMIT_USER_PER_MINUTE,
  RATE_LIMIT_BUSINESS_PER_MINUTE,
  RATE_LIMIT_ENDPOINT_PER_MINUTE,
  RATE_LIMIT_WINDOW_MS,
} from "./sanitize";

// ============================================================
// TYPES
// ============================================================

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset_at: number;
  limit: number;
  denied_by?: string;
};

// ============================================================
// POSTGRESQL-AUTHORITATIVE RATE LIMIT CHECK
// ============================================================

/**
 * Check a single rate limit dimension via PostgreSQL RPC.
 * Uses atomic check-and-increment to prevent race conditions.
 * Returns DENY if database is unavailable (fail-closed).
 */
async function checkSingleLimit(
  limitKey: string,
  maxRequests: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number; reset_at: number }> {
  const client = getSupabaseClient();
  if (!client) {
    // Database unavailable → DENY (fail-closed)
    return { allowed: false, remaining: 0, reset_at: Date.now() + windowMs };
  }

  try {
    const { data, error } = await client.rpc("check_and_increment_rate_limit", {
      p_limit_key: limitKey,
      p_max_requests: maxRequests,
      p_window_ms: windowMs,
    });

    if (error) {
      console.error(`[RATE_LIMIT] RPC error for ${limitKey}: ${error.message}`);
      // Database error → DENY (fail-closed)
      return { allowed: false, remaining: 0, reset_at: Date.now() + windowMs };
    }

    const result = data?.[0];
    if (!result) {
      return { allowed: false, remaining: 0, reset_at: Date.now() + windowMs };
    }

    return {
      allowed: result.allowed,
      remaining: result.remaining,
      reset_at: new Date(result.reset_at).getTime(),
    };
  } catch (err) {
    console.error(`[RATE_LIMIT] Exception for ${limitKey}: ${err}`);
    // Exception → DENY (fail-closed)
    return { allowed: false, remaining: 0, reset_at: Date.now() + windowMs };
  }
}

/**
 * Check all rate limits for an AI request.
 * PostgreSQL-authoritative. Database failure → DENY.
 *
 * @param params.user_id - Authenticated user ID (server-derived)
 * @param params.business_id - Authenticated business ID (server-derived)
 * @param params.endpoint - API endpoint being accessed
 * @returns Rate limit result — if any limit is exceeded or DB unavailable, request is denied
 */
export async function checkAIRateLimit(params: {
  user_id: string;
  business_id: string;
  endpoint: string;
}): Promise<RateLimitResult> {
  const { user_id, business_id, endpoint } = params;

  // Validate required identity — missing → DENY
  if (!user_id || !business_id) {
    return {
      allowed: false,
      remaining: 0,
      reset_at: Date.now() + RATE_LIMIT_WINDOW_MS,
      limit: 0,
      denied_by: "missing_identity",
    };
  }

  // Check user rate limit (20/minute)
  const userKey = `user:${user_id}`;
  const userResult = await checkSingleLimit(userKey, RATE_LIMIT_USER_PER_MINUTE, RATE_LIMIT_WINDOW_MS);
  if (!userResult.allowed) {
    return {
      ...userResult,
      limit: RATE_LIMIT_USER_PER_MINUTE,
      denied_by: "user",
    };
  }

  // Check business rate limit (50/minute)
  const bizKey = `biz:${business_id}`;
  const bizResult = await checkSingleLimit(bizKey, RATE_LIMIT_BUSINESS_PER_MINUTE, RATE_LIMIT_WINDOW_MS);
  if (!bizResult.allowed) {
    return {
      ...bizResult,
      limit: RATE_LIMIT_BUSINESS_PER_MINUTE,
      denied_by: "business",
    };
  }

  // Check endpoint rate limit (100/minute)
  const epKey = `ep:${endpoint}`;
  const epResult = await checkSingleLimit(epKey, RATE_LIMIT_ENDPOINT_PER_MINUTE, RATE_LIMIT_WINDOW_MS);
  if (!epResult.allowed) {
    return {
      ...epResult,
      limit: RATE_LIMIT_ENDPOINT_PER_MINUTE,
      denied_by: "endpoint",
    };
  }

  // All limits passed — return the most restrictive remaining count
  return {
    allowed: true,
    remaining: Math.min(userResult.remaining, bizResult.remaining, epResult.remaining),
    reset_at: Math.max(userResult.reset_at, bizResult.reset_at, epResult.reset_at),
    limit: Math.min(RATE_LIMIT_USER_PER_MINUTE, RATE_LIMIT_BUSINESS_PER_MINUTE, RATE_LIMIT_ENDPOINT_PER_MINUTE),
  };
}

/**
 * Get current rate limit status without incrementing counters.
 * Used for informational purposes (does not consume quota).
 * Falls back to safe defaults if DB unavailable.
 */
export async function getRateLimitStatus(params: {
  user_id: string;
  business_id: string;
  endpoint: string;
}): Promise<{
  user: { used: number; limit: number; remaining: number };
  business: { used: number; limit: number; remaining: number };
  endpoint: { used: number; limit: number; remaining: number };
}> {
  const client = getSupabaseClient();
  if (!client) {
    return {
      user: { used: 0, limit: RATE_LIMIT_USER_PER_MINUTE, remaining: RATE_LIMIT_USER_PER_MINUTE },
      business: { used: 0, limit: RATE_LIMIT_BUSINESS_PER_MINUTE, remaining: RATE_LIMIT_BUSINESS_PER_MINUTE },
      endpoint: { used: 0, limit: RATE_LIMIT_ENDPOINT_PER_MINUTE, remaining: RATE_LIMIT_ENDPOINT_PER_MINUTE },
    };
  }

  const now = new Date().toISOString();

  const getUserStatus = async () => {
    const { data } = await client
      .from("ai_rate_limit_state")
      .select("count, window_start")
      .eq("limit_key", `user:${params.user_id}`)
      .single();
    if (!data) return { used: 0, limit: RATE_LIMIT_USER_PER_MINUTE, remaining: RATE_LIMIT_USER_PER_MINUTE };
    const elapsed = Date.now() - new Date(data.window_start).getTime();
    if (elapsed > RATE_LIMIT_WINDOW_MS) return { used: 0, limit: RATE_LIMIT_USER_PER_MINUTE, remaining: RATE_LIMIT_USER_PER_MINUTE };
    return { used: data.count, limit: RATE_LIMIT_USER_PER_MINUTE, remaining: Math.max(0, RATE_LIMIT_USER_PER_MINUTE - data.count) };
  };

  const getBizStatus = async () => {
    const { data } = await client
      .from("ai_rate_limit_state")
      .select("count, window_start")
      .eq("limit_key", `biz:${params.business_id}`)
      .single();
    if (!data) return { used: 0, limit: RATE_LIMIT_BUSINESS_PER_MINUTE, remaining: RATE_LIMIT_BUSINESS_PER_MINUTE };
    const elapsed = Date.now() - new Date(data.window_start).getTime();
    if (elapsed > RATE_LIMIT_WINDOW_MS) return { used: 0, limit: RATE_LIMIT_BUSINESS_PER_MINUTE, remaining: RATE_LIMIT_BUSINESS_PER_MINUTE };
    return { used: data.count, limit: RATE_LIMIT_BUSINESS_PER_MINUTE, remaining: Math.max(0, RATE_LIMIT_BUSINESS_PER_MINUTE - data.count) };
  };

  const getEpStatus = async () => {
    const { data } = await client
      .from("ai_rate_limit_state")
      .select("count, window_start")
      .eq("limit_key", `ep:${params.endpoint}`)
      .single();
    if (!data) return { used: 0, limit: RATE_LIMIT_ENDPOINT_PER_MINUTE, remaining: RATE_LIMIT_ENDPOINT_PER_MINUTE };
    const elapsed = Date.now() - new Date(data.window_start).getTime();
    if (elapsed > RATE_LIMIT_WINDOW_MS) return { used: 0, limit: RATE_LIMIT_ENDPOINT_PER_MINUTE, remaining: RATE_LIMIT_ENDPOINT_PER_MINUTE };
    return { used: data.count, limit: RATE_LIMIT_ENDPOINT_PER_MINUTE, remaining: Math.max(0, RATE_LIMIT_ENDPOINT_PER_MINUTE - data.count) };
  };

  const [user, business, endpoint] = await Promise.all([getUserStatus(), getBizStatus(), getEpStatus()]);
  return { user, business, endpoint };
}

/**
 * Clear rate limit state for testing only.
 * In production, state is PostgreSQL-authoritative.
 */
export async function clearRateLimitState(): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;
  await client.from("ai_rate_limit_state").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
