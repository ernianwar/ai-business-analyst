/**
 * SALAM LIT — Authenticated Context Resolution
 *
 * Resolves the authenticated user's business context from the Supabase session.
 * Identity flows from JWT → getAuthenticatedUser() → get_user_context() RPC.
 *
 * NEVER accepts user_id, workspace_id, or business_id from client sources.
 * Identity is derived exclusively from the verified Supabase Auth JWT.
 *
 * Phase 14.2: Workspace & Business Onboarding
 * Phase 15.3: Test override hardened with NODE_ENV guard
 */

import { createClient } from "@/lib/db/supabase-server";
import { getAuthenticatedUser, type AuthenticatedUser } from "@/lib/auth/get-user";

/**
 * Onboarding status progression.
 */
export type OnboardingStatus =
  | "INVITED"
  | "WORKSPACE_CREATED"
  | "BUSINESS_CREATED"
  | "CONTEXT_CONFIGURED"
  | "COMPLETE";

/**
 * Resolved authenticated context.
 *
 * Contains only the information required by downstream application layers.
 * All fields are derived from the verified JWT and database queries.
 */
export interface AuthenticatedContext {
  /** Authenticated user ID (from JWT) */
  user_id: string;
  /** User's email (from JWT) */
  email: string | null;
  /** User's display name (from JWT metadata) */
  display_name: string | null;
  /** Workspace ID (resolved from workspace_members) — null if no workspace */
  workspace_id: string | null;
  /** Business ID (resolved from businesses) — null if no business */
  business_id: string | null;
  /** User's role in the workspace — null if no workspace */
  role: string | null;
  /** Onboarding progression status */
  onboarding_status: OnboardingStatus | null;
}

/**
 * RPC response shape from get_user_context().
 * Matches the JSONB returned by the hardened SQL function.
 */
interface UserContextRPC {
  user_id: string;
  workspace_id: string | null;
  business_id: string | null;
  role: string | null;
  onboarding_status: string | null;
}

/**
 * Test-only override: allows tests to provide controlled auth contexts.
 * Hardened with NODE_ENV guard — only active when NODE_ENV === "test".
 * Set to null after each test to avoid leaking state.
 */
let _testOverride: (() => Promise<AuthenticatedContext | null>) | null = null;

export function __setTestAuthOverride(fn: (() => Promise<AuthenticatedContext | null>) | null): void {
  if (process.env.NODE_ENV !== "test") {
    console.error("[SECURITY] __setTestAuthOverride called in non-test environment — BLOCKED");
    return;
  }
  _testOverride = fn;
}

/**
 * Resolve the authenticated user's full business context.
 *
 * Flow:
 * 1. Verify JWT via getAuthenticatedUser()
 * 2. Call hardened get_user_context() RPC (no parameters — uses auth.uid())
 * 3. Combine JWT identity with RPC-resolved context
 *
 * Returns null if:
 * - No valid session exists (unauthenticated)
 * - RPC call fails (database error)
 *
 * Returns a partial context if:
 * - User has no workspace (workspace_id/business_id are null)
 * - User has workspace but no business (business_id is null)
 *
 * Never throws. Fail closed → return null.
 *
 * Usage in Route Handlers:
 * ```ts
 * const ctx = await getAuthenticatedContext();
 * if (!ctx) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 * // ctx.workspace_id, ctx.business_id, ctx.role are available
 * ```
 *
 * Usage in Server Components:
 * ```ts
 * const ctx = await getAuthenticatedContext();
 * if (!ctx) redirect("/login");
 * if (!ctx.workspace_id) redirect("/onboarding");
 * ```
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedContext | null> {
  if (_testOverride) return _testOverride();

  // Step 1: Verify JWT — get authenticated user identity
  const user = await getAuthenticatedUser();
  if (!user) {
    return null;
  }

  // Step 2: Call hardened get_user_context() RPC
  // The RPC uses auth.uid() internally — no parameters passed
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("get_user_context");

  if (error) {
    // RPC failure — fail closed
    return null;
  }

  if (!data) {
    // No data returned — fail closed
    return null;
  }

  const rpc = data as UserContextRPC;

  // Step 3: Combine JWT identity with RPC-resolved context
  // Trust JWT for identity fields, RPC for workspace/business resolution
  return {
    user_id: user.id,
    email: user.email,
    display_name: user.display_name,
    workspace_id: rpc.workspace_id ?? null,
    business_id: rpc.business_id ?? null,
    role: rpc.role ?? null,
    onboarding_status: (rpc.onboarding_status as OnboardingStatus) ?? null,
  };
}

/**
 * Require an authenticated context or throw.
 *
 * Use in contexts where authentication AND context resolution are mandatory.
 * Throws if no valid session exists or RPC fails.
 */
export async function requireAuthenticatedContext(): Promise<AuthenticatedContext> {
  const ctx = await getAuthenticatedContext();
  if (!ctx) {
    throw new Error("Authentication and context resolution required");
  }
  return ctx;
}

/**
 * Check if the context has a complete business setup.
 *
 * Returns true only if workspace, business, and role are all resolved.
 */
export function hasCompleteContext(ctx: AuthenticatedContext): boolean {
  return ctx.workspace_id !== null && ctx.business_id !== null && ctx.role !== null;
}

/**
 * Check if the context has a workspace (but possibly no business).
 */
export function hasWorkspace(ctx: AuthenticatedContext): boolean {
  return ctx.workspace_id !== null;
}

/**
 * Check if the user needs onboarding (no workspace yet).
 */
export function needsOnboarding(ctx: AuthenticatedContext): boolean {
  return ctx.workspace_id === null;
}
