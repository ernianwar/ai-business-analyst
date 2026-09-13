/**
 * Phase 15.2A / 15.2A.2 — Standing Authorization Usage Persistence + Fail-Closed Tests
 *
 * Verifies:
 * - PostgreSQL-authoritative usage enforcement
 * - Fail-closed when DB unavailable or RPC fails
 * - In-memory state alone cannot authorize
 * - Process restart cannot reset usage
 * - Concurrency safety on final slot
 * - Business and authorization isolation
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

import {
  createStandingAuthorization,
  matchStandingAuthorization,
  revokeStandingAuthorization,
} from "./src/lib/approval/approval-service";
import { getStandingAuthRepository, resetStandingAuthRepository } from "./src/lib/approval/standing-auth-repository";
import { seedDemoApprovalAccess } from "./src/lib/approval/access-control";

seedDemoApprovalAccess();

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

// Use UUIDs matching the test data set up in the remote DB
const WS_ID = "11111111-1111-1111-1111-111111111111";
const USER_ID = "4fda0920-b201-4506-9d70-7e330896c6e6";
const BUSINESS = "22222222-2222-2222-2222-222222222222";
const BUSINESS_2 = "44444444-4444-4444-4444-444444444444";

const SCOPE = {
  business_id: BUSINESS,
  action_type: "AD_SPEND",
  max_amount: 1000,
  currency: "MYR",
  vendor_payee: null,
  vendor_category: null,
  frequency: null,
  time_period: null,
  resource: null,
  authorized_agent: null,
};

const SCOPE_B2 = { ...SCOPE, business_id: BUSINESS_2 };

async function cleanupTestData() {
  try {
    const { getSupabaseClient } = await import("./src/lib/db/supabase-client");
    const client = getSupabaseClient();
    if (!client) return;
    const businesses = [BUSINESS, BUSINESS_2];
    const { data: auths } = await client.from("standing_authorizations").select("id").in("business_id", businesses);
    if (auths?.length) {
      const ids = auths.map((a) => a.id);
      await client.from("standing_auth_usage").delete().in("authorization_id", ids);
      await client.from("standing_authorizations").delete().in("id", ids);
    }
  } catch { /* best effort */ }
}

async function runTests() {
  await cleanupTestData();
  console.log("\n=== Phase 15.2A/15.2A.2 — Standing Auth Persistence + Fail-Closed ===\n");

  // ── Test 1: DB available + usage 0 → allowed ──
  console.log("--- Test 1: Fresh Usage Starts at Zero ---");
  const auth1 = createStandingAuthorization({
    business_id: BUSINESS,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, action_type: "AD_SPEND", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 3,
  });
  await getStandingAuthRepository().flush();
  const repo = getStandingAuthRepository();
  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString();
  const initialCount = await repo.getUsageCount(auth1.id, periodStart);
  assertEqual(initialCount, 0, "1: Fresh authorization usage starts at zero in DB");

  // ── Test 2: DB available + usage below max → allowed ──
  console.log("--- Test 2: First Usage Succeeds ---");
  const match2 = await matchStandingAuthorization(BUSINESS, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assert(match2 !== null, "2: First usage succeeds");
  assertEqual(match2?.id, auth1.id, "2: Correct authorization matched");

  // ── Test 3: DB available + usage reaches max → allowed exactly at limit ──
  console.log("--- Test 3/4: Usage Limit Enforcement ---");
  const match3a = await matchStandingAuthorization(BUSINESS, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assert(match3a !== null, "3a: 2nd use succeeds");
  const match3b = await matchStandingAuthorization(BUSINESS, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assert(match3b !== null, "3b: 3rd use (exactly max) succeeds");

  // ── Test 4: DB available + usage exceeds max → denied ──
  console.log("--- Test 4: Usage Beyond Max Denied ---");
  const match4 = await matchStandingAuthorization(BUSINESS, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match4, null, "4: Usage beyond max_uses_per_period is rejected");

  // ── Test 5: Expired authorization → denied ──
  console.log("--- Test 5: Expired Authorization ---");
  const auth5 = createStandingAuthorization({
    business_id: BUSINESS,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, action_type: "AD_SPEND", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 5,
    effective_until: new Date(Date.now() - 86400000).toISOString(),
  });
  await getStandingAuthRepository().flush();
  const match5 = await matchStandingAuthorization(BUSINESS, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assert(match5?.id !== auth5.id, "5: Expired authorization is not matched");

  // ── Test 6: Revoked authorization → denied ──
  console.log("--- Test 6: Revoked Authorization ---");
  const auth6 = createStandingAuthorization({
    business_id: BUSINESS,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, action_type: "AD_SPEND", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 5,
  });
  await getStandingAuthRepository().flush();
  revokeStandingAuthorization(auth6.id, USER_ID);
  const match6 = await matchStandingAuthorization(BUSINESS, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assert(match6?.id !== auth6.id, "6: Revoked authorization is not matched");

  // ── Test 7: In-memory state alone cannot cause authorization ──
  console.log("--- Test 7: In-Memory-Only Auth Denied (FK Violation) ---");
  // Create an authorization in-memory but with a business that doesn't exist in DB
  const fakeBusiness = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const auth7 = createStandingAuthorization({
    business_id: fakeBusiness,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, business_id: fakeBusiness, action_type: "AD_SPEND", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 10,
  });
  // Do NOT flush — authorization exists only in-memory
  // Try to match — the in-memory cache will find it, but the RPC will fail with FK violation
  // The new fail-closed behavior should deny usage
  const match7 = await matchStandingAuthorization(fakeBusiness, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, business_id: fakeBusiness, max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match7, null, "7: In-memory-only authorization is DENIED (FK violation → fail closed)");

  // ── Test 8: Simulated process restart cannot reset authoritative usage ──
  console.log("--- Test 8: Process Restart Cannot Reset Usage ---");
  // auth1 was used 3 times (max_uses_per_period=3). Verify it's still rejected after cache clear.
  resetStandingAuthRepository();
  const freshRepo = getStandingAuthRepository();
  await freshRepo.loadFromDatabase(BUSINESS);
  const match8 = await matchStandingAuthorization(BUSINESS, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match8, null, "8: Exhausted authorization still rejected after cache reset + DB reload");

  // ── Test 9: max_uses_per_period = 1: first use allowed, second denied ──
  console.log("--- Test 9: Single Use Limit ---");
  const auth9 = createStandingAuthorization({
    business_id: BUSINESS,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, action_type: "MARKETING", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 1,
  });
  await getStandingAuthRepository().flush();
  const match9a = await matchStandingAuthorization(BUSINESS, {
    action_type: "MARKETING",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assert(match9a !== null, "9a: First use of single-use auth succeeds");
  const match9b = await matchStandingAuthorization(BUSINESS, {
    action_type: "MARKETING",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match9b, null, "9b: Second use of single-use auth is denied");

  // ── Test 10: max_uses_per_period = 5: five uses allowed, sixth denied ──
  console.log("--- Test 10: Five-Use Limit ---");
  const auth10 = createStandingAuthorization({
    business_id: BUSINESS,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, action_type: "FINANCIAL_COMMITMENT", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 5,
  });
  await getStandingAuthRepository().flush();
  for (let i = 1; i <= 5; i++) {
    const m = await matchStandingAuthorization(BUSINESS, {
      action_type: "FINANCIAL_COMMITMENT",
      scope: { ...SCOPE, max_amount: 300 },
      agent_key: "erni",
    });
    assert(m !== null, `10${String.fromCharCode(96 + i)}: Use ${i}/5 succeeds`);
  }
  const match10f = await matchStandingAuthorization(BUSINESS, {
    action_type: "FINANCIAL_COMMITMENT",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match10f, null, "10f: 6th use is denied");

  // ── Test 11: Concurrent final slot — exactly one succeeds ──
  console.log("--- Test 11: Concurrent Final Slot ---");
  const auth11 = createStandingAuthorization({
    business_id: BUSINESS,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, action_type: "PURCHASE", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 2,
  });
  await getStandingAuthRepository().flush();
  // Use once
  await matchStandingAuthorization(BUSINESS, {
    action_type: "PURCHASE",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  // 2 concurrent attempts for the final slot
  const [c1, c2] = await Promise.all([
    matchStandingAuthorization(BUSINESS, {
      action_type: "PURCHASE",
      scope: { ...SCOPE, max_amount: 300 },
      agent_key: "erni",
    }),
    matchStandingAuthorization(BUSINESS, {
      action_type: "PURCHASE",
      scope: { ...SCOPE, max_amount: 300 },
      agent_key: "erni",
    }),
  ]);
  const successes = (c1 !== null ? 1 : 0) + (c2 !== null ? 1 : 0);
  assertEqual(successes, 1, "11: Exactly one concurrent request succeeds for final slot");

  // Verify exhausted after concurrent test
  const match11ex = await matchStandingAuthorization(BUSINESS, {
    action_type: "PURCHASE",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match11ex, null, "11: Authorization exhausted after concurrent test");

  // ── Test 12: Different authorizations remain isolated ──
  console.log("--- Test 12: Authorization Isolation ---");
  const auth12a = createStandingAuthorization({
    business_id: BUSINESS,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, action_type: "DATA_EXPORT", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 2,
  });
  const auth12b = createStandingAuthorization({
    business_id: BUSINESS,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, action_type: "CUSTOMER_MESSAGE", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 2,
  });
  await getStandingAuthRepository().flush();
  // Exhaust auth12a
  await matchStandingAuthorization(BUSINESS, {
    action_type: "DATA_EXPORT",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  await matchStandingAuthorization(BUSINESS, {
    action_type: "DATA_EXPORT",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  const match12aExhausted = await matchStandingAuthorization(BUSINESS, {
    action_type: "DATA_EXPORT",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match12aExhausted, null, "12a: First authorization exhausted");
  // auth12b should still work (independent counter)
  const match12b = await matchStandingAuthorization(BUSINESS, {
    action_type: "CUSTOMER_MESSAGE",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assert(match12b !== null, "12b: Second authorization with independent counter still works");

  // ── Test 13: Different businesses remain isolated ──
  console.log("--- Test 13: Business Isolation ---");
  const auth13 = createStandingAuthorization({
    business_id: BUSINESS_2,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE_B2, action_type: "AD_SPEND", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 1,
  });
  await getStandingAuthRepository().flush();
  const match13a = await matchStandingAuthorization(BUSINESS_2, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE_B2, max_amount: 300 },
    agent_key: "erni",
  });
  assert(match13a !== null, "13a: Auth on business 2 succeeds");
  const match13b = await matchStandingAuthorization(BUSINESS_2, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE_B2, max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match13b, null, "13b: Auth on business 2 exhausted");
  // Auth on business 1 (auth13 was for BIZ2) should not match
  const match13c = await matchStandingAuthorization(BUSINESS, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, max_amount: 300 },
    agent_key: "erni",
  });
  assert(match13c === null || match13c?.id !== auth13.id, "13c: Auth for BIZ2 does not match BIZ1");

  // ── Test 14: DB unavailable → denied (RPC returns dbAvailable:false via FK violation) ──
  console.log("--- Test 14: DB Unavailable → Deny ---");
  // Create a standing auth in-memory only (no DB record — use a nonexistent business)
  const fakeBiz2 = "bbbbbbbb-cccc-dddd-eeee-ffffffffffff";
  const auth14 = createStandingAuthorization({
    business_id: fakeBiz2,
    authorized_by: USER_ID,
    authorized_agent: "erni",
    scope: { ...SCOPE, business_id: fakeBiz2, action_type: "AD_SPEND", max_amount: 500 },
    max_amount_per_use: 500,
    max_amount_per_period: 5000,
    period: "daily",
    max_uses_per_period: 10,
  });
  // Do NOT flush — simulates standing auth existing only in-memory (no DB record)
  // The RPC will fail with FK violation → dbAvailable: false → fail closed
  const match14 = await matchStandingAuthorization(fakeBiz2, {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, business_id: fakeBiz2, max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match14, null, "14: DB unavailable (FK violation) → DENIED");

  // ── Test 15: No standing auth match for nonexistent business ──
  console.log("--- Test 15: Nonexistent Business ---");
  const match15 = await matchStandingAuthorization("99999999-9999-9999-9999-999999999999", {
    action_type: "AD_SPEND",
    scope: { ...SCOPE, business_id: "99999999-9999-9999-9999-999999999999", max_amount: 300 },
    agent_key: "erni",
  });
  assertEqual(match15, null, "15: Nonexistent business returns no match");

  // ── Summary ──
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
