import type { ActionType } from "../runtime/types";
import type { AgentKey } from "../agents/definitions";

export type ApprovalRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

interface Membership {
  user_id: string;
  workspace_id: string;
  role: ApprovalRole;
  active: boolean;
}

interface BusinessAccess {
  user_id: string;
  workspace_id: string;
  business_id: string;
  active: boolean;
}

const memberships = new Map<string, Membership>();
const businessAccess = new Map<string, BusinessAccess>();
const resourcePermissions = new Map<string, Set<string>>();

function membershipKey(user_id: string, workspace_id: string): string {
  return `${user_id}:${workspace_id}`;
}

function businessKey(user_id: string, workspace_id: string, business_id: string): string {
  return `${user_id}:${workspace_id}:${business_id}`;
}

export function registerMembership(membership: Membership): void {
  memberships.set(membershipKey(membership.user_id, membership.workspace_id), membership);
}

export function registerBusinessAccess(access: BusinessAccess): void {
  businessAccess.set(
    businessKey(access.user_id, access.workspace_id, access.business_id),
    access
  );
}

export function setResourcePermission(
  user_id: string,
  workspace_id: string,
  business_id: string,
  permission: string,
  allowed: boolean
): void {
  const key = businessKey(user_id, workspace_id, business_id);
  const current = resourcePermissions.get(key) ?? new Set<string>();
  if (allowed) current.add(permission);
  else current.delete(permission);
  resourcePermissions.set(key, current);
}

export function revokeBusinessAccess(
  user_id: string,
  workspace_id: string,
  business_id: string
): void {
  const access = businessAccess.get(businessKey(user_id, workspace_id, business_id));
  if (access) access.active = false;
}

export function getMembership(user_id: string, workspace_id: string): Membership | null {
  return memberships.get(membershipKey(user_id, workspace_id)) ?? null;
}

export function canAccessBusiness(params: {
  user_id: string;
  workspace_id: string;
  business_id: string;
  permission: string;
}): { allowed: boolean; reason: string; role?: ApprovalRole } {
  if (!params.user_id || params.user_id === "system") {
    return { allowed: false, reason: "Authenticated user is required" };
  }
  const membership = getMembership(params.user_id, params.workspace_id);
  if (!membership || !membership.active) {
    return { allowed: false, reason: "Active workspace membership is required" };
  }
  const access = businessAccess.get(
    businessKey(params.user_id, params.workspace_id, params.business_id)
  );
  if (!access || !access.active) {
    return { allowed: false, reason: "Business scope is not authorized", role: membership.role };
  }
  const permissions = resourcePermissions.get(
    businessKey(params.user_id, params.workspace_id, params.business_id)
  );
  if (!permissions?.has(params.permission)) {
    return { allowed: false, reason: `Resource permission denied: ${params.permission}`, role: membership.role };
  }
  return { allowed: true, reason: "Access granted", role: membership.role };
}

export function canApprove(role: ApprovalRole | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}

export function canCreateStandingAuthorization(role: ApprovalRole | undefined): boolean {
  return role === "OWNER";
}

export function canAgentRequestAction(agent_key: string | null, action_type: ActionType): boolean {
  if (!agent_key) return false;
  return agent_key.length > 0 && action_type !== "OTHER";
}

export function isAgentKey(value: string): value is AgentKey {
  return ["zue", "erni", "sheera", "eddy", "carol", "ayuni", "alex", "tehna", "kopi", "adik"].includes(value);
}

export function seedDemoApprovalAccess(): void {
  // Register demo user (legacy string IDs for backward compatibility)
  registerMembership({ user_id: "demo-user", workspace_id: "demo-workspace", role: "OWNER", active: true });
  registerBusinessAccess({ user_id: "demo-user", workspace_id: "demo-workspace", business_id: "demo-business", active: true });
  for (const permission of ["VIEW_APPROVALS", "REQUEST_APPROVAL", "APPROVE_ACTION", "MANAGE_STANDING_AUTHORIZATION"]) {
    setResourcePermission("demo-user", "demo-workspace", "demo-business", permission, true);
  }

  // Register UUID-based demo user (matches DB test data)
  registerMembership({ user_id: "9079607f-8c3d-49f9-adea-159a140965a8", workspace_id: "demo-workspace", role: "OWNER", active: true });
  registerBusinessAccess({ user_id: "9079607f-8c3d-49f9-adea-159a140965a8", workspace_id: "demo-workspace", business_id: "00000000-0000-0000-0000-000000000001", active: true });
  registerBusinessAccess({ user_id: "9079607f-8c3d-49f9-adea-159a140965a8", workspace_id: "demo-workspace", business_id: "22222222-2222-2222-2222-222222222222", active: true });
  registerBusinessAccess({ user_id: "9079607f-8c3d-49f9-adea-159a140965a8", workspace_id: "demo-workspace", business_id: "44444444-4444-4444-4444-444444444444", active: true });
  for (const permission of ["VIEW_APPROVALS", "REQUEST_APPROVAL", "APPROVE_ACTION", "MANAGE_STANDING_AUTHORIZATION"]) {
    setResourcePermission("9079607f-8c3d-49f9-adea-159a140965a8", "demo-workspace", "00000000-0000-0000-0000-000000000001", permission, true);
    setResourcePermission("9079607f-8c3d-49f9-adea-159a140965a8", "demo-workspace", "22222222-2222-2222-2222-222222222222", permission, true);
    setResourcePermission("9079607f-8c3d-49f9-adea-159a140965a8", "demo-workspace", "44444444-4444-4444-4444-444444444444", permission, true);
  }

  // Register demo agents as workspace members with AGENT role
  const agentKeys = ["zue", "erni", "sheera", "eddy", "carol", "ayuni", "alex", "tehna", "kopi", "adik"];
  for (const agentKey of agentKeys) {
    registerMembership({ user_id: agentKey, workspace_id: "demo-workspace", role: "MEMBER", active: true });
    registerBusinessAccess({ user_id: agentKey, workspace_id: "demo-workspace", business_id: "demo-business", active: true });
    registerBusinessAccess({ user_id: agentKey, workspace_id: "demo-workspace", business_id: "00000000-0000-0000-0000-000000000001", active: true });
    registerBusinessAccess({ user_id: agentKey, workspace_id: "demo-workspace", business_id: "22222222-2222-2222-2222-222222222222", active: true });
    registerBusinessAccess({ user_id: agentKey, workspace_id: "demo-workspace", business_id: "44444444-4444-4444-4444-444444444444", active: true });
    for (const permission of ["VIEW_APPROVALS", "REQUEST_APPROVAL"]) {
      setResourcePermission(agentKey, "demo-workspace", "demo-business", permission, true);
      setResourcePermission(agentKey, "demo-workspace", "00000000-0000-0000-0000-000000000001", permission, true);
      setResourcePermission(agentKey, "demo-workspace", "22222222-2222-2222-2222-222222222222", permission, true);
      setResourcePermission(agentKey, "demo-workspace", "44444444-4444-4444-4444-444444444444", permission, true);
    }
  }
}
