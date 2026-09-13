/**
 * SALAM LIT — Phase 14.4.1 Tests: Remove Legacy Demo Identity Fallbacks
 *
 * Tests that demo-user and demo-business runtime fallbacks are removed
 * from DecisionCenter and OfficeChat.
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
console.log("Phase 14.4.1: Remove Legacy Demo Identity Fallbacks");
console.log("════════════════════════════════════════════════════════════\n");

const dcSrc = readRoute("src/components/office/DecisionCenter.tsx");
const ocSrc = readRoute("src/components/office/OfficeChat.tsx");
const voSrc = readRoute("src/components/office/VirtualOffice.tsx");
const decPageSrc = readRoute("app/decisions/page.tsx");
const allSrc = dcSrc + ocSrc + voSrc + decPageSrc;

// ============================================================
// 1. DecisionCenter — No demo-user Fallback
// ============================================================
console.log("--- 1. DecisionCenter ---");

assert(!dcSrc.includes("demo-user"), "DecisionCenter: no demo-user string");
assert(!dcSrc.includes("user_id ="), "DecisionCenter: no user_id default parameter");
assert(!dcSrc.includes("user_id:"), "DecisionCenter: no user_id in props interface");
assert(!dcSrc.includes("decision_maker: user_id"), "DecisionCenter: no decision_maker from client user_id");

// ============================================================
// 2. OfficeChat — No demo-business Fallback
// ============================================================
console.log("\n--- 2. OfficeChat ---");

assert(!ocSrc.includes("demo-business"), "OfficeChat: no demo-business string");
assert(!ocSrc.includes("business_id ="), "OfficeChat: no business_id default parameter");
assert(!ocSrc.includes("business_id?"), "OfficeChat: no business_id optional prop");
assert(!ocSrc.includes("business_id,"), "OfficeChat: no business_id in request body");

// ============================================================
// 3. Decisions Page — No Hardcoded Identity
// ============================================================
console.log("\n--- 3. Decisions Page ---");

assert(!decPageSrc.includes("demo-business"), "Decisions page: no demo-business");
assert(!decPageSrc.includes("demo-user"), "Decisions page: no demo-user");
assert(decPageSrc.includes("/api/me"), "Decisions page: fetches /api/me");
assert(decPageSrc.includes("business_id={businessId}"), "Decisions page: passes real business_id");

// ============================================================
// 4. VirtualOffice — No Identity Props to Children
// ============================================================
console.log("\n--- 4. VirtualOffice ---");

assert(!voSrc.includes("business_id={data.business_id}"), "VirtualOffice: does not pass business_id to OfficeChat");
assert(!voSrc.includes("demo-business"), "VirtualOffice: no demo-business fallback");

// ============================================================
// 5. No Hardcoded Replacement Identity
// ============================================================
console.log("\n--- 5. No Replacement Identity ---");

assert(!allSrc.includes("user-001"), "No replacement user ID");
assert(!allSrc.includes("owner-1"), "No replacement owner ID");
assert(!allSrc.includes("test-user"), "No test user fallback");
assert(!allSrc.includes("business-1"), "No replacement business ID");
assert(!allSrc.includes("test-business"), "No test business fallback");

// ============================================================
// 6. No Query-Param Identity
// ============================================================
console.log("\n--- 6. No Query-Param Identity ---");

assert(!allSrc.includes("searchParams.get"), "No searchParams.get in client components");
assert(!allSrc.includes("URLSearchParams"), "No URLSearchParams in client components");

// ============================================================
// 7. No Sensitive Storage
// ============================================================
console.log("\n--- 7. No Sensitive Storage ---");

assert(!allSrc.includes("localStorage"), "No localStorage usage");
assert(!allSrc.includes("sessionStorage"), "No sessionStorage usage");

// ============================================================
// 8. Missing Context Handled Safely
// ============================================================
console.log("\n--- 8. Missing Context ---");

assert(decPageSrc.includes("onboarding"), "Decisions page redirects to /onboarding when no business");
assert(voSrc.includes("requires_onboarding"), "VirtualOffice handles requires_onboarding from API");

// ============================================================
// 9. Server-Derived Identity
// ============================================================
console.log("\n--- 9. Server-Derived Identity ---");

assert(dcSrc.includes("business_id"), "DecisionCenter still uses business_id for data fetching");
assert(!dcSrc.includes("user_id"), "DecisionCenter no longer has user_id dependency");

// ============================================================
// 10. Migration Files Unchanged
// ============================================================
console.log("\n--- 10. Migration Files ---");

const migrations = [
  "001_business_context_and_truth.sql",
  "002_action_execution_engine.sql",
  "003_decision_approval_persistence.sql",
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
// Summary
// ============================================================
console.log("\n════════════════════════════════════════════════════════════");
console.log(`Phase 14.4.1 Tests: ${passed} passed, ${failed} failed, ${total} total`);
console.log("════════════════════════════════════════════════════════════");

if (failed > 0) {
  process.exit(1);
}
