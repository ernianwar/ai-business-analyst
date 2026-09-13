-- SALAM LIT — Phase 15.4.3: AI Runtime Security
-- Migration: 009_ai_runtime_security
-- Date: 2026-09-12
-- Description: Adds database tables for AI security telemetry,
--   usage tracking, and rate limit state. Enables persistent
--   AI security monitoring and cost governance.

-- ============================================================
-- AI SECURITY EVENTS
-- ============================================================
-- Structured security telemetry for the AI runtime.
-- Records prompt injection detections, rate limit events,
-- input/output rejections, and other security-relevant events.

CREATE TABLE IF NOT EXISTS ai_security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  user_id UUID,
  workspace_id UUID,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  agent_key TEXT,
  endpoint TEXT,
  provider TEXT,
  model TEXT,
  correlation_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_ai_security_events_business ON ai_security_events(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_security_events_user ON ai_security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_security_events_correlation ON ai_security_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ai_security_events_type ON ai_security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_ai_security_events_severity ON ai_security_events(severity);
CREATE INDEX IF NOT EXISTS idx_ai_security_events_created ON ai_security_events(created_at);

-- ============================================================
-- AI USAGE RECORDS
-- ============================================================
-- Authoritative usage tracking for AI requests.
-- Records every AI interaction for cost analysis and budget enforcement.

CREATE TABLE IF NOT EXISTS ai_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  agent_key TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  estimated_cost NUMERIC(10, 6),
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILURE', 'RATE_LIMITED', 'TIMEOUT', 'UNKNOWN')),
  failure_type TEXT,
  duration_ms INTEGER NOT NULL,
  is_fallback BOOLEAN DEFAULT FALSE,
  provider_transitions INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for usage queries
CREATE INDEX IF NOT EXISTS idx_ai_usage_business ON ai_usage_records(business_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage_records(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_workspace ON ai_usage_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_agent ON ai_usage_records(agent_key);
CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage_records(provider);
CREATE INDEX IF NOT EXISTS idx_ai_usage_status ON ai_usage_records(status);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage_records(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_correlation ON ai_usage_records(correlation_id);

-- ============================================================
-- RATE LIMIT STATE
-- ============================================================
-- Persistent rate limit state for AI endpoints.
-- Prevents rate limit bypass through server restart.

CREATE TABLE IF NOT EXISTS ai_rate_limit_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_key TEXT NOT NULL UNIQUE,
  count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups during rate limit checks
CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_key ON ai_rate_limit_state(limit_key);
CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_window ON ai_rate_limit_state(window_start);

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- AI Security Events: workspace members can read their business's events
ALTER TABLE ai_security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI security events workspace access" ON ai_security_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_security_events.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- AI Usage Records: workspace members can read their business's usage
ALTER TABLE ai_usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI usage records workspace access" ON ai_usage_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = ai_usage_records.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Rate limit state: no user-level access (server-only via service role)
ALTER TABLE ai_rate_limit_state ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- REVOKE BROAD PERMISSIONS
-- ============================================================

-- Revoke PUBLIC access to AI security tables
REVOKE ALL ON ai_security_events FROM PUBLIC;
REVOKE ALL ON ai_usage_records FROM PUBLIC;
REVOKE ALL ON ai_rate_limit_state FROM PUBLIC;

-- Grant only to authenticated (for RLS queries) and service_role (for writes)
GRANT SELECT ON ai_security_events TO authenticated;
GRANT ALL ON ai_security_events TO service_role;

GRANT SELECT ON ai_usage_records TO authenticated;
GRANT ALL ON ai_usage_records TO service_role;

GRANT ALL ON ai_rate_limit_state TO service_role;
