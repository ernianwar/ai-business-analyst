-- SALAM LIT — Phase 13B.1: Decision + Approval Persistence Hardening
-- Migration: 003_decision_approval_persistence
-- Date: 2026-09-08
-- Description: Persists decisions, approvals, standing authorizations, and approval audit events.
--   Derived from actual TypeScript interfaces in runtime/types.ts and in-memory services.

-- ============================================================
-- DECISIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  recommendation_id TEXT NOT NULL,
  investigation_id TEXT,
  trigger_id TEXT,
  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'APPROVE', 'APPROVE_WITH_CHANGES', 'REJECT', 'INVESTIGATE_FURTHER'
  )),
  decision_maker TEXT NOT NULL,
  reason TEXT NOT NULL,
  original_scope TEXT,
  modified_scope TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'CANCELLED')),
  superseded_by TEXT,
  decision_context JSONB DEFAULT '{}',
  decided_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_decisions_business_id ON decisions(business_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
CREATE INDEX IF NOT EXISTS idx_decisions_decision_type ON decisions(decision_type);
CREATE INDEX IF NOT EXISTS idx_decisions_recommendation_id ON decisions(recommendation_id);

-- ============================================================
-- APPROVALS
-- ============================================================

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  decision_id TEXT,
  requested_by TEXT NOT NULL,
  requested_by_type TEXT NOT NULL CHECK (requested_by_type IN ('USER', 'AGENT')),
  action_type TEXT NOT NULL,
  action_description TEXT NOT NULL,
  scope JSONB NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('L0', 'L1', 'L2', 'L3', 'L4')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED'
  )),
  approver_id TEXT,
  approval_reason TEXT,
  rejection_reason TEXT,
  standing_authorization_id TEXT,
  requested_at TIMESTAMPTZ NOT NULL,
  approved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_business_id ON approvals(business_id);
CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
CREATE INDEX IF NOT EXISTS idx_approvals_action_type ON approvals(action_type);
CREATE INDEX IF NOT EXISTS idx_approvals_risk_level ON approvals(risk_level);

-- ============================================================
-- STANDING AUTHORIZATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS standing_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  authorized_by TEXT NOT NULL,
  authorized_agent TEXT,
  scope JSONB NOT NULL,
  max_amount_per_use NUMERIC NOT NULL,
  max_amount_per_period NUMERIC NOT NULL,
  period TEXT NOT NULL,
  max_uses_per_period INTEGER,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_by TEXT,
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_standing_auth_business_id ON standing_authorizations(business_id);
CREATE INDEX IF NOT EXISTS idx_standing_auth_active ON standing_authorizations(active);
CREATE INDEX IF NOT EXISTS idx_standing_auth_revoked ON standing_authorizations(revoked);

-- ============================================================
-- APPROVAL AUDIT EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS approval_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  approval_id TEXT,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('USER', 'AGENT', 'SYSTEM')),
  details JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_audit_business_id ON approval_audit_events(business_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_approval_id ON approval_audit_events(approval_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_event_type ON approval_audit_events(event_type);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE standing_authorizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_audit_events ENABLE ROW LEVEL SECURITY;

-- Decisions: workspace members can view decisions for their businesses
CREATE POLICY "Decisions access" ON decisions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = decisions.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Approvals: join through businesses → workspace_members
CREATE POLICY "Approvals access" ON approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = approvals.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Standing authorizations: join through businesses → workspace_members
CREATE POLICY "Standing authorizations access" ON standing_authorizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = standing_authorizations.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Approval audit events: join through businesses → workspace_members
CREATE POLICY "Approval audit events access" ON approval_audit_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = approval_audit_events.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

CREATE TRIGGER update_decisions_updated_at BEFORE UPDATE ON decisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_approvals_updated_at BEFORE UPDATE ON approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_standing_authorizations_updated_at BEFORE UPDATE ON standing_authorizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
