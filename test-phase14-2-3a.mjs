/**
 * SALAM LIT — Phase 14.2.3A Tests: Authenticated Proactive + Agent + Research API Migration
 *
 * Tests security invariants for:
 * - /api/proactive
 * - /api/proactive/[trigger_id]
 * - /api/proactive/status
 * - /api/agent
 * - /api/agent/[id]
 * - /api/research
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
console.log("Phase 14.2.3A: Authenticated Proactive + Agent + Research API Tests");
console.log("════════════════════════════════════════════════════════════\n");

const proSrc = readRoute("app/api/proactive/route.ts");
const proStatusSrc = readRoute("app/api/proactive/status/route.ts");
const proIdSrc = readRoute("app/api/proactive/[trigger_id]/route.ts");
const agtSrc = readRoute("app/api/agent/route.ts");
const agtIdSrc = readRoute("app/api/agent/[id]/route.ts");
const resSrc = readRoute("app/api/research/route.ts");

const allSrc = proSrc + proStatusSrc + proIdSrc + agtSrc + agtIdSrc + resSrc;

// ============================================================
// 1. Authentication — All Routes Require Auth
// ============================================================
console.log("--- 1. Authentication ---");

assert(proSrc.includes("getAuthenticatedContext"), "Proactive GET/POST uses getAuthenticatedContext");
assert(proStatusSrc.includes("getAuthenticatedContext"), "Proactive status uses getAuthenticatedContext");
assert(proIdSrc.includes("getAuthenticatedContext"), "Proactive [trigger_id] uses getAuthenticatedContext");
assert(agtSrc.includes("getAuthenticatedContext"), "Agent GET/POST uses getAuthenticatedContext");
assert(agtIdSrc.includes("getAuthenticatedContext"), "Agent [id] uses getAuthenticatedContext");
assert(resSrc.includes("getAuthenticatedContext"), "Research uses getAuthenticatedContext");

// ============================================================
// 2. No Client Identity Trust
// ============================================================
console.log("\n--- 2. No Client Identity Trust ---");

assert(!proSrc.includes("user_id = searchParams"), "Proactive GET: user_id not from query");
assert(!proSrc.includes("workspace_id = searchParams"), "Proactive GET: workspace_id not from query");
assert(!proSrc.includes("business_id = searchParams"), "Proactive GET: business_id not from query");
assert(!proSrc.includes("user_id ="), "Proactive POST: user_id not from body");
assert(!proSrc.includes("workspace_id ="), "Proactive POST: workspace_id not from body");
assert(!proSrc.includes("business_id ="), "Proactive POST: business_id not from body");

assert(!agtSrc.includes("business_id = searchParams"), "Agent GET: business_id not from query");
assert(!agtSrc.includes('user_id = "demo-user"'), "Agent POST: no demo-user default");
assert(!agtSrc.includes('workspace_id = "demo-workspace"'), "Agent POST: no demo-workspace default");
assert(!agtSrc.includes("business_id ="), "Agent POST: business_id not from body");

assert(!agtIdSrc.includes("searchParams.get(\"business_id\")"), "Agent [id]: business_id not from query");

assert(!resSrc.includes("business_id ="), "Research: business_id not from body");

// ============================================================
// 3. No Business Fallback
// ============================================================
console.log("\n--- 3. No Business Fallback ---");

assert(!proSrc.includes("demo-business"), "Proactive: no demo-business fallback");
assert(!proStatusSrc.includes("demo-business"), "Proactive status: no demo-business fallback");
assert(!proIdSrc.includes("demo-business"), "Proactive [trigger_id]: no demo-business fallback");
assert(!agtSrc.includes("demo-business"), "Agent: no demo-business fallback");
assert(!agtIdSrc.includes("demo-business"), "Agent [id]: no demo-business fallback");
assert(!resSrc.includes("demo-business"), "Research: no demo-business fallback");

assert(!proSrc.includes("seedDemoApprovalAccess"), "Proactive: no seedDemoApprovalAccess");
assert(!proStatusSrc.includes("seedDemoApprovalAccess"), "Proactive status: no seedDemoApprovalAccess");
assert(!proIdSrc.includes("seedDemoApprovalAccess"), "Proactive [trigger_id]: no seedDemoApprovalAccess");
assert(!agtSrc.includes("seedDemoApprovalAccess"), "Agent: no seedDemoApprovalAccess");
assert(!agtIdSrc.includes("seedDemoApprovalAccess"), "Agent [id]: no seedDemoApprovalAccess");
assert(!resSrc.includes("seedDemoApprovalAccess"), "Research: no seedDemoApprovalAccess");

// ============================================================
// 4. No In-Memory Access Control
// ============================================================
console.log("\n--- 4. No In-Memory Access Control ---");

assert(!allSrc.includes("canAccessBusiness({"), "No in-memory canAccessBusiness calls");
assert(!allSrc.includes('from "@/lib/approval/access-control"'), "No access-control import");

// ============================================================
// 5. No Service-Role Client Usage
// ============================================================
console.log("\n--- 5. Service-Role ---");

assert(!allSrc.includes('from "@/lib/db/supabase-client"'), "No service-role client imported");
assert(!allSrc.includes("getSupabaseClient()"), "No service-role client used");

// ============================================================
// 6. Proactive Lifecycle Preserved
// ============================================================
console.log("\n--- 6. Proactive Lifecycle ---");

assert(proSrc.includes("proactiveWorkEngine.initialize()"), "Proactive GET: engine initialized");
assert(proSrc.includes("getWorkQueueSummary"), "Proactive GET: getWorkQueueSummary preserved");
assert(proSrc.includes("proactiveWorkEngine.runCycle"), "Proactive POST: runCycle preserved");
assert(proSrc.includes("proactiveWorkEngine.cleanup"), "Proactive POST: cleanup preserved");
assert(proSrc.includes("specialist_scope"), "Proactive POST: specialist_scope preserved");
assert(proSrc.includes("INSUFFICIENT_BUSINESS_DATA"), "Proactive POST: INSUFFICIENT_BUSINESS_DATA check preserved");
assert(proStatusSrc.includes("getWorkerStatus"), "Proactive status: getWorkerStatus preserved");
assert(proStatusSrc.includes("getEnabledRules"), "Proactive status: getEnabledRules preserved");
assert(proStatusSrc.includes("getAllRules"), "Proactive status: getAllRules preserved");
assert(proIdSrc.includes("getTrigger"), "Proactive [trigger_id]: getTrigger preserved");
assert(proIdSrc.includes("dismissTrigger"), "Proactive [trigger_id]: dismissTrigger preserved");

// ============================================================
// 7. Agent Lifecycle Preserved
// ============================================================
console.log("\n--- 7. Agent Lifecycle ---");

assert(agtSrc.includes("isAIAvailable"), "Agent POST: isAIAvailable check preserved");
assert(agtSrc.includes("getAINotAvailableMessage"), "Agent POST: AI not available message preserved");
assert(agtSrc.includes("createInvestigation"), "Agent POST: createInvestigation preserved");
assert(agtSrc.includes("analyzeAndRoute"), "Agent POST: analyzeAndRoute preserved");
assert(agtSrc.includes("executeInvestigation"), "Agent POST: executeInvestigation preserved");
assert(agtSrc.includes("invokeAgent"), "Agent POST: invokeAgent preserved");
assert(agtSrc.includes("getUsageSummary"), "Agent GET: getUsageSummary preserved");
assert(agtSrc.includes("getFindingsByBusiness"), "Agent GET: getFindingsByBusiness preserved");
assert(agtSrc.includes("getInvestigationsByBusiness"), "Agent GET: getInvestigationsByBusiness preserved");
assert(agtSrc.includes("getInvocationsByBusiness"), "Agent GET: getInvocationsByBusiness preserved");
assert(agtIdSrc.includes("getInvestigation"), "Agent [id]: getInvestigation preserved");
assert(agtIdSrc.includes("getInvocationsByInvestigation"), "Agent [id]: getInvocationsByInvestigation preserved");
assert(agtIdSrc.includes("getFindingsByInvestigation"), "Agent [id]: getFindingsByInvestigation preserved");
assert(agtIdSrc.includes("getInsightsByInvestigation"), "Agent [id]: getInsightsByInvestigation preserved");
assert(agtIdSrc.includes("getRecommendationsByInvestigation"), "Agent [id]: getRecommendationsByInvestigation preserved");

// ============================================================
// 8. Research Lifecycle Preserved
// ============================================================
console.log("\n--- 8. Research Lifecycle ---");

assert(resSrc.includes("createResearchTask"), "Research: createResearchTask preserved");
assert(resSrc.includes("waitForResearch"), "Research: waitForResearch preserved");
assert(resSrc.includes("getResearchTask"), "Research: getResearchTask preserved");
assert(resSrc.includes("buildEvidence"), "Research: buildEvidence preserved");
assert(resSrc.includes("buildSources"), "Research: buildSources preserved");
assert(resSrc.includes("normalizeQuality"), "Research: normalizeQuality preserved");
assert(resSrc.includes("TAVILY_API_KEY"), "Research: Tavily API key check preserved");
assert(resSrc.includes("output_schema"), "Research: output_schema preserved");

// ============================================================
// 9. IDOR Protection
// ============================================================
console.log("\n--- 9. IDOR Protection ---");

assert(proIdSrc.includes("trigger.business_id !== ctx.business_id"), "Proactive [trigger_id]: trigger business check");
assert(agtIdSrc.includes("investigation.business_id !== ctx.business_id"), "Agent [id]: investigation business check");

// ============================================================
// 10. No Business Returns 404
// ============================================================
console.log("\n--- 10. No Business Returns 404 ---");

assert(proSrc.includes("NO_BUSINESS"), "Proactive GET/POST: NO_BUSINESS code for missing business");
assert(proIdSrc.includes("NO_BUSINESS"), "Proactive [trigger_id]: NO_BUSINESS code for missing business");
assert(agtSrc.includes("NO_BUSINESS"), "Agent GET/POST: NO_BUSINESS code for missing business");
assert(agtIdSrc.includes("NO_BUSINESS"), "Agent [id]: NO_BUSINESS code for missing business");
assert(resSrc.includes("NO_BUSINESS"), "Research: NO_BUSINESS code for missing business");

// ============================================================
// 11. Agent Identity Separation
// ============================================================
console.log("\n--- 11. Agent Identity Separation ---");

assert(!agtSrc.includes("user_id ="), "Agent: user_id not user-supplied (uses ctx.user_id)");
assert(!agtSrc.includes("workspace_id ="), "Agent: workspace_id not user-supplied (uses ctx.workspace_id)");
assert(!agtSrc.includes("business_id ="), "Agent: business_id not user-supplied (uses ctx.business_id)");
assert(agtSrc.includes("ctx.user_id"), "Agent: uses ctx.user_id");
assert(agtSrc.includes("ctx.workspace_id"), "Agent: uses ctx.workspace_id");
assert(agtSrc.includes("ctx.business_id"), "Agent: uses ctx.business_id");

// ============================================================
// 12. Proactive Uses ctx for Run Cycle
// ============================================================
console.log("\n--- 12. Proactive Context Usage ---");

assert(proSrc.includes("business_id: ctx.business_id"), "Proactive POST: business_id from ctx for runCycle");
assert(proSrc.includes("user_id: ctx.user_id"), "Proactive POST: user_id from ctx for runCycle");
assert(proSrc.includes("workspace_id: ctx.workspace_id"), "Proactive POST: workspace_id from ctx for runCycle");

// ============================================================
// 13. Error Classification
// ============================================================
console.log("\n--- 13. Error Classification ---");

assert(allSrc.includes("{ status: 401 }"), "Returns 401 for unauthenticated");
assert(allSrc.includes("{ status: 404 }"), "Returns 404 for not found");
assert(allSrc.includes("{ status: 400 }"), "Returns 400 for bad request");
assert(allSrc.includes("{ status: 500 }"), "Returns 500 for server error");
assert(allSrc.includes("{ status: 503 }"), "Returns 503 for AI unavailable");

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
// 15. Investigation Cross-Business
// ============================================================
console.log("\n--- 15. Investigation Cross-Business ---");

assert(agtIdSrc.includes("investigation.business_id !== ctx.business_id"), "Agent [id]: investigation cross-business check enforces ctx.business_id");

// ============================================================
// 16. Proactive Trigger Detail Uses Context
// ============================================================
console.log("\n--- 16. Proactive Trigger Detail ---");

assert(proIdSrc.includes("ctx.business_id"), "Proactive [trigger_id]: uses ctx.business_id for authorization");

// ============================================================
// 17. Research No Business Ownership Model
// ============================================================
console.log("\n--- 17. Research Architecture ---");

assert(!resSrc.includes("business_id =") || resSrc.includes("business_id = ctx.business_id"), "Research: no business_id from body, only ctx");
assert(!resSrc.includes("workspace_id ="), "Research: no workspace_id parameter used");
assert(!resSrc.includes("user_id ="), "Research: no user_id parameter used");

// ============================================================
// 18. No Demo Data in Agent
// ============================================================
console.log("\n--- 18. Agent No Demo Data ---");

assert(!agtSrc.includes('"demo-user"'), "Agent: no demo-user string");
assert(!agtSrc.includes('"demo-workspace"'), "Agent: no demo-workspace string");
assert(!agtIdSrc.includes('"demo-user"'), "Agent [id]: no demo-user string");
assert(!agtIdSrc.includes('"demo-workspace"'), "Agent [id]: no demo-workspace string");

// ============================================================
// Summary
// ============================================================
console.log("\n════════════════════════════════════════════════════════════");
console.log(`Phase 14.2.3A Tests: ${passed} passed, ${failed} failed, ${total} total`);
console.log("════════════════════════════════════════════════════════════");

if (failed > 0) {
  process.exit(1);
}
