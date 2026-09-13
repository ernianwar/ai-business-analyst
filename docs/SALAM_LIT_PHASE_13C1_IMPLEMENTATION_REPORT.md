# SALAM LIT — Phase 13C.1 Implementation Report

**Status:** Infrastructure implemented  
**Real runtime verified:** NO  
**Database migrations:** None

## Scope

Phase 13C.1 adds a deterministic SALAM LIT-owned model-routing layer, OpenRouter support, strict business-scope propagation through proactive evaluation, truthful insufficient-data behavior, structured-output request support, and an explicit Erni-only first-proof scope.

No fake business data, fake activity, migrations, approvals, or external business actions were added.

## Files Changed

- `src/lib/ai-gateway/types.ts`
- `src/lib/ai-gateway/config.ts`
- `src/lib/ai-gateway/init.ts`
- `src/lib/ai-gateway/providers/openai.ts`
- `src/lib/ai-gateway/providers/anthropic.ts`
- `src/lib/ai-gateway/providers/deepseek.ts`
- `src/lib/ai-gateway/providers/openrouter.ts`
- `src/lib/runtime/model-gateway.ts`
- `src/lib/runtime/model-routing.ts`
- `src/lib/runtime/prompts.ts`
- `src/lib/runtime/types.ts`
- `src/lib/runtime/agent-runtime.ts`
- `src/lib/intelligence/insight-engine.ts`
- `src/lib/intelligence/recommendation-engine.ts`
- `src/lib/orchestration/zue.ts`
- `src/lib/proactive/index.ts`
- `src/lib/proactive/event-worker.ts`
- `app/api/proactive/route.ts`
- `app/api/office/state/route.ts`
- `src/components/office/VirtualOffice.tsx`
- `app/page.tsx`
- `test-phase13c1.mjs`

## Business ID Fix

`POST /api/proactive` now requires `business_id`, `user_id`, and `workspace_id`.

The authorized context is passed through:

```text
POST /api/proactive
  -> proactiveWorkEngine.runCycle({ business_id, user_id, workspace_id })
  -> runEvaluationCycle(params)
  -> evaluateBusinessRules(business_id)
  -> trigger.business_id
  -> investigation.business_id
  -> invokeAgent.business_id
```

The proactive execution path no longer contains an internal `demo-business` fallback.

Missing context fails closed. Unauthorized access remains rejected by `canAccessBusiness()`.

The office state endpoint also requires explicit business, user, and workspace context.

## Model Default Fix

The gateway no longer constructs a literal `"default"` model identifier.

- Missing, null, or empty model: routing/provider configuration selects the provider default.
- Explicit model: exact explicit model is selected.
- Empty model never becomes a real provider request for `"default"`.

## Routing Policy

Added `src/lib/runtime/model-routing.ts`.

The policy is:

- Deterministic
- Configuration-driven
- SALAM LIT-owned
- Versioned as `13C.1`
- No model-based model selection
- Candidate availability checked through registered adapters
- Required capabilities checked
- Structured-output requirements checked
- Context limits checked
- High-risk requests exclude experimentation-tier models
- Candidate order is stable and explainable

Supported MVP task types:

- `SPECIALIST_ANALYSIS`
- `INSIGHT_GENERATION`
- `RECOMMENDATION_GENERATION`
- `SYNTHESIS`
- `RESEARCH`
- `CLASSIFICATION`

## Model Tiers

Model metadata now supports:

- Tier
- Structured-output support
- Tool support
- Capabilities
- Enabled state
- Context and output limits
- Cost metadata where supplied

Free OpenRouter models are configuration-driven and are not hard-coded into business logic.

Tier 3/high-risk selection excludes experimentation-tier models.

## OpenRouter Integration

Added native-fetch adapter:

```text
src/lib/ai-gateway/providers/openrouter.ts
```

Registered configuration variables:

- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `OPENROUTER_MODEL`
- `OPENROUTER_MODELS`
- `OPENROUTER_TIMEOUT_MS`
- `OPENROUTER_MAX_RETRIES`
- `OPENROUTER_HTTP_REFERER`
- `OPENROUTER_TITLE`

Defaults:

- Base URL: `https://openrouter.ai/api/v1`
- Timeout: `30000ms`
- Maximum retries: `2`

The adapter supports:

- OpenAI-compatible messages
- Explicit selected model
- Controlled `models[]` candidate list
- `route: "fallback"`
- JSON Schema response format when requested
- Token usage parsing
- Actual model metadata
- Shared timeout and retry behavior
- Shared normalized error mapping

OpenRouter does not own SALAM LIT business routing policy. It receives a controlled candidate set.

## Structured Output

Agent invocations now pass an explicit agent output schema.

OpenAI and OpenRouter use JSON Schema mode where supported. DeepSeek retains JSON mode. Application-side validation remains mandatory through `validateAgentOutput()`.

Malformed or incomplete agent output is rejected and cannot become a trusted finding.

Insight and recommendation workflows also identify their task types and structured-output requirements at the runtime call site.

## Erni-Only First Proof Scope

The proactive API accepts an optional explicit `specialist_scope`.

For the first proof, only `["erni"]` is accepted. Other scopes are rejected by the API. This is an explicit proof mode and does not change normal default Zue routing when no scope is supplied.

The Virtual Office requests this scope for its Run Check action, but only after an explicit business/user/workspace context is available.

## Truthful Data Behavior

If the selected business has no metrics and no active facts, the evaluation returns:

```text
INSUFFICIENT_BUSINESS_DATA
```

No trigger, agent activity, finding, insight, or recommendation is manufactured.

## Telemetry

Usage records now support:

- Requested provider
- Requested model
- Actual provider
- Actual model
- Candidate models
- Selected candidate index
- Fallback count
- Task type
- Risk level
- Required capabilities
- Structured-output requirement
- Routing policy version
- Success/failure
- Error
- Latency
- Token counts
- Agent
- Business
- Invocation
- Investigation
- Timestamp

Retry count and exact provider cost are not yet fully persisted. Cost is not invented when unavailable.

## Tests

Added:

```text
test-phase13c1.mjs
```

The suite uses local adapters and mocked fetch only. It does not make external provider calls or use real secrets.

Coverage includes:

- OpenRouter registration
- Deterministic routing
- Routing policy version
- Available candidate selection
- Tier 3 exclusion of experimentation models
- Malformed output rejection
- Business context propagation
- Business A and Business B isolation paths
- Missing business context rejection
- OpenRouter selected model
- Controlled candidate list
- OpenRouter fallback route
- Structured output request
- Actual model metadata
- Implicit provider default model
- Explicit model selection
- Empty model semantics

## Validation Results

| Suite | Result |
|---|---:|
| Phase 12 | 148/148 passed |
| Phase 13A | 57/57 passed |
| Phase 13B | 68 assertions passed; existing summary prints `[object Object]` due to an existing test-script formatting defect |
| Phase 13B.1 | 66/66 passed |
| Phase 13C.1 | 21/21 passed |
| `tsc --noEmit` | PASS |
| `next build` | PASS; 20/20 pages generated |

## Real Provider Verification

No real provider API key was configured during implementation.

No external LLM invocation was attempted.

```text
REAL_RUNTIME_VERIFIED = NO
```

To configure a real development provider, set server-side variables in the deployment environment or local `.env.local` without committing them:

```text
OPENROUTER_API_KEY=<server-side secret>
OPENROUTER_MODEL=<provider/model>
OPENROUTER_MODELS=<ordered, comma-separated provider/model candidates>
```

Alternatively, configure direct DeepSeek:

```text
DEEPSEEK_API_KEY=<server-side secret>
DEEPSEEK_MODEL=deepseek-chat
```

The first real proof also requires legitimate business truth for the authorized business. No such data was created by this phase.

## Security Verification

- Provider keys remain server-side environment variables.
- No provider key is passed to client code.
- No provider key is logged.
- Proactive requests require explicit business/user/workspace context.
- Unauthorized business access fails closed.
- Business ID is threaded through the proactive execution path.
- OpenRouter receives only SALAM LIT-selected candidates.
- Tier 3 excludes experimentation models.
- Malformed model output is rejected.
- No automatic decision is created.
- No approval is created.
- No action is executed.
- No migration was added.

## Known Limitations

- No real provider key was available, so external inference is unverified.
- No legitimate business truth was available in the inspected local runtime, so no trigger was generated.
- Runtime usage telemetry remains in memory.
- Retry count is not separately stored in the usage record.
- OpenRouter catalogue discovery is configuration-driven rather than automatically synchronized.
- The first-proof specialist scope is explicit and limited to Erni; normal multi-specialist routing remains unchanged when omitted.
- The existing Phase 13B test script summary has a formatting defect even though all assertions pass.

## Final Status

**PASS WITH KNOWN LIMITATION**

Infrastructure and automated verification pass. Real provider execution remains unverified because no LLM credential or legitimate business truth was available. No claim of real end-to-end AI workforce success is made.
