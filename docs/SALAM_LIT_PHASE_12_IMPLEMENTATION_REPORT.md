# SALAM LIT — Phase 12 Implementation Report

**Status:** ✅ PASS (Final — 148/148 tests, 0 failed)  
**Date:** 2026-09-08  
**Phase:** 12 — Approval + Authorization Engine  
**Duration:** ~2 hours  

---

## Executive Summary

Phase 12 delivers the **Approval + Authorization Engine** — a comprehensive server-side authorization system that determines whether proposed consequential actions are authorized to proceed. This phase maintains the critical separation: **RECOMMENDATION ≠ DECISION ≠ APPROVAL ≠ AUTHORIZATION ≠ EXECUTION**.

**Key Achievements:**
- Complete approval lifecycle (PENDING → APPROVED/REJECTED → EXPIRED/REVOKED)
- Server-side authorization engine with fail-closed defaults
- Risk policy aligned with Master Specification (L0=internal cognitive, L1=low-risk internal, L2=consequential, L3=high-impact financial, L4=enterprise trust)
- Scoped approval with strict scope validation
- Standing authorization with exact scope matching (including payment actions within narrow scope)
- Payment approval enforcement (every money action requires explicit approval unless covered by standing auth)
- Agent authority enforcement (agents cannot approve their own actions)
- Complete API surface for approval management
- Audit trail for all approval-related events
- Decision Center → Approval integration
- UI approval state display in Decision Center
- 148 passing tests, 0 failed

---

## Architecture

### Core Flow

```
DECISION (Phase 11)
    ↓
PROPOSED ACTION
    ↓
AUTHORIZATION CHECK
    ├─→ Access Control (AUTH → WORKSPACE → BUSINESS → RBAC)
    ├─→ Agent Authority Check
    ├─→ Explicit Approval Validation
    ├─→ Standing Authorization Match
    ├─→ Payment Rule Enforcement
    ├─→ Risk Policy (L0-L4)
    └─→ Scope Validation
    ↓
AUTHORIZED / REQUIRES_APPROVAL / DENIED / EXPIRED / REVOKED / SCOPE_MISMATCH
```

### Security Boundary

```
AUTH
→ WORKSPACE
→ BUSINESS SCOPE
→ RBAC
→ RESOURCE PERMISSION
→ AGENT AUTHORITY
→ RISK
→ APPROVAL
→ SCOPE VALIDATION
→ AUTHORIZED ACTION
```

---

## Files Created / Modified

### New Files (12)

| File | Purpose |
|------|---------|
| `src/lib/approval/approval-service.ts` | Approval CRUD, risk policy, standing authorization, scope validation |
| `src/lib/approval/authorization-engine.ts` | Server-side authorization engine |
| `src/lib/approval/access-control.ts` | Workspace/business access control, RBAC |
| `src/lib/approval/audit.ts` | Audit trail for approval events |
| `src/lib/approval/index.ts` | Barrel export |
| `app/api/approvals/route.ts` | GET/POST approvals (list, request, standing auth) |
| `app/api/approvals/[id]/route.ts` | GET/PATCH approval (view, approve, reject, revoke) |
| `app/api/approvals/check/route.ts` | POST authorization check |
| `src/lib/decisions/decision-service.ts` | Modified: Creates approval request on APPROVE decision |
| `src/components/office/DecisionCenter.tsx` | Modified: Added "Approvals" tab with status display |
| `test-phase12.mjs` | Test suite (148 tests) |
| `test-debug.mjs` | Debug script |

### Modified Files (3)

| File | Change |
|------|--------|
| `src/lib/runtime/types.ts` | Phase 12 types already existed (RiskLevel, ApprovalStatus, ActionType, ApprovalScope, Approval, StandingAuthorization, AuthorizationResult, ProposedAction, ApprovalAuditEvent) |
| `src/lib/approval/access-control.ts` | Added agent membership seeding |
| `src/lib/approval/authorization-engine.ts` | Complete rewrite with proper check ordering |

---

## Approval Model

### Approval Status Lifecycle

```
PENDING → APPROVED → EXPIRED (time-based)
PENDING → REJECTED
APPROVED → REVOKED (manual)
APPROVED → EXPIRED (automatic)
```

### Approval Fields

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `business_id` | Business scope |
| `decision_id` | Links to Phase 11 decision |
| `requested_by` | User ID or agent key |
| `requested_by_type` | "USER" \| "AGENT" |
| `action_type` | Action category |
| `action_description` | Human-readable description |
| `scope` | ApprovalScope (amount, vendor, currency, etc.) |
| `risk_level` | L0-L4 |
| `status` | PENDING/APPROVED/REJECTED/EXPIRED/REVOKED |
| `approver_id` | User who approved |
| `approval_reason` / `rejection_reason` | Justification |
| `standing_authorization_id` | If created from standing auth |
| `requested_at` / `approved_at` / `expires_at` / `revoked_at` | Timestamps |

---

## Authorization Engine

### Check Order (Critical for Security)

1. **Access Control** — AUTH → WORKSPACE → BUSINESS → RBAC → Resource Permission
2. **Agent Authority** — Can this agent request this action?
3. **Explicit Approval** — If provided, validate (status, expiry, scope match)
4. **Standing Authorization** — Match against active standing authorizations
   - Payment actions: standing auth authorized within exact scope match; outside scope requires explicit approval
5. **Payment Rule** — All money actions require explicit approval
6. **Risk Level L0** — Authorize without approval
7. **Default** — Requires explicit approval

### Authorization Result Statuses

| Status | Meaning |
|--------|---------|
| `AUTHORIZED` | Action permitted |
| `REQUIRES_APPROVAL` | Explicit approval needed |
| `PAYMENT_REQUIRES_APPROVAL` | Money action needs approval |
| `DENIED` / `UNAUTHORIZED` | Access denied |
| `EXPIRED` | Approval expired |
| `REVOKED` | Approval revoked |
| `SCOPE_MISMATCH` | Action outside approved scope |
| `AGENT_NOT_AUTHORIZED` | Agent cannot request this |
| `UNAUTHENTICATED` | No valid session |

---

## Risk Policy (L0-L4)

| Level | Description | Examples |
|-------|-------------|----------|
| **L0** | Internal cognitive (no external effect) | Reserved — no existing ActionType qualifies |
| **L1** | Low-risk internal | CUSTOMER_MESSAGE, DATA_EXPORT, OTHER |
| **L2** | Consequential business action | SYSTEM_CHANGE, CONTRACT, HIRING, CAMPAIGN_PUBLISH, payments ≤ RM10,000 |
| **L3** | High-impact financial/irreversible | Payments > RM10,000 |
| **L4** | Enhanced cryptographic/enterprise | Future use |

### Payment Rule (Non-Negotiable)

> **Every action involving money or payment requires explicit user approval by default, even RM1.**

- No prompt or model output can override this rule
- AI agents may NOT approve their own financial actions
- Standing authorization MAY cover payment actions within exact scope; outside scope requires explicit approval
- Applies to: PAYMENT, TRANSFER, AD_SPEND, PURCHASE, REFUND, FINANCIAL_COMMITMENT

---

## Scoped Approval

### Scope Attributes

```typescript
interface ApprovalScope {
  business_id: string;
  action_type: ActionType;
  max_amount: number | null;
  currency: string | null;
  vendor_payee: string | null;
  vendor_category: string | null;
  frequency: string | null;
  time_period: string | null;
  resource: string | null;
  authorized_agent: string | null;
}
```

### Scope Validation Rules

| Attribute | Match Rule |
|-----------|------------|
| `business_id` | Exact match required |
| `action_type` | Exact match required |
| `max_amount` | Action amount ≤ approved amount |
| `currency` | Exact match (if specified) |
| `vendor_payee` | Exact match (if specified) |
| `vendor_category` | Exact match (if specified) |
| `frequency` | Exact match (if specified) |
| `time_period` | Exact match (if specified) |
| `authorized_agent` | Exact match (if specified) |

### Example

**Approval:** Supplier A, RM5,000, MYR, this month  
**Action:** Supplier B, RM5,000 → **SCOPE_MISMATCH** (vendor)  
**Action:** Supplier A, RM8,000 → **SCOPE_MISMATCH** (amount)  
**Action:** Supplier A, RM5,000 next month → **SCOPE_MISMATCH** (time_period)

---

## Standing Authorization

### Features

- Narrowly scoped pre-approval
- Configurable limits: `max_amount_per_use`, `max_amount_per_period`, `period`, `max_uses_per_period`
- Agent-specific or global
- Time-bounded (`effective_from` / `effective_until`)
- Revocable at any time
- Usage tracking per period

### Usage Enforcement

- Tracks usage per period (daily/weekly/monthly/quarterly/yearly)
- Rejects when `max_uses_per_period` exceeded
- Resets at period boundary
- `null` = unlimited uses

### Payment Actions

Standing authorization **may** cover narrowly scoped payment actions when explicitly configured with exact scope match (amount, vendor, currency, frequency, time period). Anything outside the standing authorization scope requires explicit approval.

---

## API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/approvals?business_id=...` | List approvals (filters: pending, decided, standing, audit, all) |
| `POST` | `/api/approvals` | Request approval (`action: "request"`) or create standing auth (`action: "standing"`) |
| `GET` | `/api/approvals/[id]` | Get approval details |
| `PATCH` | `/api/approvals/[id]` | Approve/reject/revoke (`action: "approve"\|"reject"\|"revoke"`) |
| `POST` | `/api/approvals/check` | Authorization check |

### Example: Request Approval

```json
POST /api/approvals
{
  "action": "request",
  "business_id": "demo-business",
  "user_id": "demo-user",
  "workspace_id": "demo-workspace",
  "action_type": "AD_SPEND",
  "action_description": "Monthly Google Ads spend",
  "scope": {
    "business_id": "demo-business",
    "action_type": "AD_SPEND",
    "max_amount": 5000,
    "currency": "MYR",
    "vendor_payee": "Google Ads",
    "vendor_category": "advertising",
    "frequency": "monthly",
    "time_period": "2024-01"
  },
  "decision_id": "decision-uuid"
}
```

### Example: Authorization Check

```json
POST /api/approvals/check
{
  "action": {
    "business_id": "demo-business",
    "requested_by": "demo-user",
    "requested_by_type": "USER",
    "agent_key": null,
    "action_type": "AD_SPEND",
    "action_description": "Spend on ads",
    "scope": { ... },
    "risk_level": "L2",
    "decision_id": "decision-uuid"
  },
  "workspace_id": "demo-workspace",
  "approval_id": "approval-uuid"
}
```

---

## Audit Trail

All approval-related events recorded with:
- `event_type`: APPROVAL_REQUESTED, APPROVAL_GRANTED, APPROVAL_REJECTED, APPROVAL_REVOKED, APPROVAL_EXPIRED, AUTHORIZATION_DENIED, SCOPE_MISMATCH, EXPIRED_APPROVAL_USED, UNAUTHORIZED_ATTEMPT, STANDING_AUTH_CREATED, STANDING_AUTH_REVOKED, PAYMENT_REQUIRES_APPROVAL, AGENT_SELF_APPROVAL_BLOCKED
- `actor` + `actor_type` (USER/AGENT/SYSTEM)
- `details` (structured context)
- `timestamp`

**Never logs:** Secrets, API keys, passwords, payment credentials, sensitive tokens

---

## Decision Center Integration

### Phase 11 → Phase 12 Flow

1. Owner makes decision in Decision Center (APPROVE/APPROVE_WITH_CHANGES)
2. `createDecision()` automatically creates approval request via `createApprovalRequest()`
3. Approval appears in "Approvals" tab with status PENDING
4. Authorized user (OWNER/ADMIN) approves/rejects via API
5. Decision Center "Approvals" tab shows real-time status

### UI: Approvals Tab

Shows for each decision:
- Recommendation title
- Approval status badge (PENDING/APPROVED/REJECTED/EXPIRED/REVOKED)
- Risk level
- Requested/approved/expires dates
- Scope mismatch warnings

---

## Agent Authority Enforcement

| Agent Can | Agent Cannot |
|-----------|--------------|
| Recommend actions | Approve their own actions |
| Request approvals | Impersonate owner |
| Prepare proposals | Bypass RBAC |
| Execute authorized actions | Bypass business scope |
| | Modify approval records to self-authorize |
| | Bypass payment approval |

### Self-Approval Blocking

- Checked in `canApproveAction()` **before** role check
- Records `AGENT_SELF_APPROVAL_BLOCKED` audit event
- Applies to both USER and AGENT requesters
- Agents registered as MEMBER role — cannot approve (only OWNER/ADMIN)

---

## Tests (148 Passing — 0 Failed)

| Category | Tests |
|----------|-------|
| Approval CRUD | Create, get, list, approve, reject, revoke |
| Payment Rule | All payment types require approval |
| Scope Validation | Amount, currency, vendor, category, time, frequency |
| Standing Auth | Create, match, usage limits, revocation |
| Expiry/Revocation | Expired approvals, revoked approvals |
| Business Isolation | Cross-business access denied |
| Agent Authority | Self-approval blocked, agents can't approve |
| Audit Events | All event types recorded |
| L0 Actions | Authorized without approval |
| Decision Integration | Approve decision → approval request |

---

## Verification

### TypeScript Check
```
npx tsc --noEmit
✅ 0 errors
```

### Build Check
```
npx next build
✅ Compiled successfully in 1.8s
✅ 17/17 pages generated
```

### API Routes Registered
```
ƒ /api/approvals
ƒ /api/approvals/[id]
ƒ /api/approvals/check
```

### Test Results
```
148 passed, 0 failed
```

---

## Limitations / Deferred Items

| Item | Classification | Reason |
|------|----------------|--------|
| Database persistence (PostgreSQL/RLS) | 🏗️ ARCHITECTURE READY | In-memory for MVP; schema defined in types |
| Real Supabase Auth integration | 🏗️ ARCHITECTURE READY | Demo user hardcoded |
| Execution Engine | 🏗️ ARCHITECTURE READY | Phase 13 |
| External provider execution | ❌ DO NOT BUILD | Not in scope |
| T3N production dependency | ❌ DO NOT BUILD | Not required |
| HI LIT / HELLO LIT integration | ❌ DO NOT BUILD | Separate products |
| Full ERP/CRM/HRMS | ❌ DO NOT BUILD | Out of scope |

---

## Classification Summary

| Component | Status |
|-----------|--------|
| Approval model/lifecycle | ✅ BUILD |
| Authorization engine | ✅ BUILD |
| Risk policy (L0-L4) | ✅ BUILD |
| Scoped approval | ✅ BUILD |
| Standing authorization foundation | ✅ BUILD |
| Payment approval enforcement | ✅ BUILD |
| Agent authority enforcement | ✅ BUILD |
| Approval APIs | ✅ BUILD |
| Audit events | ✅ BUILD |
| Decision Center integration | ✅ BUILD |
| UI approval states | ✅ BUILD |
| Tests | ✅ BUILD |
| Execution Engine | 🏗️ ARCHITECTURE READY |
| External execution | ❌ DO NOT BUILD |
| Database persistence | 🏗️ ARCHITECTURE READY |

---

## Next Steps (Phase 13)

Phase 13 will build the **Execution Engine** that takes authorized actions and executes them via external integrations (payment gateways, ad platforms, email providers, etc.) — but only after the full authorization chain passes.

---

**Phase 12: ✅ PASS (Final)**

**148/148 tests passing. TypeScript clean. Build clean.**  
**STOP — Do not start Phase 13 automatically.**