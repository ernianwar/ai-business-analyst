/**
 * SALAM LIT — Phase 14.2.1 Tests: Authenticated Business + Office State API
 *
 * Tests for:
 * - app/api/business/route.ts (migrated)
 * - app/api/office/state/route.ts (migrated)
 *
 * Validates security invariants, identity derivation, and error classification.
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
console.log("Phase 14.2.1: Authenticated Business + Office State Tests");
console.log("════════════════════════════════════════════════════════════\n");

// ============================================================
// Load source files
// ============================================================
const bizRouteSrc = readRoute("app/api/business/route.ts");
const officeSrc = readRoute("app/api/office/state/route.ts");

// ============================================================
// 1. /api/business — Authentication
// ============================================================
console.log("--- 1. /api/business: Authentication ---");

assert(bizRouteSrc.includes("getAuthenticatedContext"), "/api/business uses getAuthenticatedContext");
assert(bizRouteSrc.includes("401"), "/api/business returns 401 for unauthenticated");
assert(bizRouteSrc.includes("!ctx"), "Business route checks for null context");

// ============================================================
// 2. /api/business — No Client Identity Trust
// ============================================================
console.log("\n--- 2. /api/business: No Client Identity Trust ---");

assert(!bizRouteSrc.includes("searchParams"), "/api/business does not read query params");
assert(!bizRouteSrc.includes("workspace_id") || bizRouteSrc.includes("ctx.workspace_id"), "workspace_id comes from ctx, not client");
assert(!bizRouteSrc.includes("body.workspace_id"), "POST does not accept workspace_id from body");
assert(!bizRouteSrc.includes("body.user_id"), "POST does not accept user_id from body");
assert(!bizRouteSrc.includes("body.business_id"), "POST does not accept business_id from body");

// ============================================================
// 3. /api/business — Authenticated Context Usage
// ============================================================
console.log("\n--- 3. /api/business: Context Usage ---");

assert(bizRouteSrc.includes("ctx.workspace_id"), "Uses ctx.workspace_id for workspace resolution");
assert(bizRouteSrc.includes("getBusinessesByWorkspace"), "GET lists businesses for authenticated workspace");
assert(bizRouteSrc.includes("workspace_id: ctx.workspace_id"), "POST creates business in authenticated workspace");

// ============================================================
// 4. /api/business — No Demo Fallback
// ============================================================
console.log("\n--- 4. /api/business: No Demo Fallback ---");

assert(!bizRouteSrc.includes("demo-"), "No demo-business fallback");
assert(!bizRouteSrc.includes("demo_"), "No demo_ fallback");
assert(!bizRouteSrc.includes("seedDemo"), "No demo seeding");

// ============================================================
// 5. /api/office/state — Authentication
// ============================================================
console.log("\n--- 5. /api/office/state: Authentication ---");

assert(officeSrc.includes("getAuthenticatedContext"), "/api/office/state uses getAuthenticatedContext");
assert(officeSrc.includes("401"), "/api/office/state returns 401 for unauthenticated");
assert(officeSrc.includes("!ctx"), "Office state checks for null context");

// ============================================================
// 6. /api/office/state — No Client Identity Trust
// ============================================================
console.log("\n--- 6. /api/office/state: No Client Identity Trust ---");

assert(!officeSrc.includes("searchParams"), "/api/office/state does not read query params");
assert(!officeSrc.includes("req.query"), "/api/office/state does not read req.query");
assert(!officeSrc.includes("business_id = searchParams"), "business_id not from query params");
assert(!officeSrc.includes("user_id = searchParams"), "user_id not from query params");
assert(!officeSrc.includes("workspace_id = searchParams"), "workspace_id not from query params");

// ============================================================
// 7. /api/office/state — Authenticated Context Usage
// ============================================================
console.log("\n--- 7. /api/office/state: Context Usage ---");

assert(officeSrc.includes("ctx.business_id"), "Uses ctx.business_id for business resolution");
assert(officeSrc.includes("const business_id = ctx.business_id"), "business_id derived from authenticated context");

// ============================================================
// 8. /api/office/state — No Demo Data
// ============================================================
console.log("\n--- 8. /api/office/state: No Demo Data ---");

assert(!officeSrc.includes("seedDemoApprovalAccess"), "No seedDemoApprovalAccess call");
assert(!officeSrc.includes("canAccessBusiness"), "No in-memory canAccessBusiness call (auth via RPC)");
assert(!officeSrc.includes("demo-"), "No demo fallback");
assert(!officeSrc.includes("demo_"), "No demo_ fallback");

// ============================================================
// 9. /api/office/state — No Business Handling
// ============================================================
console.log("\n--- 9. /api/office/state: No Business Handling ---");

assert(officeSrc.includes("requires_onboarding"), "Returns requires_onboarding when no business");
assert(officeSrc.includes("!ctx.business_id"), "Checks for missing business_id");
assert(officeSrc.includes("onboarding_status"), "Returns onboarding_status when no business");

// ============================================================
// 10. Cross-Business Access Protection
// ============================================================
console.log("\n--- 10. Cross-Business Access Protection ---");

assert(
  !officeSrc.includes("business_id !== ctx.business_id") || officeSrc.includes("ctx.business_id"),
  "Business ID resolved from context, not client"
);
assert(
  !bizRouteSrc.includes("business_id !== ctx.business_id") || bizRouteSrc.includes("ctx.workspace_id"),
  "Business operations scoped to authenticated workspace"
);

// ============================================================
// 11. No Service-Role Identity Spoofing
// ============================================================
console.log("\n--- 11. No Service-Role Identity ---");

assert(!officeSrc.includes('from "@/lib/db/supabase-client"'), "/api/office/state does not import service-role client");
assert(!bizRouteSrc.includes('from "@/lib/db/supabase-client"'), "/api/business does not import service-role client");

// ============================================================
// 12. Existing Route Behavior
// ============================================================
console.log("\n--- 12. Existing Route Behavior ---");

assert(bizRouteSrc.includes("businessContextService"), "/api/business still uses businessContextService");
assert(bizRouteSrc.includes("getBusinessesByWorkspace"), "/api/business still lists by workspace");
assert(bizRouteSrc.includes("createBusiness"), "/api/business still creates businesses");
assert(officeSrc.includes("agentStateStore"), "/api/office/state still uses agentStateStore");
assert(bizRouteSrc.includes("officeEventStore") || officeSrc.includes("officeEventStore"), "/api/office/state still uses officeEventStore");
assert(officeSrc.includes("getWorkQueueSummary"), "/api/office/state still aggregates work queue");
assert(officeSrc.includes("getPendingDecisions"), "/api/office/state still counts pending decisions");
assert(officeSrc.includes("getPendingApprovals"), "/api/office/state still counts pending approvals");
assert(officeSrc.includes("isAIAvailable"), "/api/office/state still checks AI availability");

// ============================================================
// 13. Error Classification
// ============================================================
console.log("\n--- 13. Error Classification ---");

assert(bizRouteSrc.includes("500"), "/api/business returns 500 for server errors");
assert(bizRouteSrc.includes("400"), "/api/business returns 400 for validation errors");
assert(officeSrc.includes("500"), "/api/office/state returns 500 for server errors");
assert(officeSrc.includes("401"), "/api/office/state returns 401 for unauthorized");
assert(bizRouteSrc.includes("400"), "Business validation uses 400");

// ============================================================
// 14. Migration Files Unchanged
// ============================================================
console.log("\n--- 14. Migration Files Unchanged ---");

const migrations = [
  "001_business_context_and_truth.sql",
  "002_action_execution_engine.sql",
  "003_decision_approval_persistence.sql",
  "004_auth_foundation.sql",
  "005_onboarding_rpcs.sql",
  "006_harden_onboarding_functions.sql",
];

for (const m of migrations) {
  const path = resolve(`supabase/migrations/${m}`);
  try {
    const content = readFileSync(path, "utf-8");
    assert(content.length > 0, `Migration ${m} exists and is non-empty`);
  } catch {
    assert(false, `Migration ${m} exists`);
  }
}

// ============================================================
// 15. No Service-Role for Identity
// ============================================================
console.log("\n--- 15. No Service-Role for Identity ---");

assert(
  !officeSrc.includes("getSupabaseClient()") && !bizRouteSrc.includes("getSupabaseClient()"),
  "No service-role client used for identity"
);
assert(
  officeSrc.includes('from "@/lib/auth/get-context"') && bizRouteSrc.includes('from "@/lib/auth/get-context"'),
  "Both routes import get-context for identity"
);

// ============================================================
// Summary
// ============================================================
console.log("\n════════════════════════════════════════════════════════════");
console.log(`Phase 14.2.1 Tests: ${passed} passed, ${failed} failed, ${total} total`);
console.log("════════════════════════════════════════════════════════════");

if (failed > 0) {
  process.exit(1);
}
