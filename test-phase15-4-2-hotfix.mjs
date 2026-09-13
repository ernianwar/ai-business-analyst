/**
 * Phase 15.4.2 HOTFIX — Runtime Security Tests
 *
 * H1: Execution authorization re-check (runtime, mocked provider)
 * A2/M6: Decision authorization (runtime, in-memory RBAC)
 *
 * These tests EXERCISE the runtime security boundary.
 * They are NOT source string inspections.
 */

process.env.NODE_ENV = "test";

// ============================================================
// Test Framework
// ============================================================

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message}`);
    failed++;
    failures.push(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
    failures.push(message);
  }
}

function assertIncludes(haystack, needle, message) {
  if (haystack.includes(needle)) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message} — does not contain '${needle}'`);
    failed++;
    failures.push(message);
  }
}

// ============================================================
// Imports
// ============================================================

import {
  createAction,
  getAction,
  checkAndAuthorizeAction,
  queueAction,
} from "./src/lib/action/action-service";
import {
  executeAction,
  registerProvider,
  generateIdempotencyKey,
} from "./src/lib/action/execution-engine";
import {
  testProvider,
  resetTestProvider,
  getTestProviderLog,
  configureTestProvider,
} from "./src/lib/action/providers";
import {
  seedDemoApprovalAccess,
  registerMembership,
  registerBusinessAccess,
  setResourcePermission,
} from "./src/lib/approval/access-control";
import {
  createApprovalRequest,
  approveRequest,
  createStandingAuthorization,
} from "./src/lib/approval/approval-service";
import {
  canMakeDecision,
  canViewDecisions,
  canSupersedeDecision,
} from "./src/lib/decisions/authorization";

// ============================================================
// Setup
// ============================================================

seedDemoApprovalAccess();
registerProvider(testProvider);

const BUSINESS = "00000000-0000-0000-0000-000000000001";
const WORKSPACE = "demo-workspace";
const DEMO_USER = "9079607f-8c3d-49f9-adea-159a140965a8";

// Register a separate test business for cross-business tests
const OTHER_BUSINESS = "22222222-2222-2222-2222-222222222222";
registerBusinessAccess({ user_id: DEMO_USER, workspace_id: WORKSPACE, business_id: OTHER_BUSINESS, active: true });
for (const perm of ["VIEW_APPROVALS", "REQUEST_APPROVAL", "APPROVE_ACTION", "MANAGE_STANDING_AUTHORIZATION"]) {
  setResourcePermission(DEMO_USER, WORKSPACE, OTHER_BUSINESS, perm, true);
}

// Register test users with different roles
const OWNER_USER = "owner-test-user";
const ADMIN_USER = "admin-test-user";
const MEMBER_USER = "member-test-user";
const VIEWER_USER = "viewer-test-user";
const OTHER_WS_USER = "other-ws-user";

registerMembership({ user_id: OWNER_USER, workspace_id: WORKSPACE, role: "OWNER", active: true });
registerBusinessAccess({ user_id: OWNER_USER, workspace_id: WORKSPACE, business_id: BUSINESS, active: true });
for (const perm of ["VIEW_APPROVALS", "REQUEST_APPROVAL", "APPROVE_ACTION", "MANAGE_STANDING_AUTHORIZATION"]) {
  setResourcePermission(OWNER_USER, WORKSPACE, BUSINESS, perm, true);
}

registerMembership({ user_id: ADMIN_USER, workspace_id: WORKSPACE, role: "ADMIN", active: true });
registerBusinessAccess({ user_id: ADMIN_USER, workspace_id: WORKSPACE, business_id: BUSINESS, active: true });
for (const perm of ["VIEW_APPROVALS", "REQUEST_APPROVAL", "APPROVE_ACTION"]) {
  setResourcePermission(ADMIN_USER, WORKSPACE, BUSINESS, perm, true);
}

registerMembership({ user_id: MEMBER_USER, workspace_id: WORKSPACE, role: "MEMBER", active: true });
registerBusinessAccess({ user_id: MEMBER_USER, workspace_id: WORKSPACE, business_id: BUSINESS, active: true });
for (const perm of ["VIEW_APPROVALS", "REQUEST_APPROVAL"]) {
  setResourcePermission(MEMBER_USER, WORKSPACE, BUSINESS, perm, true);
}

registerMembership({ user_id: VIEWER_USER, workspace_id: WORKSPACE, role: "VIEWER", active: true });
registerBusinessAccess({ user_id: VIEWER_USER, workspace_id: WORKSPACE, business_id: BUSINESS, active: true });
setResourcePermission(VIEWER_USER, WORKSPACE, BUSINESS, "VIEW_APPROVALS", true);

registerMembership({ user_id: OTHER_WS_USER, workspace_id: "other-workspace", role: "OWNER", active: true });
registerBusinessAccess({ user_id: OTHER_WS_USER, workspace_id: "other-workspace", business_id: BUSINESS, active: true });
for (const perm of ["VIEW_APPROVALS", "REQUEST_APPROVAL", "APPROVE_ACTION"]) {
  setResourcePermission(OTHER_WS_USER, "other-workspace", BUSINESS, perm, true);
}

// ============================================================
// H1 RUNTIME TESTS — Execution Authorization Re-Check
// ============================================================

console.log("\n=== H1-RUNTIME-01: Valid authorization → provider called ===");
{
  resetTestProvider();
  const action = createAction({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test — valid auth",
    target_type: "ad_platform",
    parameters: { amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const approval = createApprovalRequest({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test approval",
    scope: { business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09", authorized_agent: null },
  });
  const approved = approveRequest(approval.id, DEMO_USER, "Approved for test");
  await checkAndAuthorizeAction({ action_id: action.id, workspace_id: WORKSPACE, approval_id: approved.id });
  queueAction(action.id);

  const logBefore = getTestProviderLog().length;
  const execution = await executeAction({
    action_id: action.id,
    provider_name: "test-provider",
    operation: "publish_ad",
    idempotency_key: generateIdempotencyKey(action.id),
    workspace_id: WORKSPACE,
  });

  assertEqual(execution.status, "SUCCEEDED", "Execution succeeded with valid authorization");
  assert(getTestProviderLog().length > logBefore, "Provider was called");
}

console.log("\n=== H1-RUNTIME-02: Revoked approval → provider NOT called ===");
{
  resetTestProvider();
  const action = createAction({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test — revoked auth",
    target_type: "ad_platform",
    parameters: { amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const approval = createApprovalRequest({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test approval to revoke",
    scope: { business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09", authorized_agent: null },
  });
  const approved = approveRequest(approval.id, DEMO_USER, "Approved for test");
  await checkAndAuthorizeAction({ action_id: action.id, workspace_id: WORKSPACE, approval_id: approved.id });
  queueAction(action.id);

  // Revoke the approval AFTER authorization but BEFORE execution
  const { revokeApproval } = await import("./src/lib/approval/approval-service");
  revokeApproval(approved.id, DEMO_USER, "Revoked for test");

  let providerCalled = false;
  const logBefore = getTestProviderLog().length;
  try {
    await executeAction({
      action_id: action.id,
      provider_name: "test-provider",
      operation: "publish_ad",
      idempotency_key: generateIdempotencyKey(action.id),
      workspace_id: WORKSPACE,
    });
  } catch (e) {
    // Expected — authorization re-check should fail
  }
  providerCalled = getTestProviderLog().length > logBefore;

  assert(!providerCalled, "Provider was NOT called after approval revocation");
}

console.log("\n=== H1-RUNTIME-03: Expired approval → provider NOT called ===");
{
  resetTestProvider();
  const action = createAction({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test — expired auth",
    target_type: "ad_platform",
    parameters: { amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const approval = createApprovalRequest({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test approval to expire",
    scope: { business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09", authorized_agent: null },
  });
  // Approve with very short expiry
  const approved = approveRequest(approval.id, DEMO_USER, "Approved for test", 1); // 1ms expiry
  await checkAndAuthorizeAction({ action_id: action.id, workspace_id: WORKSPACE, approval_id: approved.id });
  queueAction(action.id);

  // Wait for expiry
  await new Promise(r => setTimeout(r, 10));

  let providerCalled = false;
  const logBefore = getTestProviderLog().length;
  try {
    await executeAction({
      action_id: action.id,
      provider_name: "test-provider",
      operation: "publish_ad",
      idempotency_key: generateIdempotencyKey(action.id),
      workspace_id: WORKSPACE,
    });
  } catch (e) {
    // Expected — authorization re-check should fail
  }
  providerCalled = getTestProviderLog().length > logBefore;

  assert(!providerCalled, "Provider was NOT called after approval expiry");
}

console.log("\n=== H1-RUNTIME-04: Scope mismatch → provider NOT called ===");
{
  resetTestProvider();
  const action = createAction({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test — scope mismatch",
    target_type: "ad_platform",
    parameters: { amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  // Approval for only RM100 with matching scope
  const approval = createApprovalRequest({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test approval — small scope",
    scope: { business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09", authorized_agent: null },
  });
  const approved = approveRequest(approval.id, DEMO_USER, "Approved for test");
  // Authorize with the small-scope approval (this succeeds because initial check uses the same approval)
  await checkAndAuthorizeAction({ action_id: action.id, workspace_id: WORKSPACE, approval_id: approved.id });
  queueAction(action.id);

  // Now tamper: change the action amount to exceed the approval scope
  const { getActionRepository } = await import("./src/lib/action/action-repository");
  const repo = getActionRepository();
  repo.update(action.id, {
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
  });

  let providerCalled = false;
  const logBefore = getTestProviderLog().length;
  try {
    await executeAction({
      action_id: action.id,
      provider_name: "test-provider",
      operation: "publish_ad",
      idempotency_key: generateIdempotencyKey(action.id),
      workspace_id: WORKSPACE,
    });
  } catch (e) {
    // Expected — authorization re-check should detect scope mismatch
  }
  providerCalled = getTestProviderLog().length > logBefore;

  assert(!providerCalled, "Provider was NOT called after scope mismatch");
}

console.log("\n=== H1-RUNTIME-05: workspace_id is REQUIRED (type enforced) ===");
{
  // Verify that executeAction requires workspace_id at the type level
  // In JavaScript we can still call without it, but the function should fail
  // because the authorization re-check will use empty string
  resetTestProvider();
  const action = createAction({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test — missing workspace",
    target_type: "ad_platform",
    parameters: { amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const approval = createApprovalRequest({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test approval",
    scope: { business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09", authorized_agent: null },
  });
  const approved = approveRequest(approval.id, DEMO_USER, "Approved for test");
  await checkAndAuthorizeAction({ action_id: action.id, workspace_id: WORKSPACE, approval_id: approved.id });
  queueAction(action.id);

  // Call with empty workspace_id — should fail because authorization re-check uses empty workspace
  let threw = false;
  try {
    await executeAction({
      action_id: action.id,
      provider_name: "test-provider",
      operation: "publish_ad",
      idempotency_key: generateIdempotencyKey(action.id),
      workspace_id: "", // Empty workspace_id — should fail authorization
    });
  } catch (e) {
    threw = true;
    assertIncludes(e.message, "authorization re-check failed", "Error mentions authorization failure");
  }
  assert(threw, "executeAction throws when workspace_id is empty");
}

console.log("\n=== H1-RUNTIME-06: Authorization failure immediately before execution ===");
{
  resetTestProvider();
  const action = createAction({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "H1 runtime test — no approval at all",
    target_type: "ad_platform",
    parameters: { amount: 100, currency: "MYR", vendor_payee: "Test", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  // Manually set status to QUEUED without proper authorization
  const { getActionRepository } = await import("./src/lib/action/action-repository");
  const repo = getActionRepository();
  repo.update(action.id, { status: "QUEUED" });

  let providerCalled = false;
  const logBefore = getTestProviderLog().length;
  try {
    await executeAction({
      action_id: action.id,
      provider_name: "test-provider",
      operation: "publish_ad",
      idempotency_key: generateIdempotencyKey(action.id),
      workspace_id: WORKSPACE,
    });
  } catch (e) {
    // Expected — no approval exists
  }
  providerCalled = getTestProviderLog().length > logBefore;

  assert(!providerCalled, "Provider was NOT called without authorization");
}

// ============================================================
// A2/M6 RUNTIME TESTS — Decision Authorization
// ============================================================

console.log("\n=== A2-RUNTIME-01: OWNER can make decision for own business ===");
{
  const result = canMakeDecision(OWNER_USER, BUSINESS, WORKSPACE);
  assert(result.authorized, "OWNER is authorized to make decisions");
  assertEqual(result.role, "OWNER", "Role is OWNER");
}

console.log("\n=== A2-RUNTIME-02: ADMIN can make decision for own business ===");
{
  const result = canMakeDecision(ADMIN_USER, BUSINESS, WORKSPACE);
  assert(result.authorized, "ADMIN is authorized to make decisions");
  assertEqual(result.role, "ADMIN", "Role is ADMIN");
}

console.log("\n=== A2-RUNTIME-03: MEMBER cannot make decision ===");
{
  const result = canMakeDecision(MEMBER_USER, BUSINESS, WORKSPACE);
  assert(!result.authorized, "MEMBER is not authorized to make decisions");
  assert(!["OWNER", "ADMIN"].includes(result.role ?? ""), "Role is not OWNER or ADMIN");
}

console.log("\n=== A2-RUNTIME-04: VIEWER cannot make decision ===");
{
  const result = canMakeDecision(VIEWER_USER, BUSINESS, WORKSPACE);
  assert(!result.authorized, "VIEWER is not authorized to make decisions");
}

console.log("\n=== A2-RUNTIME-05: User cannot make decision for another workspace ===");
{
  // OTHER_WS_USER is in "other-workspace", trying to make decision for BUSINESS
  // which is in WORKSPACE — should fail because membership is in different workspace
  const result = canMakeDecision(OTHER_WS_USER, BUSINESS, WORKSPACE);
  assert(!result.authorized, "User from other workspace cannot make decision in this workspace");
}

console.log("\n=== A2-RUNTIME-06: canViewDecisions works with workspace_id ===");
{
  const result = canViewDecisions(OWNER_USER, BUSINESS, WORKSPACE);
  assert(result.authorized, "OWNER can view decisions");
}

console.log("\n=== A2-RUNTIME-07: canSupersedeDecision forwards workspace_id ===");
{
  const result = canSupersedeDecision(OWNER_USER, BUSINESS, WORKSPACE);
  assert(result.authorized, "OWNER can supersede decisions");
}

console.log("\n=== A2-RUNTIME-08: Missing workspace_id fails closed ===");
{
  const result = canMakeDecision(OWNER_USER, BUSINESS, "");
  assert(!result.authorized, "Empty workspace_id fails closed");
  assertIncludes(result.reason, "Workspace context required", "Reason mentions workspace requirement");
}

console.log("\n=== A2-RUNTIME-09: System user cannot make decision ===");
{
  const result = canMakeDecision("system", BUSINESS, WORKSPACE);
  assert(!result.authorized, "System user cannot make decisions");
}

console.log("\n=== A2-RUNTIME-10: Empty user cannot make decision ===");
{
  const result = canMakeDecision("", BUSINESS, WORKSPACE);
  assert(!result.authorized, "Empty user cannot make decisions");
}

console.log("\n=== A2-RUNTIME-11: Non-existent user cannot make decision ===");
{
  const result = canMakeDecision("nonexistent-user", BUSINESS, WORKSPACE);
  assert(!result.authorized, "Non-existent user cannot make decisions");
}

console.log("\n=== A2-RUNTIME-12: User cannot make decision for unassociated business ===");
{
  const UNRELATED_BUSINESS = "99999999-9999-9999-9999-999999999999";
  const result = canMakeDecision(OWNER_USER, UNRELATED_BUSINESS, WORKSPACE);
  assert(!result.authorized, "User cannot make decision for business they have no access to");
}

// ============================================================
// SUMMARY
// ============================================================

console.log("\n" + "=".repeat(60));
console.log(`Phase 15.4.2 HOTFIX Test Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  console.log("\nFailed tests:");
  for (const f of failures) {
    console.log(`  ❌ ${f}`);
  }
  process.exit(1);
} else {
  console.log("\n✅ ALL TESTS PASSED");
}
