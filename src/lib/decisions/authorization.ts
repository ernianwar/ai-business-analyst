/**
 * SALAM LIT — Decision Authorization
 *
 * Enforces AUTH → WORKSPACE → BUSINESS SCOPE → RBAC.
 * Only OWNER or ADMIN can make decisions. VIEWERs cannot.
 *
 * Phase 11: Recommendation + Decision Center
 * Phase 15.4.2: Real scope-based authorization (replaces MVP stub)
 * Phase 15.4.2 HOTFIX: workspace_id is REQUIRED — type system enforces presence.
 */

import { canAccessBusiness, getMembership } from "../approval/access-control";

/**
 * User roles within a workspace.
 */
export type UserRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

/**
 * Authorization result.
 */
export interface AuthorizationResult {
  authorized: boolean;
  reason: string;
  role?: UserRole;
}

/**
 * Check if a user can view decisions for a business.
 * Requires active workspace membership with business access.
 * workspace_id is REQUIRED — derived from authenticated context, never from client.
 */
export function canViewDecisions(
  user_id: string,
  business_id: string,
  workspace_id: string, // HOTFIX: REQUIRED — type system enforces presence
): AuthorizationResult {
  if (!user_id || user_id === "system") {
    return { authorized: false, reason: "System users cannot view decisions" };
  }

  if (!business_id) {
    return { authorized: false, reason: "Business ID required" };
  }

  if (!workspace_id) {
    return { authorized: false, reason: "Workspace context required" };
  }

  // A2/M6: Real scope-based authorization via access-control
  const access = canAccessBusiness({
    user_id,
    workspace_id,
    business_id,
    permission: "VIEW_APPROVALS",
  });

  if (!access.allowed) {
    return { authorized: false, reason: access.reason };
  }

  return {
    authorized: true,
    reason: "User is authorized to view decisions",
    role: (access.role as UserRole) ?? "MEMBER",
  };
}

/**
 * Check if a user can make decisions for a business.
 * Only OWNER or ADMIN can make decisions. MEMBER and VIEWER cannot.
 * workspace_id is REQUIRED — derived from authenticated context, never from client.
 */
export function canMakeDecision(
  user_id: string,
  business_id: string,
  workspace_id: string, // HOTFIX: REQUIRED — type system enforces presence
): AuthorizationResult {
  if (!user_id || user_id === "system") {
    return { authorized: false, reason: "System users cannot make decisions" };
  }

  if (!business_id) {
    return { authorized: false, reason: "Business ID required" };
  }

  if (!workspace_id) {
    return { authorized: false, reason: "Workspace context required" };
  }

  // A2/M6: Real scope-based authorization via access-control
  const access = canAccessBusiness({
    user_id,
    workspace_id,
    business_id,
    permission: "APPROVE_ACTION",
  });

  if (!access.allowed) {
    return { authorized: false, reason: access.reason };
  }

  // Only OWNER or ADMIN can make decisions
  const role = access.role as UserRole;
  if (role !== "OWNER" && role !== "ADMIN") {
    return {
      authorized: false,
      reason: `Role '${role}' is not authorized to make decisions. OWNER or ADMIN required.`,
    };
  }

  return {
    authorized: true,
    reason: "User is authorized to make decisions",
    role,
  };
}

/**
 * Check if a user can supersede a decision.
 * Same requirements as making decisions (OWNER or ADMIN).
 */
export function canSupersedeDecision(
  user_id: string,
  business_id: string,
  workspace_id: string, // HOTFIX: REQUIRED — forwarded from caller
): AuthorizationResult {
  return canMakeDecision(user_id, business_id, workspace_id);
}

/**
 * Validate that an AI agent is NOT making a decision as the owner.
 * AI agents can RECOMMEND but never DECIDE.
 */
export function validateDecisionMaker(
  decision_maker: string,
  is_ai_agent: boolean
): AuthorizationResult {
  if (is_ai_agent) {
    return {
      authorized: false,
      reason: "AI agents cannot make owner decisions. Recommendations only.",
    };
  }

  return {
    authorized: true,
    reason: "Decision maker is a human user",
  };
}
