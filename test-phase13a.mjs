/**
 * Phase 13A — Action + Execution Engine Test Suite
 */

// Load .env.local before any module imports so getSupabaseClient() finds the env vars
import { readFileSync } from "fs";
import { resolve } from "path";
const envContent = readFileSync(resolve(import.meta.dirname, ".env.local"), "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

import { createAction, getAction, getActionsByBusiness, checkAndAuthorizeAction, queueAction, cancelAction } from "./src/lib/action/action-service";
import { registerProvider, executeAction, reconcileExecution, generateIdempotencyKey, getOutcomeByAction, getOutcomeByExecution } from "./src/lib/action/execution-engine";
import { testProvider, configureTestProvider, resetTestProvider, getTestProviderLog } from "./src/lib/action/providers";
import { getActionAuditEvents, clearActionAuditEvents } from "./src/lib/action/audit";
import { seedDemoApprovalAccess } from "./src/lib/approval/access-control";
import { createApprovalRequest, approveRequest, createStandingAuthorization, revokeStandingAuthorization } from "./src/lib/approval/approval-service";
import { getStandingAuthRepository } from "./src/lib/approval/standing-auth-repository";

seedDemoApprovalAccess();
clearActionAuditEvents();
registerProvider(testProvider);

const DEMO_BUSINESS = "00000000-0000-0000-0000-000000000001";
const DEMO_USER = "9079607f-8c3d-49f9-adea-159a140965a8";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log("\n=== Phase 13A — Action + Execution Engine Tests ===\n");

  const BUSINESS = DEMO_BUSINESS;
  const WORKSPACE = "demo-workspace";

  // --- Action Creation ---
  console.log("--- Action Creation Tests ---");

  const action1 = createAction({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "Spend RM500 on Google Ads",
    target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  assert(action1.id !== undefined, "Action created with ID");
  assert(action1.status === "PROPOSED", "Action starts as PROPOSED");
  assert(action1.business_id === BUSINESS, "Action has correct business_id");

  const retrieved = getAction(action1.id);
  assert(retrieved !== null, "Action retrievable by ID");
  assert(retrieved.id === action1.id, "Retrieved action matches");

  const businessActions = getActionsByBusiness(BUSINESS);
  assert(businessActions.length > 0, "Actions retrievable by business");

  // --- Business Isolation ---
  console.log("\n--- Business Isolation Tests ---");

  const otherBizAction = createAction({
    business_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "SYSTEM_CHANGE",
    action_description: "Other",
    target_type: "system",
    risk_level: "L0",
  });
  const otherBizActions = getActionsByBusiness("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  assert(otherBizActions.length === 1, "Other business has its own actions");
  assert(!getActionsByBusiness(BUSINESS).some(function(a) { return a.id === otherBizAction.id; }), "Business isolation enforced");

  // --- Unauthorized Action ---
  console.log("\n--- Unauthorized Action Tests ---");

  const sysAction = createAction({
    business_id: BUSINESS, requested_by: DEMO_USER, requested_by_type: "USER",
    action_type: "SYSTEM_CHANGE", action_description: "Change config", target_type: "system",
    parameters: {}, risk_level: "L2",
  });
  const sysAuthResult = await checkAndAuthorizeAction({ action_id: sysAction.id, workspace_id: WORKSPACE });
  assert(sysAuthResult.authorized === false, "SYSTEM_CHANGE (L2) denied without approval");
  assert(sysAuthResult.result.status === "REQUIRES_APPROVAL", "Status is REQUIRES_APPROVAL");

  // --- Authorization Success ---
  console.log("\n--- Authorization Success Tests ---");

  const approval = createApprovalRequest({
    business_id: BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "Monthly ad spend",
    scope: {
      business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 1000, currency: "MYR",
      vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly",
      time_period: "2026-09", resource: null, authorized_agent: null,
    },
  });
  const approved = approveRequest(approval.id, DEMO_USER, "Approved");
  assert(approved !== null, "Approval granted");

  const authResult = await checkAndAuthorizeAction({ action_id: action1.id, workspace_id: WORKSPACE, approval_id: approval.id });
  assert(authResult.authorized === true, "Action authorized with valid approval");
  assert(authResult.result.status === "AUTHORIZED", "Authorization status is AUTHORIZED");

  const authorizedAction = getAction(action1.id);
  assert(authorizedAction.status === "AUTHORIZED", "Action status updated to AUTHORIZED");
  assert(authorizedAction.authorized_at !== null, "Authorized timestamp set");

  // --- Authorization Failure ---
  console.log("\n--- Authorization Failure Tests ---");

  const expiredAction = createAction({
    business_id: BUSINESS, requested_by: DEMO_USER, requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Expired approval test", target_type: "ad_platform", risk_level: "L2",
  });
  const expiredAuthResult = await checkAndAuthorizeAction({ action_id: expiredAction.id, workspace_id: WORKSPACE });
  assert(expiredAuthResult.authorized === false, "No approval means denied");

  // --- Action Lifecycle ---
  console.log("\n--- Action Lifecycle Tests ---");

  const queued = queueAction(action1.id);
  assert(queued !== null, "Action queued");
  assert(queued.status === "QUEUED", "Action status is QUEUED");
  assert(queued.queued_at !== null, "Queued timestamp set");

  const cannotQueue = queueAction(action1.id);
  assert(cannotQueue === null, "Cannot queue already-queued action");

  const cancelAction1 = createAction({
    business_id: BUSINESS, requested_by: DEMO_USER, requested_by_type: "USER",
    action_type: "OTHER", action_description: "To be cancelled", target_type: "system", risk_level: "L2",
  });
  const cancelled = cancelAction(cancelAction1.id, "No longer needed");
  assert(cancelled !== null, "Action cancelled");
  assert(cancelled.status === "CANCELLED", "Action status is CANCELLED");

  // --- Execution ---
  console.log("\n--- Execution Tests ---");

  resetTestProvider();
  const idempotencyKey = generateIdempotencyKey(action1.id);

  const execution1 = await executeAction({
    action_id: action1.id, provider_name: "test-provider", operation: "publish_ad", idempotency_key: idempotencyKey,
    workspace_id: WORKSPACE,
  });
  assert(execution1.id !== undefined, "Execution created");
  assert(execution1.status === "SUCCEEDED", "Execution succeeded via test provider");
  assert(execution1.external_reference !== null, "External reference set");

  const completedAction = getAction(action1.id);
  assert(completedAction.status === "COMPLETED", "Action status is COMPLETED");

  const outcome = getOutcomeByAction(action1.id);
  assert(outcome !== null, "Outcome recorded");
  assert(outcome.outcome_type === "SUCCESS", "Outcome type is SUCCESS");

  // --- Idempotency ---
  console.log("\n--- Idempotency Tests ---");

  const idemAction = createAction({
    business_id: BUSINESS, requested_by: DEMO_USER, requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Idempotency test", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  await checkAndAuthorizeAction({ action_id: idemAction.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(idemAction.id);

  const idemKey = generateIdempotencyKey(idemAction.id);
  const exec1 = await executeAction({
    action_id: idemAction.id, provider_name: "test-provider", operation: "publish_ad", idempotency_key: idemKey,
    workspace_id: WORKSPACE,
  });
  assert(exec1.status === "SUCCEEDED", "First execution succeeded");

  // Duplicate with SAME key — must return same execution, no second provider call
  const exec2 = await executeAction({
    action_id: idemAction.id, provider_name: "test-provider", operation: "publish_ad", idempotency_key: idemKey,
    workspace_id: WORKSPACE,
  });
  assert(exec2.id === exec1.id, "Duplicate key returns same execution record");
  assert(exec2.status === exec1.status, "Duplicate execution has same status");

  const log = getTestProviderLog();
  const realExecutions = log.filter(function(e) { return e.idempotency_key === idemKey; });
  assert(realExecutions.length === 1, "Only one real provider call (idempotency enforced server-side)");

  // Different key on completed action — must reject
  const key2 = generateIdempotencyKey(idemAction.id);
  let diffKeyRejected = false;
  try {
    await executeAction({
      action_id: idemAction.id, provider_name: "test-provider", operation: "publish_ad", idempotency_key: key2,
      workspace_id: WORKSPACE,
    });
  } catch (e) {
    diffKeyRejected = true;
  }
  assert(diffKeyRejected, "Different key on completed action is rejected");

  // --- Provider Failure ---
  console.log("\n--- Provider Failure Tests ---");

  configureTestProvider({ succeed_by_default: false });
  const failAction1 = createAction({
    business_id: BUSINESS, requested_by: DEMO_USER, requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Will fail", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  await checkAndAuthorizeAction({ action_id: failAction1.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(failAction1.id);

  const failExec = await executeAction({
    action_id: failAction1.id, provider_name: "test-provider", operation: "publish_ad",
    idempotency_key: generateIdempotencyKey(failAction1.id),
    workspace_id: WORKSPACE,
  });
  assert(failExec.status === "FAILED", "Execution failed via test provider");
  assert(failExec.error_code === "TEST_FAILURE", "Error code set");

  const failedAct = getAction(failAction1.id);
  assert(failedAct.status === "FAILED", "Action status is FAILED");

  resetTestProvider();

  // --- UNKNOWN State ---
  console.log("\n--- UNKNOWN State Tests ---");

  configureTestProvider({ simulate_unknown: true });
  const unknownAction = createAction({
    business_id: BUSINESS, requested_by: DEMO_USER, requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "UNKNOWN test", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  await checkAndAuthorizeAction({ action_id: unknownAction.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(unknownAction.id);

  const unknownExec = await executeAction({
    action_id: unknownAction.id, provider_name: "test-provider", operation: "publish_ad",
    idempotency_key: generateIdempotencyKey(unknownAction.id),
    workspace_id: WORKSPACE,
  });
  assert(unknownExec.status === "UNKNOWN", "Execution status is UNKNOWN");
  assert(unknownExec.error_code === "UNKNOWN_RESULT", "UNKNOWN error code set");

  const unknownAct = getAction(unknownAction.id);
  assert(unknownAct.status === "EXECUTING", "Action remains EXECUTING for UNKNOWN");

  // --- Reconciliation ---
  console.log("\n--- Reconciliation Tests ---");

  resetTestProvider();
  const reconciled = await reconcileExecution(unknownExec.id);
  assert(reconciled !== null, "Reconciliation completed");
  assert(reconciled.reconciliation_status === "RECONCILED", "Reconciliation status is RECONCILED");
  assert(reconciled.reconciled_at !== null, "Reconciled timestamp set");

  const reconciledAction = getAction(unknownAction.id);
  assert(reconciledAction.status === "COMPLETED", "Action reconciled to COMPLETED");

  const reconciledOutcome = getOutcomeByExecution(unknownExec.id);
  assert(reconciledOutcome !== null, "Outcome created from reconciliation");

  // --- Provider Timeout ---
  console.log("\n--- Provider Timeout Tests ---");

  configureTestProvider({ simulate_timeout_ms: 10 });
  const timeoutAction = createAction({
    business_id: BUSINESS, requested_by: DEMO_USER, requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Timeout test", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  await checkAndAuthorizeAction({ action_id: timeoutAction.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(timeoutAction.id);

  const timeoutExec = await executeAction({
    action_id: timeoutAction.id, provider_name: "test-provider", operation: "publish_ad",
    idempotency_key: generateIdempotencyKey(timeoutAction.id), timeout_ms: 5,
    workspace_id: WORKSPACE,
  });
  assert(timeoutExec.status === "FAILED", "Timeout treated as failure");
  assert(timeoutExec.error_code === "PROVIDER_TIMEOUT", "Timeout error code set");

  resetTestProvider();

  // --- Audit Trail ---
  console.log("\n--- Audit Trail Tests ---");

  const allAudit = getActionAuditEvents(BUSINESS);
  assert(allAudit.length > 0, "Audit events recorded");
  assert(allAudit.some(function(e) { return e.event_type === "ACTION_CREATED"; }), "ACTION_CREATED in audit");
  assert(allAudit.some(function(e) { return e.event_type === "EXECUTION_SUCCEEDED"; }), "EXECUTION_SUCCEEDED in audit");
  assert(allAudit.some(function(e) { return e.event_type === "EXECUTION_FAILED"; }), "EXECUTION_FAILED in audit");
  assert(allAudit.some(function(e) { return e.event_type === "EXECUTION_UNKNOWN"; }), "EXECUTION_UNKNOWN in audit");
  assert(allAudit.some(function(e) { return e.event_type === "RECONCILIATION_ATTEMPTED"; }), "RECONCILIATION_ATTEMPTED in audit");
  assert(allAudit.every(function(e) { return e.timestamp !== undefined; }), "All audit events have timestamps");

  // --- Standing Authorization ---
  console.log("\n--- Standing Authorization Tests ---");

  const standingAuth = createStandingAuthorization({
    business_id: BUSINESS, authorized_by: DEMO_USER, authorized_agent: null,
    scope: {
      business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 500, currency: "MYR",
      vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly",
      time_period: "2026-09", resource: null, authorized_agent: null,
    },
    max_amount_per_use: 500, max_amount_per_period: 2000, period: "monthly", max_uses_per_period: 4,
  });
  await getStandingAuthRepository().flush();

  const standingAction = createAction({
    business_id: BUSINESS, requested_by: "system", requested_by_type: "AGENT", agent_key: "erni",
    action_type: "AD_SPEND", action_description: "Standing auth test", target_type: "ad_platform",
    parameters: { amount: 300, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const standingAuthResult = await checkAndAuthorizeAction({ action_id: standingAction.id, workspace_id: WORKSPACE });
  assert(standingAuthResult.authorized === true, "Standing auth authorizes payment within scope");

  revokeStandingAuthorization(standingAuth.id, DEMO_USER);
  const revokedStandingAction = createAction({
    business_id: BUSINESS, requested_by: "system", requested_by_type: "AGENT", agent_key: "erni",
    action_type: "AD_SPEND", action_description: "After revocation", target_type: "ad_platform",
    parameters: { amount: 300, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const revokedAuthResult = await checkAndAuthorizeAction({ action_id: revokedStandingAction.id, workspace_id: WORKSPACE });
  assert(revokedAuthResult.authorized === false, "Revoked standing auth denies action");

  // --- L2 Classification ---
  console.log("\n--- Risk Classification Tests ---");

  const { getApprovalPolicy } = await import("./src/lib/approval/authorization-engine");
  const l2Policy = getApprovalPolicy({
    business_id: BUSINESS, requested_by: DEMO_USER, requested_by_type: "USER", agent_key: null,
    action_type: "SYSTEM_CHANGE", action_description: "test",
    scope: { business_id: BUSINESS, action_type: "SYSTEM_CHANGE", max_amount: null, currency: null, vendor_payee: null, vendor_category: null, frequency: null, time_period: null, resource: null, authorized_agent: null },
    risk_level: "L2", decision_id: null,
  });
  assert(l2Policy.risk_level === "L2", "SYSTEM_CHANGE is L2");
  assert(l2Policy.approval_required === true, "L2 requires approval");

  console.log("\n=== Results: " + passed + " passed, " + failed + " failed ===");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
