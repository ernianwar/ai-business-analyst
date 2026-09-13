/**
 * Phase 13C.1 — runtime routing and business-scope tests.
 * Uses local adapters only. No network calls, secrets, or business data.
 *
 * Auth mocking: getAuthenticatedContext() is overridden via __setTestAuthOverride()
 * from get-context.ts. The override returns controlled test-only contexts.
 * No production authentication behavior is modified.
 */

// NODE_ENV=test required for __setTestAuthOverride() to be active.
// The guard in get-context.ts ensures this override is impossible in production.
if (!process.env.NODE_ENV) process.env.NODE_ENV = "test";

import { registerProvider, getProvider } from "./src/lib/ai-gateway/registry.ts";
import { OpenRouterAdapter } from "./src/lib/ai-gateway/providers/openrouter.ts";
import { resetProviderConfigs } from "./src/lib/ai-gateway/config.ts";
import { selectModelCandidates } from "./src/lib/runtime/model-routing.ts";
import { validateAgentOutput } from "./src/lib/runtime/prompts.ts";
import { proactiveWorkEngine } from "./src/lib/proactive/index.ts";
import { __setTestAuthOverride } from "./src/lib/auth/get-context.ts";

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`PASS: ${message}`);
    passed++;
  } else {
    console.log(`FAIL: ${message}`);
    failed++;
  }
}

function localAdapter(provider, models, behavior = {}) {
  return {
    provider,
    async isAvailable() { return behavior.available ?? true; },
    async getModels() { return models; },
    async request(config) {
      if (behavior.fail) throw new Error(behavior.fail);
      return {
        content: JSON.stringify({ findings: [{ title: "Local finding", summary: "Local test", epistemic_type: "INFERENCE" }] }),
        model_used: config.model_id,
        provider,
        usage: { input_tokens: 1, output_tokens: 2, total_tokens: 3 },
        from_cache: false,
        request_id: crypto.randomUUID(),
        latency_ms: 1,
      };
    },
  };
}

const baseModel = (provider, model_id, overrides = {}) => ({
  provider,
  model_id,
  display_name: model_id,
  capabilities: ["analysis", "generation"],
  max_input_tokens: 4096,
  max_output_tokens: 2000,
  structured_output: true,
  enabled: true,
  ...overrides,
});

async function runTests() {
  console.log("\n=== Phase 13C.1 Runtime Tests ===\n");

  // Model-default semantics are represented by adapter config behavior.
  const fakeOpenRouter = localAdapter("openrouter", [baseModel("openrouter", "test/model")]);
  registerProvider(fakeOpenRouter);
  assert(getProvider("openrouter") === fakeOpenRouter, "OpenRouter adapter registers");

  // Deterministic routing and unavailable candidate removal.
  registerProvider(localAdapter("deepseek", [baseModel("deepseek", "deepseek-chat", { tier: "LOW_COST" })]));
  const decision1 = await selectModelCandidates({
    agent_key: "erni",
    task_type: "SPECIALIST_ANALYSIS",
    risk_level: "L1",
    required_capabilities: ["analysis"],
    structured_output_required: true,
  });
  const decision2 = await selectModelCandidates({
    agent_key: "erni",
    task_type: "SPECIALIST_ANALYSIS",
    risk_level: "L1",
    required_capabilities: ["analysis"],
    structured_output_required: true,
  });
  assert(JSON.stringify(decision1) === JSON.stringify(decision2), "Routing policy is deterministic");
  assert(decision1.routing_policy_version === "13C.1", "Routing policy version is present");
  assert(decision1.candidate_list.length >= 1, "Available candidate is selected");

  const tier3 = await selectModelCandidates({
    agent_key: "erni",
    task_type: "SYNTHESIS",
    risk_level: "L3",
    required_capabilities: ["analysis"],
    structured_output_required: true,
  });
  assert(tier3.candidate_list.every((candidate) => candidate.tier !== "EXPERIMENTATION"), "Tier 3 excludes experimentation models");

  assert(!validateAgentOutput("not json").valid, "Malformed output is rejected");
  assert(!validateAgentOutput('{"findings":[{"title":"x"}]}').valid, "Incomplete finding is rejected");
  assert(validateAgentOutput('{"findings":[{"title":"x","summary":"y","epistemic_type":"INFERENCE"}]}').valid, "Valid finding output is accepted");

  // ============================================================
  // Authenticated proactive API tests
  // ============================================================

  // Test-only mock contexts — not production identities.
  // These represent server-derived authenticated contexts from get_user_context() RPC.
  const ctxA = {
    user_id: "test-user-a",
    email: "a@test.example",
    display_name: "Test User A",
    workspace_id: "workspace-a",
    business_id: "business-a",
    role: "OWNER",
    onboarding_status: "COMPLETE",
  };
  const ctxB = {
    user_id: "test-user-b",
    email: "b@test.example",
    display_name: "Test User B",
    workspace_id: "workspace-b",
    business_id: "business-b",
    role: "OWNER",
    onboarding_status: "COMPLETE",
  };
  const ctxNoBusiness = {
    user_id: "test-user-nb",
    email: "nb@test.example",
    display_name: "Test User No Business",
    workspace_id: "workspace-nb",
    business_id: null,
    role: "MEMBER",
    onboarding_status: "BUSINESS_CREATED",
  };

  // Install the test-only auth override
  let currentCtx = null;
  __setTestAuthOverride(async () => currentCtx);

  // Spy on proactiveWorkEngine.runCycle
  let captured = null;
  const originalRunCycle = proactiveWorkEngine.runCycle.bind(proactiveWorkEngine);
  proactiveWorkEngine.runCycle = async (params) => {
    captured = params;
    return { businesses_evaluated: 1, triggers_created: 0, investigations_started: 0 };
  };

  const { POST } = await import("./app/api/proactive/route.ts");

  // --- Test: Authorized business check is accepted ---
  currentCtx = ctxA;
  captured = null;
  const responseA = await POST(new Request("http://localhost/api/proactive", {
    method: "POST",
    body: JSON.stringify({ action: "evaluate" }),
    headers: { "content-type": "application/json" },
  }));
  assert(responseA.status === 200, "Authorized business check is accepted");

  // --- Test: Business A reaches the worker unchanged ---
  assert(captured?.business_id === "business-a", "Business A reaches the worker unchanged");
  assert(captured?.business_id !== "demo-business", "Worker does not silently replace business scope");

  // --- Test: Body-supplied business_id cannot override authenticated context ---
  captured = null;
  currentCtx = ctxA;
  const bodyOverride = await POST(new Request("http://localhost/api/proactive", {
    method: "POST",
    body: JSON.stringify({ business_id: "business-b", action: "evaluate" }),
    headers: { "content-type": "application/json" },
  }));
  assert(bodyOverride.status === 200, "Authenticated request with body business_id override is processed");
  assert(captured?.business_id === "business-a", "Body-supplied business_id does not override authenticated context");

  // --- Test: Business B request is independently authorized ---
  currentCtx = ctxB;
  captured = null;
  const responseB = await POST(new Request("http://localhost/api/proactive", {
    method: "POST",
    body: JSON.stringify({ action: "evaluate" }),
    headers: { "content-type": "application/json" },
  }));
  assert(responseB.status === 200, "Business B request is independently authorized");
  assert(captured?.business_id === "business-b", "Worker receives Business B authenticated context");

  // --- Test: Missing business context fails closed ---
  currentCtx = null;
  captured = null;
  const missing = await POST(new Request("http://localhost/api/proactive", {
    method: "POST",
    body: JSON.stringify({ action: "evaluate" }),
    headers: { "content-type": "application/json" },
  }));
  assert(missing.status === 404, "Unauthenticated request fails closed with 404");
  const missingBody = await missing.json();
  assert(missingBody.code === "NO_BUSINESS", "Unauthenticated response includes NO_BUSINESS code");
  assert(captured === null, "Worker is not invoked when authentication fails");

  // --- Test: Context without business_id fails closed ---
  currentCtx = ctxNoBusiness;
  captured = null;
  const noBusiness = await POST(new Request("http://localhost/api/proactive", {
    method: "POST",
    body: JSON.stringify({ action: "evaluate" }),
    headers: { "content-type": "application/json" },
  }));
  assert(noBusiness.status === 404, "Context without business_id fails closed with 404");
  assert(captured === null, "Worker is not invoked when business_id is missing from context");

  // Restore the original runCycle
  proactiveWorkEngine.runCycle = originalRunCycle;

  // Clean up the test override
  __setTestAuthOverride(null);

  // ============================================================
  // OpenRouter adapter tests
  // ============================================================

  const originalFetch = globalThis.fetch;
  let requestBody = null;
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(init.body);
    return new Response(JSON.stringify({
      model: "test/model",
      choices: [{ message: { content: '{"findings":[{"title":"x","summary":"y","epistemic_type":"INFERENCE"}]}' } }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  process.env.OPENROUTER_API_KEY = "test-only-not-a-real-secret";
  process.env.OPENROUTER_MODEL = "test/model";
  resetProviderConfigs();
  const adapter = new OpenRouterAdapter();
  const result = await adapter.request(baseModel("openrouter", "test/model"), {
    prompt: "test", system_message: "test", output_schema: { type: "object" }, metadata: { candidate_models: ["test/model", "test/fallback"] },
  });
  assert(requestBody.model === "test/model", "OpenRouter sends selected model");
  assert(Array.isArray(requestBody.models), "OpenRouter sends controlled candidate list");
  assert(requestBody.route === "fallback", "OpenRouter fallback route is explicit");
  assert(requestBody.response_format.type === "json_schema", "OpenRouter structured output is explicit");
  assert(result.model_used === "test/model", "OpenRouter preserves actual model metadata");
  requestBody = null;
  await adapter.request(baseModel("openrouter", ""), { prompt: "test" });
  assert(requestBody.model === "test/model", "No model uses configured provider default");
  requestBody = null;
  await adapter.request(baseModel("openrouter", "explicit/model"), { prompt: "test" });
  assert(requestBody.model === "explicit/model", "Explicit model is used exactly");
  requestBody = null;
  await adapter.request(baseModel("openrouter", ""), { prompt: "test", model: "" });
  assert(requestBody.model !== "default", "Empty model never becomes literal default");
  globalThis.fetch = originalFetch;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.OPENROUTER_MODEL;
  resetProviderConfigs();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

runTests().catch((error) => {
  console.error(error);
  process.exit(1);
});
