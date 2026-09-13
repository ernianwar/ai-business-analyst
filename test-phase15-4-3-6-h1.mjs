/**
 * Phase 15.4.3.6 H1 — Circuit-Breaker Auto-Reset Verification
 *
 * Tests the 60-second cooldown auto-reset behavior in get_circuit_state().
 * Uses a unique test provider per test to isolate from other tests.
 * Directly manipulates opened_at to control time without pg_sleep().
 *
 * Run: NODE_ENV=test npx tsx test-phase15-4-3-6-h1.mjs
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";

// Load .env.local before any module imports
const envPath = resolve(import.meta.dirname, ".env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx < 0) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const val = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = val;
}

let passed = 0;
let failed = 0;
let total = 0;
const failures = [];

function test(condition, message) {
  total++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.log(`  ❌ FAIL: ${message}`);
    failed++;
    failures.push(message);
  }
}

async function runTests() {
  console.log("\n=== Phase 15.4.3.6 H1 — Circuit-Breaker Auto-Reset Verification ===\n");

  const { getSupabaseClient } = await import("./src/lib/db/supabase-client.ts");
  const client = getSupabaseClient();

  if (!client) {
    console.log("  ⚠️ SKIPPED: PostgreSQL not available (getSupabaseClient() returned null)");
    console.log("  ⚠️ H1 cannot be behaviorally verified without database access.");
    process.exit(0);
  }

  // ============================================================
  // HELPER: Open a circuit for a unique test provider
  // ============================================================
  async function openCircuit(provider, threshold = 5) {
    for (let i = 0; i < threshold; i++) {
      await client.rpc("record_circuit_failure", {
        p_provider: provider,
        p_threshold: threshold,
      });
    }
  }

  // ============================================================
  // HELPER: Read circuit state directly from table
  // ============================================================
  async function readCircuitRow(provider) {
    const { data } = await client
      .from("ai_circuit_breaker_state")
      .select("open, failures, last_failure, opened_at")
      .eq("provider", provider)
      .single();
    return data;
  }

  // ============================================================
  // HELPER: Set opened_at to N seconds ago
  // ============================================================
  async function setOpenedAtSecondsAgo(provider, secondsAgo) {
    const target = new Date(Date.now() - secondsAgo * 1000).toISOString();
    await client
      .from("ai_circuit_breaker_state")
      .update({ opened_at: target })
      .eq("provider", provider);
  }

  // ============================================================
  // TEST 1: Verify auto-reset triggers when cooldown has elapsed
  // ============================================================
  console.log("--- 1. Auto-Reset After Cooldown (opened_at 61s ago) ---");

  const provider1 = `h1-reset-${Date.now()}`;
  await openCircuit(provider1);

  const row1 = await readCircuitRow(provider1);
  test(row1 !== null, "Circuit row exists after opening");
  test(row1?.open === true, "Circuit is open after 5 failures");
  test(row1?.failures === 5, "Failure count is 5");

  // Set opened_at to 61 seconds ago (past the 60s cooldown)
  await setOpenedAtSecondsAgo(provider1, 61);

  // Now call get_circuit_state — should trigger auto-reset
  const state1 = await client.rpc("get_circuit_state", {
    p_provider: provider1,
  });
  const resetRow = Array.isArray(state1.data) ? state1.data[0] : state1.data;

  test(resetRow.open === false, "Circuit auto-reset: open is FALSE after 61s cooldown");
  test(resetRow.failures === 0, "Circuit auto-reset: failures is 0 after reset");
  test(resetRow.cooldown_remaining_ms === 0, "Circuit auto-reset: cooldown_remaining_ms is 0");

  // Verify the database row was also updated
  const afterReset = await readCircuitRow(provider1);
  test(afterReset?.open === false, "Database row: open is FALSE after auto-reset");
  test(afterReset?.failures === 0, "Database row: failures is 0 after auto-reset");
  test(afterReset?.opened_at === null, "Database row: opened_at is NULL after auto-reset");

  // ============================================================
  // TEST 2: Verify auto-reset does NOT trigger when cooldown has not elapsed
  // ============================================================
  console.log("\n--- 2. No Auto-Reset Before Cooldown (opened_at 30s ago) ---");

  const provider2 = `h1-noreset-${Date.now()}`;
  await openCircuit(provider2);

  // Set opened_at to 30 seconds ago (within the 60s cooldown)
  await setOpenedAtSecondsAgo(provider2, 30);

  const state2 = await client.rpc("get_circuit_state", {
    p_provider: provider2,
  });
  const noResetRow = Array.isArray(state2.data) ? state2.data[0] : state2.data;

  test(noResetRow.open === true, "Circuit still open at 30s (within cooldown)");
  test(noResetRow.failures === 5, "Failure count preserved at 5");
  test(noResetRow.cooldown_remaining_ms > 0, "cooldown_remaining_ms is positive");
  test(noResetRow.cooldown_remaining_ms <= 60000, "cooldown_remaining_ms <= 60000");

  // Verify the database row was NOT modified
  const afterNoReset = await readCircuitRow(provider2);
  test(afterNoReset?.open === true, "Database row: still open (no auto-reset)");
  test(afterNoReset?.failures === 5, "Database row: failures unchanged");

  // ============================================================
  // TEST 3: Boundary — opened_at 59s ago (should NOT reset)
  // ============================================================
  console.log("\n--- 3. Within Cooldown — opened_at 50s ago (no reset expected) ---");

  const provider3 = `h1-boundary-${Date.now()}`;
  await openCircuit(provider3);

  // Set opened_at to 50 seconds ago — safely within the 60s cooldown
  // Buffer accounts for test execution latency (network, RPC overhead)
  await setOpenedAtSecondsAgo(provider3, 50);

  const state3 = await client.rpc("get_circuit_state", {
    p_provider: provider3,
  });
  const boundaryRow = Array.isArray(state3.data) ? state3.data[0] : state3.data;

  test(boundaryRow.open === true, "Circuit still open at 50s (within cooldown)");
  test(boundaryRow.failures === 5, "Failure count preserved at boundary");
  test(boundaryRow.cooldown_remaining_ms > 0, "cooldown_remaining_ms is positive at 50s");
  test(boundaryRow.cooldown_remaining_ms <= 60000, "cooldown_remaining_ms <= 60000 at 50s");

  // ============================================================
  // TEST 4: Boundary — opened_at 61s ago (should reset)
  // ============================================================
  console.log("\n--- 4. Boundary — opened_at 61s ago (reset expected) ---");

  const provider4 = `h1-boundary2-${Date.now()}`;
  await openCircuit(provider4);

  await setOpenedAtSecondsAgo(provider4, 61);

  const state4 = await client.rpc("get_circuit_state", {
    p_provider: provider4,
  });
  const boundary2Row = Array.isArray(state4.data) ? state4.data[0] : state4.data;

  test(boundary2Row.open === false, "Circuit auto-reset at 61s (just past boundary)");
  test(boundary2Row.failures === 0, "Failure count reset at boundary");

  // ============================================================
  // TEST 5: Auto-reset is deterministic (consistent across calls)
  // ============================================================
  console.log("\n--- 5. Deterministic Behavior ---");

  const provider5 = `h1-deterministic-${Date.now()}`;
  await openCircuit(provider5);

  await setOpenedAtSecondsAgo(provider5, 120);

  // Call get_circuit_state twice
  const state5a = await client.rpc("get_circuit_state", {
    p_provider: provider5,
  });
  const row5a = Array.isArray(state5a.data) ? state5a.data[0] : state5a.data;

  const state5b = await client.rpc("get_circuit_state", {
    p_provider: provider5,
  });
  const row5b = Array.isArray(state5b.data) ? state5b.data[0] : state5b.data;

  test(row5a.open === false, "First call: circuit reset");
  test(row5a.failures === 0, "First call: failures 0");
  test(row5b.open === false, "Second call: circuit still reset");
  test(row5b.failures === 0, "Second call: failures still 0");

  // ============================================================
  // TEST 6: SQL contract verification
  // ============================================================
  console.log("\n--- 6. SQL Contract Verification ---");

  const migrationSrc = readFileSync(
    "supabase/migrations/010_ai_runtime_security_enforcement.sql",
    "utf-8"
  );

  test(
    migrationSrc.includes("v_reset_ms BIGINT := 60000"),
    "SQL defines cooldown as 60000ms"
  );
  test(
    migrationSrc.includes("EXTRACT(EPOCH FROM (NOW() - v_state.opened_at)) * 1000 > v_reset_ms"),
    "SQL auto-reset condition uses > (strictly greater than)"
  );
  test(
    migrationSrc.includes("SET failures = 0, open = FALSE, opened_at = NULL"),
    "SQL resets failures, open, and opened_at"
  );

  // Verify TypeScript matches SQL
  const gwSource = readFileSync("src/lib/runtime/model-gateway.ts", "utf-8");
  test(
    gwSource.includes("CIRCUIT_RESET_MS = 60_000"),
    "TypeScript cooldown matches SQL (60000ms)"
  );
  test(
    gwSource.includes("CIRCUIT_FAILURE_THRESHOLD = 5"),
    "TypeScript failure threshold is 5"
  );

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log("\n" + "=".repeat(60));
  console.log(`RESULTS: ${passed} passed / ${failed} failed / ${total} total`);
  if (failures.length > 0) {
    console.log("\nFailed tests:");
    for (const f of failures) {
      console.log(`  ❌ ${f}`);
    }
  }
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
