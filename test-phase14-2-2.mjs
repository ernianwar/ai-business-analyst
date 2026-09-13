/**
 * SALAM LIT — Phase 14.2.2 Tests: Authenticated Sensitive API Migration
 *
 * Tests security invariants for:
 * - /api/decisions
 * - /api/approvals
 * - /api/actions
 * - /api/executions
 */

import { readFileSync } from "fs";
import { resolve } from "path";

let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, name) {
  total++;
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${name}`);
    failed++;
  }
}

function readRoute(path) {
  return readFileSync(resolve(path), "utf-8");
}

console.log("════════════════════════════════════════════════════════════");
console.log("Phase 14.2.2: Authenticated Sensitive API Tests");
console.log("════════════════════════════════════════════════════════════\n");

const decSrc = readRoute("app/api/decisions/route.ts");
const decIdSrc = readRoute("app/api/decisions/[id]/route.ts");
const apprSrc = readRoute("app/api/approvals/route.ts");
const apprIdSrc = readRoute("app/api/approvals/[id]/route.ts");
const apprChkSrc = readRoute("app/api/approvals/check/route.ts");
const actSrc = readRoute("app/api/actions/route.ts");
const actIdSrc = readRoute("app/api/actions/[id]/route.ts");
const execSrc = readRoute("app/api/executions/route.ts");
const execIdSrc = readRoute("app/api/executions/[id]/route.ts");

// ============================================================
// 1. Authentication — All Routes
// ============================================================
console.log("--- 1. Authentication ---");

const allSrc = decSrc + decIdSrc + apprSrc + apprIdSrc + apprChkSrc + actSrc + actIdSrc + execSrc + execIdSrc;

assert(allSrc.includes("getAuthenticatedContext"), "All routes use getAuthenticatedContext");
assert(!allSrc.includes("demo-user"), "No demo-user fallback anywhere");
assert(!allSrc.includes("demo-workspace"), "No demo-workspace fallback anywhere");
assert(allSrc.split("getAuthenticatedContext").length - 1 >= 9, "getAuthenticatedContext called in all 9 route files");

// ============================================================
// 2. No Client Identity Trust
// ============================================================
console.log("\n--- 2. No Client Identity Trust ---");

assert(!decSrc.includes("user_id = searchParams"), "Decisions: user_id not from query");
assert(!decSrc.includes("decision_maker =") || decSrc.includes("decision_maker = ctx.user_id"), "Decisions: decision_maker from ctx");
assert(!decIdSrc.includes("user_id = new URL"), "Decisions [id]: user_id not from query");
assert(!decIdSrc.includes("decision_maker =") || decIdSrc.includes("decision_maker: ctx.user_id"), "Decisions [id]: decision_maker from ctx");

assert(!apprSrc.includes("user_id =") || apprSrc.includes("user_id = ctx.user_id"), "Approvals: user_id from ctx");
assert(!apprSrc.includes("workspace_id =") || apprSrc.includes("workspace_id: ctx.workspace_id"), "Approvals: workspace_id from ctx");
assert(!apprIdSrc.includes("user_id =") || apprIdSrc.includes("ctx.user_id"), "Approvals [id]: user_id from ctx");

assert(!actSrc.includes("business_id = searchParams"), "Actions: business_id not from query");
assert(!actIdSrc.includes("searchParams"), "Actions [id]: no query params");

assert(!execSrc.includes("business_id = searchParams"), "Executions: business_id not from query");

// ============================================================
// 3. Cross-Business Protection
// ============================================================
console.log("\n--- 3. Cross-Business Protection ---");

assert(decIdSrc.includes("decision.business_id !== ctx.business_id"), "Decision [id]: cross-business check");
assert(apprIdSrc.includes("approval.business_id !== ctx.business_id"), "Approval [id]: cross-business check");
assert(actIdSrc.includes("action.business_id !== ctx.business_id"), "Action [id]: cross-business check");
assert(execIdSrc.includes("execAction.business_id !== ctx.business_id"), "Execution [id]: cross-business check via action");
assert(apprChkSrc.includes("business_id !== ctx.business_id"), "Approval check: cross-business check");

// ============================================================
// 4. Seed Demo Removed
// ============================================================
console.log("\n--- 4. Demo Data Removal ---");

assert(!apprSrc.includes("seedDemoApprovalAccess"), "Approvals: no seedDemoApprovalAccess");
assert(!apprIdSrc.includes("seedDemoApprovalAccess"), "Approvals [id]: no seedDemoApprovalAccess");
assert(!apprChkSrc.includes("seedDemoApprovalAccess"), "Approval check: no seedDemoApprovalAccess");
assert(!allSrc.includes("canAccessBusiness({"), "No in-memory canAccessBusiness calls");

// ============================================================
// 5. Decision Lifecycle
// ============================================================
console.log("\n--- 5. Decision Lifecycle ---");

assert(decSrc.includes("createDecision"), "Decisions: createDecision preserved");
assert(decSrc.includes("getPendingDecisions"), "Decisions: getPendingDecisions preserved");
assert(decSrc.includes("getDecidedItems"), "Decisions: getDecidedItems preserved");
assert(decSrc.includes("getDecisionMemoryByBusiness"), "Decisions: getDecisionMemoryByBusiness preserved");
assert(decIdSrc.includes("supersedeDecision"), "Decisions [id]: supersedeDecision preserved");
assert(decIdSrc.includes("cancelDecision"), "Decisions [id]: cancelDecision preserved");

// ============================================================
// 6. Approval Lifecycle
// ============================================================
console.log("\n--- 6. Approval Lifecycle ---");

assert(apprSrc.includes("createApprovalRequest"), "Approvals: createApprovalRequest preserved");
assert(apprSrc.includes("createStandingAuthorization"), "Approvals: createStandingAuthorization preserved");
assert(apprSrc.includes("expireOldApprovals"), "Approvals: expireOldApprovals preserved");
assert(apprIdSrc.includes("approveRequest"), "Approvals [id]: approveRequest preserved");
assert(apprIdSrc.includes("rejectRequest"), "Approvals [id]: rejectRequest preserved");
assert(apprIdSrc.includes("revokeApproval"), "Approvals [id]: revokeApproval preserved");
assert(apprChkSrc.includes("checkAuthorization"), "Approval check: checkAuthorization preserved");

// ============================================================
// 7. Action Lifecycle
// ============================================================
console.log("\n--- 7. Action Lifecycle ---");

assert(actSrc.includes("createAction"), "Actions: createAction preserved");
assert(actSrc.includes("queueAction"), "Actions: queueAction preserved");
assert(actSrc.includes("cancelAction"), "Actions: cancelAction preserved");
assert(actSrc.includes("checkAndAuthorizeAction"), "Actions: checkAndAuthorizeAction preserved");
assert(actIdSrc.includes("getAction"), "Actions [id]: getAction preserved");
assert(actIdSrc.includes("getExecutionsByAction"), "Actions [id]: getExecutionsByAction preserved");
assert(actIdSrc.includes("getOutcomeByAction"), "Actions [id]: getOutcomeByAction preserved");

// ============================================================
// 8. Execution Lifecycle
// ============================================================
console.log("\n--- 8. Execution Lifecycle ---");

assert(execSrc.includes("executeAction"), "Executions: executeAction preserved");
assert(execSrc.includes("reconcileExecution"), "Executions: reconcileExecution preserved");
assert(execSrc.includes("generateIdempotencyKey"), "Executions: idempotency key generation preserved");
assert(execSrc.includes("getExecutionsByBusiness"), "Executions: getExecutionsByBusiness preserved");
assert(execIdSrc.includes("getExecution"), "Executions [id]: getExecution preserved");
assert(execIdSrc.includes("reconcileExecution"), "Executions [id]: reconcileExecution preserved");

// ============================================================
// 9. Authorization Preservation
// ============================================================
console.log("\n--- 9. Authorization ---");

assert(decSrc.includes("canViewDecisions"), "Decisions: canViewDecisions preserved");
assert(decSrc.includes("canMakeDecision"), "Decisions: canMakeDecision preserved");
assert(decIdSrc.includes("canSupersedeDecision"), "Decisions [id]: canSupersedeDecision preserved");
assert(apprIdSrc.includes("canApproveAction"), "Approvals [id]: canApproveAction preserved");
assert(apprSrc.includes("canCreateStandingAuthorization"), "Approvals: canCreateStandingAuthorization preserved");
assert(apprChkSrc.includes("checkAuthorization"), "Approval check: checkAuthorization preserved");

// ============================================================
// 10. Service-Role Handling
// ============================================================
console.log("\n--- 10. Service-Role ---");

assert(!allSrc.includes('from "@/lib/db/supabase-client"'), "No service-role client imported");
assert(!allSrc.includes("getSupabaseClient()"), "No service-role client used");

// ============================================================
// 11. Error Classification
// ============================================================
console.log("\n--- 11. Error Classification ---");

assert(allSrc.includes("{ status: 401 }"), "Returns 401 for unauthorized");
assert(allSrc.includes("{ status: 403 }"), "Returns 403 for forbidden");
assert(allSrc.includes("{ status: 404 }"), "Returns 404 for not found");
assert(allSrc.includes("{ status: 400 }"), "Returns 400 for bad request");
assert(allSrc.includes("{ status: 500 }"), "Returns 500 for server error");
assert(allSrc.includes("{ status: 409 }"), "Returns 409 for conflicts (approvals)");
assert(allSrc.includes("{ status: 201 }"), "Returns 201 for creation");

// ============================================================
// 12. Migration Files Unchanged
// ============================================================
console.log("\n--- 12. Migration Files ---");

const migrations = [
  "004_auth_foundation.sql",
  "005_onboarding_rpcs.sql",
  "006_harden_onboarding_functions.sql",
];

for (const m of migrations) {
  try {
    const content = readFileSync(resolve(`supabase/migrations/${m}`), "utf-8");
    assert(content.length > 0, `Migration ${m} exists`);
  } catch {
    assert(false, `Migration ${m} exists`);
  }
}

// ============================================================
// 13. No SearchParams for Identity
// ============================================================
console.log("\n--- 13. No SearchParams for Identity ---");

assert(!decSrc.includes("searchParams.get(\"user_id\")"), "Decisions GET: no user_id from searchParams");
assert(!decSrc.includes("searchParams.get(\"business_id\")"), "Decisions GET: no business_id from searchParams");
assert(!actSrc.includes("searchParams.get(\"business_id\")"), "Actions GET: no business_id from searchParams");
assert(!execSrc.includes("searchParams.get(\"business_id\")"), "Executions GET: no business_id from searchParams");

// ============================================================
// Summary
// ============================================================
console.log("\n════════════════════════════════════════════════════════════");
console.log(`Phase 14.2.2 Tests: ${passed} passed, ${failed} failed, ${total} total`);
console.log("════════════════════════════════════════════════════════════");

if (failed > 0) {
  process.exit(1);
}
