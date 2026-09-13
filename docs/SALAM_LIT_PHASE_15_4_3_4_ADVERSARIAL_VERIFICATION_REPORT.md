# SALAM LIT — Phase 15.4.3.4 Adversarial Verification Report

## 1. Executive Verdict

**NOT LOCKED**

Phase 15.4.3.3 made genuine and substantial production code changes that wire security modules into the runtime. The rate limiter, usage tracker, and security events are correctly imported and invoked. Identity threading is complete across all call paths. However, the **circuit breaker is non-functional** due to RPC parameter and column-name mismatches, and the **68 "runtime security tests" are static source-code pattern checks** that exercise zero production functions. These findings prevent a LOCKED PASS.

## 2. Files Independently Verified

| File | Exists | Functional Change | Verified |
|------|--------|-------------------|----------|
| `src/lib/runtime/model-gateway.ts` | ✅ 486 lines | Complete rewrite — security modules, RPC circuit breaker, PostgreSQL usage/events | ✅ |
| `src/lib/runtime/types.ts` | ✅ 969 lines | Added `user_id`/`workspace_id` to InsightInput, RecommendationInput | ✅ |
| `src/lib/runtime/agent-runtime.ts` | ✅ 441 lines | Threads `user_id`/`workspace_id` to gateway | ✅ |
| `src/lib/intelligence/insight-engine.ts` | ✅ 238 lines | Threads `user_id`/`workspace_id` to gateway | ✅ |
| `src/lib/intelligence/recommendation-engine.ts` | ✅ 242 lines | Threads `user_id`/`workspace_id` to gateway | ✅ |
| `src/lib/orchestration/zue.ts` | ✅ 670 lines | Threads identity through synthesis chain | ✅ |
| `app/api/research/route.ts` | ✅ 596 lines | Added rate limit enforcement | ✅ |
| `app/api/agent/route.ts` | ✅ 209 lines | Updated getUsageSummary to async | ✅ |
| `app/api/proactive/route.ts` | ✅ 139 lines | Not modified (already correct) | ✅ |
| `test-phase15-4-3-3-runtime-security.mjs` | ✅ 328 lines | New test file | ✅ |
| `test-phase15-4-3.mjs` | ✅ 405 lines | Updated async API | ✅ |
| `test-phase15-3.mjs` | ✅ 378 lines | Migration check updated | ✅ |

All files are real, contain functional code, and are used by the application. No comments-only or formatting-only changes.

## 3. Actual Production Integration Evidence

### Gateway Security Wiring (VERIFIED)
- `checkAIRateLimit` called at line 199 — BEFORE provider invocation
- `getCircuitState` called at line 236 — BEFORE provider invocation
- `recordAIUsage` called on success (line 343), failure (line 384), no-config (line 277), exhausted (line 426)
- `recordAISecurityEvent` called on rate-limit denial (line 206), circuit-open (line 238), auth error (line 403), exhausted (line 443)
- `resetCircuit` called on success (line 340)
- `recordCircuitFailure` called on error (line 380)
- In-memory `usageRecords[]` eliminated
- In-memory `circuitStates Map` eliminated

### Identity Threading (VERIFIED)
- `ModelCompletionParams` interface requires `user_id: string` and `workspace_id: string`
- `InsightInput` interface requires `user_id: string` and `workspace_id: string`
- `RecommendationInput` interface requires `user_id: string` and `workspace_id: string`
- All 4 callers pass server-derived identity (agent-runtime, insight-engine, recommendation-engine, zue)
- No route reads identity from request body

### Rate Limiting (VERIFIED)
- Gateway enforces rate limiting BEFORE provider invocation
- `/api/research` has route-level rate limiting (separate from gateway — calls Tavily directly)
- Denial returns early with `error_code: "RATE_LIMITED"` — no provider call

### Circuit Breaker (PARTIALLY FUNCTIONAL — SEE FINDINGS)
- getCircuitState RPC works correctly ✅
- recordCircuitFailure RPC fails due to parameter mismatch ❌
- resetCircuit RPC works correctly ✅
- Column name mismatches cause silent failures ❌

## 4. Complete AI Call-Path Inventory

| Call Path | Entry Point | Provider | Uses Gateway | Auth Context | Rate Limit | Usage Tracking | Security Events | Status |
|-----------|-------------|----------|--------------|--------------|------------|----------------|-----------------|--------|
| Agent invocation | /api/agent POST → invokeAgent → requestModelCompletion | OpenRouter | ✅ | getAuthenticatedContext | ✅ (gateway) | ✅ | ✅ | VERIFIED |
| Investigation | /api/agent POST → executeInvestigation → synthesizeWithAI → requestModelCompletion | OpenRouter | ✅ | getAuthenticatedContext | ✅ (gateway) | ✅ | ✅ | VERIFIED |
| Insights | executeInvestigation → generateInsights → requestModelCompletion | OpenRouter | ✅ | getAuthenticatedContext | ✅ (gateway) | ✅ | ✅ | VERIFIED |
| Recommendations | executeInvestigation → generateRecommendations → requestModelCompletion | OpenRouter | ✅ | getAuthenticatedContext | ✅ (gateway) | ✅ | ✅ | VERIFIED |
| Proactive | /api/proactive POST → runCycle → executeInvestigation → (above) | OpenRouter | ✅ | getAuthenticatedContext | ✅ (gateway) | ✅ | ✅ | VERIFIED |
| Research | /api/research POST → Tavily HTTP | Tavily | ❌ (separate) | getAuthenticatedContext | ✅ (route) | ❌ | ❌ | VERIFIED |

**No direct provider bypass paths found.** All LLM calls go through the secured gateway. Research uses a separate external API (Tavily) with its own rate limiting.

## 5. Database/RPC Verification

| RPC | Code Params | SQL Params | Match | Return Shape Match |
|-----|-------------|------------|-------|-------------------|
| `check_and_increment_rate_limit` | `{ p_limit_key, p_max_requests, p_window_ms }` | `(p_limit_key, p_max_requests, p_window_ms)` | ✅ | ✅ `allowed, remaining, reset_at` |
| `get_circuit_state` | `{ p_provider }` | `(p_provider)` | ✅ | ❌ Code expects `failure_count, last_failure_at, is_open`; SQL returns `failures, last_failure, open` |
| `record_circuit_failure` | `{ p_provider, p_failure_threshold, p_reset_ms }` | `(p_provider, p_threshold)` | ❌ | ❌ Code expects `is_open, failure_count`; SQL returns `opened, failures` |
| `reset_circuit` | `{ p_provider }` | `(p_provider)` | ✅ | ✅ Returns VOID |

**Critical**: `record_circuit_failure` fails with `PGRST202` error on every call. The circuit breaker failure recording is completely non-functional.

## 6. Runtime Test Quality Assessment

### test-phase15-4-3-3-runtime-security.mjs (68 tests)

| Category | Test Count | Type | Exercises Production Code? |
|----------|-----------|------|---------------------------|
| Static import verification | 14 | `fs.readFileSync` + `string.includes` | ❌ No |
| Call chain identity threading | 6 | `fs.readFileSync` + `string.includes` | ❌ No |
| In-memory state elimination | 5 | `fs.readFileSync` + `string.includes` | ❌ No |
| Rate limit enforcement | 2 | `fs.readFileSync` + `string.includes` | ❌ No |
| Circuit breaker enforcement | 4 | `fs.readFileSync` + `string.includes` | ❌ No |
| Security event emitting | 5 | `fs.readFileSync` + `string.includes` | ❌ No |
| Usage recording | 4 | `fs.readFileSync` + `string.includes` | ❌ No |
| Route-level enforcement | 7 | `fs.readFileSync` + `string.includes` | ❌ No |
| Authentication context flow | 4 | `fs.readFileSync` + `string.includes` | ❌ No |
| Data protection | 3 | `fs.readFileSync` + `string.includes` | ❌ No |
| Fail-closed behavior | 2 | `fs.readFileSync` + `string.includes` | ❌ No |
| Workspace authorization | 6 | `fs.readFileSync` + `string.includes` | ❌ No |
| Gateway structure | 6 | `fs.readFileSync` + `string.includes` | ❌ No |
| **TOTAL** | **68** | **All static text checks** | **0 runtime tests** |

**Every test reads a `.ts` file as a string and checks if a pattern exists.** No test calls `requestModelCompletion()`, `checkAIRateLimit()`, `recordAIUsage()`, `recordAISecurityEvent()`, or any other production function. The tests verify that source code contains certain strings — they do not verify runtime behavior.

### test-phase15-4-3.mjs (68 tests)
This file DOES exercise actual module functions (untrusted-content, sanitize, ai-rate-limiter, ai-usage-tracker, ai-security-events). These are real runtime tests that call production code, but they test modules in isolation, not through the gateway integration.

## 7. Independently Reproduced Test Results

| Metric | Claimed | Actual |
|--------|---------|--------|
| Test files | 20 | 20 ✅ |
| Tests passed | 1,383 | 1,382 ❌ (off by 1) |
| Tests failed | 0 | 0 ✅ |
| Tests skipped | 0 | 0 ✅ |
| Broken/empty files | 0 | 0 ✅ |
| TypeScript errors | 0 | 0 ✅ |
| Production build | Success | Success ✅ |
| Lint errors (modified files) | 0 | 0 ✅ |
| Lint errors (total) | N/A | 39 pre-existing |

**Note**: The claimed 1,383 count is off by 1 — actual verified count is 1,382.

## 8. Authentication and Identity Findings

| Check | Result |
|-------|--------|
| All AI routes use `getAuthenticatedContext()` | ✅ Verified |
| Routes reject unauthenticated requests | ✅ Verified |
| Client-supplied identity not used | ✅ No `body.user_id` or `body.workspace_id` in any route |
| Server-derived identity passed to runtime | ✅ `ctx.user_id`, `ctx.workspace_id` used everywhere |
| Missing identity blocks execution | ✅ Rate limiter denies with `denied_by: "missing_identity"` |

## 9. Rate-Limit Findings

| Check | Result |
|-------|--------|
| Rate limit check before provider invocation | ✅ Line 199 in gateway |
| Denial returns early | ✅ Lines 205-233 |
| No provider call on denial | ✅ `return` statement before provider loop |
| RPC parameter names match | ✅ `p_limit_key, p_max_requests, p_window_ms` |
| RPC return shape matches | ✅ `allowed, remaining, reset_at` |
| Fail-closed on DB failure | ✅ Returns `{ allowed: false }` |
| `/api/research` has rate limiting | ✅ Route-level enforcement |

## 10. Usage-Tracking Findings

| Check | Result |
|-------|--------|
| Usage recorded on success | ✅ `recordAIUsage` with `status: "SUCCESS"` |
| Usage recorded on failure | ✅ `recordAIUsage` with `status: "FAILURE"` |
| Usage recorded on no-config | ✅ `failure_type: "NOT_CONFIGURED"` |
| Usage recorded on exhausted | ✅ `failure_type: "FALLBACK_EXHAUSTED"` |
| DB failure non-blocking | ✅ Returns `{ persisted: false }`, does not block request |
| Raw prompts not stored | ✅ Usage record has no prompt field |

## 11. Security-Event Findings

| Check | Result |
|-------|--------|
| Rate-limit denial emits event | ✅ `AI_RATE_LIMITED` |
| Circuit-open emits event | ✅ `AI_CIRCUIT_OPENED` |
| Circuit recovery emits event | ✅ `AI_CIRCUIT_RECOVERED` |
| Auth error emits event | ✅ `AI_FAILURE` with severity HIGH |
| Exhausted emits event | ✅ `AI_RETRY_LIMIT_REACHED` |
| Raw prompts redacted | ✅ `blockedKeys` set in sanitizeMetadata |
| DB failure non-blocking | ✅ Returns `{ persisted: false }`, does not block request |

## 12. Circuit-Breaker Findings

| Check | Result |
|-------|--------|
| `getCircuitState` RPC works | ✅ Parameter names match, return accessible |
| `recordCircuitFailure` RPC **FAILS** | ❌ **CRITICAL**: Code passes `p_failure_threshold, p_reset_ms`; SQL expects `p_threshold` (no `p_reset_ms`) |
| `resetCircuit` RPC works | ✅ Parameter names match |
| `get_circuit_state` column names match code | ❌ **HIGH**: SQL returns `open, failures, last_failure`; code expects `is_open, failure_count, last_failure_at` |
| `record_circuit_failure` column names match code | ❌ **HIGH**: SQL returns `opened, failures`; code expects `is_open, failure_count` |
| Circuit ever opens | ❌ **CRITICAL**: `record_circuit_failure` always fails → failures never recorded → circuit never opens |
| Circuit breaker effective | ❌ **CRITICAL**: Entirely non-functional |

## 13. Direct-Provider Bypass Findings

| Check | Result |
|-------|--------|
| No direct OpenAI SDK in gateway | ✅ Verified |
| No direct Anthropic SDK in gateway | ✅ Verified |
| No raw fetch to model providers | ✅ Verified |
| All LLM paths through gateway | ✅ 4 callers verified |
| Tavily uses direct HTTP | ✅ Separate provider, has route-level rate limit |

## 14. Sensitive-Data Findings

| Check | Result |
|-------|--------|
| No raw prompts in gateway logs | ✅ No `console.log(user_prompt)` |
| No API keys in gateway | ✅ No `api_key` reference |
| Error messages generic | ✅ "Internal server error" in routes |
| Security event metadata sanitized | ✅ `blockedKeys` redacts prompts |
| No secrets in telemetry | ✅ Verified |

## 15. Findings by Severity

### CRITICAL (2)
1. **Circuit breaker non-functional**: `record_circuit_failure` RPC call uses wrong parameter names (`p_failure_threshold`, `p_reset_ms` instead of `p_threshold`). Every call fails silently. Circuit never opens. Provider failures are not tracked.
2. **Circuit breaker column-name mismatch**: `get_circuit_state` returns `open, failures, last_failure` but code reads `is_open, failure_count, last_failure_at`. All values are `undefined` at runtime. Even if the circuit did open, the gateway would never detect it.

### HIGH (2)
3. **68 "runtime security tests" are static source-code checks**: All tests read `.ts` files as strings and check for pattern matches. Zero tests call any production function. The tests verify source code contains certain strings, not that runtime behavior is correct.
4. **Test count discrepancy**: Claimed 1,383, verified 1,382. Minor but indicates imprecise accounting.

### MEDIUM (1)
5. **`record_circuit_failure` return shape mismatch**: Code expects `{ is_open, failure_count }` but SQL returns `{ opened, failures }`. Even if the RPC parameters were fixed, the gateway would read `undefined` for both values.

### LOW (0)
No low-severity findings.

### INFO (1)
6. **Pre-existing lint warnings**: 39 errors and 174 warnings exist in the codebase. None introduced by this phase. Modified files have 0 lint errors.

## 16. Required Remediation

| # | Severity | Finding | Remediation |
|---|----------|---------|-------------|
| 1 | CRITICAL | `record_circuit_failure` RPC param mismatch | Fix code to pass `{ p_provider, p_threshold }` instead of `{ p_provider, p_failure_threshold, p_reset_ms }` |
| 2 | CRITICAL | `get_circuit_state` column name mismatch | Fix code to read `{ open, failures, last_failure }` instead of `{ is_open, failure_count, last_failure_at }` |
| 3 | HIGH | Tests are static, not runtime | Create actual runtime tests that call `requestModelCompletion()` with a fake provider |
| 4 | HIGH | Test count off by 1 | Reconcile and correct |

## 17. Final Recommendation

**NOT LOCKED**

The production code changes are genuine and substantial. Rate limiting, usage tracking, and security events are properly wired. Identity threading is complete. However, the circuit breaker is entirely non-functional due to RPC parameter and column-name mismatches — this is a CRITICAL finding that means provider failures will never trigger circuit protection. Additionally, the 68 "runtime security tests" are static source-code pattern checks that exercise zero production functions, providing no evidence of actual runtime enforcement.

**Required before LOCKED PASS:**
1. Fix `record_circuit_failure` RPC call to use correct parameter names
2. Fix `get_circuit_state` and `record_circuit_failure` return shape parsing to match actual SQL column names
3. Create actual runtime tests that call production gateway functions with a deterministic fake provider
