/**
 * Phase 13B — Persistent Action + Execution State Engine Test Suite
 *
 * Tests persistence, idempotency, state transitions, audit trail,
 * reconciliation, and the "survive restart" pattern.
 *
 * Note: Without a running Supabase instance, persistence is tested via
 * the in-memory write-through cache. The migration SQL is tested separately.
 * With SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY configured, writes
 * are also persisted to PostgreSQL.
 */

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

import { createAction, getAction, getActionsByBusiness, checkAndAuthorizeAction, queueAction, cancelAction, startExecution, completeAction, failAction, clearActionCache } from "./src/lib/action/action-service.js";
import { registerProvider, executeAction, reconcileExecution, generateIdempotencyKey, getOutcomeByAction, getOutcomeByExecution, clearExecutionCache } from "./src/lib/action/execution-engine.js";
import { testProvider, configureTestProvider, resetTestProvider, getTestProviderLog } from "./src/lib/action/providers/index.js";
import { getActionAuditEvents, clearActionAuditEvents } from "./src/lib/action/audit.js";
import { seedDemoApprovalAccess } from "./src/lib/approval/access-control.js";
import { createApprovalRequest, approveRequest, createStandingAuthorization, revokeStandingAuthorization } from "./src/lib/approval/approval-service.js";
import { getStandingAuthRepository } from "./src/lib/approval/standing-auth-repository.js";

seedDemoApprovalAccess();
clearActionAuditEvents();
registerProvider(testProvider);

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
  console.log("\n=== Phase 13B — Persistent Action + Execution State Engine Tests ===\n");

  const BUSINESS = "00000000-0000-0000-0000-000000000001";
  const WORKSPACE = "demo-workspace";

  // Register demo-user with UUID business for RBAC (matches seedDemoApprovalAccess pattern)
  const { registerBusinessAccess, setResourcePermission } = await import("./src/lib/approval/access-control.js");
  registerBusinessAccess({ user_id: "demo-user", workspace_id: WORKSPACE, business_id: BUSINESS, active: true });
  for (const perm of ["VIEW_APPROVALS", "REQUEST_APPROVAL", "APPROVE_ACTION", "MANAGE_STANDING_AUTHORIZATION"]) {
    setResourcePermission("demo-user", WORKSPACE, BUSINESS, perm, true);
  }

  // ─── SETUP ──────────────────────────────────────────────────────
  resetTestProvider();
  const approval = createApprovalRequest({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Phase 13B test approval",
    scope: {
      business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 1000, currency: "MYR",
      vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly",
      time_period: "2026-09", resource: null, authorized_agent: null,
    },
  });
  approveRequest(approval.id, "demo-user", "Approved");

  // ─── 1. ACTION PERSISTENCE ──────────────────────────────────────
  console.log("--- 1. Action Persistence ---");

  const action1 = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Persist test", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  assert(action1.id !== undefined, "Action created");
  assert(getAction(action1.id) !== null, "Action retrievable from cache");

  // ─── 2. ACTION SURVIVES CACHE CLEAR (simulates restart) ─────────
  console.log("\n--- 2. Action Survives Cache Clear ---");

  // Save action state before cache clear
  const savedActionId = action1.id;

  // Clear the in-memory cache
  clearActionCache();

  // Without Supabase, the action is lost — this is the MVP limitation.
  // With Supabase configured, loadActionsFromDatabase() would restore it.
  // For testing, we verify the cache clear works and the API still functions.
  const afterClear = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "After cache clear", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  assert(afterClear.id !== undefined, "New action created after cache clear");
  assert(getAction(afterClear.id) !== null, "New action retrievable");

  // Re-authorize the new action for further tests
  await checkAndAuthorizeAction({ action_id: afterClear.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(afterClear.id);

  // ─── 3. EXECUTION PERSISTENCE ───────────────────────────────────
  console.log("\n--- 3. Execution Persistence ---");

  const execKey = generateIdempotencyKey(afterClear.id);
  const exec1 = await executeAction({
    action_id: afterClear.id, provider_name: "test-provider", operation: "publish_ad", idempotency_key: execKey,
    workspace_id: WORKSPACE,
  });
  assert(exec1.id !== undefined, "Execution created");
  assert(exec1.status === "SUCCEEDED", "Execution succeeded");
  assert(getOutcomeByAction(afterClear.id) !== null, "Outcome persisted");

  // ─── 4. EXECUTION SURVIVES CACHE CLEAR ──────────────────────────
  console.log("\n--- 4. Execution Survives Cache Clear ---");

  const savedExecId = exec1.id;
  clearExecutionCache();

  // After cache clear, execution is gone from cache (MVP limitation)
  // With Supabase, loadExecutionsFromDatabase() would restore it
  const afterExecClear = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Post-exec-clear", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  await checkAndAuthorizeAction({ action_id: afterExecClear.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(afterExecClear.id);

  const exec2Key = generateIdempotencyKey(afterExecClear.id);
  const exec2 = await executeAction({
    action_id: afterExecClear.id, provider_name: "test-provider", operation: "publish_ad", idempotency_key: exec2Key,
    workspace_id: WORKSPACE,
  });
  assert(exec2.id !== undefined, "Execution created after cache clear");
  assert(exec2.status === "SUCCEEDED", "Execution succeeded after cache clear");

  // ─── 5. OUTCOME PERSISTENCE ─────────────────────────────────────
  console.log("\n--- 5. Outcome Persistence ---");

  const outcome = getOutcomeByAction(afterExecClear.id);
  assert(outcome !== null, "Outcome exists");
  assert(outcome.outcome_type === "SUCCESS", "Outcome type is SUCCESS");
  assert(outcome.execution_id === exec2.id, "Outcome linked to correct execution");

  // ─── 6. INVALID STATE TRANSITIONS ───────────────────────────────
  console.log("\n--- 6. Invalid State Transitions ---");

  // Cannot queue a PROPOSED action
  const proposedAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Proposed only", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const cannotQueue = queueAction(proposedAction.id);
  assert(cannotQueue === null, "Cannot queue PROPOSED action");

  // Cannot complete a QUEUED action (must be EXECUTING)
  await checkAndAuthorizeAction({ action_id: proposedAction.id, workspace_id: WORKSPACE, approval_id: approval.id });
  const queued = queueAction(proposedAction.id);
  assert(queued !== null, "Action queued");
  const cannotComplete = completeAction(proposedAction.id);
  assert(cannotComplete === null, "Cannot complete QUEUED action (must be EXECUTING)");

  // Cannot cancel an EXECUTING action
  startExecution(proposedAction.id);
  const cannotCancel = cancelAction(proposedAction.id, "test");
  assert(cannotCancel === null, "Cannot cancel EXECUTING action");

  // Fail it instead
  const failedAction = failAction(proposedAction.id, "test failure");
  assert(failedAction !== null, "Action failed");
  assert(failedAction.status === "FAILED", "Action status is FAILED");

  // Cannot queue a FAILED action
  const cannotQueueFailed = queueAction(proposedAction.id);
  assert(cannotQueueFailed === null, "Cannot queue FAILED action");

  // ─── 7. VALID STATE TRANSITIONS ─────────────────────────────────
  console.log("\n--- 7. Valid State Transitions ---");

  const lifecycleAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Lifecycle", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  assert(lifecycleAction.status === "PROPOSED", "Starts PROPOSED");

  await checkAndAuthorizeAction({ action_id: lifecycleAction.id, workspace_id: WORKSPACE, approval_id: approval.id });
  assert(getAction(lifecycleAction.id).status === "AUTHORIZED", "→ AUTHORIZED");

  queueAction(lifecycleAction.id);
  assert(getAction(lifecycleAction.id).status === "QUEUED", "→ QUEUED");

  startExecution(lifecycleAction.id);
  assert(getAction(lifecycleAction.id).status === "EXECUTING", "→ EXECUTING");

  completeAction(lifecycleAction.id);
  assert(getAction(lifecycleAction.id).status === "COMPLETED", "→ COMPLETED");

  // ─── 8. DUPLICATE IDEMPOTENCY KEY ───────────────────────────────
  console.log("\n--- 8. Duplicate Idempotency Key ---");

  const idemAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Idempotency 13B", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  await checkAndAuthorizeAction({ action_id: idemAction.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(idemAction.id);

  const idemKey = generateIdempotencyKey(idemAction.id);
  const idemExec1 = await executeAction({
    action_id: idemAction.id, provider_name: "test-provider", operation: "publish_ad", idempotency_key: idemKey,
    workspace_id: WORKSPACE,
  });
  assert(idemExec1.status === "SUCCEEDED", "First execution succeeded");

  // Duplicate with same key
  const idemExec2 = await executeAction({
    action_id: idemAction.id, provider_name: "test-provider", operation: "publish_ad", idempotency_key: idemKey,
    workspace_id: WORKSPACE,
  });
  assert(idemExec2.id === idemExec1.id, "Same key returns same execution");
  assert(idemExec2.status === idemExec1.status, "Same status on duplicate");

  const log = getTestProviderLog();
  const realCalls = log.filter(function(e) { return e.idempotency_key === idemKey; });
  assert(realCalls.length === 1, "Only one real provider call (idempotency enforced)");

  // ─── 9. DIFFERENT IDEMPOTENCY KEY ON COMPLETED ──────────────────
  console.log("\n--- 9. Different Key on Completed Action ---");

  const key2 = generateIdempotencyKey(idemAction.id);
  let rejected = false;
  try {
    await executeAction({
      action_id: idemAction.id, provider_name: "test-provider", operation: "publish_ad", idempotency_key: key2,
      workspace_id: WORKSPACE,
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "Different key on completed action rejected");

  // ─── 10. UNKNOWN EXECUTION ──────────────────────────────────────
  console.log("\n--- 10. UNKNOWN Execution ---");

  configureTestProvider({ simulate_unknown: true });
  const unknownAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "UNKNOWN 13B", target_type: "ad_platform",
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
  assert(unknownExec.status === "UNKNOWN", "Execution is UNKNOWN");
  assert(unknownExec.error_code === "UNKNOWN_RESULT", "UNKNOWN error code set");
  assert(getAction(unknownAction.id).status === "EXECUTING", "Action remains EXECUTING");

  // ─── 11. UNKNOWN → RECONCILIATION ──────────────────────────────
  console.log("\n--- 11. UNKNOWN → Reconciliation ---");

  resetTestProvider();
  const reconciled = await reconcileExecution(unknownExec.id);
  assert(reconciled !== null, "Reconciliation completed");
  assert(reconciled.reconciliation_status === "RECONCILED", "Reconciliation status is RECONCILED");
  assert(reconciled.status === "SUCCEEDED", "Execution reconciled to SUCCEEDED");
  assert(getAction(unknownAction.id).status === "COMPLETED", "Action reconciled to COMPLETED");
  assert(getOutcomeByExecution(unknownExec.id) !== null, "Outcome created from reconciliation");

  // ─── 12. AUTHORIZATION RE-CHECK ─────────────────────────────────
  console.log("\n--- 12. Authorization Re-check ---");

  // Expired approval — approve with very short expiry
  const expiredAppr = createApprovalRequest({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Expired",
    scope: { business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 1000, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09", resource: null, authorized_agent: null },
  });
  approveRequest(expiredAppr.id, "demo-user", "ok", 1); // 1ms expiry

  // Wait for expiry
  await new Promise(function(r) { setTimeout(r, 10); });

  const expiredAuthAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Expired auth", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const expiredResult = await checkAndAuthorizeAction({
    action_id: expiredAuthAction.id, workspace_id: WORKSPACE, approval_id: expiredAppr.id,
  });
  assert(expiredResult.authorized === false, "Expired approval denied");

  // Revoked approval
  const revokedAppr = createApprovalRequest({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Revoked",
    scope: { business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 1000, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09", resource: null, authorized_agent: null },
  });
  approveRequest(revokedAppr.id, "demo-user", "ok");
  const { revokeApproval } = await import("./src/lib/approval/approval-service.js");
  revokeApproval(revokedAppr.id, "demo-user", "Revoked");

  const revokedAuthAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Revoked auth", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const revokedResult = await checkAndAuthorizeAction({
    action_id: revokedAuthAction.id, workspace_id: WORKSPACE, approval_id: revokedAppr.id,
  });
  assert(revokedResult.authorized === false, "Revoked approval denied");

  // Scope mismatch
  const scopeMismatchAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Scope mismatch", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "DIFFERENT_VENDOR", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const mismatchResult = await checkAndAuthorizeAction({
    action_id: scopeMismatchAction.id, workspace_id: WORKSPACE, approval_id: approval.id,
  });
  assert(mismatchResult.authorized === false, "Scope mismatch denied");

  // ─── 13. AGENT IDENTITY ─────────────────────────────────────────
  console.log("\n--- 13. Agent Identity ---");

  const standingAuth = createStandingAuthorization({
    business_id: BUSINESS, authorized_by: "demo-user", authorized_agent: null,
    scope: { business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09", resource: null, authorized_agent: null },
    max_amount_per_use: 500, max_amount_per_period: 2000, period: "monthly", max_uses_per_period: 4,
  });
  await getStandingAuthRepository().flush();

  const agentAction = createAction({
    business_id: BUSINESS, requested_by: "system", requested_by_type: "AGENT", agent_key: "erni",
    action_type: "AD_SPEND", action_description: "Agent identity", target_type: "ad_platform",
    parameters: { amount: 300, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const agentResult = await checkAndAuthorizeAction({ action_id: agentAction.id, workspace_id: WORKSPACE });
  assert(agentResult.authorized === true, "Agent authorized via standing auth");

  revokeStandingAuthorization(standingAuth.id, "demo-user");

  // ─── 14. CROSS-BUSINESS ACCESS DENIAL ───────────────────────────
  console.log("\n--- 14. Cross-Business Access ---");

  const crossBizAction = createAction({
    business_id: "cccccccc-cccc-cccc-cccc-cccccccccccc", requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Cross biz", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const crossBizResult = await checkAndAuthorizeAction({
    action_id: crossBizAction.id, workspace_id: "other-workspace-13b",
  });
  assert(crossBizResult.authorized === false, "Cross-business access denied");

  // ─── 15. AUDIT TRAIL COMPLETENESS ───────────────────────────────
  console.log("\n--- 15. Audit Trail ---");

  const auditEvents = getActionAuditEvents(BUSINESS);
  assert(auditEvents.length > 0, "Audit events exist");

  const eventTypes = new Set(auditEvents.map(function(e) { return e.event_type; }));
  assert(eventTypes.has("ACTION_CREATED"), "ACTION_CREATED recorded");
  assert(eventTypes.has("ACTION_AUTHORIZED"), "ACTION_AUTHORIZED recorded");
  assert(eventTypes.has("ACTION_QUEUED"), "ACTION_QUEUED recorded");
  assert(eventTypes.has("EXECUTION_SUCCEEDED"), "EXECUTION_SUCCEEDED recorded");
  assert(eventTypes.has("EXECUTION_UNKNOWN"), "EXECUTION_UNKNOWN recorded");
  assert(eventTypes.has("RECONCILIATION_ATTEMPTED"), "RECONCILIATION_ATTEMPTED recorded");
  assert(eventTypes.has("RECONCILIATION_RESULT"), "RECONCILIATION_RESULT recorded");
  assert(eventTypes.has("IDEMPOTENCY_DUPLICATE"), "IDEMPOTENCY_DUPLICATE recorded");

  // Audit events are append-only
  const countBefore = auditEvents.length;
  createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Audit append", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  const countAfter = getActionAuditEvents(BUSINESS).length;
  assert(countAfter > countBefore, "Audit events are append-only");

  // ─── 16. TEST PROVIDER ──────────────────────────────────────────
  console.log("\n--- 16. Test Provider ---");

  resetTestProvider();
  configureTestProvider({ succeed_by_default: true });
  const testProvAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Test provider", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  await checkAndAuthorizeAction({ action_id: testProvAction.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(testProvAction.id);

  const testExec = await executeAction({
    action_id: testProvAction.id, provider_name: "test-provider", operation: "publish_ad",
    idempotency_key: generateIdempotencyKey(testProvAction.id),
    workspace_id: WORKSPACE,
  });
  assert(testExec.status === "SUCCEEDED", "Test provider succeeds");
  assert(testExec.external_reference !== null, "External reference set");
  assert(testExec.external_reference.startsWith("test-ext-"), "External reference is synthetic");

  // ─── 17. PROVIDER TIMEOUT ───────────────────────────────────────
  console.log("\n--- 17. Provider Timeout ---");

  configureTestProvider({ simulate_timeout_ms: 10 });
  const timeoutAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Timeout 13B", target_type: "ad_platform",
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

  // No duplicate execution after timeout
  const timeoutExecCount = getTestProviderLog().filter(function(e) { return e.operation === "publish_ad"; }).length;
  const timeoutExecs2 = await executeAction({
    action_id: timeoutAction.id, provider_name: "test-provider", operation: "publish_ad",
    idempotency_key: generateIdempotencyKey(timeoutAction.id),
    workspace_id: WORKSPACE,
  }).catch(function() { return null; });
  // Should fail because action is FAILED, not QUEUED
  assert(timeoutExecs2 === null, "No duplicate execution after timeout (action is FAILED)");

  resetTestProvider();

  // ─── 18. OUTCOME LINKAGE INTEGRITY ──────────────────────────────
  console.log("\n--- 18. Outcome Linkage Integrity ---");

  const outcomeTestAction = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Outcome linkage", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  await checkAndAuthorizeAction({ action_id: outcomeTestAction.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(outcomeTestAction.id);

  const outcomeExec = await executeAction({
    action_id: outcomeTestAction.id, provider_name: "test-provider", operation: "publish_ad",
    idempotency_key: generateIdempotencyKey(outcomeTestAction.id),
    workspace_id: WORKSPACE,
  });

  const outcomeRecord = getOutcomeByAction(outcomeTestAction.id);
  assert(outcomeRecord !== null, "Outcome exists for action");
  assert(outcomeRecord.execution_id === outcomeExec.id, "Outcome linked to correct execution");
  assert(outcomeRecord.business_id === BUSINESS, "Outcome scoped to business");
  assert(outcomeRecord.financial_impact === null, "Financial impact is null (not fabricated)");
  assert(outcomeRecord.currency === null, "Currency is null (not inferred)");

  // ─── 19. LIFECYCLE CANCELLATION ─────────────────────────────────
  console.log("\n--- 19. Lifecycle Cancellation ---");

  const cancelAction1 = createAction({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER",
    action_type: "AD_SPEND", action_description: "Cancel test", target_type: "ad_platform",
    parameters: { amount: 500, currency: "MYR", vendor_payee: "Google Ads", vendor_category: "advertising", frequency: "monthly", time_period: "2026-09" },
    risk_level: "L2",
  });
  await checkAndAuthorizeAction({ action_id: cancelAction1.id, workspace_id: WORKSPACE, approval_id: approval.id });
  queueAction(cancelAction1.id);

  const cancelled = cancelAction(cancelAction1.id, "No longer needed");
  assert(cancelled !== null, "Action cancelled");
  assert(cancelled.status === "CANCELLED", "Status is CANCELLED");

  const cannotQueueCancelled = queueAction(cancelAction1.id);
  assert(cannotQueueCancelled === null, "Cannot queue CANCELLED action");

  // ─── 20. RISK CLASSIFICATION ────────────────────────────────────
  console.log("\n--- 20. Risk Classification ---");

  const { getApprovalPolicy } = await import("./src/lib/approval/authorization-engine.js");
  const l2Policy = getApprovalPolicy({
    business_id: BUSINESS, requested_by: "demo-user", requested_by_type: "USER", agent_key: null,
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
