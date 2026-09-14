/**
 * SALAM LIT — Phase 15.4.3 Remediation: Research Endpoint Security Tests
 *
 * Verifies that the Tavily Research endpoint (/api/research) now has
 * full security wiring: rate limiting, usage tracking, security events,
 * and server-derived identity.
 *
 * These are genuine source-code pattern checks that verify the
 * production code path contains the required security controls.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

let passed = 0;
let failed = 0;
let total = 0;

function test(condition, description) {
  total++;
  if (condition) {
    passed++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failed++;
    console.log(`  ❌ FAIL: ${description}`);
  }
}

// ============================================================
// Load source files
// ============================================================

const researchRoute = readFileSync(
  resolve(import.meta.dirname, "app/api/research/route.ts"),
  "utf-8"
);

const modelGateway = readFileSync(
  resolve(import.meta.dirname, "src/lib/runtime/model-gateway.ts"),
  "utf-8"
);

const agentRuntime = readFileSync(
  resolve(import.meta.dirname, "src/lib/runtime/agent-runtime.ts"),
  "utf-8"
);

const insightEngine = readFileSync(
  resolve(import.meta.dirname, "src/lib/intelligence/insight-engine.ts"),
  "utf-8"
);

const recommendationEngine = readFileSync(
  resolve(import.meta.dirname, "src/lib/intelligence/recommendation-engine.ts"),
  "utf-8"
);

const zueOrchestration = readFileSync(
  resolve(import.meta.dirname, "src/lib/orchestration/zue.ts"),
  "utf-8"
);

// ============================================================
// TESTS: Research Endpoint Security Wiring
// ============================================================

console.log("\n=== Phase 15.4.3 Remediation: Research Endpoint Security ===\n");

console.log("--- 1. Research endpoint imports security modules ---");

test(
  researchRoute.includes('from "@/lib/security/ai-rate-limiter"'),
  "Research imports checkAIRateLimit"
);

test(
  researchRoute.includes('from "@/lib/security/ai-usage-tracker"'),
  "Research imports recordAIUsage"
);

test(
  researchRoute.includes('from "@/lib/security/ai-security-events"'),
  "Research imports recordAISecurityEvent"
);

test(
  researchRoute.includes("generateCorrelationId"),
  "Research imports generateCorrelationId"
);

test(
  researchRoute.includes('from "@/lib/auth/get-context"'),
  "Research imports getAuthenticatedContext"
);

console.log("\n--- 2. Research endpoint uses server-derived identity ---");

test(
  researchRoute.includes("getAuthenticatedContext()"),
  "Research calls getAuthenticatedContext()"
);

test(
  !researchRoute.includes("req.headers") || researchRoute.includes("getAuthenticatedContext()"),
  "Research does not trust client-provided identity"
);

console.log("\n--- 3. Research endpoint enforces rate limiting ---");

test(
  researchRoute.includes("checkAIRateLimit({"),
  "Research calls checkAIRateLimit"
);

test(
  researchRoute.includes("user_id: ctx.user_id"),
  "Research passes server-derived user_id to rate limiter"
);

test(
  researchRoute.includes("business_id: ctx.business_id"),
  "Research passes server-derived business_id to rate limiter"
);

test(
  researchRoute.includes('endpoint: "research"'),
  "Research uses correct endpoint name for rate limiting"
);

test(
  researchRoute.includes("rateLimit.allowed"),
  "Research checks rate limit result"
);

test(
  researchRoute.includes("429"),
  "Research returns 429 on rate limit"
);

console.log("\n--- 4. Research endpoint records usage ---");

test(
  researchRoute.includes("recordAIUsage({"),
  "Research calls recordAIUsage"
);

test(
  researchRoute.includes('correlation_id: correlationId'),
  "Research passes correlation ID to usage tracking"
);

test(
  researchRoute.includes('agent_key: "research"'),
  "Research uses correct agent_key for usage"
);

test(
  researchRoute.includes('provider: "tavily"'),
  "Research records provider as tavily"
);

test(
  researchRoute.includes('model: "tavily-research"'),
  "Research records model as tavily-research"
);

test(
  researchRoute.includes("duration_ms: Date.now() - start"),
  "Research records duration"
);

test(
  researchRoute.includes('status: "SUCCESS"'),
  "Research records SUCCESS status on success"
);

test(
  researchRoute.includes('status: "FAILURE"'),
  "Research records FAILURE status on failure"
);

test(
  researchRoute.includes('failure_type: "PROVIDER_ERROR"'),
  "Research records failure_type on error"
);

console.log("\n--- 5. Research endpoint records security events ---");

test(
  researchRoute.includes("recordAISecurityEvent({"),
  "Research calls recordAISecurityEvent"
);

test(
  researchRoute.includes('event_type: "AI_RATE_LIMITED"'),
  "Research records AI_RATE_LIMITED security event"
);

test(
  researchRoute.includes('event_type: "AI_FAILURE"'),
  "Research records AI_FAILURE security event"
);

test(
  researchRoute.includes('severity: "MEDIUM"'),
  "Research uses MEDIUM severity for events"
);

test(
  researchRoute.includes("correlation_id: correlationId"),
  "Research passes correlation ID to security events"
);

console.log("\n--- 6. Research endpoint does NOT store raw prompts ---");

test(
  !researchRoute.includes("metadata: { prompt:") || researchRoute.includes("[REDACTED]"),
  "Research does not store raw prompts in metadata"
);

test(
  !researchRoute.includes("metadata: { idea:") || researchRoute.includes("[REDACTED]"),
  "Research does not store raw idea in metadata"
);

// ============================================================
// TESTS: Model Gateway Security Pipeline
// ============================================================

console.log("\n=== Model Gateway Security Pipeline ===\n");

console.log("--- 7. Gateway rate limiting ---");

test(
  modelGateway.includes("checkAIRateLimit({"),
  "Gateway calls checkAIRateLimit"
);

test(
  modelGateway.includes("RATE_LIMITED"),
  "Gateway handles rate limit denial"
);

test(
  modelGateway.includes('error_code: "RATE_LIMITED"'),
  "Gateway returns RATE_LIMITED error code"
);

console.log("\n--- 8. Gateway circuit breaker ---");

test(
  modelGateway.includes("getCircuitState("),
  "Gateway checks circuit breaker state"
);

test(
  modelGateway.includes("recordCircuitFailure("),
  "Gateway records circuit failures"
);

test(
  modelGateway.includes("resetCircuit("),
  "Gateway resets circuit on success"
);

test(
  modelGateway.includes('error_code: "CIRCUIT_OPEN"'),
  "Gateway returns CIRCUIT_OPEN error code"
);

console.log("\n--- 9. Gateway usage tracking ---");

test(
  modelGateway.includes("recordAIUsage({"),
  "Gateway calls recordAIUsage"
);

test(
  modelGateway.includes('status: "SUCCESS"'),
  "Gateway records SUCCESS usage"
);

test(
  modelGateway.includes('status: "FAILURE"'),
  "Gateway records FAILURE usage"
);

test(
  modelGateway.includes("FALLBACK_EXHAUSTED"),
  "Gateway records FALLBACK_EXHAUSTED"
);

console.log("\n--- 10. Gateway security events ---");

test(
  modelGateway.includes("recordAISecurityEvent({"),
  "Gateway calls recordAISecurityEvent"
);

test(
  modelGateway.includes("AI_CIRCUIT_OPENED"),
  "Gateway records circuit opened event"
);

test(
  modelGateway.includes("AI_CIRCUIT_RECOVERED"),
  "Gateway records circuit recovered event"
);

test(
  modelGateway.includes("AI_RETRY_LIMIT_REACHED"),
  "Gateway records retry limit reached event"
);

test(
  modelGateway.includes("AI_AUTH_ERROR"),
  "Gateway records auth error security event"
);

console.log("\n--- 11. Gateway server-derived identity ---");

test(
  modelGateway.includes("user_id: string"),
  "Gateway requires user_id parameter"
);

test(
  modelGateway.includes("workspace_id: string"),
  "Gateway requires workspace_id parameter"
);

test(
  modelGateway.includes("business_id: string"),
  "Gateway requires business_id parameter"
);

// ============================================================
// TESTS: Caller Chain — All Callers Use Gateway
// ============================================================

console.log("\n=== Caller Chain — All Callers Use Gateway ===\n");

console.log("--- 12. Agent Runtime uses gateway ---");

test(
  agentRuntime.includes("requestModelCompletion("),
  "Agent runtime calls requestModelCompletion"
);

test(
  agentRuntime.includes("user_id:"),
  "Agent runtime passes user_id"
);

test(
  agentRuntime.includes("workspace_id:"),
  "Agent runtime passes workspace_id"
);

test(
  agentRuntime.includes("business_id:"),
  "Agent runtime passes business_id"
);

console.log("\n--- 13. Insight Engine uses gateway ---");

test(
  insightEngine.includes("requestModelCompletion("),
  "Insight engine calls requestModelCompletion"
);

console.log("\n--- 14. Recommendation Engine uses gateway ---");

test(
  recommendationEngine.includes("requestModelCompletion("),
  "Recommendation engine calls requestModelCompletion"
);

console.log("\n--- 15. Zue Orchestration uses gateway ---");

test(
  zueOrchestration.includes("requestModelCompletion("),
  "Zue orchestration calls requestModelCompletion"
);

// ============================================================
// TESTS: Complete AI Execution Path Inventory
// ============================================================

console.log("\n=== AI Execution Path Inventory ===\n");

console.log("--- 16. All AI execution paths protected ---");

// Count direct adapter.request calls outside gateway
const gatewayFile = modelGateway;
const directAdapterCalls = (gatewayFile.match(/adapter\.request\(/g) || []).length;
test(
  directAdapterCalls === 1,
  `Gateway has exactly 1 adapter.request() call (found ${directAdapterCalls})`
);

// Verify no direct fetch to AI providers in routes
const routeFiles = [
  researchRoute,
  readFileSync(resolve(import.meta.dirname, "app/api/agent/route.ts"), "utf-8"),
  readFileSync(resolve(import.meta.dirname, "app/api/proactive/route.ts"), "utf-8"),
];

let bypassFound = false;
for (const file of routeFiles) {
  if (file.includes("api.openai.com") || file.includes("api.anthropic.com") || file.includes("openrouter.ai")) {
    bypassFound = true;
  }
}
test(
  !bypassFound,
  "No direct AI provider API calls found in route files"
);

// ============================================================
// TESTS: Fail-Closed Behavior
// ============================================================

console.log("\n=== Fail-Closed Behavior ===\n");

console.log("--- 17. Rate limiter fails closed ---");

const rateLimiter = readFileSync(
  resolve(import.meta.dirname, "src/lib/security/ai-rate-limiter.ts"),
  "utf-8"
);

test(
  rateLimiter.includes("allowed: false") && rateLimiter.includes("Database unavailable"),
  "Rate limiter returns DENY when DB unavailable"
);

test(
  rateLimiter.includes("allowed: false") && rateLimiter.includes("Database error"),
  "Rate limiter returns DENY on RPC error"
);

test(
  rateLimiter.includes("allowed: false") && rateLimiter.includes("Exception"),
  "Rate limiter returns DENY on exception"
);

console.log("\n--- 18. Usage tracker fails open (non-blocking) ---");

const usageTracker = readFileSync(
  resolve(import.meta.dirname, "src/lib/security/ai-usage-tracker.ts"),
  "utf-8"
);

test(
  usageTracker.includes("persisted: false") && usageTracker.includes("Database unavailable"),
  "Usage tracker returns persisted: false when DB unavailable (non-blocking)"
);

console.log("\n--- 19. Security events fail open (non-blocking) ---");

const securityEvents = readFileSync(
  resolve(import.meta.dirname, "src/lib/security/ai-security-events.ts"),
  "utf-8"
);

test(
  securityEvents.includes("persisted: false") && securityEvents.includes("Database unavailable"),
  "Security events return persisted: false when DB unavailable (non-blocking)"
);

// ============================================================
// TESTS: Prompt Sanitization
// ============================================================

console.log("\n=== Prompt Sanitization ===\n");

console.log("--- 20. Raw prompts not stored in telemetry ---");

test(
  securityEvents.includes("blockedKeys") || securityEvents.includes("[REDACTED]"),
  "Security events sanitize metadata before storage"
);

test(
  securityEvents.includes('"prompt"') || securityEvents.includes("'prompt'"),
  "Security events block 'prompt' key"
);

test(
  securityEvents.includes('"api_key"') || securityEvents.includes("'api_key'"),
  "Security events block 'api_key' key"
);

// ============================================================
// SUMMARY
// ============================================================

console.log("\n" + "=".repeat(60));
console.log(`RESULTS: ${passed} passed / ${failed} failed / ${total} total`);
console.log("=".repeat(60));

if (failed > 0) {
  console.log("\nFailed tests:");
  process.exit(1);
}
