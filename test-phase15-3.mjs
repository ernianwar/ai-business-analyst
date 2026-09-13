/**
 * Phase 15.3 — API Authentication & Multi-Tenant Security Hardening Tests
 *
 * Verifies:
 * - Authentication required on all /api/business/[id]/* routes
 * - Business scope enforcement (cross-business access denied)
 * - Fail-closed when business_id is null in authenticated routes
 * - __setTestAuthOverride NODE_ENV guard blocks non-test usage
 * - increment_standing_auth_usage PUBLIC EXECUTE revoked
 * - Document routes require authentication
 */

// Force test mode for __setTestAuthOverride guard tests
process.env.NODE_ENV = "test";

import { readFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

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
    console.log(`❌ FAIL: ${message} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

function assertIncludes(str, substr, message) {
  if (str && str.includes(substr)) {
    console.log(`✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`❌ FAIL: ${message} — "${str}" does not contain "${substr}"`);
    failed++;
  }
}

// ─── Test IDs ──────────────────────────────────────────────
const BUSINESS_A = "22222222-2222-2222-2222-222222222222";
const BUSINESS_B = "44444444-4444-4444-4444-444444444444";
const BUSINESS_FAKE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const BASE = "http://localhost:3456";

// ─── Test helpers ──────────────────────────────────────────
const UNAUTHENTICATED_ROUTES = [
  { method: "GET",  path: `/api/business/${BUSINESS_A}` },
  { method: "PATCH", path: `/api/business/${BUSINESS_A}` },
  { method: "DELETE", path: `/api/business/${BUSINESS_A}` },
  { method: "GET",  path: `/api/business/${BUSINESS_A}/context` },
  { method: "GET",  path: `/api/business/${BUSINESS_A}/evidence` },
  { method: "POST", path: `/api/business/${BUSINESS_A}/evidence` },
  { method: "GET",  path: `/api/business/${BUSINESS_A}/facts` },
  { method: "POST", path: `/api/business/${BUSINESS_A}/facts` },
  { method: "GET",  path: `/api/business/${BUSINESS_A}/finance` },
  { method: "POST", path: `/api/business/${BUSINESS_A}/finance` },
  { method: "GET",  path: `/api/business/${BUSINESS_A}/finance/definitions` },
  { method: "GET",  path: `/api/business/${BUSINESS_A}/finance/compare?period_start=2026-01-01&period_end=2026-01-31` },
  { method: "GET",  path: `/api/business/${BUSINESS_A}/data-sources` },
  { method: "POST", path: `/api/business/${BUSINESS_A}/data-sources` },
  { method: "POST", path: `/api/business/${BUSINESS_A}/upload` },
  { method: "GET",  path: `/api/documents/nonexistent/ingest` },
  { method: "POST", path: `/api/documents/nonexistent/ingest` },
  { method: "GET",  path: `/api/documents/nonexistent/evidence` },
];

// ─── 1. Unauthenticated access tests ──────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log("1. UNAUTHENTICATED ACCESS → 307 redirect to /login");
console.log("═══════════════════════════════════════════════\n");

for (const route of UNAUTHENTICATED_ROUTES) {
  try {
    const opts = { method: route.method, headers: {}, redirect: "manual" };
    if (route.method === "POST") {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify({});
    }
    const res = await fetch(`${BASE}${route.path}`, opts);
    const status = res.status;
    const location = res.headers.get("location") || "";

    const isBlocked = status === 307 || status === 401 || status === 403;
    assert(isBlocked, `${route.method} ${route.path} → blocked (got ${status})`);
    if (status === 307) {
      assertIncludes(location, "/login", `  → redirects to /login`);
    }
  } catch (err) {
    assert(false, `${route.method} ${route.path} → fetch error: ${err.message}`);
  }
}

// ─── 2. __setTestAuthOverride NODE_ENV guard ───────────────
console.log("\n═══════════════════════════════════════════════");
console.log("2. __setTestAuthOverride NODE_ENV GUARD");
console.log("═══════════════════════════════════════════════\n");

try {
  // Import the module — _testOverride is module-level state
  const mod = await import("./src/lib/auth/get-context.ts");
  const { __setTestAuthOverride } = mod;

  // Save original NODE_ENV
  const origNodeEnv = process.env.NODE_ENV;

  // Test 2a: In test environment, override should work (no error thrown)
  process.env.NODE_ENV = "test";
  let overrideSet = false;
  try {
    __setTestAuthOverride(async () => ({
      user_id: "test-user", email: "test@test.com", display_name: "Test",
      workspace_id: "ws-1", business_id: "biz-1", role: "OWNER", onboarding_status: "COMPLETE",
    }));
    overrideSet = true;
  } catch (e) {
    overrideSet = false;
  }
  assert(overrideSet, "Override accepted in NODE_ENV=test");

  // Test 2b: In production, override should be BLOCKED (no error, but function not set)
  __setTestAuthOverride(null);
  process.env.NODE_ENV = "production";
  let productionBlocked = false;
  // Capture console.error to verify the security log
  const origError = console.error;
  let securityLog = "";
  console.error = (...args) => { securityLog = args.join(" "); origError(...args); };
  __setTestAuthOverride(async () => ({
    user_id: "hacked-user", email: "hacked@evil.com", display_name: "Hacker",
    workspace_id: "ws-evil", business_id: "biz-evil", role: "OWNER", onboarding_status: "COMPLETE",
  }));
  console.error = origError;
  assertIncludes(securityLog, "BLOCKED", "Security log emitted when override called in production");
  assertIncludes(securityLog, "non-test environment", "Log message mentions non-test environment");

  // Test 2c: In development, override should also be BLOCKED
  __setTestAuthOverride(null);
  process.env.NODE_ENV = "development";
  let devBlocked = false;
  let devSecurityLog = "";
  console.error = (...args) => { devSecurityLog = args.join(" "); origError(...args); };
  __setTestAuthOverride(async () => ({
    user_id: "hacked-user", email: "hacked@evil.com", display_name: "Hacker",
    workspace_id: "ws-evil", business_id: "biz-evil", role: "OWNER", onboarding_status: "COMPLETE",
  }));
  console.error = origError;
  assertIncludes(devSecurityLog, "BLOCKED", "Security log emitted when override called in development");

  // Test 2d: Override must NOT be active after production/dev attempt
  // Verify the override was not set by calling getAuthenticatedContext in non-test env
  process.env.NODE_ENV = "production";
  let overrideNotActive = false;
  try {
    const ctx = await mod.getAuthenticatedContext();
    // In production without a real session, getAuthenticatedContext returns null (fail-closed)
    // If the override were active, it would return the evil context
    overrideNotActive = ctx === null || ctx?.user_id !== "hacked-user";
  } catch (e) {
    // cookies() outside request scope is expected — confirms real auth path is used, not override
    overrideNotActive = true;
  }
  assert(overrideNotActive, "Override not active in production after attempt");

  // Clean up
  __setTestAuthOverride(null);
  process.env.NODE_ENV = origNodeEnv;
} catch (err) {
  assert(false, `NODE_ENV guard test error: ${err.message}`);
}

// ─── 3. Business scope enforcement (source code verification) ───
console.log("\n═══════════════════════════════════════════════");
console.log("3. BUSINESS SCOPE ENFORCEMENT (source verification)");
console.log("═══════════════════════════════════════════════\n");

try {
  // Verify that all business routes check business_id match
  const { readFileSync } = await import("fs");
  const { resolve: res } = await import("path");

  // Check that business routes verify URL param matches ctx.business_id
  const routesToCheck = [
    { file: "app/api/business/[id]/route.ts", pattern: "ctx.business_id !== id", label: "GET/PATCH/DELETE /api/business/[id]" },
    { file: "app/api/business/[id]/context/route.ts", pattern: "ctx.business_id !== id", label: "GET /api/business/[id]/context" },
    { file: "app/api/business/[id]/evidence/route.ts", pattern: "ctx.business_id !== id", label: "GET/POST /api/business/[id]/evidence" },
    { file: "app/api/business/[id]/facts/route.ts", pattern: "ctx.business_id !== id", label: "GET/POST /api/business/[id]/facts" },
    { file: "app/api/business/[id]/finance/route.ts", pattern: "ctx.business_id !== business_id", label: "GET/POST /api/business/[id]/finance" },
    { file: "app/api/business/[id]/finance/compare/route.ts", pattern: "ctx.business_id !== business_id", label: "GET /api/business/[id]/finance/compare" },
    { file: "app/api/business/[id]/data-sources/route.ts", pattern: "ctx.business_id !== business_id", label: "GET/POST /api/business/[id]/data-sources" },
    { file: "app/api/business/[id]/upload/route.ts", pattern: "ctx.business_id !== business_id", label: "POST /api/business/[id]/upload" },
    { file: "app/api/executions/route.ts", pattern: "if (!ctx.business_id)", label: "GET/POST /api/executions" },
    { file: "app/api/actions/[id]/route.ts", pattern: "if (!ctx.business_id)", label: "GET/PATCH /api/actions/[id]" },
  ];

  for (const route of routesToCheck) {
    const src = readFileSync(res(import.meta.dirname, route.file), "utf-8");
    assertIncludes(src, route.pattern, `${route.label} enforces business scope`);
  }

  // Verify NO conditional bypass patterns remain
  const bypassPatterns = [
    { file: "app/api/executions/route.ts", bad: "if (ctx.business_id) {", good: "if (!ctx.business_id)", label: "executions" },
    { file: "app/api/actions/[id]/route.ts", bad: "if (ctx.business_id && ", good: "if (!ctx.business_id)", label: "actions/[id]" },
  ];

  for (const check of bypassPatterns) {
    const src = readFileSync(res(import.meta.dirname, check.file), "utf-8");
    assert(!src.includes(check.bad), `${check.label} has no conditional bypass pattern "${check.bad}"`);
  }
} catch (err) {
  assert(false, `Business scope enforcement test error: ${err.message}`);
}

// ─── 4. increment_standing_auth_usage permission check ─────
console.log("\n═══════════════════════════════════════════════");
console.log("4. increment_standing_auth_usage PERMISSIONS");
console.log("═══════════════════════════════════════════════\n");

try {
  const ACCESS_TOKEN = readFileSync(resolve(homedir(), ".supabase/access-token"), "utf-8").trim();
  const PROJECT_REF = "umqqntdkjmodjwutcfwl";

  // Check anon role permissions
  const anonRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `SELECT has_function_privilege('anon', 'increment_standing_auth_usage(uuid,timestamptz,integer)', 'EXECUTE') as has_execute;`
    }),
  });
  const anonData = await anonRes.json();
  const anonExecute = anonData?.[0]?.has_execute;
  assertEqual(anonExecute, false, "anon role EXECUTE on increment_standing_auth_usage = false");

  // Check authenticated role permissions
  const authRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `SELECT has_function_privilege('authenticated', 'increment_standing_auth_usage(uuid,timestamptz,integer)', 'EXECUTE') as has_execute;`
    }),
  });
  const authData = await authRes.json();
  const authExecute = authData?.[0]?.has_execute;
  assertEqual(authExecute, true, "authenticated role EXECUTE on increment_standing_auth_usage = true");

  // Check service_role permissions
  const svcRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: `SELECT has_function_privilege('service_role', 'increment_standing_auth_usage(uuid,timestamptz,integer)', 'EXECUTE') as has_execute;`
    }),
  });
  const svcData = await svcRes.json();
  const svcExecute = svcData?.[0]?.has_execute;
  assertEqual(svcExecute, true, "service_role EXECUTE on increment_standing_auth_usage = true");
} catch (err) {
  assert(false, `Permission check error: ${err.message}`);
}

// ─── 5. All existing migrations still locked ───────────────
console.log("\n═══════════════════════════════════════════════");
console.log("5. MIGRATION FILE INTEGRITY");
console.log("═══════════════════════════════════════════════\n");

import { readdirSync } from "fs";
const migrationDir = resolve(import.meta.dirname, "supabase/migrations");
const migrations = readdirSync(migrationDir).filter(f => f.endsWith(".sql")).sort();
assert(migrations.length >= 8, `At least 8 migrations exist (found ${migrations.length})`);
assertIncludes(migrations[migrations.length - 1], "010_", "Latest migration is 010");

// ─── 6. Source code invariants ─────────────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log("6. SOURCE CODE INVARIANTS");
console.log("═══════════════════════════════════════════════\n");

import { readFileSync as readFile } from "fs";

// 6a: __setTestAuthOverride must have NODE_ENV guard
const getContextSrc = readFile(resolve(import.meta.dirname, "src/lib/auth/get-context.ts"), "utf-8");
assertIncludes(getContextSrc, 'process.env.NODE_ENV !== "test"', "__setTestAuthOverride has NODE_ENV guard");
assertIncludes(getContextSrc, "BLOCKED", "NODE_ENV guard logs BLOCKED message");

// 6b: No conditional business_id bypass in executions/route.ts
const execSrc = readFile(resolve(import.meta.dirname, "app/api/executions/route.ts"), "utf-8");
assert(!execSrc.includes("if (ctx.business_id)") || execSrc.includes("if (!ctx.business_id)"), "executions/route.ts has no conditional business_id bypass");

// 6c: No conditional business_id bypass in actions/[id]/route.ts
const actionSrc = readFile(resolve(import.meta.dirname, "app/api/actions/[id]/route.ts"), "utf-8");
assert(!actionSrc.includes("if (ctx.business_id)") || actionSrc.includes("if (!ctx.business_id)"), "actions/[id]/route.ts has no conditional business_id bypass");

// 6d: Business routes use getAuthenticatedContext
const businessRoutes = [
  "app/api/business/[id]/route.ts",
  "app/api/business/[id]/context/route.ts",
  "app/api/business/[id]/evidence/route.ts",
  "app/api/business/[id]/facts/route.ts",
  "app/api/business/[id]/finance/route.ts",
  "app/api/business/[id]/finance/definitions/route.ts",
  "app/api/business/[id]/finance/compare/route.ts",
  "app/api/business/[id]/data-sources/route.ts",
  "app/api/business/[id]/upload/route.ts",
  "app/api/documents/[id]/ingest/route.ts",
  "app/api/documents/[id]/evidence/route.ts",
];

for (const routePath of businessRoutes) {
  const src = readFile(resolve(import.meta.dirname, routePath), "utf-8");
  assertIncludes(src, "getAuthenticatedContext", `${routePath} imports getAuthenticatedContext`);
  assertIncludes(src, '"Unauthorized"', `${routePath} returns 401 for unauthenticated`);
}

// 6e: Document routes must not trust client-supplied business_id
const docIngestSrc = readFile(resolve(import.meta.dirname, "app/api/documents/[id]/ingest/route.ts"), "utf-8");
assert(!docIngestSrc.includes("body.business_id"), "ingest route does not trust body.business_id");
assert(!docIngestSrc.includes('searchParams.get("business_id")'), "ingest route does not trust query business_id");
assertIncludes(docIngestSrc, "ctx.business_id", "ingest route derives business_id from context");

const docEvidenceSrc = readFile(resolve(import.meta.dirname, "app/api/documents/[id]/evidence/route.ts"), "utf-8");
assert(!docEvidenceSrc.includes('searchParams.get("business_id")'), "evidence route does not trust query business_id");
assertIncludes(docEvidenceSrc, "ctx.business_id", "evidence route derives business_id from context");
assertIncludes(docEvidenceSrc, "document.business_id !== ctx.business_id", "evidence route verifies document ownership");

// 6f: UI pages must not hard-code demo-business
const financePageSrc = readFile(resolve(import.meta.dirname, "app/finance/page.tsx"), "utf-8");
assert(!financePageSrc.includes('"demo-business"'), "finance page does not hard-code demo-business");
assertIncludes(financePageSrc, "/api/me", "finance page fetches authenticated context");
assertIncludes(financePageSrc, "window.location.href = \"/login\"", "finance page redirects to login on 401");

const dataSourcesPageSrc = readFile(resolve(import.meta.dirname, "app/data-sources/page.tsx"), "utf-8");
assert(!dataSourcesPageSrc.includes('"demo-business"'), "data-sources page does not hard-code demo-business");
assertIncludes(dataSourcesPageSrc, "/api/me", "data-sources page fetches authenticated context");
assertIncludes(dataSourcesPageSrc, "window.location.href = \"/login\"", "data-sources page redirects to login on 401");

// ─── Summary ───────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════");
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
console.log("═══════════════════════════════════════════════\n");

if (failed > 0) {
  process.exit(1);
}
