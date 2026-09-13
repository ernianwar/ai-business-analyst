/**
 * SALAM LIT — Phase 14.2 Tests: Authenticated Context Resolution
 *
 * Tests for src/lib/auth/get-context.ts
 *
 * Validates:
 * - Function exports and types
 * - Security properties (no client-supplied user_id, correct RPC call)
 * - Edge cases (unauthenticated, RPC failure, partial context)
 *
 * Note: get-context.ts depends on Next.js SSR (cookies, Supabase SSR client).
 * These tests validate the module structure and security invariants.
 * Integration tests require a running Next.js dev server.
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

console.log("════════════════════════════════════════════════════════════");
console.log("Phase 14.2: Authenticated Context Resolution Tests");
console.log("════════════════════════════════════════════════════════════\n");

// ============================================================
// 1. Source Code Analysis
// ============================================================
console.log("--- 1. Source Code Analysis ---");

const srcPath = resolve("src/lib/auth/get-context.ts");
const src = readFileSync(srcPath, "utf-8");

// Test: File exists and is non-empty
assert(src.length > 0, "get-context.ts exists and is non-empty");

// Test: Exports AuthenticatedContext type
assert(
  src.includes("export interface AuthenticatedContext"),
  "Exports AuthenticatedContext interface"
);

// Test: Exports OnboardingStatus type
assert(
  src.includes("export type OnboardingStatus"),
  "Exports OnboardingStatus type"
);

// Test: Exports getAuthenticatedContext function
assert(
  src.includes("export async function getAuthenticatedContext"),
  "Exports getAuthenticatedContext function"
);

// Test: Exports requireAuthenticatedContext function
assert(
  src.includes("export async function requireAuthenticatedContext"),
  "Exports requireAuthenticatedContext function"
);

// Test: Exports helper functions
assert(
  src.includes("export function hasCompleteContext"),
  "Exports hasCompleteContext helper"
);
assert(
  src.includes("export function hasWorkspace"),
  "Exports hasWorkspace helper"
);
assert(
  src.includes("export function needsOnboarding"),
  "Exports needsOnboarding helper"
);

// ============================================================
// 2. Security Properties — Source Code Invariants
// ============================================================
console.log("\n--- 2. Security Properties ---");

// Test: Never accepts user_id as a function parameter
assert(
  !src.includes("function getAuthenticatedContext(user_id") &&
  !src.includes("function getAuthenticatedContext({"),
  "getAuthenticatedContext() accepts no parameters"
);

// Test: Uses getAuthenticatedUser() for identity
assert(
  src.includes("getAuthenticatedUser()"),
  "Uses getAuthenticatedUser() for identity derivation"
);

// Test: Imports from get-user.ts
assert(
  src.includes('from "@/lib/auth/get-user"'),
  "Imports from get-user.ts (JWT-verified identity)"
);

// Test: Imports createClient from supabase-server.ts
assert(
  src.includes('from "@/lib/db/supabase-server"'),
  "Imports user-scoped Supabase SSR client"
);

// Test: Does NOT import supabase-client.ts (service role)
assert(
  !src.includes('from "@/lib/db/supabase-client"'),
  "Does NOT import service-role client"
);

// Test: Calls get_user_context RPC with no parameters
assert(
  src.includes('rpc("get_user_context")') || src.includes("rpc('get_user_context')"),
  "Calls get_user_context() RPC with no parameters"
);

// Test: Does NOT call old vulnerable signature
assert(
  !src.includes("get_user_context(") || src.includes('rpc("get_user_context")'),
  "Does NOT call old get_user_context(uuid) signature"
);

// Test: Never accepts workspace_id from client
assert(
  !src.includes("workspace_id:") || src.includes("rpc.workspace_id"),
  "workspace_id comes from RPC, not client"
);

// Test: Never accepts business_id from client
assert(
  !src.includes("business_id:") || src.includes("rpc.business_id"),
  "business_id comes from RPC, not client"
);

// Test: Fails closed on error
assert(
  src.includes("return null") && src.includes("error"),
  "Returns null on error (fail closed)"
);

// Test: Fails closed when no data
assert(
  src.includes("if (!data)") || src.includes("if (data === null)"),
  "Returns null when no data (fail closed)"
);

// Test: Fails closed when unauthenticated
assert(
  src.includes("if (!user)") && src.includes("return null"),
  "Returns null when unauthenticated (fail closed)"
);

// ============================================================
// 3. AuthenticatedContext Type Structure
// ============================================================
console.log("\n--- 3. Context Type Structure ---");

// Test: Context has user_id
assert(
  src.includes("user_id: string"),
  "Context has user_id: string"
);

// Test: Context has email
assert(
  src.includes("email: string | null"),
  "Context has email: string | null"
);

// Test: Context has display_name
assert(
  src.includes("display_name: string | null"),
  "Context has display_name: string | null"
);

// Test: Context has workspace_id (nullable)
assert(
  src.includes("workspace_id: string | null"),
  "Context has workspace_id: string | null"
);

// Test: Context has business_id (nullable)
assert(
  src.includes("business_id: string | null"),
  "Context has business_id: string | null"
);

// Test: Context has role (nullable)
assert(
  src.includes("role: string | null"),
  "Context has role: string | null"
);

// Test: Context has onboarding_status
assert(
  src.includes("onboarding_status: OnboardingStatus | null"),
  "Context has onboarding_status: OnboardingStatus | null"
);

// ============================================================
// 4. OnboardingStatus Values
// ============================================================
console.log("\n--- 4. OnboardingStatus Values ---");

const statuses = ["INVITED", "WORKSPACE_CREATED", "BUSINESS_CREATED", "CONTEXT_CONFIGURED", "COMPLETE"];
for (const status of statuses) {
  assert(
    src.includes(`"${status}"`),
    `OnboardingStatus includes "${status}"`
  );
}

// ============================================================
// 5. Helper Function Security
// ============================================================
console.log("\n--- 5. Helper Functions ---");

// Test: hasCompleteContext checks all three fields
assert(
  src.includes("ctx.workspace_id !== null") &&
  src.includes("ctx.business_id !== null") &&
  src.includes("ctx.role !== null"),
  "hasCompleteContext checks workspace_id, business_id, and role"
);

// Test: needsOnboarding checks workspace_id
assert(
  src.includes("ctx.workspace_id === null"),
  "needsOnboarding checks workspace_id is null"
);

// ============================================================
// 6. Migration 006 Compatibility
// ============================================================
console.log("\n--- 6. Migration 006 Compatibility ---");

// Test: No reference to old function signatures
assert(
  !src.includes("uuid, text, text") && !src.includes("uuid,text,text"),
  "No reference to old create_workspace_with_owner(uuid,text,text) signature"
);

assert(
  !src.includes("uuid, uuid, text") && !src.includes("uuid,uuid,text"),
  "No reference to old create_business_with_context(uuid,uuid,...) signature"
);

// Test: No reference to supabase.auth.getUser with user_id
assert(
  !src.includes("getUser(user_id") && !src.includes("getUser({ id:"),
  "Does not call getUser with a supplied user_id"
);

// ============================================================
// Summary
// ============================================================
console.log("\n════════════════════════════════════════════════════════════");
console.log(`Phase 14.2 Context Tests: ${passed} passed, ${failed} failed, ${total} total`);
console.log("════════════════════════════════════════════════════════════");

if (failed > 0) {
  process.exit(1);
}
