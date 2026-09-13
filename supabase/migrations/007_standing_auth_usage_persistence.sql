-- SALAM LIT — Phase 15.2A: Standing Authorization Usage Persistence
-- Migration: 007_standing_auth_usage_persistence
-- Date: 2026-09-10
-- Description: Eliminates CRITICAL security gap where standing authorization
--   usage counters were stored only in memory and reset on server restart.
--   A standing authorization with max_uses_per_period=5 could be used 5
--   additional times after each restart. This migration adds persistent,
--   concurrency-safe usage tracking.

-- ============================================================
-- STANDING AUTH USAGE
-- ============================================================
-- Tracks per-period usage counts for standing authorizations.
-- One row per authorization_id + period_start combination.
-- Atomic enforcement via SELECT ... FOR UPDATE prevents concurrent overuse.

CREATE TABLE IF NOT EXISTS standing_auth_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  authorization_id UUID NOT NULL REFERENCES standing_authorizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One usage record per authorization per period boundary
  UNIQUE(authorization_id, period_start)
);

-- Index for fast lookups during authorization matching
CREATE INDEX IF NOT EXISTS idx_standing_auth_usage_auth_id ON standing_auth_usage(authorization_id);
CREATE INDEX IF NOT EXISTS idx_standing_auth_usage_period ON standing_auth_usage(period_start);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE standing_auth_usage ENABLE ROW LEVEL SECURITY;

-- Usage records accessible to workspace members who can see the parent authorization
CREATE POLICY "Standing auth usage access" ON standing_auth_usage
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM standing_authorizations sa
      JOIN businesses ON businesses.id = sa.business_id
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE sa.id = standing_auth_usage.authorization_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE TRIGGER update_standing_auth_usage_updated_at BEFORE UPDATE ON standing_auth_usage
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
