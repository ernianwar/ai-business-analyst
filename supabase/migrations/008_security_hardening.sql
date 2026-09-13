-- SALAM LIT — Phase 15.3: Security Hardening
-- Migration: 008_security_hardening
-- Date: 2026-09-11
-- Description: Revokes PUBLIC EXECUTE on increment_standing_auth_usage
--   which currently allows anonymous/public callers to manipulate
--   usage counters directly. Only authenticated service_role and
--   authenticated roles should call this function.

-- ============================================================
-- REVOKE PUBLIC EXECUTE ON increment_standing_auth_usage
-- ============================================================
-- CRITICAL: PUBLIC EXECUTE allows unauthenticated callers to
-- increment usage counters without proper authorization checks.

REVOKE EXECUTE ON FUNCTION increment_standing_auth_usage(p_authorization_id uuid, p_period_start timestamp with time zone, p_max_uses integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_standing_auth_usage(p_authorization_id uuid, p_period_start timestamp with time zone, p_max_uses integer) FROM anon;

-- Grant EXECUTE only to authenticated and service_role
GRANT EXECUTE ON FUNCTION increment_standing_auth_usage(p_authorization_id uuid, p_period_start timestamp with time zone, p_max_uses integer) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_standing_auth_usage(p_authorization_id uuid, p_period_start timestamp with time zone, p_max_uses integer) TO service_role;
