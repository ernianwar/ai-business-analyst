/**
 * SALAM LIT — Phase 14.4 Tests: Authenticated Virtual AI Office Entry + Context Refactor
 *
 * Tests security invariants and behavioral contract for:
 * - app/page.tsx
 * - src/components/office/VirtualOffice.tsx
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
console.log("Phase 14.4: Authenticated Virtual AI Office Entry Tests");
console.log("════════════════════════════════════════════════════════════\n");

const pageSrc = readRoute("app/page.tsx");
const voSrc = readRoute("src/components/office/VirtualOffice.tsx");
const allSrc = pageSrc + voSrc;

// ============================================================
// 1. Query-Param Identity Removal
// ============================================================
console.log("--- 1. Query-Param Identity Removal ---");

assert(!pageSrc.includes('query?.get("business_id")'), "page.tsx: no business_id from query params");
assert(!pageSrc.includes('query?.get("user_id")'), "page.tsx: no user_id from query params");
assert(!pageSrc.includes('query?.get("workspace_id")'), "page.tsx: no workspace_id from query params");
assert(!pageSrc.includes("URLSearchParams"), "page.tsx: no URLSearchParams usage");

// ============================================================
// 2. VirtualOffice Props — No Identity
// ============================================================
console.log("\n--- 2. VirtualOffice Props ---");

assert(!voSrc.includes("business_id: string | null"), "VirtualOffice: no business_id prop");
assert(!voSrc.includes("user_id: string | null"), "VirtualOffice: no user_id prop");
assert(!voSrc.includes("workspace_id: string | null"), "VirtualOffice: no workspace_id prop");
assert(voSrc.includes("onAgentClick"), "VirtualOffice: retains onAgentClick callback");
assert(voSrc.includes("onOpenChat"), "VirtualOffice: retains onOpenChat callback");

// ============================================================
// 3. /api/me Integration
// ============================================================
console.log("\n--- 3. /api/me Integration ---");

assert(pageSrc.includes("/api/me"), "page.tsx: fetches /api/me");
assert(pageSrc.includes('cache: "no-store"'), "page.tsx: uses no-store cache for /api/me");

// ============================================================
// 4. /api/office/state — No Query Params
// ============================================================
console.log("\n--- 4. /api/office/state ---");

assert(voSrc.includes('"/api/office/state"'), "VirtualOffice: fetches /api/office/state");
assert(!voSrc.includes("business_id=${"), "VirtualOffice: no business_id in office/state URL");
assert(!voSrc.includes("user_id=${"), "VirtualOffice: no user_id in office/state URL");
assert(!voSrc.includes("workspace_id=${"), "VirtualOffice: no workspace_id in office/state URL");

// ============================================================
// 5. No Demo/Fallback Data
// ============================================================
console.log("\n--- 5. No Demo/Fallback Data ---");

assert(!allSrc.includes("demo-business"), "No demo-business fallback");
assert(!allSrc.includes("demo-user"), "No demo-user fallback");
assert(!allSrc.includes("demo-workspace"), "No demo-workspace fallback");

// ============================================================
// 6. No Fake Business Data
// ============================================================
console.log("\n--- 6. No Fake Business Data ---");

assert(!allSrc.includes("RM0"), "No fake RM0 revenue");
assert(!allSrc.includes("health_score"), "No fake health score in client");
assert(!allSrc.includes("revenue:"), "No fake revenue in client");

// ============================================================
// 7. No Fake AI Activity
// ============================================================
console.log("\n--- 7. No Fake AI Activity ---");

assert(!allSrc.includes("AI is working"), "No fake AI activity claim");
assert(!allSrc.includes("agents are active"), "No fake agent activity");

// ============================================================
// 8. Authentication Flow
// ============================================================
console.log("\n--- 8. Authentication Flow ---");

assert(pageSrc.includes('"/login"'), "page.tsx: redirects to /login on 401");
assert(voSrc.includes('"/login"'), "VirtualOffice: redirects to /login on 401");

// ============================================================
// 9. Onboarding Redirect
// ============================================================
console.log("\n--- 9. Onboarding Redirect ---");

assert(pageSrc.includes('"/onboarding"'), "page.tsx: redirects to /onboarding for incomplete context");
assert(voSrc.includes('"/onboarding"'), "VirtualOffice: redirects to /onboarding for requires_onboarding");

// ============================================================
// 10. Loading States
// ============================================================
console.log("\n--- 10. Loading States ---");

assert(pageSrc.includes("loading"), "page.tsx: has loading state");
assert(voSrc.includes("loading"), "VirtualOffice: has loading state");
assert(pageSrc.includes("animate-spin"), "page.tsx: shows loading spinner");
assert(voSrc.includes("animate-spin"), "VirtualOffice: shows loading spinner");

// ============================================================
// 11. Error States
// ============================================================
console.log("\n--- 11. Error States ---");

assert(pageSrc.includes("error"), "page.tsx: has error state");
assert(voSrc.includes("error"), "VirtualOffice: has error state");
assert(pageSrc.includes("Retry"), "page.tsx: has retry button");
assert(voSrc.includes("Retry"), "VirtualOffice: has retry button");

// ============================================================
// 12. Alberto Not an Agent
// ============================================================
console.log("\n--- 12. Alberto Not an Agent ---");

assert(!allSrc.includes("alberto"), "Alberto is not represented as an AI agent");
assert(!allSrc.includes("Alberto"), "Alberto is not represented as an AI agent (capitalized)");

// ============================================================
// 13. KOPI/Adik Identity
// ============================================================
console.log("\n--- 13. KOPI/Adik Identity ---");

assert(voSrc.includes("kopi") || allSrc.includes("kopi"), "KOPI exists in agent definitions");
assert(voSrc.includes("adik") || allSrc.includes("adik"), "Adik exists in agent definitions");
assert(voSrc.includes("Security") && voSrc.includes("kopi"), "KOPI associated with Security");
assert(voSrc.includes("Companion") && voSrc.includes("adik"), "Adik associated with Companion");

// ============================================================
// 14. OfficeChat No Identity Dependency
// ============================================================
console.log("\n--- 14. OfficeChat No Identity ---");

assert(!voSrc.includes("business_id={data.business_id}"), "VirtualOffice does not pass business_id to OfficeChat");
assert(!voSrc.includes('business_id={business_id}'), "VirtualOffice does not pass prop business_id to OfficeChat");

// ============================================================
// 15. No Service-Role in Client Code
// ============================================================
console.log("\n--- 15. No Service-Role ---");

assert(!allSrc.includes("supabase-client"), "No service-role client import");
assert(!allSrc.includes("getSupabaseClient"), "No service-role client usage");
assert(!allSrc.includes("SUPABASE_SERVICE_ROLE"), "No service-role key reference");

// ============================================================
// 16. No Sensitive Storage
// ============================================================
console.log("\n--- 16. No Sensitive Storage ---");

assert(!allSrc.includes("localStorage"), "No localStorage usage");
assert(!allSrc.includes("sessionStorage"), "No sessionStorage usage");

// ============================================================
// 17. Proactive Call — No Client IDs
// ============================================================
console.log("\n--- 17. Proactive Call ---");

assert(voSrc.includes("/api/proactive"), "VirtualOffice calls /api/proactive");
assert(!voSrc.includes("business_id,"), "Proactive call does not send business_id");
assert(!voSrc.includes("user_id,"), "Proactive call does not send user_id");
assert(!voSrc.includes("workspace_id,"), "Proactive call does not send workspace_id");

// ============================================================
// 18. Migration Files Unchanged
// ============================================================
console.log("\n--- 18. Migration Files ---");

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
// 19. Agent Definitions Preserved
// ============================================================
console.log("\n--- 19. Agent Definitions ---");

const requiredAgents = ["zue", "erni", "sheera", "eddy", "carol", "ayuni", "alex", "tehna", "kopi", "adik"];
for (const agent of requiredAgents) {
  assert(voSrc.includes(`"${agent}"`) || voSrc.includes(`${agent}:`), `VirtualOffice references agent: ${agent}`);
}

// ============================================================
// 20. Onboarding Page Unmodified
// ============================================================
console.log("\n--- 20. Onboarding Unmodified ---");

try {
  const onbSrc = readRoute("app/onboarding/page.tsx");
  assert(onbSrc.includes("/api/onboarding/status"), "Onboarding page still uses status API");
  assert(onbSrc.includes("/api/onboarding/workspace"), "Onboarding page still uses workspace API");
  assert(onbSrc.includes("/api/onboarding/business"), "Onboarding page still uses business API");
} catch {
  assert(false, "Onboarding page exists");
}

// ============================================================
// Summary
// ============================================================
console.log("\n════════════════════════════════════════════════════════════");
console.log(`Phase 14.4 Tests: ${passed} passed, ${failed} failed, ${total} total`);
console.log("════════════════════════════════════════════════════════════");

if (failed > 0) {
  process.exit(1);
}
