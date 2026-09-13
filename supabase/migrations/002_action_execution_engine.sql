-- SALAM LIT — Phase 13B: Persistent Action + Execution State Engine
-- Migration: 002_action_execution_engine
-- Date: 2026-09-08
-- Description: Persists actions, executions, execution outcomes, and action audit events.
--   Establishes database-backed idempotency via unique constraints.
--   Follows existing RLS patterns (auth.uid() → workspace_members → businesses).

-- ============================================================
-- ACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  decision_id UUID,
  approval_id UUID,
  recommendation_id UUID,
  requested_by TEXT NOT NULL,
  requested_by_type TEXT NOT NULL CHECK (requested_by_type IN ('USER', 'AGENT')),
  agent_key TEXT,
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_reference TEXT,
  parameters JSONB DEFAULT '{}',
  risk_level TEXT NOT NULL CHECK (risk_level IN ('L0', 'L1', 'L2', 'L3', 'L4')),
  authorization_result JSONB,
  status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK (status IN (
    'PROPOSED', 'AUTHORIZED', 'QUEUED', 'EXECUTING',
    'COMPLETED', 'FAILED', 'BLOCKED', 'CANCELLED'
  )),
  blocked_reason TEXT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  authorized_at TIMESTAMPTZ,
  queued_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_actions_business_id ON actions(business_id);
CREATE INDEX IF NOT EXISTS idx_actions_status ON actions(status);
CREATE INDEX IF NOT EXISTS idx_actions_action_type ON actions(action_type);

-- ============================================================
-- EXECUTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  external_reference TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'UNKNOWN'
  )),
  request_metadata JSONB DEFAULT '{}',
  response_metadata JSONB DEFAULT '{}',
  error_code TEXT,
  error_message TEXT,
  reconciliation_status TEXT NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (reconciliation_status IN (
    'NOT_REQUIRED', 'PENDING', 'RECONCILED', 'UNRESOLVED'
  )),
  reconciled_at TIMESTAMPTZ,
  reconciliation_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- CRITICAL: Unique constraint enforces idempotency at the database level.
-- Two concurrent requests with the same idempotency_key cannot both insert.
-- The second INSERT will hit the unique constraint and must be handled as a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_executions_idempotency_key ON executions(idempotency_key);

CREATE INDEX IF NOT EXISTS idx_executions_action_id ON executions(action_id);
CREATE INDEX IF NOT EXISTS idx_executions_business_id ON executions(business_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);

-- ============================================================
-- EXECUTION OUTCOMES
-- ============================================================

CREATE TABLE IF NOT EXISTS execution_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action_id UUID NOT NULL REFERENCES actions(id) ON DELETE CASCADE,
  execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
  outcome_type TEXT NOT NULL CHECK (outcome_type IN (
    'SUCCESS', 'PARTIAL_SUCCESS', 'ROLLBACK_SUCCESS', 'ROLLBACK_FAILED'
  )),
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  financial_impact NUMERIC,
  currency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_execution_outcomes_action_id ON execution_outcomes(action_id);
CREATE INDEX IF NOT EXISTS idx_execution_outcomes_execution_id ON execution_outcomes(execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_outcomes_business_id ON execution_outcomes(business_id);

-- ============================================================
-- ACTION AUDIT EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS action_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  action_id UUID,
  execution_id UUID,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('USER', 'AGENT', 'SYSTEM')),
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_audit_events_business_id ON action_audit_events(business_id);
CREATE INDEX IF NOT EXISTS idx_action_audit_events_action_id ON action_audit_events(action_id);
CREATE INDEX IF NOT EXISTS idx_action_audit_events_event_type ON action_audit_events(event_type);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE execution_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_audit_events ENABLE ROW LEVEL SECURITY;

-- Actions: workspace members can view actions for their businesses
CREATE POLICY "Actions access" ON actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = actions.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Executions: join through actions → businesses → workspace_members
CREATE POLICY "Executions access" ON executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM actions
      JOIN businesses ON businesses.id = actions.business_id
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE actions.id = executions.action_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Execution outcomes: join through executions → actions → businesses → workspace_members
CREATE POLICY "Execution outcomes access" ON execution_outcomes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM executions
      JOIN actions ON actions.id = executions.action_id
      JOIN businesses ON businesses.id = actions.business_id
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE executions.id = execution_outcomes.execution_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Audit events: join through businesses → workspace_members
CREATE POLICY "Action audit events access" ON action_audit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = action_audit_events.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER update_actions_updated_at BEFORE UPDATE ON actions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_executions_updated_at BEFORE UPDATE ON executions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
