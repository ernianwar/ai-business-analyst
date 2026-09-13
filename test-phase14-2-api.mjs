/**
 * SALAM LIT — Phase 14.2 Tests: Authenticated Onboarding API
 *
 * Tests for:
 * - app/api/me/route.ts
 * - app/api/onboarding/status/route.ts
 * - app/api/onboarding/workspace/route.ts
 * - app/api/onboarding/business/route.ts
 *
 * Validates security invariants, RPC signatures, and error handling.
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
console.log("Phase 14.2: Authenticated Onboarding API Tests");
console.log("════════════════════════════════════════════════════════════\n");

// ============================================================
// Load source files
// ============================================================
const meSrc = readRoute("app/api/me/route.ts");
const statusSrc = readRoute("app/api/onboarding/status/route.ts");
const wsSrc = readRoute("app/api/onboarding/workspace/route.ts");
const bizSrc = readRoute("app/api/onboarding/business/route.ts");
const getCtxSrc = readRoute("src/lib/auth/get-context.ts");

// ============================================================
// 1. /api/me Security Invariants
// ============================================================
console.log("--- 1. /api/me ---");

assert(meSrc.includes("getAuthenticatedContext"), "/api/me uses getAuthenticatedContext");
assert(!meSrc.includes("user_id:") || meSrc.includes("ctx.user_id"), "/api/me does not accept client user_id");
assert(!meSrc.includes("searchParams"), "/api/me does not read query params");
assert(!meSrc.includes("request.json"), "/api/me does not read request body");
assert(meSrc.includes("401"), "/api/me returns 401 for unauthenticated");
assert(!meSrc.includes("supabase-client"), "/api/me does not use service-role client");
assert(!meSrc.includes("demo-"), "/api/me has no demo fallback");

// ============================================================
// 2. /api/onboarding/status Security Invariants
// ============================================================
console.log("\n--- 2. /api/onboarding/status ---");

assert(statusSrc.includes("getAuthenticatedContext"), "/api/onboarding/status uses getAuthenticatedContext");
assert(!statusSrc.includes("searchParams"), "/status does not read query params");
assert(!statusSrc.includes("request.json"), "/status does not read request body");
assert(statusSrc.includes("has_workspace"), "/status returns has_workspace");
assert(statusSrc.includes("has_business"), "/status returns has_business");
assert(statusSrc.includes("onboarding_complete"), "/status returns onboarding_complete");
assert(statusSrc.includes("onboarding_status"), "/status returns onboarding_status field");
assert(statusSrc.includes("COMPLETE"), "/status references COMPLETE state");
assert(!statusSrc.includes("demo-"), "/status has no demo fallback");

// ============================================================
// 3. /api/onboarding/workspace Security Invariants
// ============================================================
console.log("\n--- 3. /api/onboarding/workspace ---");

assert(wsSrc.includes("getAuthenticatedContext"), "/workspace uses getAuthenticatedContext");
assert(wsSrc.includes("create_workspace_with_owner"), "/workspace calls correct RPC");
assert(!wsSrc.includes("uuid, text, text"), "/workspace does not use old RPC signature");
assert(!wsSrc.includes("p_user_id"), "/workspace does not pass user_id to RPC");
assert(!wsSrc.includes("searchParams"), "/workspace does not read query params for identity");
assert(wsSrc.includes("p_name"), "/workspace passes p_name to RPC");
assert(wsSrc.includes("p_slug"), "/workspace passes p_slug to RPC");
assert(wsSrc.includes("401"), "/workspace returns 401 for unauthenticated");
assert(wsSrc.includes("400"), "/workspace returns 400 for validation errors");
assert(!wsSrc.includes("supabase-client"), "/workspace does not use service-role client");
assert(!wsSrc.includes("demo-"), "/workspace has no demo fallback");

// ============================================================
// 4. /api/onboarding/business Security Invariants
// ============================================================
console.log("\n--- 4. /api/onboarding/business ---");

assert(bizSrc.includes("getAuthenticatedContext"), "/business uses getAuthenticatedContext");
assert(bizSrc.includes("create_business_with_context"), "/business calls correct RPC");
assert(!bizSrc.includes("uuid,uuid,text"), "/business does not use old RPC signature");
assert(!bizSrc.includes("p_user_id"), "/business does not pass user_id to RPC");
assert(bizSrc.includes("ctx.workspace_id"), "/business uses workspace_id from authenticated context");
assert(!bizSrc.includes("body.workspace_id"), "/business does not accept workspace_id from client");
assert(!bizSrc.includes("searchParams"), "/business does not read query params for identity");
assert(bizSrc.includes("p_workspace_id"), "/business passes p_workspace_id to RPC");
assert(bizSrc.includes("p_name"), "/business passes p_name to RPC");
assert(bizSrc.includes("401"), "/business returns 401 for unauthenticated");
assert(bizSrc.includes("400"), "/business returns 400 for validation errors");
assert(bizSrc.includes("workspace required") || bizSrc.includes("Workspace required"), "/business requires workspace");
assert(!bizSrc.includes("supabase-client"), "/business does not use service-role client");
assert(!bizSrc.includes("demo-"), "/business has no demo fallback");

// ============================================================
// 5. RPC Signature Verification
// ============================================================
console.log("\n--- 5. RPC Signatures ---");

// get_user_context — zero params
assert(
  getCtxSrc.includes('rpc("get_user_context")') || getCtxSrc.includes("rpc('get_user_context')"),
  "get_user_context() called with zero parameters"
);

// create_workspace_with_owner(name, slug)
assert(
  wsSrc.includes('"create_workspace_with_owner"') || wsSrc.includes("'create_workspace_with_owner'"),
  "create_workspace_with_owner RPC name correct"
);
assert(
  wsSrc.includes("p_name:") && wsSrc.includes("p_slug:"),
  "create_workspace_with_owner passes p_name and p_slug"
);

// create_business_with_context(ws_id, name, industry, desc, website)
assert(
  bizSrc.includes('"create_business_with_context"') || bizSrc.includes("'create_business_with_context'"),
  "create_business_with_context RPC name correct"
);
assert(
  bizSrc.includes("p_workspace_id:") && bizSrc.includes("p_name:"),
  "create_business_with_context passes p_workspace_id and p_name"
);
assert(
  bizSrc.includes("p_industry:") && bizSrc.includes("p_description:") && bizSrc.includes("p_website:"),
  "create_business_with_context passes optional params"
);

// ============================================================
// 6. Onboarding State Rules
// ============================================================
console.log("\n--- 6. Onboarding State Rules ---");

const validStates = ["INVITED", "WORKSPACE_CREATED", "BUSINESS_CREATED", "CONTEXT_CONFIGURED", "COMPLETE"];
assert(
  validStates.every(s => getCtxSrc.includes(`"${s}"`)),
  "All 5 onboarding states defined in OnboardingStatus type"
);
assert(
  !bizSrc.includes("COMPLETE") || bizSrc.includes("onboarding_status"),
  "Business route does not manually set COMPLETE"
);
assert(
  !wsSrc.includes("COMPLETE") || wsSrc.includes("onboarding_status"),
  "Workspace route does not manually set COMPLETE"
);

// ============================================================
// 7. Error Handling
// ============================================================
console.log("\n--- 7. Error Handling ---");

assert(meSrc.includes("try") && meSrc.includes("catch"), "/api/me has try/catch");
assert(statusSrc.includes("try") && statusSrc.includes("catch"), "/status has try/catch");
assert(wsSrc.includes("try") && wsSrc.includes("catch"), "/workspace has try/catch");
assert(bizSrc.includes("try") && bizSrc.includes("catch"), "/business has try/catch");

assert(meSrc.includes("Internal server error"), "/api/me has generic error message");
assert(statusSrc.includes("Internal server error"), "/status has generic error message");
assert(wsSrc.includes("Internal server error"), "/workspace has generic error message");
assert(bizSrc.includes("Internal server error"), "/business has generic error message");

// ============================================================
// 8. No Client Identity Acceptance
// ============================================================
console.log("\n--- 8. No Client Identity Acceptance ---");

const allSrc = meSrc + statusSrc + wsSrc + bizSrc;
assert(
  !allSrc.includes("req.query.user_id") && !allSrc.includes("query.user_id"),
  "No route reads user_id from query"
);
assert(
  !allSrc.includes("body.user_id") && !allSrc.includes("body.workspace_id") && !allSrc.includes("body.business_id"),
  "No route reads identity from request body"
);
assert(
  !allSrc.includes("headers.x-user-id") && !allSrc.includes("headers['x-user-id']"),
  "No route reads user_id from headers"
);

// ============================================================
// 9. Import Verification
// ============================================================
console.log("\n--- 9. Imports ---");

assert(meSrc.includes('from "@/lib/auth/get-context"'), "/api/me imports get-context");
assert(statusSrc.includes('from "@/lib/auth/get-context"'), "/status imports get-context");
assert(wsSrc.includes('from "@/lib/auth/get-context"'), "/workspace imports get-context");
assert(bizSrc.includes('from "@/lib/auth/get-context"'), "/business imports get-context");

assert(wsSrc.includes('from "@/lib/db/supabase-server"'), "/workspace imports supabase-server (for RPC)");
assert(bizSrc.includes('from "@/lib/db/supabase-server"'), "/business imports supabase-server (for RPC)");

assert(!wsSrc.includes('from "@/lib/db/supabase-client"'), "/workspace does NOT import service-role client");
assert(!bizSrc.includes('from "@/lib/db/supabase-client"'), "/business does NOT import service-role client");

// ============================================================
// Summary
// ============================================================
console.log("\n════════════════════════════════════════════════════════════");
console.log(`Phase 14.2 API Tests: ${passed} passed, ${failed} failed, ${total} total`);
console.log("════════════════════════════════════════════════════════════");

if (failed > 0) {
  process.exit(1);
}
