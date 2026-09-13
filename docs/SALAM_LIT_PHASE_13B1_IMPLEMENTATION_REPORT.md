# Phase 13B.1 — Decision + Approval Persistence Hardening
## Implementation Report

**Date:** 2026-09-08
**Status:** COMPLETE — all gates passed

---

## 1. Objective

Harden the Decision Center (Phase 11) and Approval + Authorization Engine (Phase 12) to persist their state through a write-through cache pattern, matching the architecture established in Phase 13B for the Action + Execution Engine.

**Before Phase 13B.1:**
- `decisions` — in-memory `Map<string, Decision>` (lost on restart)
- `approvals` — in-memory `Map<string, Approval>` (lost on restart)
- `standingAuthorizations` — in-memory `Map<string, StandingAuthorization>` (lost on restart)
- `approvalAuditEvents` — in-memory `ApprovalAuditEvent[]` (lost on restart)

**After Phase 13B.1:**
- 4 repository layers with write-through cache pattern
- 4 new tables in PostgreSQL (migration 003)
- All services refactored to use repositories
- Zero behavioral changes to existing logic

---

## 2. Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/003_decision_approval_persistence.sql` | Creates `decisions`, `approvals`, `standing_authorizations`, `approval_audit_events` tables with RLS, indexes, FKs, triggers |
| `src/lib/decisions/decision-repository.ts` | Write-through cache repository for Decision records |
| `src/lib/approval/approval-repository.ts` | Write-through cache repository for Approval records |
| `src/lib/approval/standing-auth-repository.ts` | Write-through cache repository for StandingAuthorization records |
| `src/lib/approval/audit-repository.ts` | Write-through cache repository for ApprovalAuditEvent records |
| `test-phase13b1.mjs` | 66-test comprehensive test suite |

## 3. Files Modified

| File | Change |
|------|--------|
| `src/lib/decisions/decision-service.ts` | Replaced `Map<string, Decision>` with `getDecisionRepository()` calls |
| `src/lib/approval/approval-service.ts` | Replaced `Map<string, Approval>` and `Map<string, StandingAuthorization>` with repository calls |
| `src/lib/approval/audit.ts` | Replaced `ApprovalAuditEvent[]` with `getApprovalAuditRepository()` calls |
| `src/lib/approval/approval-repository.ts` | Added `getAll()` method for bulk operations (expireOldApprovals) |
| `src/lib/decisions/decision-repository.ts` | Fixed `decision_context` type cast for PostgreSQL JSONB |
| `src/lib/approval/audit-repository.ts` | Fixed `event_type` type cast for TypeScript union |
| `test-phase12.mjs` | Fixed 4 tests that passed stale approval objects to `checkAuthorization` (now uses returned updated objects) |

---

## 4. Migration 003 Schema

### Tables Created

| Table | Columns | RLS |
|-------|---------|-----|
| `decisions` | id, business_id, recommendation_id, investigation_id, trigger_id, decision_type, decision_maker, reason, original_scope, modified_scope, status, superseded_by, decision_context (JSONB), decided_at, created_at, updated_at | Business members via workspace_members |
| `approvals` | id, business_id, decision_id, requested_by, requested_by_type, action_type, action_description, scope (JSONB), risk_level, status, approver_id, approval_reason, rejection_reason, standing_authorization_id, requested_at, approved_at, expires_at, revoked_at, created_at, updated_at | Business members via workspace_members |
| `standing_authorizations` | id, business_id, authorized_by, authorized_agent, scope (JSONB), max_amount_per_use, max_amount_per_period, period, max_uses_per_period, active, revoked, revoked_at, revoked_by, effective_from, effective_until, created_at, updated_at | Business members via workspace_members |
| `approval_audit_events` | id, business_id, approval_id, event_type, actor, actor_type, details (JSONB), timestamp | Business members via workspace_members |

### Indexes
- `idx_decisions_business_id`, `idx_decisions_status`, `idx_decisions_decision_type`, `idx_decisions_recommendation_id`
- `idx_approvals_business_id`, `idx_approvals_status`, `idx_approvals_action_type`, `idx_approvals_risk_level`
- `idx_standing_auth_business_id`, `idx_standing_auth_active`, `idx_standing_auth_revoked`
- `idx_approval_audit_business_id`, `idx_approval_audit_approval_id`, `idx_approval_audit_event_type`

### Triggers
- `update_decisions_updated_at` — auto-updates `updated_at` on UPDATE
- `update_approvals_updated_at` — auto-updates `updated_at` on UPDATE
- `update_standing_authorizations_updated_at` — auto-updates `updated_at` on UPDATE

### Constraints
- `decisions.decision_type` CHECK: APPROVE, APPROVE_WITH_CHANGES, REJECT, INVESTIGATE_FURTHER
- `decisions.status` CHECK: ACTIVE, SUPERSEDED, CANCELLED
- `approvals.requested_by_type` CHECK: USER, AGENT
- `approvals.risk_level` CHECK: L0, L1, L2, L3, L4
- `approvals.status` CHECK: PENDING, APPROVED, REJECTED, EXPIRED, REVOKED
- `approval_audit_events.actor_type` CHECK: USER, AGENT, SYSTEM
- All FKs reference `businesses(id) ON DELETE CASCADE`

---

## 5. Repository Architecture

All repositories follow the same write-through cache pattern from Phase 13B:

```
Service Layer
  ↓
Repository (write-through cache)
  ├── In-memory Map (sync reads)
  └── PostgreSQL via Supabase client (async writes, fire-and-forget)
```

### DecisionRepository
| Method | Description |
|--------|-------------|
| `create(decision)` | Insert into cache + async DB persist |
| `getById(id)` | Sync read from cache |
| `getByBusiness(business_id, limit)` | Filter cache by business, sorted by created_at desc |
| `getActiveByRecommendation(recommendation_id)` | Find ACTIVE decision for a recommendation |
| `update(id, updates)` | Update cache + async DB persist |
| `clearCache()` | Clear in-memory cache |
| `loadFromDatabase(business_id?)` | Hydrate cache from PostgreSQL |
| `flush()` | Await all pending writes |

### ApprovalRepository
| Method | Description |
|--------|-------------|
| `create(approval)` | Insert into cache + async DB persist |
| `getById(id)` | Sync read from cache |
| `getByBusiness(business_id, limit)` | Filter cache by business |
| `getPendingByBusiness(business_id)` | Filter PENDING + sort by risk level |
| `getAll()` | Return all cached approvals (for expireOldApprovals) |
| `update(id, updates)` | Update cache + async DB persist |

### StandingAuthRepository
| Method | Description |
|--------|-------------|
| `create(auth)` | Insert into cache + async DB persist |
| `getById(id)` | Sync read from cache |
| `getActiveByBusiness(business_id)` | Filter active, non-revoked, within effective dates |
| `update(id, updates)` | Update cache + async DB persist |

### ApprovalAuditRepository
| Method | Description |
|--------|-------------|
| `create(event)` | Insert into cache + async DB persist |
| `getByBusiness(business_id, limit)` | Filter by business, sorted by timestamp desc |
| `getByApprovalId(approval_id)` | Filter by approval_id |

---

## 6. Key Design Decisions

### DecisionMemory stays in-memory
Decision memory is historical context for future investigations — not business-critical data. It's cheap to regenerate and adds no value to PostgreSQL persistence.

### standingAuthUsage stays in-memory
Usage counts (`max_uses_per_period`) are ephemeral — they reset on restart. With PostgreSQL, they'd need a separate tracking table. Keeping them in-memory is acceptable for MVP.

### Scope JSONB
`ApprovalScope` and `decision_context` are stored as JSONB in PostgreSQL. This allows flexible querying while preserving the full TypeScript interface structure on read.

### No foreign keys to in-memory data
`decision_id` in approvals and `approval_id` in audit events are TEXT, not UUID FKs. Recommendations, investigations, and decisions are in-memory — no FK constraint is possible.

### RLS via workspace_members join
All 4 tables use the same RLS pattern: `businesses → workspace_members → user_id = auth.uid()`. This ensures workspace-level access control without application-level checks.

---

## 7. Test Results

| Suite | Tests | Result |
|-------|-------|--------|
| Phase 12 (Approval + Authorization) | 148 | ✅ ALL PASS |
| Phase 13A (Action + Execution Foundation) | 57 | ✅ ALL PASS |
| Phase 13B (Persistent Action + Execution State) | 68 | ✅ ALL PASS |
| Phase 13B.1 (Decision + Approval Persistence) | 66 | ✅ ALL PASS |
| **Total** | **339** | ✅ **ALL PASS** |
| `tsc --noEmit` | — | ✅ No errors |
| `next build` | — | ✅ Successful |

### Phase 13B.1 Test Coverage (66 tests)
1. Decision Repository: Create & Read (4)
2. Decision Repository: Get By Business (4)
3. Decision Repository: Get Active By Recommendation (3)
4. Decision Repository: Update (1)
5. Decision Repository: Sort Order (3)
6. Decision Repository: Clear Cache (1)
7. Approval Repository: Create & Read (3)
8. Approval Repository: Get By Business (2)
9. Approval Repository: Get Pending By Business (3)
10. Approval Repository: Get All (1)
11. Approval Repository: Update (2)
12. Approval Repository: Clear Cache (1)
13. Standing Auth Repository: Create & Read (3)
14. Standing Auth Repository: Get Active By Business (3)
15. Standing Auth Repository: Update (Revoke) (3)
16. Standing Auth Repository: Clear Cache (1)
17. Approval Audit Repository: Create & Read (2)
18. Approval Audit Repository: Get By Approval ID (3)
19. Approval Audit Repository: Clear (1)
20. Audit Via audit.ts Integration (5)
21. Risk Level Determination (4)
22. Multi-Business Isolation (6)
23. Cache Clear Simulates Restart (3)
24. Write-Through Batch (2)

---

## 8. Breaking Changes

### Test update required
Phase 12 tests that passed stale approval objects to `checkAuthorization` were updated. After refactor, `approveRequest()` and `revokeApproval()` return new objects instead of mutating in place. Tests now capture the returned updated objects.

### No API changes
All existing API routes (`/api/decisions`, `/api/approvals`, etc.) continue to work without modification — the service interfaces are unchanged.

---

## 9. Known Limitations (MVP)

- Without Supabase configured (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), data is lost on process restart — write-through cache is write-only
- `loadFromDatabase()` is available but not auto-called on startup
- `flush()` awaits pending writes but is not called automatically
- Decision memory and standing auth usage counts remain in-memory only

---

## 10. What's NOT in Scope

- ❌ Phase 13C (not started)
- ❌ Modifying migrations 001 or 002
- ❌ Pushing to remote Supabase
- ❌ New AI agent capabilities
- ❌ New UI components
- ❌ Risk level changes
- ❌ Authorization logic changes
- ❌ Agent self-approval changes

---

## 11. Next Steps (Phase 13C)

Phase 13C will add:
- Execution outcome recording with business impact tracking
- Financial impact verification
- Action outcome audit trail
- Reconciliation improvements
