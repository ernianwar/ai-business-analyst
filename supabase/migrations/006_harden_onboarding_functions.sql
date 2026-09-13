-- SALAM LIT — Phase 14.2 Security Fix: Harden Onboarding Functions
-- Migration: 006_harden_onboarding_functions
-- Date: 2026-09-09
-- Description: Replaces vulnerable SECURITY DEFINER functions from migration 005.
--   All functions now derive identity exclusively from auth.uid().
--   Removes caller-supplied user_id parameters.
--   Revokes anon EXECUTE, grants only to authenticated.

-- ============================================================
-- 1. Drop old vulnerable function signatures
-- ============================================================
-- These accept p_user_id from the caller — a critical vulnerability.
-- Must be dropped BEFORE creating replacements to avoid overload confusion.

DROP FUNCTION IF EXISTS public.create_workspace_with_owner(uuid, text, text);
DROP FUNCTION IF EXISTS public.create_business_with_context(uuid, uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.get_user_context(uuid);

-- ============================================================
-- 2. create_workspace_with_owner (HARDENED)
-- ============================================================
-- Identity: auth.uid() only — no p_user_id parameter.
-- Creates workspace + OWNER membership for authenticated user.
-- Updates onboarding_status for authenticated user only.

CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  p_name TEXT,
  p_slug TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_workspace_id UUID;
  v_member_id UUID;
BEGIN
  -- Fail closed: require authenticated identity
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: auth.uid() is NULL';
  END IF;

  -- Validate inputs
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'Workspace slug is required';
  END IF;

  -- Verify user exists in public.users
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Create workspace (created_by = authenticated user only)
  INSERT INTO public.workspaces (name, slug, created_by)
  VALUES (trim(p_name), trim(p_slug), v_user_id)
  RETURNING id INTO v_workspace_id;

  -- Add authenticated user as OWNER (not invitable — self-ownership)
  INSERT INTO public.workspace_members (workspace_id, user_id, role, status, invited_by, joined_at)
  VALUES (v_workspace_id, v_user_id, 'OWNER', 'ACTIVE', v_user_id, NOW())
  RETURNING id INTO v_member_id;

  -- Update onboarding_status for authenticated user only
  UPDATE public.users
  SET onboarding_status = 'WORKSPACE_CREATED',
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'workspace_id', v_workspace_id,
    'member_id', v_member_id,
    'onboarding_status', 'WORKSPACE_CREATED'
  );
END;
$$;

-- ============================================================
-- 3. get_user_context (HARDENED)
-- ============================================================
-- Identity: auth.uid() only — no p_user_id parameter.
-- Returns only the authenticated user's authorized context.

CREATE OR REPLACE FUNCTION public.get_user_context()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_workspace_id UUID;
  v_business_id UUID;
  v_role TEXT;
  v_onboarding_status TEXT;
BEGIN
  -- Fail closed: require authenticated identity
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: auth.uid() is NULL';
  END IF;

  -- Get user's onboarding status
  SELECT onboarding_status INTO v_onboarding_status
  FROM public.users
  WHERE id = v_user_id;

  -- Get workspace membership (authenticated user only)
  SELECT wm.workspace_id, wm.role
  INTO v_workspace_id, v_role
  FROM public.workspace_members wm
  WHERE wm.user_id = v_user_id
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
    'user_id', v_user_id,
    'workspace_id', v_workspace_id,
    'business_id', v_business_id,
    'role', v_role,
    'onboarding_status', v_onboarding_status
  );
END;
$$;

-- ============================================================
-- 4. create_business_with_context (HARDENED)
-- ============================================================
-- Identity: auth.uid() only — no p_user_id parameter.
-- Verifies authenticated user is OWNER/ADMIN of p_workspace_id.
-- Creates business + default context in that workspace.

CREATE OR REPLACE FUNCTION public.create_business_with_context(
  p_workspace_id UUID,
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
  v_user_id UUID;
  v_business_id UUID;
  v_member_role TEXT;
BEGIN
  -- Fail closed: require authenticated identity
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: auth.uid() is NULL';
  END IF;

  -- Validate inputs
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN
    RAISE EXCEPTION 'Business name is required';
  END IF;

  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Workspace ID is required';
  END IF;

  -- Verify workspace exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Workspace not found or inactive';
  END IF;

  -- Verify AUTHENTICATED user has OWNER or ADMIN role in workspace
  -- This is the critical security check: uses auth.uid(), not caller-supplied ID
  SELECT wm.role INTO v_member_role
  FROM public.workspace_members wm
  WHERE wm.workspace_id = p_workspace_id
    AND wm.user_id = v_user_id
    AND wm.status = 'ACTIVE';

  IF v_member_role IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this workspace';
  END IF;

  IF v_member_role NOT IN ('OWNER', 'ADMIN') THEN
    RAISE EXCEPTION 'Only workspace owners or admins can create businesses';
  END IF;

  -- Create business in the specified workspace
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

  -- Update onboarding_status for authenticated user only
  UPDATE public.users
  SET onboarding_status = 'BUSINESS_CREATED',
      updated_at = NOW()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'business_id', v_business_id,
    'onboarding_status', 'BUSINESS_CREATED'
  );
END;
$$;

-- ============================================================
-- 5. EXECUTE Privileges — Fail Closed
-- ============================================================
-- Revoke from PUBLIC first (removes inherited EXECUTE).
-- Then revoke from anon (explicit belt-and-suspenders).
-- Grant ONLY to authenticated.
-- Do NOT grant to service_role — admin pathway is separate.

REVOKE EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_context() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_business_with_context(uuid, text, text, text, text) FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_context() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_business_with_context(uuid, text, text, text, text) FROM anon;

GRANT EXECUTE ON FUNCTION public.create_workspace_with_owner(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_business_with_context(uuid, text, text, text, text) TO authenticated;

-- ============================================================
-- 6. Verify no old vulnerable signatures remain (non-blocking)
-- ============================================================
-- Uses RAISE NOTICE — does not abort if old signatures found.
-- Actual verification runs as separate API call post-deployment.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_workspace_with_owner'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid,text,text'
  ) THEN
    RAISE WARNING 'VERIFY: old signature create_workspace_with_owner(uuid,text,text) still exists';
  ELSE
    RAISE NOTICE 'VERIFY: old signature create_workspace_with_owner(uuid,text,text) removed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'create_business_with_context'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid,uuid,text,text,text,text'
  ) THEN
    RAISE WARNING 'VERIFY: old signature create_business_with_context(uuid,uuid,text,text,text,text) still exists';
  ELSE
    RAISE NOTICE 'VERIFY: old signature create_business_with_context(uuid,uuid,text,text,text,text) removed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.proname = 'get_user_context'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid'
  ) THEN
    RAISE WARNING 'VERIFY: old signature get_user_context(uuid) still exists';
  ELSE
    RAISE NOTICE 'VERIFY: old signature get_user_context(uuid) removed';
  END IF;
END;
$$;

-- ============================================================
-- 7. Verify EXECUTE Privileges (non-blocking)
-- ============================================================
-- Uses RAISE NOTICE/WARNING — does not abort migration.
-- Actual verification runs as separate API call post-deployment.

DO $$
DECLARE
  v_FUNC_1 TEXT := 'public.create_workspace_with_owner(text,text)';
  v_FUNC_2 TEXT := 'public.get_user_context()';
  v_FUNC_3 TEXT := 'public.create_business_with_context(uuid,text,text,text,text)';
  v_proacl TEXT;
  v_issues INTEGER := 0;
BEGIN
  -- PUBLIC check via pg_proc.proacl
  SELECT array_to_string(proacl, ',') INTO v_proacl
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'create_workspace_with_owner'
    AND pg_get_function_identity_arguments(p.oid) = 'text,text';
  IF v_proacl LIKE '%=X%' THEN
    RAISE WARNING 'PRIVILEGE: PUBLIC has EXECUTE on %', v_FUNC_1;
    v_issues := v_issues + 1;
  END IF;

  SELECT array_to_string(proacl, ',') INTO v_proacl
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'get_user_context'
    AND pg_get_function_identity_arguments(p.oid) = '';
  IF v_proacl LIKE '%=X%' THEN
    RAISE WARNING 'PRIVILEGE: PUBLIC has EXECUTE on %', v_FUNC_2;
    v_issues := v_issues + 1;
  END IF;

  SELECT array_to_string(proacl, ',') INTO v_proacl
  FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public' AND p.proname = 'create_business_with_context'
    AND pg_get_function_identity_arguments(p.oid) = 'uuid,text,text,text,text';
  IF v_proacl LIKE '%=X%' THEN
    RAISE WARNING 'PRIVILEGE: PUBLIC has EXECUTE on %', v_FUNC_3;
    v_issues := v_issues + 1;
  END IF;

  -- anon check
  IF has_function_privilege('anon', v_FUNC_1, 'EXECUTE') THEN
    RAISE WARNING 'PRIVILEGE: anon has EXECUTE on %', v_FUNC_1;
    v_issues := v_issues + 1;
  END IF;
  IF has_function_privilege('anon', v_FUNC_2, 'EXECUTE') THEN
    RAISE WARNING 'PRIVILEGE: anon has EXECUTE on %', v_FUNC_2;
    v_issues := v_issues + 1;
  END IF;
  IF has_function_privilege('anon', v_FUNC_3, 'EXECUTE') THEN
    RAISE WARNING 'PRIVILEGE: anon has EXECUTE on %', v_FUNC_3;
    v_issues := v_issues + 1;
  END IF;

  -- authenticated check (must have)
  IF NOT has_function_privilege('authenticated', v_FUNC_1, 'EXECUTE') THEN
    RAISE WARNING 'PRIVILEGE: authenticated lacks EXECUTE on %', v_FUNC_1;
    v_issues := v_issues + 1;
  END IF;
  IF NOT has_function_privilege('authenticated', v_FUNC_2, 'EXECUTE') THEN
    RAISE WARNING 'PRIVILEGE: authenticated lacks EXECUTE on %', v_FUNC_2;
    v_issues := v_issues + 1;
  END IF;
  IF NOT has_function_privilege('authenticated', v_FUNC_3, 'EXECUTE') THEN
    RAISE WARNING 'PRIVILEGE: authenticated lacks EXECUTE on %', v_FUNC_3;
    v_issues := v_issues + 1;
  END IF;

  -- service_role check (must NOT have)
  IF has_function_privilege('service_role', v_FUNC_1, 'EXECUTE') THEN
    RAISE WARNING 'PRIVILEGE: service_role has EXECUTE on %', v_FUNC_1;
    v_issues := v_issues + 1;
  END IF;
  IF has_function_privilege('service_role', v_FUNC_2, 'EXECUTE') THEN
    RAISE WARNING 'PRIVILEGE: service_role has EXECUTE on %', v_FUNC_2;
    v_issues := v_issues + 1;
  END IF;
  IF has_function_privilege('service_role', v_FUNC_3, 'EXECUTE') THEN
    RAISE WARNING 'PRIVILEGE: service_role has EXECUTE on %', v_FUNC_3;
    v_issues := v_issues + 1;
  END IF;

  IF v_issues > 0 THEN
    RAISE WARNING 'Migration 006 privilege verification: % issues found (see warnings above)', v_issues;
  ELSE
    RAISE NOTICE 'Migration 006 privilege verification PASSED: PUBLIC=no, anon=no, authenticated=YES, service_role=no';
  END IF;
END;
$$;
