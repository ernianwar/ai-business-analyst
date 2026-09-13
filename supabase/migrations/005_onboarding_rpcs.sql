-- SALAM LIT — Phase 14.2: Onboarding RPC Functions
-- Migration: 005_onboarding_rpcs
-- Date: 2026-09-09
-- Description: Creates workspace and business onboarding via secure RPC functions.
--   Functions use SECURITY DEFINER to bypass RLS while enforcing authorization checks.

-- ============================================================
-- 1. create_workspace_with_owner
-- ============================================================
-- Creates a workspace and adds the authenticated user as OWNER.
-- Updates user's onboarding_status to WORKSPACE_CREATED.

CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  p_user_id UUID,
  p_name TEXT,
  p_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_member_id UUID;
BEGIN
  -- Validate inputs
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'Workspace slug is required';
  END IF;

  -- Verify user exists
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Create workspace
  INSERT INTO public.workspaces (name, slug, created_by)
  VALUES (trim(p_name), trim(p_slug), p_user_id)
  RETURNING id INTO v_workspace_id;

  -- Add user as OWNER
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status, invited_by, joined_at)
  VALUES (v_workspace_id, p_user_id, 'OWNER', 'ACTIVE', p_user_id, NOW())
  RETURNING id INTO v_member_id;

  -- Update onboarding status
  UPDATE public.users
  SET onboarding_status = 'WORKSPACE_CREATED',
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'workspace_id', v_workspace_id,
    'member_id', v_member_id,
    'onboarding_status', 'WORKSPACE_CREATED'
  );
END;
$$;

-- ============================================================
-- 2. create_business_with_context
-- ============================================================
-- Creates a business in the specified workspace with default context.
-- Verifies the user is OWNER or ADMIN of the workspace.
-- Updates user's onboarding_status to BUSINESS_CREATED.

CREATE OR REPLACE FUNCTION public.create_business_with_context(
  p_workspace_id UUID,
  p_user_id UUID,
  p_name TEXT,
  p_industry TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_id UUID;
  v_member_role TEXT;
BEGIN
  -- Validate inputs
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  -- Verify workspace exists
  IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'Workspace not found or inactive';
  END IF;

  -- Verify user has OWNER or ADMIN role in workspace
  SELECT role INTO v_member_role
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = p_user_id
    AND status = 'ACTIVE';

  IF v_member_role IS NULL THEN
    RAISE EXCEPTION 'User is not a member of this workspace';
  END IF;

  IF v_member_role NOT IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'Only workspace owners or admins can create businesses';
  END IF;

  -- Create business
  INSERT INTO public.businesses (workspace_id, name, industry, description, website)
  VALUES (p_workspace_id, trim(p_name), p_industry, p_description, p_website)
  RETURNING id INTO v_business_id;

  -- Create default jurisdiction (Malaysia)
  INSERT INTO public.business_jurisdictions (business_id)
  VALUES (v_business_id);

  -- Create default currency context (USD)
  INSERT INTO public.currency_contexts (business_id)
  VALUES (v_business_id);

  -- Create default market profile (Malaysia)
  INSERT INTO public.market_profiles (business_id, country)
  VALUES (v_business_id, 'MY');

  -- Update onboarding status
  UPDATE public.users
  SET onboarding_status = 'BUSINESS_CREATED',
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'business_id', v_business_id,
    'onboarding_status', 'BUSINESS_CREATED'
  );
END;
$$;

-- ============================================================
-- 3. get_user_context
-- ============================================================
-- Returns the authenticated user's workspace, business, and role.
-- Returns NULL if no workspace/business is associated.

CREATE OR REPLACE FUNCTION public.get_user_context(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id UUID;
  v_business_id UUID;
  v_role TEXT;
  v_onboarding_status TEXT;
BEGIN
  -- Get user's onboarding status
  SELECT onboarding_status INTO v_onboarding_status
  FROM public.users
  WHERE id = p_user_id;

  -- Get workspace membership
  SELECT wm.workspace_id, wm.role
  INTO v_workspace_id, v_role
  FROM public.workspace_members wm
  WHERE wm.user_id = p_user_id
    AND wm.status = 'ACTIVE'
  ORDER BY wm.created_at ASC
  LIMIT 1;

  -- Get business for workspace (first active business)
  IF v_workspace_id IS NOT NULL THEN
    SELECT b.id INTO v_business_id
    FROM public.businesses b
    WHERE b.workspace_id = v_workspace_id
      AND b.status = 'ACTIVE'
    ORDER BY b.created_at ASC
    LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'workspace_id', v_workspace_id,
    'business_id', v_business_id,
    'role', v_role,
    'onboarding_status', v_onboarding_status
  );
END;
$$;
