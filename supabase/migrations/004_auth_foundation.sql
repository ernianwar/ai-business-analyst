-- SALAM LIT — Phase 14.1: Authentication Foundation
-- Migration: 004_auth_foundation
-- Date: 2026-09-09
-- Description: Adds onboarding_status to users, website to businesses,
--   and a secure trigger to auto-create public.users rows on Supabase Auth signup.

-- ============================================================
-- 1. Add onboarding_status to users
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_status TEXT NOT NULL DEFAULT 'INVITED'
  CHECK (onboarding_status IN ('INVITED', 'WORKSPACE_CREATED', 'BUSINESS_CREATED', 'CONTEXT_CONFIGURED', 'COMPLETE'));

-- ============================================================
-- 2. Add website to businesses
-- ============================================================

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS website TEXT;

-- ============================================================
-- 3. Auth user creation trigger
-- ============================================================

-- SECURITY DEFINER: runs with owner privileges (the function creator).
-- search_path is explicitly set to prevent search_path manipulation.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, display_name, avatar_url, locale, timezone, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NULL),
    COALESCE(NEW.raw_user_meta_data->>'locale', 'en-MY'),
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'Asia/Kuala_Lumpur'),
    'ACTIVE'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Create the trigger on auth.users
-- Only fires on INSERT, not UPDATE or DELETE.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
