/**
 * Phase 12 Approval + Authorization Engine - Test Suite
 *
 * Tests the approval and authorization system.
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

import { createApprovalRequest, getApproval, approveRequest, rejectRequest, revokeApproval, expireOldApprovals } from "./src/lib/approval/approval-service";
import { createStandingAuthorization, getActiveStandingAuthorizations, matchStandingAuthorization, revokeStandingAuthorization } from "./src/lib/approval/approval-service";
import { getStandingAuthRepository } from "./src/lib/approval/standing-auth-repository";
import { checkAuthorization, canApproveAction, getApprovalPolicy } from "./src/lib/approval/authorization-engine";
import { seedDemoApprovalAccess } from "./src/lib/approval/access-control";
import { recordApprovalAuditEvent, getApprovalAuditEvents, clearApprovalAuditEvents } from "./src/lib/approval/audit";
import { createDecision } from "./src/lib/decisions/decision-service";

// Seed demo access
seedDemoApprovalAccess();
clearApprovalAuditEvents();

// Use UUID constants matching DB test data
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
  console.log("\n=== Phase 12 Approval + Authorization Engine Tests ===\n");

  // Test 1: Create approval request
  console.log("--- Approval Request Tests ---");
  const scope = {
    business_id: DEMO_BUSINESS,
    action_type: "AD_SPEND",
    max_amount: 5000,
    currency: "MYR",
    vendor_payee: "Google Ads",
    vendor_category: "advertising",
    frequency: "monthly",
    time_period: "2024-01",
    resource: null,
    authorized_agent: null,
  };

  const approval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "Spend RM5000 on Google Ads",
    scope,
    decision_id: "decision-123",
  });
  assert(approval.id !== undefined, "Approval request created with ID");
  assert(approval.status === "PENDING", "Approval status is PENDING");
  assert(approval.risk_level === "L2", "Risk level is L2 for payment under 10000");
  assert(approval.decision_id === "decision-123", "Decision ID linked");

  // Test 2: Payment always requires approval
  const paymentScope = { ...scope, action_type: "PAYMENT", max_amount: 100 };
  const paymentApproval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "PAYMENT",
    action_description: "Payment of RM100",
    scope: paymentScope,
  });
  assert(paymentApproval.risk_level === "L2", "Payment under 10000 is L2");
  assert(paymentApproval.risk_level !== "L0", "Payment never L0");

  // Test 3: Approve request
  const approved = approveRequest(approval.id, DEMO_USER, "Approved by owner");
  assert(approved !== null, "Approval granted");
  assert(approved.status === "APPROVED", "Status is APPROVED");
  assert(approved.approver_id === DEMO_USER, "Approver recorded");
  assert(approved.expires_at !== null, "Expiry set");

  // Test 4: Reject request
  const rejectApproval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "PURCHASE",
    action_description: "Purchase equipment",
    scope: { ...scope, action_type: "PURCHASE" },
  });
  const rejected = rejectRequest(rejectApproval.id, DEMO_USER, "Budget exceeded");
  assert(rejected !== null, "Rejection recorded");
  assert(rejected.status === "REJECTED", "Status is REJECTED");

  // Test 5: Revoke approval
  const revokeApproval2 = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "TRANSFER",
    action_description: "Transfer funds",
    scope: { ...scope, action_type: "TRANSFER" },
  });
  approveRequest(revokeApproval2.id, DEMO_USER, "Approved");
  const revoked = revokeApproval(revokeApproval2.id, DEMO_USER, "Policy change");
  assert(revoked !== null, "Revocation recorded");
  assert(revoked.status === "REVOKED", "Status is REVOKED");

  // Test 6: Agent cannot approve their own action
  const agentApproval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: "erni",
    requested_by_type: "AGENT",
    action_type: "AD_SPEND",
    action_description: "Agent requested ad spend",
    scope: { ...scope, action_type: "AD_SPEND" },
  });
  const selfApprove = canApproveAction({
    approver_id: "erni",
    workspace_id: "demo-workspace",
    business_id: DEMO_BUSINESS,
    approval: agentApproval,
  });
  assert(selfApprove.allowed === false, "Agent cannot approve own action");
  assert(selfApprove.reason === "Requester cannot approve their own action", "Correct rejection reason");

  // Test 7: Authorization check - requires approval (AD_SPEND is payment action)
  const proposedAction = {
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    agent_key: null,
    action_type: "AD_SPEND",
    action_description: "Spend on ads",
    scope,
    risk_level: "L2",
    decision_id: "decision-123",
  };
  const authResult = await checkAuthorization({
    action: proposedAction,
    workspace_id: "demo-workspace",
  });
  assert(authResult.status === "PAYMENT_REQUIRES_APPROVAL", "Payment action requires approval");
  assert(authResult.approval_required === true, "Approval required flag set");

  // Test 8: Authorization with valid approval
  const authWithApproval = await checkAuthorization({
    action: proposedAction,
    workspace_id: "demo-workspace",
    approval: approved,
  });
  assert(authWithApproval.status === "AUTHORIZED", "Authorized with valid approval");
  assert(authWithApproval.authorized === true, "Authorized flag true");

  // Test 9: Scope mismatch
  const mismatchScope = { ...scope, max_amount: 10000 }; // Exceeds approved 5000
  const mismatchAction = { ...proposedAction, scope: mismatchScope };
  const mismatchResult = await checkAuthorization({
    action: mismatchAction,
    workspace_id: "demo-workspace",
    approval: approved,
  });
  assert(mismatchResult.status === "SCOPE_MISMATCH", "Scope mismatch detected");
  assert(mismatchResult.authorized === false, "Not authorized due to scope mismatch");

  // Test 10: Expired approval
  const expiredApproval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "Old approval",
    scope,
  });
  // Manually set expiry to past
  expiredApproval.status = "APPROVED";
  expiredApproval.expires_at = new Date(Date.now() - 1000).toISOString();
  const expiredResult = await checkAuthorization({
    action: proposedAction,
    workspace_id: "demo-workspace",
    approval: expiredApproval,
  });
  assert(expiredResult.status === "EXPIRED", "Expired approval rejected");

  // Test 11: Standing authorization
  const standingAuth = createStandingAuthorization({
    business_id: DEMO_BUSINESS,
    authorized_by: DEMO_USER,
    authorized_agent: "erni",
    scope: { ...scope, action_type: "AD_SPEND", max_amount: 1000 },
    max_amount_per_use: 1000,
    max_amount_per_period: 5000,
    period: "monthly",
    max_uses_per_period: 5,
  });
  await getStandingAuthRepository().flush();
  assert(standingAuth.id !== undefined, "Standing authorization created");
  assert(standingAuth.max_uses_per_period === 5, "Usage limit set");

  // Test 12: Standing authorization matching
  const standingAction = {
    action_type: "AD_SPEND",
    scope: { ...scope, max_amount: 500 },
    agent_key: "erni",
  };
  const matched = await matchStandingAuthorization(DEMO_BUSINESS, standingAction);
  assert(matched !== null, "Standing authorization matched");
  assert(matched.id === standingAuth.id, "Correct standing authorization");

  // Test 13: Standing authorization usage limit
  for (let i = 0; i < 5; i++) {
    await matchStandingAuthorization(DEMO_BUSINESS, standingAction);
  }
  const exceeded = await matchStandingAuthorization(DEMO_BUSINESS, standingAction);
  assert(exceeded === null, "Standing auth rejected after usage limit");

  // Test 13b: Standing auth for different agent not matched
  const otherAgentAction = { ...standingAction, agent_key: "eddy" };
  const notMatched = await matchStandingAuthorization(DEMO_BUSINESS, otherAgentAction);
  assert(notMatched === null, "Standing auth not matched for different agent");

  // Test 14: Vendor mismatch in standing auth
  const vendorStanding = createStandingAuthorization({
    business_id: DEMO_BUSINESS,
    authorized_by: DEMO_USER,
    authorized_agent: null,
    scope: { ...scope, action_type: "PURCHASE", vendor_payee: "Vendor A" },
    max_amount_per_use: 1000,
    max_amount_per_period: 10000,
    period: "monthly",
    max_uses_per_period: null,
  });
  await getStandingAuthRepository().flush();
  const vendorMismatchAction1 = {
    action_type: "PURCHASE",
    scope: { ...scope, action_type: "PURCHASE", vendor_payee: "Vendor B" },
    agent_key: null,
  };
  const vendorMismatch = await matchStandingAuthorization(DEMO_BUSINESS, vendorMismatchAction1);
  assert(vendorMismatch === null, "Vendor mismatch rejected");

  // Test 15: Currency mismatch
  const currencyMismatchAction1 = {
    action_type: "AD_SPEND",
    scope: { ...scope, currency: "USD" },
    agent_key: "erni",
  };
  const currencyMismatch = await matchStandingAuthorization(DEMO_BUSINESS, currencyMismatchAction1);
  assert(currencyMismatch === null, "Currency mismatch rejected");

  // Test 16: SYSTEM_CHANGE is L2 (consequential business), requires approval
  const l0Action = {
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    agent_key: null,
    action_type: "SYSTEM_CHANGE",
    action_description: "Internal config change",
    scope: { ...scope, action_type: "SYSTEM_CHANGE" },
    risk_level: "L2",
    decision_id: null,
  };
  const l0Result = await checkAuthorization({
    action: l0Action,
    workspace_id: "demo-workspace",
  });
  assert(l0Result.status === "REQUIRES_APPROVAL", "SYSTEM_CHANGE (L2) requires approval");

  // Test 17: Payment action always requires approval even if L0
  const paymentAction = {
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    agent_key: null,
    action_type: "PAYMENT",
    action_description: "Tiny payment",
    scope: { ...scope, action_type: "PAYMENT", max_amount: 1 },
    risk_level: "L0",
    decision_id: null,
  };
  const paymentResult = await checkAuthorization({
    action: paymentAction,
    workspace_id: "demo-workspace",
  });
  assert(paymentResult.status === "PAYMENT_REQUIRES_APPROVAL", "Payment always requires approval");

  // Test 18: Agent requesting payment action - agents cannot directly authorize, only request approvals
  // The checkAuthorization for agents uses "system" as user_id which fails access check
  // This is correct behavior - agents request approvals, they don't authorize directly
  const agentPaymentAction1 = {
    ...paymentAction,
    requested_by: "erni",
    requested_by_type: "AGENT",
    agent_key: "erni",
  };
  const agentPaymentResult = await checkAuthorization({
    action: agentPaymentAction1,
    workspace_id: "demo-workspace",
  });
  // Agents authenticate successfully but cannot self-approve payment.
  // Without an explicit approval, the result is REQUIRES_APPROVAL.
  assert(
    agentPaymentResult.status === "PAYMENT_REQUIRES_APPROVAL",
    "Agent cannot self-approve payment — requires human approval"
  );

  // Test 19: Decision creates approval request (recommendation must exist)
  // We can't test this fully without a real recommendation, so we'll skip

  // Test 20: Approval policy
  const policy = getApprovalPolicy(proposedAction);
  assert(policy.risk_level === "L2", "Policy risk level correct");
  assert(policy.approval_required === true, "Policy says approval required");

  // Test 21: Audit events
  const events = getApprovalAuditEvents(DEMO_BUSINESS);
  const approvalRequestedEvent = events.find(e => e.event_type === "APPROVAL_REQUESTED");
  assert(approvalRequestedEvent !== undefined, "APPROVAL_REQUESTED audit event recorded");
  const approvalGrantedEvent = events.find(e => e.event_type === "APPROVAL_GRANTED");
  assert(approvalGrantedEvent !== undefined, "APPROVAL_GRANTED audit event recorded");
  const scopeMismatchEvent = events.find(e => e.event_type === "SCOPE_MISMATCH");
  assert(scopeMismatchEvent !== undefined, "SCOPE_MISMATCH audit event recorded");
  const agentSelfApprovalEvent = events.find(e => e.event_type === "AGENT_SELF_APPROVAL_BLOCKED");
  assert(agentSelfApprovalEvent !== undefined, "AGENT_SELF_APPROVAL_BLOCKED audit event recorded");

  // Test 22: Business isolation
  const otherBusinessAction = {
    ...proposedAction,
    business_id: "other-business",
    scope: { ...scope, business_id: "other-business" },
  };
  const isolationResult = await checkAuthorization({
    action: otherBusinessAction,
    workspace_id: "demo-workspace",
  });
  assert(isolationResult.status === "UNAUTHORIZED", "Cross-business access denied");

  // Test 23: Revoked standing authorization
  revokeStandingAuthorization(standingAuth.id, DEMO_USER);
  const revokedStanding = await matchStandingAuthorization(DEMO_BUSINESS, standingAction);
  assert(revokedStanding === null, "Revoked standing authorization not matched");

  // Test 24: Approval expiry
  const now = new Date();
  const soonExpiringApproval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "Expiring soon",
    scope,
  });
  soonExpiringApproval.status = "APPROVED";
  soonExpiringApproval.expires_at = new Date(now.getTime() - 1).toISOString();
  const expiredCheck = expireOldApprovals();

  // Test 25: User cannot approve their own action
  const userSelfApproval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "User requested ad spend",
    scope: { ...scope, action_type: "AD_SPEND" },
  });
  const userSelfApprove = canApproveAction({
    approver_id: DEMO_USER,
    workspace_id: "demo-workspace",
    business_id: DEMO_BUSINESS,
    approval: userSelfApproval,
  });
  assert(userSelfApprove.allowed === false, "User cannot approve own action");
  assert(userSelfApprove.reason === "Requester cannot approve their own action", "Correct rejection reason for user");

  // Test 26: Approval with scope mismatch on vendor
  const vendorApproval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "PURCHASE",
    action_description: "Purchase from Vendor A",
    scope: { ...scope, action_type: "PURCHASE", vendor_payee: "Vendor A" },
  });
  const vendorApproved = approveRequest(vendorApproval.id, DEMO_USER, "Approved");
  const vendorMismatchAction2 = {
    ...proposedAction,
    action_type: "PURCHASE",
    scope: { ...scope, action_type: "PURCHASE", vendor_payee: "Vendor B" },
  };
  const vendorMismatchResult = await checkAuthorization({
    action: vendorMismatchAction2,
    workspace_id: "demo-workspace",
    approval: vendorApproved,
  });
  assert(vendorMismatchResult.status === "SCOPE_MISMATCH", "Vendor mismatch rejected");

  // Test 27: Approval with currency mismatch
  const currencyApproval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "Spend in MYR",
    scope: { ...scope, currency: "MYR" },
  });
  const currencyApproved = approveRequest(currencyApproval.id, DEMO_USER, "Approved");
  const currencyMismatchAction2 = {
    ...proposedAction,
    scope: { ...scope, currency: "USD" },
  };
  const currencyMismatchResult = await checkAuthorization({
    action: currencyMismatchAction2,
    workspace_id: "demo-workspace",
    approval: currencyApproved,
  });
  assert(currencyMismatchResult.status === "SCOPE_MISMATCH", "Currency mismatch rejected");

  // Test 28: Approval with time period mismatch
  const timeApproval = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "Monthly spend",
    scope: { ...scope, time_period: "2024-01", frequency: "monthly" },
  });
  const timeApproved = approveRequest(timeApproval.id, DEMO_USER, "Approved");
  const timeMismatchAction2 = {
    ...proposedAction,
    scope: { ...scope, time_period: "2024-02", frequency: "monthly" },
  };
  const timeMismatchResult = await checkAuthorization({
    action: timeMismatchAction2,
    workspace_id: "demo-workspace",
    approval: timeApproved,
  });
  assert(timeMismatchResult.status === "SCOPE_MISMATCH", "Time period mismatch rejected");

  // Test 29: Revoked approval cannot be used
  const revokedApproval2 = createApprovalRequest({
    business_id: DEMO_BUSINESS,
    requested_by: DEMO_USER,
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "To be revoked",
    scope,
  });
  const revokedApproved = approveRequest(revokedApproval2.id, DEMO_USER, "Approved");
  const revokedAfterRevoke = revokeApproval(revokedApproved.id, DEMO_USER, "Revoked");
  const revokedResult = await checkAuthorization({
    action: proposedAction,
    workspace_id: "demo-workspace",
    approval: revokedAfterRevoke,
  });
  assert(revokedResult.status === "REVOKED", "Revoked approval rejected");

  // Test 30: Standing authorization with max_uses_per_period = null (unlimited)
  const unlimitedStanding = createStandingAuthorization({
    business_id: DEMO_BUSINESS,
    authorized_by: DEMO_USER,
    authorized_agent: "eddy",
    scope: { ...scope, action_type: "AD_SPEND", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 10000,
    period: "monthly",
    max_uses_per_period: null,
  });
  await getStandingAuthRepository().flush();
  for (let i = 0; i < 100; i++) {
    const unlimitedMatch = await matchStandingAuthorization(DEMO_BUSINESS, {
      action_type: "AD_SPEND",
      scope: { ...scope, max_amount: 300 },
      agent_key: "eddy",
    });
    assert(unlimitedMatch !== null, `Unlimited standing auth use ${i + 1} succeeded`);
  }

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();