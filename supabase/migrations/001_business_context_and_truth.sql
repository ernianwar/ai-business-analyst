-- SALAM LIT — Phase 4: Business Context + Business Truth Foundation
-- Migration: 001_business_context_and_truth
-- Date: 2026-09-07
-- Description: Establishes business context, data sources, evidence, business facts, and context resolution foundation

-- ============================================================
-- v1.1 Core Foundation Tables
-- ============================================================

-- Users table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  locale TEXT DEFAULT 'en-MY',
  timezone TEXT DEFAULT 'Asia/Kuala_Lumpur',
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'SUSPENDED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace members
CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PENDING')),
  invited_by UUID REFERENCES users(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, user_id)
);

-- Businesses
CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ssm_registration_no TEXT,
  ssm_registered_address TEXT,
  office_phone TEXT,
  nature_of_business TEXT,
  business_type TEXT,
  industry TEXT,
  location TEXT,
  description TEXT,
  years_operating INTEGER,
  business_stage TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Business Context Tables
-- ============================================================

-- Business jurisdiction context
CREATE TABLE IF NOT EXISTS business_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  registered_country TEXT NOT NULL DEFAULT 'MY',
  operating_country TEXT NOT NULL DEFAULT 'MY',
  business_jurisdiction TEXT NOT NULL DEFAULT 'MY',
  user_country TEXT NOT NULL DEFAULT 'MY',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id)
);

-- Market profiles
CREATE TABLE IF NOT EXISTS market_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  country TEXT NOT NULL,
  region TEXT,
  locale TEXT DEFAULT 'en',
  language TEXT DEFAULT 'English',
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  date_format TEXT DEFAULT 'YYYY-MM-DD',
  number_format TEXT DEFAULT '1,234.56',
  measurement_system TEXT DEFAULT 'metric',
  target_audience TEXT,
  marketing_preferences JSONB DEFAULT '{}',
  tax_jurisdiction TEXT,
  market_status TEXT DEFAULT 'ACTIVE' CHECK (market_status IN ('ACTIVE', 'TARGETED', 'INACTIVE')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Currency context
CREATE TABLE IF NOT EXISTS currency_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  display_currency TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id)
);

-- Business goals
CREATE TABLE IF NOT EXISTS business_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  goal TEXT NOT NULL,
  target TEXT,
  timeline TEXT,
  priority TEXT DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'ABANDONED', 'PAUSED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business constraints
CREATE TABLE IF NOT EXISTS business_constraints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  constraint_type TEXT NOT NULL CHECK (constraint_type IN ('BUDGET', 'TEAM_CAPACITY', 'TIME', 'SKILLS', 'TECHNOLOGY', 'CASH', 'OPERATIONAL', 'OTHER')),
  description TEXT NOT NULL,
  severity TEXT DEFAULT 'MEDIUM' CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'RELAXED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI adoption readiness
CREATE TABLE IF NOT EXISTS ai_readiness (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  dimension TEXT NOT NULL CHECK (dimension IN ('TECHNOLOGY', 'PEOPLE', 'PROCESS', 'DATA', 'LEADERSHIP', 'BUDGET')),
  status TEXT DEFAULT 'UNKNOWN' CHECK (status IN ('UNKNOWN', 'INSUFFICIENT_DATA', 'LOW', 'MEDIUM', 'HIGH')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, dimension)
);

-- ============================================================
-- v1.2 Business Truth Layer Tables
-- ============================================================

-- Data sources registry
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('USER_INPUT', 'DOCUMENT', 'API', 'INTEGRATION', 'EXTERNAL')),
  provider TEXT,
  name TEXT NOT NULL,
  external_reference TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'ERROR', 'SYNCING')),
  trust_level TEXT DEFAULT 'MEDIUM' CHECK (trust_level IN ('HIGH', 'MEDIUM', 'LOW', 'UNTRUSTED')),
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document metadata
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  data_source_id UUID REFERENCES data_sources(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  storage_key TEXT,
  file_size BIGINT,
  file_hash TEXT,
  classification TEXT DEFAULT 'INTERNAL' CHECK (classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SENSITIVE', 'RESTRICTED')),
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PROCESSING', 'ERROR', 'ARCHIVED')),
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evidence layer
CREATE TABLE IF NOT EXISTS evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('DOCUMENT_EXCERPT', 'API_RESPONSE', 'USER_STATEMENT', 'EXTERNAL_RESEARCH', 'SYSTEM_RECORD', 'OTHER')),
  content_reference TEXT NOT NULL,
  excerpt TEXT,
  source_timestamp TIMESTAMPTZ,
  retrieved_at TIMESTAMPTZ DEFAULT NOW(),
  classification TEXT DEFAULT 'INTERNAL' CHECK (classification IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'SENSITIVE', 'RESTRICTED')),
  source_reliability TEXT DEFAULT 'MEDIUM' CHECK (source_reliability IN ('HIGH', 'MEDIUM', 'LOW', 'UNVERIFIED')),
  content_hash TEXT,
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUPERSEDED', 'RETRACTED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Business facts
CREATE TABLE IF NOT EXISTS business_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  fact_type TEXT NOT NULL CHECK (fact_type IN ('REVENUE', 'COGS', 'GROSS_PROFIT', 'OPERATING_EXPENSES', 'NET_PROFIT', 'ACCOUNTS_RECEIVABLE', 'ACCOUNTS_PAYABLE', 'CASH', 'ASSETS', 'LIABILITIES', 'LOANS', 'INVENTORY', 'CUSTOMER_COUNT', 'EMPLOYEE_COUNT', 'OTHER')),
  subject TEXT NOT NULL,
  value JSONB NOT NULL,
  unit TEXT,
  period_start DATE,
  period_end DATE,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  source_type TEXT NOT NULL CHECK (source_type IN ('USER', 'SYSTEM', 'AGENT', 'IMPORT')),
  confidence DECIMAL(3,2) DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
  evidence_strength TEXT DEFAULT 'MEDIUM' CHECK (evidence_strength IN ('STRONG', 'MODERATE', 'WEAK', 'NONE')),
  freshness_status TEXT DEFAULT 'CURRENT' CHECK (freshness_status IN ('CURRENT', 'STALE', 'UNKNOWN', 'UNAVAILABLE', 'SYNC_ERROR')),
  lifecycle_status TEXT DEFAULT 'ACTIVE' CHECK (lifecycle_status IN ('ACTIVE', 'SUPERSEDED', 'HISTORICAL', 'EXPIRED', 'RETRACTED', 'CONFLICTED')),
  created_by_type TEXT NOT NULL CHECK (created_by_type IN ('USER', 'SYSTEM', 'AGENT', 'IMPORT')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fact evidence provenance
CREATE TABLE IF NOT EXISTS fact_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fact_id UUID NOT NULL REFERENCES business_facts(id) ON DELETE CASCADE,
  evidence_id UUID NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('PRIMARY', 'SUPPORTING', 'CONFLICTING')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(fact_id, evidence_id)
);

-- Business metrics (derived from facts)
CREATE TABLE IF NOT EXISTS business_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value JSONB NOT NULL,
  unit TEXT,
  period_start DATE,
  period_end DATE,
  calculation_method TEXT,
  source_facts UUID[] DEFAULT '{}',
  confidence DECIMAL(3,2) DEFAULT 0.50 CHECK (confidence >= 0 AND confidence <= 1),
  freshness_status TEXT DEFAULT 'CURRENT' CHECK (freshness_status IN ('CURRENT', 'STALE', 'UNKNOWN', 'UNAVAILABLE', 'SYNC_ERROR')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metric sources (provenance for metrics)
CREATE TABLE IF NOT EXISTS metric_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID NOT NULL REFERENCES business_metrics(id) ON DELETE CASCADE,
  fact_id UUID NOT NULL REFERENCES business_facts(id) ON DELETE CASCADE,
  contribution_weight DECIMAL(3,2) DEFAULT 1.00,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_id, fact_id)
);

-- ============================================================
-- Context Resolution Tables
-- ============================================================

-- Resolved context cache (for performance)
CREATE TABLE IF NOT EXISTS resolved_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  context_type TEXT NOT NULL,
  context_data JSONB NOT NULL,
  resolved_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Indexes for Performance
-- ============================================================

-- Businesses
CREATE INDEX IF NOT EXISTS idx_businesses_workspace ON businesses(workspace_id);

-- Business jurisdictions
CREATE INDEX IF NOT EXISTS idx_business_jurisdictions_business ON business_jurisdictions(business_id);

-- Market profiles
CREATE INDEX IF NOT EXISTS idx_market_profiles_business ON market_profiles(business_id);
CREATE INDEX IF NOT EXISTS idx_market_profiles_country ON market_profiles(country);

-- Currency contexts
CREATE INDEX IF NOT EXISTS idx_currency_contexts_business ON currency_contexts(business_id);

-- Business goals
CREATE INDEX IF NOT EXISTS idx_business_goals_business ON business_goals(business_id);

-- Business constraints
CREATE INDEX IF NOT EXISTS idx_business_constraints_business ON business_constraints(business_id);

-- AI readiness
CREATE INDEX IF NOT EXISTS idx_ai_readiness_business ON ai_readiness(business_id);

-- Data sources
CREATE INDEX IF NOT EXISTS idx_data_sources_business ON data_sources(business_id);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_business ON documents(business_id);
CREATE INDEX IF NOT EXISTS idx_documents_data_source ON documents(data_source_id);

-- Evidence
CREATE INDEX IF NOT EXISTS idx_evidence_business ON evidence(business_id);
CREATE INDEX IF NOT EXISTS idx_evidence_data_source ON evidence(data_source_id);
CREATE INDEX IF NOT EXISTS idx_evidence_document ON evidence(document_id);

-- Business facts
CREATE INDEX IF NOT EXISTS idx_business_facts_business ON business_facts(business_id);
CREATE INDEX IF NOT EXISTS idx_business_facts_type ON business_facts(fact_type);
CREATE INDEX IF NOT EXISTS idx_business_facts_lifecycle ON business_facts(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_business_facts_period ON business_facts(period_start, period_end);

-- Fact evidence
CREATE INDEX IF NOT EXISTS idx_fact_evidence_fact ON fact_evidence(fact_id);
CREATE INDEX IF NOT EXISTS idx_fact_evidence_evidence ON fact_evidence(evidence_id);

-- Business metrics
CREATE INDEX IF NOT EXISTS idx_business_metrics_business ON business_metrics(business_id);
CREATE INDEX IF NOT EXISTS idx_business_metrics_type ON business_metrics(metric_type);

-- Metric sources
CREATE INDEX IF NOT EXISTS idx_metric_sources_metric ON metric_sources(metric_id);
CREATE INDEX IF NOT EXISTS idx_metric_sources_fact ON metric_sources(fact_id);

-- Resolved contexts
CREATE INDEX IF NOT EXISTS idx_resolved_contexts_business ON resolved_contexts(business_id);
CREATE INDEX IF NOT EXISTS idx_resolved_contexts_user ON resolved_contexts(user_id);

-- ============================================================
-- Row Level Security (RLS) Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_jurisdictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE currency_contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE metric_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE resolved_contexts ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Workspace members can view workspace
CREATE POLICY "Workspace members can view workspace" ON workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Workspace members can view other members
CREATE POLICY "Workspace members can view members" ON workspace_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members AS wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.status = 'ACTIVE'
    )
  );

-- Business access through workspace membership
CREATE POLICY "Workspace members can view businesses" ON businesses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = businesses.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Business jurisdiction access
CREATE POLICY "Business jurisdiction access" ON business_jurisdictions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = business_jurisdictions.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Market profile access
CREATE POLICY "Market profile access" ON market_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = market_profiles.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Currency context access
CREATE POLICY "Currency context access" ON currency_contexts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = currency_contexts.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Business goals access
CREATE POLICY "Business goals access" ON business_goals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = business_goals.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Business constraints access
CREATE POLICY "Business constraints access" ON business_constraints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = business_constraints.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- AI readiness access
CREATE POLICY "AI readiness access" ON ai_readiness
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = ai_readiness.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Data sources access
CREATE POLICY "Data sources access" ON data_sources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = data_sources.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Documents access
CREATE POLICY "Documents access" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = documents.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Evidence access
CREATE POLICY "Evidence access" ON evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = evidence.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Business facts access
CREATE POLICY "Business facts access" ON business_facts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = business_facts.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Fact evidence access
CREATE POLICY "Fact evidence access" ON fact_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM business_facts
      JOIN businesses ON businesses.id = business_facts.business_id
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE business_facts.id = fact_evidence.fact_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Business metrics access
CREATE POLICY "Business metrics access" ON business_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = business_metrics.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Metric sources access
CREATE POLICY "Metric sources access" ON metric_sources
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM business_metrics
      JOIN businesses ON businesses.id = business_metrics.business_id
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE business_metrics.id = metric_sources.metric_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- Resolved contexts access
CREATE POLICY "Resolved contexts access" ON resolved_contexts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM businesses
      JOIN workspace_members ON workspace_members.workspace_id = businesses.workspace_id
      WHERE businesses.id = resolved_contexts.business_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.status = 'ACTIVE'
    )
  );

-- ============================================================
-- Functions for updated_at timestamps
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspace_members_updated_at BEFORE UPDATE ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_jurisdictions_updated_at BEFORE UPDATE ON business_jurisdictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_market_profiles_updated_at BEFORE UPDATE ON market_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_currency_contexts_updated_at BEFORE UPDATE ON currency_contexts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_goals_updated_at BEFORE UPDATE ON business_goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_constraints_updated_at BEFORE UPDATE ON business_constraints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_readiness_updated_at BEFORE UPDATE ON ai_readiness
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_data_sources_updated_at BEFORE UPDATE ON data_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_facts_updated_at BEFORE UPDATE ON business_facts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_business_metrics_updated_at BEFORE UPDATE ON business_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
