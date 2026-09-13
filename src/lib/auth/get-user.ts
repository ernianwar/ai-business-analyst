/**
 * SALAM LIT — Authenticated User Resolver
 *
 * Server-side utility to identify the authenticated user from the
 * Supabase Auth session. Identity is derived from the verified JWT,
 * NEVER from client-supplied query parameters.
 *
 * Phase 14.1: Authentication Foundation
 */

import { createClient } from "@/lib/db/supabase-server";

/**
 * Authenticated user identity.
 */
export interface AuthenticatedUser {
  /** Supabase Auth user ID (UUID) */
  id: string;
  /** Email address from Supabase Auth */
  email: string | null;
  /** Display name from user metadata or public.users */
  display_name: string | null;
}

/**
 * Get the authenticated user from the current request session.
 *
 * Returns null if no valid session exists.
 * Identity comes from the verified Supabase Auth JWT.
 *
 * Usage in Route Handlers:
 * ```ts
 * const user = await getAuthenticatedUser();
 * if (!user) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * ```
 *
 * Usage in Server Components:
 * ```ts
 * const user = await getAuthenticatedUser();
 * if (!user) {
 *   redirect("/login");
 * }
 * ```
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    display_name:
      user.user_metadata?.display_name ??
      user.user_metadata?.name ??
      null,
  };
}

/**
 * Get the authenticated user ID or throw.
 *
 * Use in contexts where authentication is mandatory.
 * Throws if no valid session exists.
 */
export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

/**
 * Get the authenticated user ID as a string.
 *
 * Returns null if not authenticated.
 * Convenience wrapper for cases that only need the ID.
 */
export async function getAuthenticatedUserId(): Promise<string | null> {
  const user = await getAuthenticatedUser();
  return user?.id ?? null;
}
