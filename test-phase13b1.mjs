/**
 * Phase 13B.1 — Decision + Approval Persistence Hardening Test Suite
 *
 * Tests persistence of decisions, approvals, standing authorizations,
 * and approval audit events via write-through cache repositories.
 *
 * Note: Without a running Supabase instance, persistence is tested via
 * the in-memory write-through cache. The migration SQL is tested separately.
 */

import { getDecisionRepository, resetDecisionRepository } from "./src/lib/decisions/decision-repository.js";
import { getApprovalRepository, resetApprovalRepository } from "./src/lib/approval/approval-repository.js";
import { getStandingAuthRepository, resetStandingAuthRepository } from "./src/lib/approval/standing-auth-repository.js";
import { getApprovalAuditRepository, resetApprovalAuditRepository } from "./src/lib/approval/audit-repository.js";
import { recordApprovalAuditEvent, getApprovalAuditEvents, clearApprovalAuditEvents } from "./src/lib/approval/audit.js";
import { determineRiskLevel } from "./src/lib/approval/approval-service.js";
import { seedDemoApprovalAccess } from "./src/lib/approval/access-control.js";

seedDemoApprovalAccess();
clearApprovalAuditEvents();

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

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message} — expected "${expected}", got "${actual}"`);
    failed++;
  }
}

function now() { return new Date().toISOString(); }

function makeDecision(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    business_id: "demo-business",
    recommendation_id: "rec-001",
    investigation_id: null,
    trigger_id: null,
    decision_type: "APPROVE",
    decision_maker: "demo-user",
    reason: "Test reason",
    original_scope: "Original scope",
    modified_scope: null,
    status: "ACTIVE",
    superseded_by: null,
    decision_context: {
      recommendation_title: "Test",
      recommendation_description: "Desc",
      recommendation_confidence: 0.5,
      recommendation_impact: "Impact",
      recommendation_risk: "Risk",
    },
    decided_at: now(),
    created_at: now(),
    updated_at: now(),
    ...overrides,
  };
}

function makeApproval(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    business_id: "demo-business",
    decision_id: null,
    requested_by: "demo-user",
    requested_by_type: "USER",
    action_type: "AD_SPEND",
    action_description: "Test approval",
    scope: {
      business_id: "demo-business",
      action_type: "AD_SPEND",
      max_amount: 5000,
      currency: "MYR",
      vendor_payee: null,
      vendor_category: null,
      frequency: "monthly",
      time_period: "2026-09",
      resource: null,
      authorized_agent: null,
    },
    risk_level: "L2",
    status: "PENDING",
    approver_id: null,
    approval_reason: null,
    rejection_reason: null,
    standing_authorization_id: null,
    requested_at: now(),
    approved_at: null,
    expires_at: null,
    revoked_at: null,
    created_at: now(),
    updated_at: now(),
    ...overrides,
  };
}

function makeStandingAuth(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    business_id: "demo-business",
    authorized_by: "owner-user",
    authorized_agent: null,
    scope: {
      business_id: "demo-business",
      action_type: "AD_SPEND",
      max_amount: 3000,
      currency: "MYR",
      vendor_payee: null,
      vendor_category: null,
      frequency: "monthly",
      time_period: null,
      resource: null,
      authorized_agent: null,
    },
    max_amount_per_use: 3000,
    max_amount_per_period: 10000,
    period: "monthly",
    max_uses_per_period: 5,
    active: true,
    revoked: false,
    revoked_at: null,
    revoked_by: null,
    effective_from: now(),
    effective_until: null,
    created_at: now(),
    updated_at: now(),
    ...overrides,
  };
}

async function runTests() {
  console.log("\n=== Phase 13B.1 — Decision + Approval Persistence Hardening Tests ===\n");

  const BUSINESS = "demo-business";
  const BUSINESS2 = "demo-business-2";

  // Reset all repositories
  resetDecisionRepository();
  resetApprovalRepository();
  resetStandingAuthRepository();
  resetApprovalAuditRepository();

  // ─── 1. DECISION REPOSITORY: CREATE & READ ──────────────────────
  console.log("\n--- 1. Decision Repository: Create & Read ---");

  const repo = getDecisionRepository();
  const d1 = makeDecision({ id: "d-001", business_id: BUSINESS, decision_type: "APPROVE" });
  repo.create(d1);

  const fromCache = repo.getById("d-001");
  assert(fromCache !== null, "Decision retrievable from cache");
  assertEqual(fromCache.decision_type, "APPROVE", "Decision type correct");
  assertEqual(fromCache.status, "ACTIVE", "Decision status ACTIVE");
  assertEqual(fromCache.business_id, BUSINESS, "Business ID correct");

  // ─── 2. DECISION REPOSITORY: GET BY BUSINESS ────────────────────
  console.log("\n--- 2. Decision Repository: Get By Business ---");

  const d2 = makeDecision({ id: "d-002", business_id: BUSINESS, decision_type: "REJECT" });
  const d3 = makeDecision({ id: "d-003", business_id: BUSINESS2, decision_type: "APPROVE" });
  repo.create(d2);
  repo.create(d3);

  const biz1Decisions = repo.getByBusiness(BUSINESS);
  assertEqual(biz1Decisions.length, 2, "Business 1 has 2 decisions");
  assert(biz1Decisions.every((d) => d.business_id === BUSINESS), "All decisions belong to business 1");

  const biz2Decisions = repo.getByBusiness(BUSINESS2);
  assertEqual(biz2Decisions.length, 1, "Business 2 has 1 decision");
  assertEqual(biz2Decisions[0].id, "d-003", "Business 2 decision correct");

  // ─── 3. DECISION REPOSITORY: GET ACTIVE BY RECOMMENDATION ───────
  console.log("\n--- 3. Decision Repository: Get Active By Recommendation ---");

  const d4 = makeDecision({ id: "d-004", business_id: BUSINESS, recommendation_id: "rec-002", status: "ACTIVE" });
  repo.create(d4);

  const active = repo.getActiveByRecommendation("rec-002");
  assert(active !== null, "Active decision found for recommendation");
  assertEqual(active.id, "d-004", "Correct active decision");

  // Supersede it
  repo.update("d-004", { status: "SUPERSEDED", superseded_by: "d-005" });
  const afterSupersede = repo.getActiveByRecommendation("rec-002");
  assert(afterSupersede === null, "No active decision after supersede");

  // ─── 4. DECISION REPOSITORY: UPDATE ─────────────────────────────
  console.log("\n--- 4. Decision Repository: Update ---");

  const d5 = makeDecision({ id: "d-005", business_id: BUSINESS, status: "ACTIVE" });
  repo.create(d5);

  repo.update("d-005", { status: "CANCELLED" });
  const cancelled = repo.getById("d-005");
  assertEqual(cancelled.status, "CANCELLED", "Decision updated to CANCELLED");

  // ─── 5. DECISION REPOSITORY: SORT ORDER ─────────────────────────
  console.log("\n--- 5. Decision Repository: Sort Order ---");

  // Decisions are sorted by created_at descending (newest first)
  const sorted = repo.getByBusiness(BUSINESS);
  for (let i = 1; i < sorted.length; i++) {
    assert(
      sorted[i - 1].created_at >= sorted[i].created_at,
      `Decision ${i - 1} created_at >= Decision ${i} created_at`
    );
  }

  // ─── 6. DECISION REPOSITORY: CLEAR CACHE ────────────────────────
  console.log("\n--- 6. Decision Repository: Clear Cache ---");

  repo.clearCache();
  const afterClear = repo.getById("d-001");
  assert(afterClear === null, "Decision cache cleared");

  // Re-create for further tests
  repo.create(makeDecision({ id: "d-001", business_id: BUSINESS, decision_type: "APPROVE" }));

  // ─── 7. APPROVAL REPOSITORY: CREATE & READ ──────────────────────
  console.log("\n--- 7. Approval Repository: Create & Read ---");

  const approvalRepo = getApprovalRepository();
  const a1 = makeApproval({ id: "a-001", business_id: BUSINESS, status: "PENDING" });
  approvalRepo.create(a1);

  const aFromCache = approvalRepo.getById("a-001");
  assert(aFromCache !== null, "Approval retrievable from cache");
  assertEqual(aFromCache.status, "PENDING", "Approval status PENDING");
  assertEqual(aFromCache.risk_level, "L2", "Risk level L2");

  // ─── 8. APPROVAL REPOSITORY: GET BY BUSINESS ────────────────────
  console.log("\n--- 8. Approval Repository: Get By Business ---");

  const a2 = makeApproval({ id: "a-002", business_id: BUSINESS, status: "APPROVED" });
  const a3 = makeApproval({ id: "a-003", business_id: BUSINESS2, status: "PENDING" });
  approvalRepo.create(a2);
  approvalRepo.create(a3);

  const biz1Approvals = approvalRepo.getByBusiness(BUSINESS);
  assertEqual(biz1Approvals.length, 2, "Business 1 has 2 approvals");

  const biz2Approvals = approvalRepo.getByBusiness(BUSINESS2);
  assertEqual(biz2Approvals.length, 1, "Business 2 has 1 approval");

  // ─── 9. APPROVAL REPOSITORY: GET PENDING BY BUSINESS ────────────
  console.log("\n--- 9. Approval Repository: Get Pending By Business ---");

  const pending = approvalRepo.getPendingByBusiness(BUSINESS);
  assertEqual(pending.length, 1, "Business 1 has 1 pending approval");
  assertEqual(pending[0].id, "a-001", "Pending approval is a-001");
  assertEqual(pending[0].status, "PENDING", "Pending status correct");

  // ─── 10. APPROVAL REPOSITORY: GET ALL ───────────────────────────
  console.log("\n--- 10. Approval Repository: Get All ---");

  const all = approvalRepo.getAll();
  assertEqual(all.length, 3, "All 3 approvals retrieved");

  // ─── 11. APPROVAL REPOSITORY: UPDATE ────────────────────────────
  console.log("\n--- 11. Approval Repository: Update ---");

  approvalRepo.update("a-001", {
    status: "APPROVED",
    approver_id: "owner-user",
    approved_at: now(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  });

  const updated = approvalRepo.getById("a-001");
  assertEqual(updated.status, "APPROVED", "Approval updated to APPROVED");
  assertEqual(updated.approver_id, "owner-user", "Approver ID set");

  // ─── 12. APPROVAL REPOSITORY: CLEAR CACHE ───────────────────────
  console.log("\n--- 12. Approval Repository: Clear Cache ---");

  approvalRepo.clearCache();
  const afterClearA = approvalRepo.getById("a-001");
  assert(afterClearA === null, "Approval cache cleared");

  // Re-create for further tests
  approvalRepo.create(makeApproval({ id: "a-001", business_id: BUSINESS, status: "PENDING" }));
  approvalRepo.update("a-001", { status: "APPROVED", approver_id: "owner-user", approved_at: now(), expires_at: new Date(Date.now() + 86400000).toISOString() });

  // ─── 13. STANDING AUTH REPOSITORY: CREATE & READ ────────────────
  console.log("\n--- 13. Standing Auth Repository: Create & Read ---");

  const saRepo = getStandingAuthRepository();
  const sa1 = makeStandingAuth({ id: "sa-001", business_id: BUSINESS, active: true, revoked: false });
  saRepo.create(sa1);

  const saFromCache = saRepo.getById("sa-001");
  assert(saFromCache !== null, "Standing auth retrievable from cache");
  assertEqual(saFromCache.active, true, "Standing auth active");
  assertEqual(saFromCache.revoked, false, "Standing auth not revoked");

  // ─── 14. STANDING AUTH REPOSITORY: GET ACTIVE BY BUSINESS ───────
  console.log("\n--- 14. Standing Auth Repository: Get Active By Business ---");

  const sa2 = makeStandingAuth({ id: "sa-002", business_id: BUSINESS, active: true, revoked: false });
  const sa3 = makeStandingAuth({ id: "sa-003", business_id: BUSINESS, active: false, revoked: true });
  const sa4 = makeStandingAuth({ id: "sa-004", business_id: BUSINESS2, active: true, revoked: false });
  saRepo.create(sa2);
  saRepo.create(sa3);
  saRepo.create(sa4);

  const activeSA = saRepo.getActiveByBusiness(BUSINESS);
  assertEqual(activeSA.length, 2, "Business 1 has 2 active standing auths");
  assert(activeSA.some((a) => a.id === "sa-001"), "sa-001 is active");
  assert(activeSA.some((a) => a.id === "sa-002"), "sa-002 is active");

  const activeSA2 = saRepo.getActiveByBusiness(BUSINESS2);
  assertEqual(activeSA2.length, 1, "Business 2 has 1 active standing auth");

  // ─── 15. STANDING AUTH REPOSITORY: UPDATE (REVOKE) ──────────────
  console.log("\n--- 15. Standing Auth Repository: Update (Revoke) ---");

  saRepo.update("sa-001", { active: false, revoked: true, revoked_at: now(), revoked_by: "owner-user" });
  const revokedSA = saRepo.getById("sa-001");
  assertEqual(revokedSA.revoked, true, "Standing auth revoked");
  assertEqual(revokedSA.active, false, "Standing auth inactive");

  const activeAfterRevoke = saRepo.getActiveByBusiness(BUSINESS);
  assertEqual(activeAfterRevoke.length, 1, "1 active standing auth after revoke (sa-002)");
  assertEqual(activeAfterRevoke[0].id, "sa-002", "Remaining active is sa-002");

  // ─── 16. STANDING AUTH REPOSITORY: CLEAR CACHE ──────────────────
  console.log("\n--- 16. Standing Auth Repository: Clear Cache ---");

  saRepo.clearCache();
  const afterClearSA = saRepo.getById("sa-001");
  assert(afterClearSA === null, "Standing auth cache cleared");

  // ─── 17. APPROVAL AUDIT REPOSITORY: CREATE & READ ──────────────
  console.log("\n--- 17. Approval Audit Repository: Create & Read ---");

  const auditRepo = getApprovalAuditRepository();
  const e1 = {
    id: crypto.randomUUID(),
    business_id: BUSINESS,
    approval_id: "a-001",
    event_type: "APPROVAL_REQUESTED",
    actor: "demo-user",
    actor_type: "USER",
    details: { action_type: "AD_SPEND" },
    timestamp: now(),
  };
  auditRepo.create(e1);

  const eFromCache = auditRepo.getByBusiness(BUSINESS);
  assertEqual(eFromCache.length, 1, "Audit event retrievable from cache");
  assertEqual(eFromCache[0].event_type, "APPROVAL_REQUESTED", "Event type correct");

  // ─── 18. APPROVAL AUDIT REPOSITORY: GET BY APPROVAL ID ──────────
  console.log("\n--- 18. Approval Audit Repository: Get By Approval ID ---");

  const e2 = {
    id: crypto.randomUUID(),
    business_id: BUSINESS,
    approval_id: "a-001",
    event_type: "APPROVAL_GRANTED",
    actor: "owner-user",
    actor_type: "USER",
    details: {},
    timestamp: now(),
  };
  auditRepo.create(e2);

  const byApproval = auditRepo.getByApprovalId("a-001");
  assertEqual(byApproval.length, 2, "2 audit events for approval a-001");
  assert(byApproval.some((e) => e.event_type === "APPROVAL_REQUESTED"), "Has APPROVAL_REQUESTED");
  assert(byApproval.some((e) => e.event_type === "APPROVAL_GRANTED"), "Has APPROVAL_GRANTED");

  // ─── 19. APPROVAL AUDIT REPOSITORY: CLEAR ───────────────────────
  console.log("\n--- 19. Approval Audit Repository: Clear ---");

  auditRepo.clearCache();
  const afterClearAudit = auditRepo.getByBusiness(BUSINESS);
  assertEqual(afterClearAudit.length, 0, "Audit cache cleared");

  // ─── 20. AUDIT VIA audit.ts (integration) ──────────────────────
  console.log("\n--- 20. Audit Via audit.ts (Integration) ---");

  const recorded = recordApprovalAuditEvent({
    business_id: BUSINESS,
    approval_id: "a-integration",
    event_type: "APPROVAL_REQUESTED",
    actor: "demo-user",
    actor_type: "USER",
    details: { action_type: "PAYMENT" },
  });
  assert(recorded.id !== undefined, "Audit event recorded via audit.ts");
  assert(recorded.timestamp !== undefined, "Timestamp set");

  const events = getApprovalAuditEvents(BUSINESS);
  assert(events.length >= 1, "Audit events retrievable via audit.ts");
  assert(events.some((e) => e.approval_id === "a-integration"), "Integration event found");

  clearApprovalAuditEvents();
  const afterClearIntegration = getApprovalAuditEvents(BUSINESS);
  assertEqual(afterClearIntegration.length, 0, "Audit events cleared via audit.ts");

  // ─── 21. RISK LEVEL DETERMINATION ──────────────────────────────
  console.log("\n--- 21. Risk Level Determination ---");

  const l1Risk = determineRiskLevel({
    action_type: "CUSTOMER_MESSAGE",
    scope: { business_id: BUSINESS, action_type: "CUSTOMER_MESSAGE", max_amount: null, currency: null, vendor_payee: null, vendor_category: null, frequency: null, time_period: null, resource: null, authorized_agent: null },
  });
  assertEqual(l1Risk, "L1", "CUSTOMER_MESSAGE is L1");

  const l2Risk = determineRiskLevel({
    action_type: "AD_SPEND",
    scope: { business_id: BUSINESS, action_type: "AD_SPEND", max_amount: 5000, currency: "MYR", vendor_payee: null, vendor_category: null, frequency: null, time_period: null, resource: null, authorized_agent: null },
  });
  assertEqual(l2Risk, "L2", "AD_SPEND <= 10k is L2");

  const l3Risk = determineRiskLevel({
    action_type: "PAYMENT",
    scope: { business_id: BUSINESS, action_type: "PAYMENT", max_amount: 50000, currency: "MYR", vendor_payee: null, vendor_category: null, frequency: null, time_period: null, resource: null, authorized_agent: null },
  });
  assertEqual(l3Risk, "L3", "PAYMENT > 10k is L3");

  const contractRisk = determineRiskLevel({
    action_type: "CONTRACT",
    scope: { business_id: BUSINESS, action_type: "CONTRACT", max_amount: null, currency: null, vendor_payee: null, vendor_category: null, frequency: null, time_period: null, resource: null, authorized_agent: null },
  });
  assertEqual(contractRisk, "L2", "CONTRACT is L2");

  // ─── 22. MULTI-BUSINESS ISOLATION ──────────────────────────────
  console.log("\n--- 22. Multi-Business Isolation ---");

  resetDecisionRepository();
  resetApprovalRepository();
  resetStandingAuthRepository();
  resetApprovalAuditRepository();

  const b1d = makeDecision({ id: "b1-d1", business_id: "biz-1" });
  const b2d = makeDecision({ id: "b2-d1", business_id: "biz-2" });
  const b1a = makeApproval({ id: "b1-a1", business_id: "biz-1" });
  const b2a = makeApproval({ id: "b2-a1", business_id: "biz-2" });
  const b1sa = makeStandingAuth({ id: "b1-sa1", business_id: "biz-1" });
  const b2sa = makeStandingAuth({ id: "b2-sa1", business_id: "biz-2" });

  getDecisionRepository().create(b1d);
  getDecisionRepository().create(b2d);
  getApprovalRepository().create(b1a);
  getApprovalRepository().create(b2a);
  getStandingAuthRepository().create(b1sa);
  getStandingAuthRepository().create(b2sa);

  const b1Decisions = getDecisionRepository().getByBusiness("biz-1");
  const b2Decisions = getDecisionRepository().getByBusiness("biz-2");
  assert(b1Decisions.every((d) => d.business_id === "biz-1"), "Biz-1 decisions isolated");
  assert(b2Decisions.every((d) => d.business_id === "biz-2"), "Biz-2 decisions isolated");

  const b1Approvals = getApprovalRepository().getByBusiness("biz-1");
  const b2Approvals = getApprovalRepository().getByBusiness("biz-2");
  assert(b1Approvals.every((a) => a.business_id === "biz-1"), "Biz-1 approvals isolated");
  assert(b2Approvals.every((a) => a.business_id === "biz-2"), "Biz-2 approvals isolated");

  const b1SA = getStandingAuthRepository().getActiveByBusiness("biz-1");
  const b2SA = getStandingAuthRepository().getActiveByBusiness("biz-2");
  assert(b1SA.every((s) => s.business_id === "biz-1"), "Biz-1 standing auths isolated");
  assert(b2SA.every((s) => s.business_id === "biz-2"), "Biz-2 standing auths isolated");

  // ─── 23. CACHE CLEAR SIMULATES RESTART ─────────────────────────
  console.log("\n--- 23. Cache Clear Simulates Restart ---");

  const savedId = "restart-test";
  getDecisionRepository().create(makeDecision({ id: savedId, business_id: BUSINESS }));

  // Verify exists before clear
  assert(getDecisionRepository().getById(savedId) !== null, "Decision exists before clear");

  // Clear cache
  getDecisionRepository().clearCache();

  // Without Supabase, data is lost — this is the MVP limitation
  assert(getDecisionRepository().getById(savedId) === null, "Decision lost after cache clear (no DB)");

  // New data can still be written
  getDecisionRepository().create(makeDecision({ id: "new-after-clear", business_id: BUSINESS }));
  assert(getDecisionRepository().getById("new-after-clear") !== null, "New decision writable after clear");

  // ─── 24. WRITE-THROUGH BATCH (multiple writes) ─────────────────
  console.log("\n--- 24. Write-Through Batch ---");

  resetDecisionRepository();
  for (let i = 0; i < 10; i++) {
    getDecisionRepository().create(makeDecision({
      id: `batch-${i}`,
      business_id: BUSINESS,
      decision_type: i % 2 === 0 ? "APPROVE" : "REJECT",
    }));
  }

  const batchDecisions = getDecisionRepository().getByBusiness(BUSINESS);
  assertEqual(batchDecisions.length, 10, "10 batch decisions created");
  assert(batchDecisions.every((d) => d.business_id === BUSINESS), "All batch decisions belong to business");

  // ─── SUMMARY ────────────────────────────────────────────────────
  console.log("\n" + "═".repeat(60));
  console.log(`Phase 13B.1 Tests: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log("═".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
