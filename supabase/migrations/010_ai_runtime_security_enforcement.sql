-- SALAM LIT — Phase 15.4.3.1: AI Runtime Security Enforcement & Persistence
-- Migration: 010_ai_runtime_security_enforcement
-- Date: 2026-09-13
-- Description: Adds PostgreSQL-backed persistence for rate limiting,
--   usage tracking, security events, and circuit breaker state.
--   Replaces in-memory-only security controls with database-authoritative ones.

-- ============================================================
-- RATE LIMIT CHECK RPC
-- ============================================================
-- Atomic check-and-increment for rate limiting.
-- Uses SELECT FOR UPDATE to prevent race conditions.
-- Returns: allowed (boolean), remaining (integer), reset_at (timestamptz)

CREATE OR REPLACE FUNCTION check_and_increment_rate_limit(
  p_limit_key TEXT,
  p_max_requests INTEGER,
  p_window_ms BIGINT
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, reset_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
  v_new_count INTEGER;
BEGIN
  -- Lock the row for atomic update
  SELECT rl.count, rl.window_start
  INTO v_count, v_window_start
  FROM ai_rate_limit_state rl
  WHERE rl.limit_key = p_limit_key
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No entry exists — create new window
    INSERT INTO ai_rate_limit_state (limit_key, count, window_start, updated_at)
    VALUES (p_limit_key, 1, v_now, v_now);
    RETURN QUERY SELECT
      TRUE AS allowed,
      (p_max_requests - 1) AS remaining,
      (v_now + (p_window_ms || ' milliseconds')::INTERVAL) AS reset_at;
    RETURN;
  END IF;

  -- Check if window has expired
  IF EXTRACT(EPOCH FROM (v_now - v_window_start)) * 1000 > p_window_ms THEN
    -- Window expired — reset counter
    UPDATE ai_rate_limit_state
    SET count = 1, window_start = v_now, updated_at = v_now
    WHERE limit_key = p_limit_key;
    RETURN QUERY SELECT
      TRUE AS allowed,
      (p_max_requests - 1) AS remaining,
      (v_now + (p_window_ms || ' milliseconds')::INTERVAL) AS reset_at;
    RETURN;
  END IF;

  -- Window active — check limit
  IF v_count >= p_max_requests THEN
    -- Rate limited
    RETURN QUERY SELECT
      FALSE AS allowed,
      0 AS remaining,
      (v_window_start + (p_window_ms || ' milliseconds')::INTERVAL) AS reset_at;
    RETURN;
  END IF;

  -- Increment counter
  v_new_count := v_count + 1;
  UPDATE ai_rate_limit_state
  SET count = v_new_count, updated_at = v_now
  WHERE limit_key = p_limit_key;

  RETURN QUERY SELECT
    TRUE AS allowed,
    (p_max_requests - v_new_count) AS remaining,
    (v_window_start + (p_window_ms || ' milliseconds')::INTERVAL) AS reset_at;
  RETURN;
END;
$$;

-- ============================================================
-- CIRCUIT BREAKER STATE TABLE
-- ============================================================
-- Persistent circuit breaker state for AI providers.
-- Prevents provider cascade failures across restarts.

CREATE TABLE IF NOT EXISTS ai_circuit_breaker_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0,
  last_failure TIMESTAMPTZ,
  open BOOLEAN NOT NULL DEFAULT FALSE,
  opened_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(provider)
);

CREATE INDEX IF NOT EXISTS idx_ai_circuit_breaker_provider ON ai_circuit_breaker_state(provider);

-- ============================================================
-- CIRCUIT BREAKER RPCS
-- ============================================================

-- Record a failure and open circuit if threshold reached
CREATE OR REPLACE FUNCTION record_circuit_failure(
  p_provider TEXT,
  p_threshold INTEGER
)
RETURNS TABLE(opened BOOLEAN, failures INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- Upsert circuit state
  INSERT INTO ai_circuit_breaker_state (provider, failures, last_failure, open, opened_at, updated_at)
  VALUES (p_provider, 1, v_now, FALSE, NULL, v_now)
  ON CONFLICT (provider) DO UPDATE
  SET failures = ai_circuit_breaker_state.failures + 1,
      last_failure = v_now,
      updated_at = v_now;

  -- Get updated count
  SELECT cb.failures INTO v_count
  FROM ai_circuit_breaker_state cb
  WHERE cb.provider = p_provider;

  -- Open circuit if threshold reached
  IF v_count >= p_threshold THEN
    UPDATE ai_circuit_breaker_state
    SET open = TRUE, opened_at = v_now
    WHERE provider = p_provider AND open = FALSE;
    RETURN QUERY SELECT TRUE AS opened, v_count AS failures;
  ELSE
    RETURN QUERY SELECT FALSE AS opened, v_count AS failures;
  END IF;
END;
$$;

-- Reset circuit on success
CREATE OR REPLACE FUNCTION reset_circuit(p_provider TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE ai_circuit_breaker_state
  SET failures = 0, open = FALSE, opened_at = NULL, updated_at = NOW()
  WHERE provider = p_provider;
END;
$$;

-- Check circuit state
CREATE OR REPLACE FUNCTION get_circuit_state(p_provider TEXT)
RETURNS TABLE(open BOOLEAN, failures INTEGER, last_failure TIMESTAMPTZ, cooldown_remaining_ms BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state RECORD;
  v_reset_ms BIGINT := 60000;
BEGIN
  SELECT cb.open, cb.failures, cb.last_failure, cb.opened_at
  INTO v_state
  FROM ai_circuit_breaker_state cb
  WHERE cb.provider = p_provider;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE AS open, 0 AS failures, NULL::TIMESTAMPTZ AS last_failure, 0::BIGINT AS cooldown_remaining_ms;
    RETURN;
  END IF;

  -- Auto-reset after cooldown
  IF v_state.open AND v_state.opened_at IS NOT NULL THEN
    IF EXTRACT(EPOCH FROM (NOW() - v_state.opened_at)) * 1000 > v_reset_ms THEN
      UPDATE ai_circuit_breaker_state
      SET failures = 0, open = FALSE, opened_at = NULL, updated_at = NOW()
      WHERE provider = p_provider;
      RETURN QUERY SELECT FALSE AS open, 0 AS failures, v_state.last_failure, 0::BIGINT AS cooldown_remaining_ms;
      RETURN;
    END IF;
    RETURN QUERY SELECT
      v_state.open,
      v_state.failures,
      v_state.last_failure,
      (v_reset_ms - EXTRACT(EPOCH FROM (NOW() - v_state.opened_at)) * 1000)::BIGINT AS cooldown_remaining_ms;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_state.open, v_state.failures, v_state.last_failure, 0::BIGINT AS cooldown_remaining_ms;
END;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Circuit breaker state: no user-level access (server-only via service role)
ALTER TABLE ai_circuit_breaker_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REVOKE BROAD PERMISSIONS
-- ============================================================

REVOKE ALL ON ai_circuit_breaker_state FROM PUBLIC;

-- Grant only to service_role (server operations)
GRANT ALL ON ai_circuit_breaker_state TO service_role;

-- Grant EXECUTE on functions to service_role
GRANT EXECUTE ON FUNCTION check_and_increment_rate_limit(p_limit_key TEXT, p_max_requests INTEGER, p_window_ms BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION record_circuit_failure(p_provider TEXT, p_threshold INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION reset_circuit(p_provider TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION get_circuit_state(p_provider TEXT) TO service_role;
