# SALAM LIT Phase 13A — Action + Execution Engine Foundation

**Status:** ✅ COMPLETE  
**Date:** 2026-09-08  
**Tests:** Phase 12 — 148/148 passed | Phase 13A — 57/57 passed  
**tsc --noEmit:** Clean  
**next build:** Clean (34 routes)

---

## Summary

Phase 13A delivers the foundational Action + Execution Engine — the layer that bridges authorized actions into real-world execution through a provider abstraction. The system enforces authorization before execution, prevents duplicate execution via idempotency keys, handles provider failures/unknown states/timeouts, and maintains a complete audit trail.

## What Was Built

### Core Services

| File | Purpose |
|------|---------|
| `src/lib/action/action-service.ts` | Action CRUD, authorization handoff, lifecycle transitions (PROPOSED → AUTHORIZED → QUEUED → COMPLETED/FAILED/CANCELLED) |
| `src/lib/action/execution-engine.ts` | Execution lifecycle, provider registry, idempotency enforcement, reconciliation |
| `src/lib/action/audit.ts` | Action audit trail (ACTION_CREATED, ACTION_AUTHORIZED, EXECUTION_SUCCEEDED, etc.) |
| `src/lib/action/index.ts` | Barrel exports |

### Provider Abstraction

| File | Purpose |
|------|---------|
| `src/lib/action/providers/types.ts` | `ExecutionProvider` interface — providers implement `execute()` and `reconcile()` |
| `src/lib/action/providers/test-provider.ts` | **TEST ONLY** — configurable success/fail/timeout/unknown. No real side effects. |
| `src/lib/action/providers/index.ts` | Barrel exports |

### API Routes

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/actions` | GET, POST | List actions, create + authorize + queue actions |
| `/api/actions/[id]` | GET | Get action detail with audit trail |
| `/api/executions` | GET, POST | List executions, execute + reconcile actions |
| `/api/executions/[id]` | GET | Get execution detail with outcome |

### UI

| File | Purpose |
|------|---------|
| `src/components/office/ExecutionStatusView.tsx` | Action + execution status display with lifecycle progression |

### Types

Added to `src/lib/runtime/types.ts`:
- `ActionStatus`: PROPOSED, REQUIRES_APPROVAL, PAYMENT_REQUIRES_APPROVAL, AUTHORIZED, QUEUED, EXECUTING, COMPLETED, FAILED, CANCELLED, BLOCKED
- `Action`: Full action record with parameters, approval linkage, authorization result
- `ExecutionStatus`: PENDING, EXECUTING, SUCCEEDED, FAILED, UNKNOWN, TIMED_OUT, CANCELLED
- `Execution`: Provider execution record with idempotency key, external reference, reconciliation status
- `ExecutionOutcome`: SUCCESS, PARTIAL, FAILURE, UNKNOWN, TIMED_OUT
- `ActionAuditEvent`: Complete audit trail for actions

---

## Idempotency Invariants (Verified)

| # | Invariant | Status |
|---|-----------|--------|
| 1 | Same idempotency_key + same intent → no second execution | ✅ Tested |
| 2 | Concurrent duplicate requests → same logical execution | ✅ Atomic check (single-threaded in-memory) |
| 3 | Different idempotency_key on completed action → rejected | ✅ Tested |
| 4 | Idempotency enforced server-side (not UI-only) | ✅ Test verifies single provider call |
| 5 | Provider timeout/UNKNOWN → no unsafe duplicate | ✅ Idempotency check before status check |
| 6 | Keys scoped to action (prevent cross-business collisions) | ✅ Key format: `exec-{action_id}-{random}` |
| 7 | Authorization/approval checks not weakened for idempotency | ✅ Authorization required before queueing |

### Key Fix Applied

**Idempotency check order** (`execution-engine.ts`): The idempotency check was previously AFTER the action status check. This caused duplicates to fail with "must be QUEUED" when the first execution had already completed the action. Fixed by moving the idempotency check BEFORE the status check — duplicate keys now return the existing execution immediately regardless of action state.

### Authorization Fix Applied

**Agent identity resolution** (`authorization-engine.ts`): Agent-initiated actions were resolving to `user_id: "system"` in the access check, causing "Authenticated user is required" errors. Fixed by using `agent_key` as the user_id for agent-initiated actions, since agents are already registered as workspace members with appropriate permissions.

---

## Risk Classification

| Level | Description | Qualifying Actions |
|-------|-------------|-------------------|
| L0 | Internal cognitive (reserved) | *(empty — no actions qualify)* |
| L1 | Low-risk internal | CUSTOMER_MESSAGE, DATA_EXPORT, OTHER |
| L2 | Consequential business action | SYSTEM_CHANGE, CONTRACT, HIRING, FIRING, CAMPAIGN_PUBLISH, payment ≤ 10,000 |
| L3 | High-impact financial/sensitive | payment > 10,000 |
| L4 | Enhanced cryptographic/enterprise | *(reserved for future)* |

---

## MVP Persistence Limitation

**All action, execution, and audit data is stored in in-memory JavaScript Maps.** This is intentional for MVP — the services are designed with clean interfaces that can be swapped to database-backed implementations without changing the API surface. Key limitation: all data is lost on server restart. A future phase will introduce durable persistence.

---

## Test Coverage (57 tests)

| Category | Tests |
|----------|-------|
| Action creation | 6 |
| Business isolation | 2 |
| Unauthorized actions | 2 |
| Authorization success | 5 |
| Authorization failure | 1 |
| Action lifecycle | 5 |
| Execution | 6 |
| Idempotency | 5 |
| Provider failure | 3 |
| UNKNOWN state | 3 |
| Reconciliation | 5 |
| Provider timeout | 2 |
| Audit trail | 7 |
| Standing authorization | 2 |
| Risk classification | 2 |
| **Total** | **57** |

---

## Phase 12 Regression Check

Phase 12 tests: **148/148 passed** (unchanged). One test assertion updated to reflect corrected agent identity resolution (agent-initiated payment now returns `PAYMENT_REQUIRES_APPROVAL` instead of `UNAUTHORIZED`, since agents authenticate successfully but cannot self-approve).

---

## Files Changed (Phase 13A)

**New files:**
- `src/lib/action/action-service.ts`
- `src/lib/action/execution-engine.ts`
- `src/lib/action/audit.ts`
- `src/lib/action/index.ts`
- `src/lib/action/providers/types.ts`
- `src/lib/action/providers/test-provider.ts`
- `src/lib/action/providers/index.ts`
- `app/api/actions/route.ts`
- `app/api/actions/[id]/route.ts`
- `app/api/executions/route.ts`
- `app/api/executions/[id]/route.ts`
- `src/components/office/ExecutionStatusView.tsx`
- `test-phase13a.mjs`

**Modified files:**
- `src/lib/runtime/types.ts` — Phase 13A types added
- `src/lib/approval/authorization-engine.ts` — Agent identity resolution fix
- `test-phase12.mjs` — Updated assertion for corrected agent behavior

---

**STOP. Do NOT proceed to Phase 13B.**
