# SALAM LIT — Supabase Migration Audit Report

**Date:** 2026-09-08  
**Auditor:** Automated forensic discovery  
**Scope:** Local migrations 001 + 002 vs. code expectations through Phase 13B  
**Classification:** B — MIGRATIONS INCOMPLETE — NEW MIGRATIONS REQUIRED

---

## 1. Current Migration Inventory

| Migration | File | Tables | Status |
|-----------|------|--------|--------|
| 001 | `001_business_context_and_truth.sql` | 18 | Local only |
| 002 | `002_action_execution_engine.sql` | 4 | Local only |

**Remote Supabase:** 0 migrations applied.  
**Total local migrations:** 2  
**Total tables created:** 22

---

## 2. Migration 001 — What It Creates

**18 tables** for business context and truth foundation:

| # | Table | Purpose |
|---|-------|---------|
| 1 | `users` | Extended user profile (FK → auth.users) |
| 2 | `workspaces` | Collaboration boundary |
| 3 | `workspace_members` | RBAC membership |
| 4 | `businesses` | Business entity |
| 5 | `business_jurisdictions` | Jurisdiction context |
| 6 | `market_profiles` | Target market config |
| 7 | `currency_contexts` | Currency defaults |
| 8 | `business_goals` | Structured goals |
| 9 | `business_constraints` | Business constraints |
| 10 | `ai_readiness` | AI readiness assessment |
| 11 | `data_sources` | Data source registry |
| 12 | `documents` | Document metadata |
| 13 | `evidence` | Source material |
| 14 | `business_facts` | Validated facts with provenance |
| 15 | `fact_evidence` | Fact-to-evidence links |
| 16 | `business_metrics` | Derived metrics |
| 17 | `metric_sources` | Metric-to-fact provenance |
| 18 | `resolved_contexts` | Cached contexts |

**Indexes:** 26  
**RLS policies:** 19 (all SELECT-only)  
**Triggers:** 14 (update_updated_at_column)  
**Foreign keys:** 28  

---

## 3. Migration 002 — What It Creates

**4 tables** for the Action + Execution Engine:

| # | Table | Purpose |
|---|-------|---------|
| 19 | `actions` | Action lifecycle records |
| 20 | `executions` | Provider execution records |
| 21 | `execution_outcomes` | Execution results |
| 22 | `action_audit_events` | Append-only audit trail |

**Indexes:** 13 (including UNIQUE on `idempotency_key`)  
**RLS policies:** 4 (all SELECT-only)  
**Triggers:** 2 (update_updated_at_column)  
**Foreign keys:** 7  

---

## 4. Complete Table Inventory Required by Current Code

### A. Tables with active code (in-memory services) but NO migration

| Table | Type Definition | Service | Supabase `.from()` | Migration |
|-------|----------------|---------|-------------------|-----------|
| `decisions` | `runtime/types.ts` | `decision-service.ts` (Map) | No | **MISSING** |
| `approvals` | `runtime/types.ts` | `approval-service.ts` (Map) | No | **MISSING** |
| `standing_authorizations` | `runtime/types.ts` | `approval-service.ts` (Map) | No | **MISSING** |

### B. Tables in Master Build Specification but NOT implemented

| Table | Spec Section | Status |
|-------|-------------|--------|
| `subscriptions` | v1.1 Core | Not implemented |
| `plans` | v1.1 Core | Not implemented |
| `plan_entitlements` | v1.1 Core | Not implemented |
| `usage_records` | v1.1 Core | Not implemented |
| `entitlement_overrides` | v1.1 Core | Not implemented |
| `agents` | v1.1 Core | TypeScript constants only |
| `business_agents` | v1.1 Core | Comment reference only |
| `marketing_consents` | v1.1 Core | Not implemented |
| `business_events` | v1.3 Intelligence | In-memory only |
| `business_rules` | v1.3 Intelligence | In-memory only |
| `triggers` | v1.3 Intelligence | In-memory only |
| `investigations` | v1.3 Intelligence | In-memory only |
| `investigation_agents` | v1.3 Intelligence | In-memory only |
| `agent_findings` | v1.3 Intelligence | In-memory only |
| `finding_evidence` | v1.3 Intelligence | In-memory only |
| `insights` | v1.3 Intelligence | In-memory only |
| `recommendations` | v1.3 Intelligence | In-memory only |
| `tasks` | v1.4 Execution | Not implemented |
| `workflows` | v1.4 Execution | Not implemented |
| `workflow_steps` | v1.4 Execution | Not implemented |
| `workflow_runs` | v1.4 Execution | Not implemented |
| `workflow_step_runs` | v1.4 Execution | Not implemented |
| `learnings` | v1.4 Execution | Not implemented |

---

## 5. Tables Already Covered

| Table | Migration | RLS | Indexes | FKs |
|-------|-----------|-----|---------|-----|
| `users` | 001 | ✅ | ✅ | ✅ |
| `workspaces` | 001 | ✅ | ✅ | ✅ |
| `workspace_members` | 001 | ✅ | ✅ | ✅ |
| `businesses` | 001 | ✅ | ✅ | ✅ |
| `business_jurisdictions` | 001 | ✅ | ✅ | ✅ |
| `market_profiles` | 001 | ✅ | ✅ | ✅ |
| `currency_contexts` | 001 | ✅ | ✅ | ✅ |
| `business_goals` | 001 | ✅ | ✅ | ✅ |
| `business_constraints` | 001 | ✅ | ✅ | ✅ |
| `ai_readiness` | 001 | ✅ | ✅ | ✅ |
| `data_sources` | 001 | ✅ | ✅ | ✅ |
| `documents` | 001 | ✅ | ✅ | ✅ |
| `evidence` | 001 | ✅ | ✅ | ✅ |
| `business_facts` | 001 | ✅ | ✅ | ✅ |
| `fact_evidence` | 001 | ✅ | ✅ | ✅ |
| `business_metrics` | 001 | ✅ | ✅ | ✅ |
| `metric_sources` | 001 | ✅ | ✅ | ✅ |
| `resolved_contexts` | 001 | ✅ | ✅ | ✅ |
| `actions` | 002 | ✅ | ✅ | ✅ |
| `executions` | 002 | ✅ | ✅ | ✅ |
| `execution_outcomes` | 002 | ✅ | ✅ | ✅ |
| `action_audit_events` | 002 | ✅ | ✅ | ✅ |

---

## 6. Tables Missing from Migrations

### Critical (required for Phase 11-12 persistence)

| Table | Why Missing Matters |
|-------|-------------------|
| `decisions` | Phase 11 Decision Center has no DB persistence |
| `approvals` | Phase 12 Approval Engine has no DB persistence |
| `standing_authorizations` | Standing auth has no DB persistence |

### Not Yet Implemented (future phases)

23+ tables from Master Build Specification v1.3/v1.4 are not implemented in code at all. These are not migration gaps — they are feature gaps.

---

## 7. Missing Indexes

None identified for the 22 existing migration tables. All critical query patterns are indexed.

For the 3 missing tables (`decisions`, `approvals`, `standing_authorizations`), indexes will need to be created when migrations are added.

---

## 8. Missing Foreign Keys

None identified for the 22 existing migration tables.

For the 3 missing tables:
- `decisions.business_id` → `businesses.id`
- `approvals.business_id` → `businesses.id`
- `standing_authorizations.business_id` → `businesses.id`

---

## 9. Missing RLS Policies

**All 23 existing RLS policies are SELECT-only.** This means:

- ✅ SELECT queries are protected by RLS
- ❌ INSERT, UPDATE, DELETE operations have no RLS policies
- The application relies on `service_role` key for writes (bypasses RLS)

**This is acceptable for the current architecture** where all writes go through server-side API routes using the service_role key. If client-side writes are ever introduced, INSERT/UPDATE/DELETE policies will be needed.

For the 3 missing tables, RLS policies following the same `businesses → workspace_members → auth.uid()` pattern will be needed.

---

## 10. Missing Triggers/Functions

**Shared function:** `update_updated_at_column()` — exists in migration 001, referenced by all tables with `updated_at`.

**Missing triggers for migration 002:**
- `execution_outcomes` — no `updated_at` trigger (intentional: append-only)
- `action_audit_events` — no `updated_at` trigger (intentional: append-only)

**No issues identified.**

---

## 11. Potential Schema/Code Mismatches

### Type/Schema Drift

| TypeScript Interface | Migration | Discrepancy |
|---------------------|-----------|-------------|
| `Document.status` | `documents.status CHECK` | TS allows 9 statuses, SQL allows 4 |
| `Document` fields | `documents` | 4 extra fields in TS not in SQL |
| `BusinessMetric` fields | `business_metrics` | 6 extra fields in TS not in SQL |
| `MetricSource` fields | `metric_sources` | 1 extra field in TS not in SQL |

These drifts exist because the TypeScript types were defined speculatively for future use, while the SQL schema was created conservatively. They do not block current functionality but should be reconciled when the tables are actively used.

---

## 12. Phase 12 Database Dependencies

Phase 12 (Approval + Authorization Engine) uses:
- `approval-service.ts` — in-memory Map for `Approval` and `StandingAuthorization`
- `authorization-engine.ts` — delegates to approval-service
- `access-control.ts` — in-memory Map for memberships and permissions

**Database dependency:** None. Phase 12 is 100% in-memory. No Supabase `.from()` calls.

**Migration gap:** The `approvals` and `standing_authorizations` tables are not in any migration. If Phase 12 were to be persisted, a new migration would be required.

---

## 13. Phase 13A Database Dependencies

Phase 13A (Action + Execution Engine Foundation) uses:
- `action-service.ts` — in-memory Map for `Action`
- `execution-engine.ts` — in-memory Maps for `Execution` and `ExecutionOutcome`
- `audit.ts` — in-memory array for `ActionAuditEvent`

**Database dependency:** None. Phase 13A is 100% in-memory. No Supabase `.from()` calls.

**Migration gap:** Phase 13B added migration 002, which covers all 4 Phase 13A tables.

---

## 14. Phase 13B Database Dependencies

Phase 13B (Persistent Action + Execution State Engine) uses:
- `action-repository.ts` — `.from("actions")` ✅ in migration 002
- `execution-repository.ts` — `.from("executions")` ✅ in migration 002
- `outcome-repository.ts` — `.from("execution_outcomes")` ✅ in migration 002
- `audit-repository.ts` — `.from("action_audit_events")` ✅ in migration 002

**All 4 Phase 13B Supabase `.from()` calls reference tables that exist in migration 002.**

**No gaps for Phase 13B.**

---

## 15. Are Current Migrations Safe to Push?

**For the 22 existing tables:** YES. The migrations are well-structured, follow existing conventions, and all referenced tables/indexes/RLS/triggers are present.

**For the full application:** NO. The `decisions`, `approvals`, and `standing_authorizations` tables are missing. Pushing only migrations 001+002 would result in a database that supports business context (Phase 4) and action/execution (Phase 13B) but NOT approvals (Phase 12) or decisions (Phase 11).

**However:** Since no code currently writes to PostgreSQL for approvals or decisions (all in-memory), pushing 001+002 would not break anything. The in-memory services would continue to work. The gap would only matter when persistence is added for those features.

---

## 16. Recommended Migration Strategy

### Immediate (safe to push)

Push migrations 001 + 002 as-is. They are correct, complete for their scope, and will not break anything.

### Next migration needed: 003

Create `003_approvals_and_decisions.sql` to add:

```sql
-- Approvals
CREATE TABLE IF NOT EXISTS approvals (...);
CREATE TABLE IF NOT EXISTS standing_authorizations (...);

-- Decisions
CREATE TABLE IF NOT EXISTS decisions (...);
```

With corresponding indexes, RLS policies, foreign keys, and triggers.

### Future migrations (per phase)

Each subsequent phase that introduces new tables should include its own migration file following the `{NNN}_{descriptive_name}.sql` convention.

---

## Classification

**B — MIGRATIONS INCOMPLETE — NEW MIGRATIONS REQUIRED**

The existing migrations (001 + 002) are correct and well-structured, but do not cover the full application schema. Specifically:

- `approvals` table — MISSING (Phase 12 persistence)
- `standing_authorizations` table — MISSING (Phase 12 persistence)
- `decisions` table — MISSING (Phase 11 persistence)

These are not bugs in the existing migrations — they are scope boundaries. Migrations 001 and 002 cover Phases 4 and 13B respectively. A new migration 003 is needed for Phases 11-12 persistence.

---

## Summary

| Metric | Value |
|--------|-------|
| Classification | B — Migrations Incomplete |
| Migration count | 2 (001, 002) |
| Tables in migrations | 22 |
| Tables in code (Supabase `.from()`) | 4 (all covered) |
| Tables with types but no migration | 3 (decisions, approvals, standing_authorizations) |
| Tables in Master Spec but not implemented | 23+ (future phases) |
| RLS policies | 23 (all SELECT-only) |
| Indexes | 39 |
| Foreign keys | 35 |
| Triggers | 16 |
| Security/RLS findings | SELECT-only policies, service_role for writes — acceptable |
| Recommended next step | Push 001+002, create migration 003 for approvals/decisions |
| Report path | `docs/SALAM_LIT_SUPABASE_MIGRATION_AUDIT.md` |

**STOP.** Do not push migrations. Do not create new migrations. Do not modify code.
