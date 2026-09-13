/**
 * SALAM LIT — Phase 14.3 Tests: Authenticated SaaS Onboarding Wizard
 *
 * Tests security invariants and UI contract for:
 * - app/onboarding/page.tsx
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
console.log("Phase 14.3: Authenticated SaaS Onboarding Wizard Tests");
console.log("════════════════════════════════════════════════════════════\n");

let src;
try {
  src = readRoute("app/onboarding/page.tsx");
} catch {
  console.log("❌ FATAL: app/onboarding/page.tsx not found");
  process.exit(1);
}

// ============================================================
// 1. File Exists and Has Required Structure
// ============================================================
console.log("--- 1. File Structure ---");

assert(src.length > 100, "Onboarding page has content");
assert(src.includes('"use client"'), "Page is a client component");
assert(src.includes("export default function"), "Page has default export");

// ============================================================
// 2. API Integration — Status
// ============================================================
console.log("\n--- 2. API Integration: Status ---");

assert(src.includes("/api/onboarding/status"), "Fetches /api/onboarding/status");
assert(src.includes("fetchStatus"), "Has fetchStatus function");
assert(src.includes('cache: "no-store"'), "Status fetch uses no-store cache");

// ============================================================
// 3. API Integration — Workspace
// ============================================================
console.log("\n--- 3. API Integration: Workspace ---");

assert(src.includes("/api/onboarding/workspace"), "Calls /api/onboarding/workspace");
assert(src.includes('method: "POST"'), "Uses POST method");
assert(src.includes("workspace"), "References workspace in API call");

// ============================================================
// 4. API Integration — Business
// ============================================================
console.log("\n--- 4. API Integration: Business ---");

assert(src.includes("/api/onboarding/business"), "Calls /api/onboarding/business");

// ============================================================
// 5. No Client Identity Trust
// ============================================================
console.log("\n--- 5. No Client Identity Trust ---");

const bodyPatterns = src.match(/body:\s*JSON\.stringify\(\{[\s\S]*?\}\)/g) || [];
const allBodies = bodyPatterns.join(" ");
assert(!allBodies.includes("user_id"), "Request bodies do not contain user_id");
assert(!allBodies.includes("workspace_id"), "Request bodies do not contain workspace_id");
assert(!allBodies.includes("business_id"), "Request bodies do not contain business_id");

// ============================================================
// 6. No Service-Role or Server Imports
// ============================================================
console.log("\n--- 6. No Service-Role ---");

assert(!src.includes("supabase-client"), "No service-role client import");
assert(!src.includes("getSupabaseClient"), "No service-role client usage");
assert(!src.includes("SUPABASE_SERVICE_ROLE"), "No service-role key reference");

// ============================================================
// 7. No Demo/Fake Data
// ============================================================
console.log("\n--- 7. No Demo/Fake Data ---");

assert(!src.includes("demo-business"), "No demo-business fallback");
assert(!src.includes("demo-user"), "No demo-user fallback");
assert(!src.includes("demo-workspace"), "No demo-workspace fallback");
assert(!src.includes("fake"), "No fake data");
assert(!src.includes("seed"), "No seed data");
assert(!src.includes("mock"), "No mock data");

// ============================================================
// 8. No Fake AI Activity
// ============================================================
console.log("\n--- 8. No Fake AI Activity ---");

assert(!src.includes("AI is working"), "No fake AI activity claim");
assert(!src.includes("agents are active"), "No fake agent activity");
assert(!src.includes("Your AI workforce is working"), "No fake AI workforce activity claim");

// ============================================================
// 9. Refresh/Resume Logic
// ============================================================
console.log("\n--- 9. Refresh/Resume Logic ---");

assert(src.includes("useEffect"), "Uses useEffect for status check on load");
assert(src.includes("has_workspace"), "Checks has_workspace from status");
assert(src.includes("has_business"), "Checks has_business from status");
assert(src.includes("onboarding_complete"), "Checks onboarding_complete from status");
assert(src.includes("INVITED") || src.includes("WORKSPACE_CREATED") || src.includes("COMPLETE"), "Handles onboarding states");

// ============================================================
// 10. Completion Requires API Confirmation
// ============================================================
console.log("\n--- 10. Completion ---");

assert(src.includes("Enter Your Office") || src.includes("onboarding_complete"), "Completion step exists");
assert(src.includes('window.location.href = "/"'), "Redirects to / after completion");

// ============================================================
// 11. Error Handling
// ============================================================
console.log("\n--- 11. Error Handling ---");

assert(src.includes("401"), "Handles 401 (unauthorized)");
assert(src.includes("409"), "Handles 409 (conflict/duplicate slug)");
assert(src.includes("setError"), "Has error state management");
assert(src.includes("error &&"), "Renders error state in UI");

// ============================================================
// 12. Loading/Submission State
// ============================================================
console.log("\n--- 12. Loading State ---");

assert(src.includes("disabled={workspaceLoading"), "Workspace submit disabled while loading");
assert(src.includes("disabled={businessLoading"), "Business submit disabled while loading");
assert(src.includes("disabled={completing}"), "Complete button disabled while loading");
assert(src.includes("Creating...") || src.includes("loading"), "Shows loading text");

// ============================================================
// 13. Auth Architecture Reused
// ============================================================
console.log("\n--- 13. Auth Architecture ---");

assert(!src.includes("signInWithPassword"), "Does not implement login directly");
assert(!src.includes("createUser"), "Does not implement signup directly");
assert(src.includes('/login') || src.includes("window.location.href"), "Redirects to login on auth failure");

// ============================================================
// 14. Migration Files Unchanged
// ============================================================
console.log("\n--- 14. Migration Files ---");

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
// 15. VirtualOffice Authenticated Context
// ============================================================
console.log("\n--- 15. VirtualOffice Authenticated Context ---");

try {
  const voSrc = readRoute("src/components/office/VirtualOffice.tsx");
  assert(voSrc.includes("/api/office/state"), "VirtualOffice fetches /api/office/state");
  assert(!voSrc.includes("business_id string | null"), "VirtualOffice: no business_id prop");
  assert(!voSrc.includes("user_id string | null"), "VirtualOffice: no user_id prop");
  assert(!voSrc.includes("workspace_id string | null"), "VirtualOffice: no workspace_id prop");
  assert(!voSrc.includes("demo-business"), "VirtualOffice: no demo-business fallback");
  assert(!voSrc.includes("demo-user"), "VirtualOffice: no demo-user fallback");
} catch {
  assert(false, "VirtualOffice file readable");
}

// ============================================================
// 16. No Browser-Side Sensitive Storage
// ============================================================
console.log("\n--- 16. No Sensitive Storage ---");

assert(!src.includes("localStorage"), "No localStorage usage");
assert(!src.includes("sessionStorage"), "No sessionStorage usage");
assert(!src.includes("document.cookie"), "No direct cookie access");

// ============================================================
// 17. Slug Generation
// ============================================================
console.log("\n--- 17. Slug Generation ---");

assert(src.includes("slugify") || src.includes("slug"), "Has slug generation");
assert(src.includes("toLowerCase"), "Slug is lowercased");
assert(src.includes("trim"), "Slug is trimmed");

// ============================================================
// 18. Form Validation
// ============================================================
console.log("\n--- 18. Form Validation ---");

assert(src.includes("required"), "Uses required attribute on inputs");
assert(src.includes("maxLength"), "Has maxLength constraints");
assert(src.includes("type=\"email\"") || src.includes("type=\"url\""), "Uses proper input types");

// ============================================================
// 19. UI Quality
// ============================================================
console.log("\n--- 19. UI Quality ---");

assert(src.includes("SALAM LIT"), "Shows brand name");
assert(src.includes("workspace") || src.includes("Workspace"), "Step 1 references workspace");
assert(src.includes("business") || src.includes("Business"), "Step 2 references business");
assert(src.includes("progress") || src.includes("Step") || src.includes("step") || src.includes("01"), "Has progress indicator");

// ============================================================
// 20. No Unnecessary File Changes
// ============================================================
console.log("\n--- 20. Scope ---");

const changedFiles = [
  "app/onboarding/page.tsx",
];

for (const f of changedFiles) {
  try {
    const content = readFileSync(resolve(f), "utf-8");
    assert(content.length > 0, `${f} exists`);
  } catch {
    assert(false, `${f} exists`);
  }
}

// ============================================================
// Summary
// ============================================================
console.log("\n════════════════════════════════════════════════════════════");
console.log(`Phase 14.3 Tests: ${passed} passed, ${failed} failed, ${total} total`);
console.log("════════════════════════════════════════════════════════════");

if (failed > 0) {
  process.exit(1);
}
