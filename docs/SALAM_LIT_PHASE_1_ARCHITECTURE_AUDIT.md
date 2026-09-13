# SALAM LIT — Phase 1 Architecture Audit

**Date:** 2026-09-07
**Scope:** Full repository inspection of both `ai-business-analyst` and `hello-lit` repositories
**Auditor:** Senior Principal Engineer

---

## 1. Executive Summary

**PHASE 1 STATUS: 🟡 BLOCKED — Requires Human Decision Before Phase 2**

Two repositories exist with the "LIT" name:

| Repository | Location | Purpose | Maturity |
|-----------|----------|---------|----------|
| `ai-business-analyst` | `/Users/ernianwar/Documents/ai-business-analyst/` | SALAM LIT — Agentic AI Business Opportunity Scout MVP | **Prototype** (5 commits, single page, no auth, no DB) |
| `hello-lit` | `/Users/ernianwar/Projects/hello-lit/` | Hello LIT — Full CRM/Training/Proposal SaaS platform | **Production-grade** (32+ migrations, full auth/RBAC, 50+ API routes, extensive tests) |

**Critical finding:** The `hello-lit` repository contains a mature, production-grade SaaS platform with Supabase auth, PostgreSQL RLS, RBAC, multi-tenant architecture, CRM, invoicing, training programs, proposals, quotations, payments, automation engine, AI integration, and comprehensive security testing. The `ai-business-analyst` repository is a minimal prototype with a single page and a Tavily API integration.

**The Master Build Specification was NOT found in either repository.** It was referenced as an attachment but does not exist on disk. The specification details were provided in the user's message text.

**BLOCKER:** Before any Phase 2 implementation begins, the following must be decided:

1. Which repository is the primary SALAM LIT codebase?
2. Should `hello-lit` infrastructure be adopted, extended, or ignored?
3. Where is the `SALAM_LIT_Master_Build_Specification_v1.0.md` file?
4. Where is the Virtual AI Business Office visual reference image?

---

## 2. Repository Structure

### 2.1 ai-business-analyst (SALAM LIT Prototype)

```
ai-business-analyst/
├── app/
│   ├── api/research/
│   │   ├── route.ts              # Tavily Research API integration (559 lines)
│   │   └── route.backup.ts       # Backup of older Tavily search approach
│   ├── favicon.ico
│   ├── globals.css               # Minimal Tailwind setup
│   ├── layout.tsx                # Root layout (Montserrat font)
│   ├── page.tsx                  # Main UI — single-page opportunity scout
│   └── page.tsx.backup           # Backup of older client-side approach
├── public/
│   ├── file.svg, globe.svg, next.svg, vercel.svg, window.svg
├── .env.local                    # TAVILY_API_KEY (exposed in repo)
├── .gitignore
├── AGENTS.md                     # Next.js agent rules
├── CLAUDE.md
├── eslint.config.mjs
├── LICENSE                       # MIT
├── next.config.ts                # Empty config
├── package.json                  # Next.js 16.2.10, React 19.2.4, Tailwind 4
├── postcss.config.mjs
├── README.md
├── tsconfig.json
└── tsconfig.tsbuildinfo
```

**Total source files:** 4 (route.ts, route.backup.ts, page.tsx, page.tsx.backup)
**Total lines of production code:** ~750

### 2.2 hello-lit (Full SaaS Platform)

```
hello-lit/
├── src/
│   ├── app/
│   │   ├── (app)/                 # Authenticated app routes
│   │   │   ├── activities/        # Activity management
│   │   │   ├── analytics/         # Analytics dashboard
│   │   │   ├── assessments/       # TNA assessments
│   │   │   ├── automation/        # Automation inbox
│   │   │   ├── branding/          # Brand management
│   │   │   ├── challenges/        # Training challenges
│   │   │   ├── challenge-assignments/
│   │   │   ├── companies/         # Company management
│   │   │   ├── components/        # App nav, logout
│   │   │   ├── contacts/          # Contact management
│   │   │   ├── crm/               # CRM activity forms/timeline
│   │   │   ├── dashboard/         # Main dashboard
│   │   │   ├── documents/         # Document management
│   │   │   ├── invoices/          # Invoice management
│   │   │   ├── leads/             # Lead management + import
│   │   │   ├── participants/      # Participant management
│   │   │   ├── proposals/         # AI proposal generation
│   │   │   ├── quotations/        # Quotation management
│   │   │   ├── settings/          # Plan, tax settings
│   │   │   └── training-programs/ # Full training program management
│   │   ├── (auth)/                # Auth routes
│   │   │   ├── login/, signup/, forgot-password/, reset-password/, verify/
│   │   │   └── layout.tsx
│   │   ├── api/                   # 50+ API routes
│   │   │   ├── activities/, analytics/, auth/, automation/
│   │   │   ├── brand-profile/, challenge-assignments/, challenges/
│   │   │   ├── companies/, contacts/, csp-report/, dashboard/
│   │   │   ├── documents/, health/, ingest/, invoices/
│   │   │   ├── lead-sources/, leads/, participants/
│   │   │   ├── proposals/, quotations/, settings/, tax/
│   │   │   ├── test/, tna/, training-programs/
│   │   │   └── ...
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── print/                 # Print views for proposals/payments
│   ├── components/
│   │   ├── brand.tsx, empty-state.tsx, landing/reveal.tsx
│   ├── lib/
│   │   └── supabase-client.ts
│   ├── modules/                   # Business logic modules
│   │   ├── auth/                  # Auth service, org context
│   │   ├── automation/            # Automation engine, service, types
│   │   ├── billing/               # Capacity, features, types
│   │   ├── commercial/            # Money, tax, totals
│   │   ├── communication/         # Email service
│   │   ├── crm/                   # Activity, analytics, import, service, types
│   │   ├── documents/             # Service, types
│   │   ├── entitlement/           # Service, types
│   │   ├── evidence/              # Service, types
│   │   ├── hrdc/                  # Bundle, claim-package, export, readiness
│   │   ├── ingest/                # Service, sources, types
│   │   ├── invoice/               # Numbering, service, types
│   │   ├── payment/               # Receipt, service, types
│   │   ├── proposal/              # AI generation, generation, pricing, service, types
│   │   ├── quotation/             # Service, types
│   │   ├── reports/               # Service
│   │   ├── tna/                   # AI, framework, gap, scoring, service, types
│   │   └── training/              # Service, types
│   ├── server/                    # Server-side infrastructure
│   │   ├── ai/                    # AI config, provider, schema, service
│   │   ├── api-handler.ts, csp.ts, email-templates.ts
│   │   ├── extract/, logger.ts, mailer.ts
│   │   ├── observability/         # Sentry integration
│   │   ├── rate-limit.ts, safe-errors.ts, security-events.ts
│   │   ├── server-context.ts, service-client.ts
│   │   ├── storage.ts, supabase-server.ts
│   │   └── ...
│   └── proxy.ts
├── supabase/
│   ├── migrations/                # 32 SQL migration files
│   └── .temp/
├── tests/
│   ├── e2e/                       # Playwright E2E tests (auth, CRM, HRDC, lifecycle, sales, training)
│   ├── security/                  # 40+ security test files
│   └── unit/                      # 25+ unit test files
├── scripts/
├── docs/
├── public/
├── .env.example, .env.local
├── package.json                   # Next.js 16.3.0, Supabase SSR, ExcelJS, PDFKit, etc.
├── vitest.config.ts, playwright.config.ts
├── tsconfig.json
└── SECURITY_REVIEW.md             # Comprehensive security audit (341 lines)
```

**Total source files:** 150+
**Total lines of production code:** 15,000+
**Total test files:** 65+
**Total SQL migrations:** 32

---

## 3. Existing Technology Stack

### 3.1 ai-business-analyst

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.10 |
| Language | TypeScript | ^5 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS | v4 |
| AI/Research | Tavily Research API | External |
| Database | None | — |
| Auth | None | — |
| Hosting | Local / Vercel | — |

### 3.2 hello-lit

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | ^16.3.0 |
| Language | TypeScript | ^5.5.0 |
| UI | React | ^19.2.8 |
| Database | PostgreSQL (via Supabase) | — |
| Auth | Supabase Auth (Email + OTP/2FA) | @supabase/ssr ^0.12.4 |
| ORM/Client | @supabase/supabase-js | ^2.112.2 |
| Testing | Vitest (unit/security) + Playwright (E2E) | ^2.1.0 / ^1.62.1 |
| PDF | PDFKit | ^0.20.1 |
| Excel | ExcelJS | ^4.4.0 |
| ZIP | JSZip | ^3.10.1 |
|Doc parsing | Mammoth (DOCX), unpdf | ^1.12.1 / ^1.8.1 |
| Observability | Sentry | Integrated |
| Security | CSP, rate limiting, RLS, RBAC | Custom + PostgreSQL |

---

## 4. Existing Architecture

### 4.1 ai-business-analyst

**Architecture: Single-page prototype**

```
Browser → page.tsx (client component)
       → /api/research (Next.js API route)
       → Tavily Research API
       → Response → Rendered as Opportunity Brief
```

- No server-side rendering beyond API routes
- No persistent state
- No user management
- No data persistence
- Single API endpoint
- Backup files suggest earlier client-side approach was refactored to server-side

### 4.2 hello-lit

**Architecture: Multi-tenant SaaS with defense-in-depth**

```
Browser → (auth)/layout.tsx → Login/Signup/OTP
       → (app)/layout.tsx → Authenticated App
       → API routes → api-handler.ts → server-context.ts
                   → supabase-server.ts (RLS-enforced)
                   → service-client.ts (service_role, limited use)
       → PostgreSQL (RLS policies)
       → Supabase Storage
```

**Key architectural patterns:**
- **Two Supabase clients:** Browser client (RLS-enforced) + Service client (bypasses RLS, used only for provisioning)
- **Server context:** Extracts user + org from JWT, enforces tenant isolation
- **API handler pattern:** Centralized request handling with auth checks
- **Module-based business logic:** Each domain (CRM, invoicing, training, etc.) has its own module with service/types separation
- **Automation engine:** Background job processing with approval gates
- **AI integration:** Server-side AI provider abstraction

---

## 5. Existing Database Architecture

### 5.1 ai-business-analyst

**No database.** All data is ephemeral (request/response only).

### 5.2 hello-lit

**32 SQL migrations** covering:

| Migration | Purpose |
|-----------|---------|
| `baseline_public_auth.sql` | Auth tables, Supabase GoTrue |
| `cp1_tenant_identity_orgs_roles_rls.sql` | Multi-tenant orgs, roles, RBAC, RLS |
| `cp2_crm_companies_contacts_leads.sql` | CRM core entities |
| `cp3_auth_ingest_sources.sql` | Lead ingest sources |
| `cp4_tna_assessment.sql` | Training Needs Assessment |
| `cp5_proposal.sql` | Proposal management |
| `cp6_quotation.sql` | Quotation management |
| `cp7_invoice.sql` | Invoice management |
| `cp8_payments.sql` | Payment tracking |
| `cp10_learning_gain.sql` | Learning outcome tracking |
| `cp11_evidence_validation.sql` | Evidence validation |
| `auth_otp_2fa.sql` | OTP/2FA authentication |
| `documents_infrastructure.sql` | Document storage |
| `entitlement_ai_usage_foundation.sql` | Plan entitlements, AI usage tracking |
| `automation_engine_foundation.sql` | Automation engine |
| `commercial_entitlement_enforcement.sql` | Commercial plan enforcement |
| `crm_lifecycle_hardening.sql` | CRM data integrity |
| `lead_import.sql` | Lead import system |
| `crm_activities.sql` | CRM activity tracking |
| ... and 13 more |

**Key tables (inferred from migrations):**
- `organizations` — Multi-tenant orgs
- `memberships` — User-org associations with roles
- `roles` + `role_permissions` — RBAC
- `companies`, `contacts`, `leads` — CRM
- `training_programs`, `enrollments`, `challenges` — Training
- `proposals`, `quotations`, `invoices`, `payments` — Commercial
- `tna_assessments`, `tna_responses` — Training Needs Assessment
- `documents` — Document management
- `automation_runs`, `automation_emails` — Automation
- `org_tax_profiles` — Tax configuration
- `brand_profiles` — Branding

---

## 6. Existing Authentication

### 6.1 ai-business-analyst

**None.** No authentication of any kind.

### 6.2 hello-lit

**Production-grade authentication:**

| Feature | Status | Evidence |
|---------|--------|----------|
| Email + Password sign-up | ✅ Implemented | `signup/route.ts` |
| OTP/2FA verification | ✅ Implemented | `auth_otp_2fa.sql`, `verify-otp/route.ts` |
| Password reset | ✅ Implemented | `forgot-password/route.ts` |
| Session management | ✅ Implemented | `supabase-server.ts` with `@supabase/ssr` |
| Rate limiting | ✅ Implemented | Per-endpoint rate limits |
| Account enumeration prevention | ✅ Implemented | Generic error messages |
| Cookie security | ✅ Implemented | httpOnly, secure, SameSite |

**Security audit findings (SECURITY_REVIEW.md):**
- **No BLOCKER findings**
- 4 NON-BLOCKING findings (OTP lifetime, brute-force protection, session fixation, device fingerprinting)
- 4 DEFERRED findings (session timeout, service role client, reset flow, device fingerprinting)

---

## 7. Existing Authorization / RLS

### 7.1 ai-business-analyst

**None.** No authorization or RLS.

### 7.2 hello-lit

**Two-wall defense-in-depth:**

1. **Primary Wall (Database):** PostgreSQL Row Level Security (RLS)
   - `current_org_id()` derived from JWT `app_metadata.organization_id`
   - All tables scoped to org
   - Enforced at database layer

2. **Secondary Wall (Application):** `org_has_permission()` SECURITY DEFINER function
   - Checks role-based permissions
   - Applied in service layer

**RBAC model:**
- Organizations → Memberships → Roles → Permissions
- Role-based access control with permission matrix
- UX gating via TypeScript capability matrix (convenience only, not security)

---

## 8. Existing AI Architecture

### 8.1 ai-business-analyst

**Tavily Research API integration:**

```
POST /api/research
  → createResearchTask(idea, apiKey) → Tavily Research endpoint
  → waitForResearch(requestId, apiKey) → Poll for completion
  → Parse structured output (dimensions, evidence, sources)
  → Calculate weighted score
  → Return Opportunity Brief
```

- Uses Tavily's structured research output
- 6-dimension scoring model (Market Demand, Customer Pain, Revenue Potential, Competitive Opportunity, Market Growth, Execution Feasibility)
- Evidence-based source quality normalization
- Backup file shows earlier approach using Tavily Search API directly

### 8.2 hello-lit

**Server-side AI abstraction:**

```
src/server/ai/
├── config.ts       # AI configuration
├── index.ts        # AI module exports
├── provider.ts     # AI provider abstraction
├── schema.ts       # AI response schemas
└── service.ts      # AI service layer
```

**AI usage in business logic:**
- `src/modules/proposal/ai-generation.ts` — AI-powered proposal generation
- `src/modules/tna/ai.ts` — AI-powered Training Needs Assessment
- `src/modules/automation/training-report.ts` — Automated training reports

**AI usage tracking:**
- `entitlement_ai_usage_foundation.sql` — Tracks AI usage per org
- Entitlement system controls AI feature access

---

## 9. Existing UI Architecture

### 9.1 ai-business-analyst

**Single-page client component:**

```
app/page.tsx (187 lines)
├── Header: "SALAM LIT — Agentic AI Business Opportunity Intelligence"
├── Input: Textarea for business opportunity description
├── Button: "RUN SALAM LIT"
├── Approval checkpoint (conditional)
├── Error display (conditional)
├── Two-column grid:
│   ├── Left: Agent Activity panel + Research Plan
│   └── Right: Opportunity Brief (score, confidence, verdict, etc.)
```

- Client-side state management (useState)
- Tailwind CSS styling
- Montserrat font
- Color scheme: #faf7f2 background, #DD7430 accent
- Rounded-3xl card design

### 9.2 hello-lit

**Full SaaS UI:**

```
src/app/(auth)/
├── layout.tsx          # Auth layout
├── login/page.tsx      # Login page
├── signup/page.tsx     # Signup page
├── verify/             # OTP verification
├── forgot-password/    # Password reset
└── reset-password/     # Password reset completion

src/app/(app)/
├── layout.tsx          # App layout with nav
├── dashboard/          # Main dashboard
├── companies/          # Company CRUD
├── contacts/           # Contact CRUD
├── leads/              # Lead management + import
├── crm/                # CRM activity forms/timeline
├── training-programs/  # Full training program management
├── proposals/          # AI proposal generation
├── quotations/         # Quotation management
├── invoices/           # Invoice management
├── documents/          # Document management
├── assessments/        # TNA assessments
├── challenges/         # Training challenges
├── automation/         # Automation inbox
├── analytics/          # Analytics dashboard
├── branding/           # Brand management
├── settings/           # Plan + tax settings
└── components/         # Shared app components
```

**UI patterns:**
- Server components by default, client components when needed
- Form components with validation
- Data tables with CRUD operations
- Print views for proposals/payments
- Responsive design

---

## 10. Existing Virtual Office / Character System

### 10.1 ai-business-analyst

**None.** No character system, no virtual office, no AI workforce visualization.

The UI has a simple "Agent Activity" panel showing:
- Objective received ✓
- Research plan created ✓
- Researching (active/done/idle)
- Analyzing (active/done/idle)
- Generating recommendation (active/done/idle)

This is a basic progress indicator, not a virtual office experience.

### 10.2 hello-lit

**None.** No character system or virtual office implementation.

The UI is a conventional SaaS dashboard with sidebar navigation, data tables, forms, and CRUD operations.

---

## 11. Existing Integrations

### 11.1 ai-business-analyst

| Integration | Status | Evidence |
|------------|--------|----------|
| Tavily Research API | ✅ Working | `route.ts` — creates research tasks, polls for completion |
| Web search | ⚠️ Conditional | Falls back to demo mode if API key missing |

### 11.2 hello-lit

| Integration | Status | Evidence |
|------------|--------|----------|
| Supabase Auth | ✅ Working | Full auth flow with OTP/2FA |
| Supabase Database | ✅ Working | 32 migrations, RLS policies |
| Supabase Storage | ✅ Working | Document storage |
| AI Provider | ✅ Working | Server-side AI abstraction |
| Email Service | ✅ Working | Email templates, mailer |
| Sentry | ✅ Working | Observability integration |
| PDF Generation | ✅ Working | PDFKit integration |
| Excel Export | ✅ Working | ExcelJS integration |
| ZIP Export | ✅ Working | JSZip integration |
| DOCX Parsing | ✅ Working | Mammoth integration |

---

## 12. Existing Testing

### 12.1 ai-business-analyst

**No tests.** No test files, no test configuration, no test scripts.

### 12.2 hello-lit

**Comprehensive test suite:**

| Test Type | Count | Framework | Coverage |
|-----------|-------|-----------|----------|
| Unit tests | 25+ | Vitest | Business logic modules |
| Security tests | 40+ | Vitest | Auth, RLS, RBAC, isolation, XSS, CSRF |
| E2E tests | 15+ | Playwright | Auth, CRM, HRDC, lifecycle, sales, training |

**Test scripts:**
```json
"test": "vitest run",
"test:sec": "vitest run tests/security",
"test:unit": "vitest run tests/unit",
"test:coverage": "vitest run tests/unit --coverage",
"test:e2e": "npx playwright test"
```

**Security test coverage includes:**
- Auth flow testing
- OTP bypass testing
- RLS isolation testing
- CRM/isolation testing
- CSRF protection
- XSS protection
- Payment isolation
- Entitlement enforcement
- AI foundation security

---

## 13. Existing Security

### 13.1 ai-business-analyst

**No security controls.** No auth, no RLS, no rate limiting, no CSP, no security headers.

**Security risk:** `.env.local` with `TAVILY_API_KEY` is committed to git (though `.gitignore` lists `.env*`, the file exists in the repo).

### 13.2 hello-lit

**Production-grade security:**

| Control | Status | Evidence |
|---------|--------|----------|
| Authentication | ✅ | Email + password + OTP/2FA |
| Authorization | ✅ | RBAC with role_permissions |
| RLS | ✅ | PostgreSQL Row Level Security on all tables |
| Rate limiting | ✅ | Per-endpoint rate limits |
| CSP | ✅ | Content Security Policy reporting |
| Session security | ✅ | httpOnly, secure, SameSite cookies |
| Input validation | ✅ | Server-side validation |
| Error handling | ✅ | Generic error messages, no info leakage |
| Service role isolation | ✅ | Limited use, client-side exclusion |
| Security audit | ✅ | 341-line SECURITY_REVIEW.md |

---

## 14. Existing Working Features

### 14.1 ai-business-analyst

| Feature | Status | Classification |
|---------|--------|---------------|
| Business opportunity input | ✅ Working | BUILD |
| Research plan generation | ✅ Working | BUILD |
| Tavily Research API integration | ✅ Working | BUILD |
| 6-dimension scoring | ✅ Working | BUILD |
| Opportunity Brief rendering | ✅ Working | BUILD |
| Agent activity display | ⚠️ Mock only | MOCK ONLY |
| Approval checkpoint | ✅ Working | BUILD |
| Demo mode fallback | ✅ Working | BUILD |

### 14.2 hello-lit

| Feature | Status | Classification |
|---------|--------|---------------|
| Multi-tenant auth (email + OTP/2FA) | ✅ Working | BUILD |
| Organization management | ✅ Working | BUILD |
| RBAC with permissions | ✅ Working | BUILD |
| Company management | ✅ Working | BUILD |
| Contact management | ✅ Working | BUILD |
| Lead management + import | ✅ Working | BUILD |
| CRM activities + timeline | ✅ Working | BUILD |
| CRM analytics | ✅ Working | BUILD |
| Training program management | ✅ Working | BUILD |
| TNA assessments | ✅ Working | BUILD |
| AI proposal generation | ✅ Working | BUILD |
| Quotation management | ✅ Working | BUILD |
| Invoice management | ✅ Working | BUILD |
| Payment tracking | ✅ Working | BUILD |
| Document management | ✅ Working | BUILD |
| HRDC claim package | ✅ Working | BUILD |
| Automation engine | ✅ Working | BUILD |
| Email service | ✅ Working | BUILD |
| Entitlement system | ✅ Working | BUILD |
| Brand profiles | ✅ Working | BUILD |
| Tax profiles | ✅ Working | BUILD |
| Print views | ✅ Working | BUILD |
| PDF export | ✅ Working | BUILD |
| Excel export | ✅ Working | BUILD |
| ZIP export | ✅ Working | BUILD |

---

## 15. Existing Partial Features

### 15.1 ai-business-analyst

| Feature | Status | Notes |
|---------|--------|-------|
| Agent activity panel | Partial | Static progress list, not real-time agent status |
| Research plan | Partial | Keyword-based plan building, not AI-generated |
| Demo mode | Partial | Hardcoded fallback, not a proper demo system |

### 15.2 hello-lit

| Feature | Status | Notes |
|---------|--------|-------|
| AI proposal generation | Partial | Works but may need tuning for SALAM LIT context |
| TNA AI recommendations | Partial | Works but specific to training context |
| Automation engine | Partial | Foundation laid, may need extension for AI workforce |

---

## 16. Missing Features

### For SALAM LIT (comparing ai-business-analyst to Master Build Specification)

| Missing Feature | Priority | Classification |
|----------------|----------|---------------|
| **Virtual AI Office experience** | Critical | BUILD |
| **AI Workforce characters (ZUE, ERNI, SHEERA, EDDY, CAROL, AYUNI, ALEX, TEHNA, KOPI, ADIK)** | Critical | BUILD |
| **Character rendering architecture** | Critical | BUILD |
| **Contextual speech bubbles** | Critical | BUILD |
| **Real business event → speech bubble pipeline** | Critical | BUILD |
| **Proactive work engine** | Critical | BUILD |
| **Character status system** | Critical | BUILD |
| **Business profile intake** | High | BUILD |
| **Multi-agent orchestration (ZUE as orchestrator)** | High | BUILD |
| **Specialist AI agents** | High | BUILD |
| **Business health pulse** | High | BUILD |
| **Conversation memory** | High | BUILD |
| **Supabase integration** | High | BUILD |
| **Authentication** | High | BUILD |
| **User/business data persistence** | High | BUILD |
| **Owner presence (Alberto)** | Medium | BUILD |
| **Research layer** | Medium | BUILD |
| **Execution layer** | Low | DO NOT BUILD YET |
| **Meta Ads integration** | Low | DO NOT BUILD YET |
| **Character asset system** | Medium | BUILD (architecture only) |
| **/public/assets/workforce/ structure** | Medium | BUILD |

### For hello-lit (comparing to SALAM LIT requirements)

| Missing Feature | Priority | Classification |
|----------------|----------|---------------|
| **Virtual AI Office UI** | Critical | BUILD |
| **AI workforce character system** | Critical | BUILD |
| **Character state management** | Critical | BUILD |
| **Speech bubble system** | Critical | BUILD |
| **Business context model** | High | BUILD |
| **AI orchestrator (ZUE)** | High | BUILD |
| **Business health pulse** | High | BUILD |
| **Owner decision authority model** | Medium | BUILD |

---

## 17. Architecture Conflicts

### 17.1 ai-business-analyst vs Master Build Specification

| Conflict | Severity | Resolution |
|----------|----------|-----------|
| No authentication | High | Must add Supabase auth |
| No database | High | Must add Supabase DB + RLS |
| No user model | High | Must add user/business model |
| Single-page app | Medium | Must restructure for multi-view office |
| Tavily-only research | Medium | Must add direct web search + official sources |
| No character system | Critical | Must build from scratch |
| No virtual office UI | Critical | Must build from scratch |
| No agent orchestration | Critical | Must build from scratch |
| No business context | High | Must add business profile model |
| No conversation memory | High | Must add persistent conversation storage |

### 17.2 hello-lit vs SALAM LIT Requirements

| Conflict | Severity | Resolution |
|----------|----------|-----------|
| Conventional SaaS UI (not virtual office) | Critical | Must build virtual office overlay or replacement |
| No AI workforce characters | Critical | Must add character system |
| No speech bubble system | Critical | Must add speech bubble system |
| No proactive work engine | High | Must add event-driven proactive system |
| CRM-focused data model | Medium | Must extend for business intelligence context |
| Training-focused features | Low | Can be repurposed or ignored |

### 17.3 Cross-Repository Conflicts

| Conflict | Severity | Resolution |
|----------|----------|-----------|
| Two separate repositories | High | Must decide: merge, adopt one, or keep separate |
| Different Next.js versions (16.2.10 vs 16.3.0) | Low | Use hello-lit's newer version |
| Different dependencies | Medium | Consolidate |
| Different security postures | High | Use hello-lit's security model |

---

## 18. Technical Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Character asset system is undefined** | High | Build replaceable asset architecture per spec |
| **Speech bubble content generation may be expensive** | Medium | Implement caching + throttling |
| **Multi-agent orchestration complexity** | High | Start with single agent, add complexity incrementally |
| **Tavily API costs at scale** | Medium | Add caching, implement usage limits |
| **Supabase free tier limitations** | Medium | Monitor usage, plan upgrade path |
| **AI model API costs** | Medium | Implement usage tracking + entitlements (hello-lit has this) |
| **Real-time character status updates** | Medium | Use Supabase Realtime or polling |
| **Asset management for 10 characters** | Low | Build asset reference system, defer final assets |

---

## 19. Security Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **AI agents must not bypass authorization** | Critical | Enforce via RLS + server-side checks (hello-lit pattern) |
| **AI must not approve own consequential actions** | Critical | Implement approval gate (hello-lit automation pattern) |
| **Secrets must not be exposed to browser** | Critical | Server-side only API routes (hello-lit pattern) |
| **Business data must be tenant-isolated** | Critical | RLS + org_id scoping (hello-lit pattern) |
| **Ethnicity data collection** | High | PDPA compliance review required |
| **AI inference presented as fact** | Medium | Evidence provenance tracking (hello-lit evidence module) |

---

## 20. Technical Debt

### 20.1 ai-business-analyst

| Debt | Severity | Notes |
|------|----------|-------|
| Backup files in production | Low | `route.backup.ts`, `page.tsx.backup` should be removed or archived |
| No tests | High | Zero test coverage |
| No type safety for API responses | Medium | Uses `any` types extensively |
| Hardcoded demo input | Low | Should be configurable |
| `.env.local` in git | Medium | Security risk — API key exposed |

### 20.2 hello-lit

| Debt | Severity | Notes |
|------|----------|-------|
| Large migration set (32 files) | Low | Consider squashing for new deployments |
| Some `any` types in modules | Low | Type safety could be improved |
| Automation engine complexity | Medium | Well-structured but complex — needs documentation |

---

## 21. Recommended Implementation Order

Based on the Master Build Specification and existing codebase:

### Phase 2A: Foundation (Week 1-2)

1. **Decide repository strategy** — BLOCKER: adopt hello-lit, merge, or rebuild?
2. **Add business profile model** — Extend Supabase schema for business context
3. **Add user→business mapping** — Connect users to business profiles
4. **Build character asset architecture** — `/public/assets/workforce/` with replaceable references
5. **Build character state system** — AVAILABLE, WORKING, THINKING, etc.

### Phase 2B: Virtual Office UI (Week 2-4)

6. **Build spatial office environment** — Main experience layout
7. **Build character rendering** — positioned AI workforce in office
8. **Build speech bubble system** — Contextual, event-driven
9. **Build owner presence** — Alberto's desk/position
10. **Build activity awareness** — What each agent is doing

### Phase 2C: AI Orchestration (Week 3-5)

11. **Implement ZUE orchestrator** — Route tasks to specialist agents
12. **Implement ERNI** — Business Intelligence & Strategy
13. **Implement basic agent routing** — Start with 2-3 agents
14. **Build proactive work engine** — Real events → agent activity → speech bubbles
15. **Build conversation memory** — Persistent business context

### Phase 2D: Agent Expansion (Week 5-8)

16. **Implement SHEERA** — Marketing & Creative
17. **Implement EDDY** — Sales & Opportunity Intelligence
18. **Implement CAROL** — Finance & Accounting
19. **Implement AYUNI** — HR & People Operations
20. **Implement ALEX** — Funding & Growth Intelligence
21. **Implement TEHNA** — Operations Intelligence

### Phase 2E: Polish & Security (Week 7-9)

22. **Implement KOPI** — Security Guardian
23. **Implement ADIK** — Office Companion
24. **Add comprehensive tests** — Adapt hello-lit test patterns
25. **Security hardening** — Apply hello-lit security model
26. **Performance optimization** — Caching, throttling, monitoring

---

## 22. Files That Should Be Preserved

### ai-business-analyst

| File | Reason |
|------|--------|
| `app/api/research/route.ts` | Core Tavily integration — useful reference for research layer |
| `app/page.tsx` | UI reference for opportunity brief layout |
| `app/layout.tsx` | Root layout pattern |
| `app/globals.css` | Tailwind configuration |
| `package.json` | Dependency reference |
| `tsconfig.json` | TypeScript configuration |
| `LICENSE` | MIT license |

### hello-lit

| File | Reason |
|------|--------|
| **ALL of `src/`** | Production-grade SaaS infrastructure |
| **ALL of `supabase/migrations/`** | Database schema + RLS |
| **ALL of `tests/`** | Comprehensive test suite |
| `src/server/ai/*` | AI provider abstraction |
| `src/modules/automation/*` | Automation engine |
| `src/modules/entitlement/*` | Entitlement system |
| `SECURITY_REVIEW.md` | Security audit |
| `vitest.config.ts` | Test configuration |
| `playwright.config.ts` | E2E test configuration |

---

## 23. Files That Require Modification

### If adopting hello-lit as base

| File | Modification |
|------|-------------|
| `src/app/(app)/layout.tsx` | Add virtual office layout option |
| `src/app/(app)/dashboard/page.tsx` | Replace with virtual office experience |
| `supabase/migrations/` | Add business profile, character state, speech bubble tables |
| `src/modules/` | Add AI workforce module |
| `src/server/ai/` | Extend for multi-agent orchestration |

### If extending ai-business-analyst

| File | Modification |
|------|-------------|
| `app/page.tsx` | Complete rewrite for virtual office |
| `app/api/research/route.ts` | Extend for multi-agent orchestration |
| `package.json` | Add Supabase, auth, database dependencies |
| `app/layout.tsx` | Add auth layout |

---

## 24. Files That Can Be Deprecated

### ai-business-analyst

| File | Reason |
|------|--------|
| `app/page.tsx.backup` | Outdated client-side approach |
| `app/api/research/route.backup.ts` | Outdated Tavily search approach |

---

## 25. Files That Should NOT Be Touched Yet

| File/Feature | Reason |
|-------------|--------|
| hello-lit CRM modules | Not relevant to SALAM LIT core |
| hello-lit training modules | Not relevant to SALAM LIT core |
| hello-lit invoicing modules | Not relevant to SALAM LIT core |
| hello-lit HRDC modules | Not relevant to SALAM LIT core |
| Execution layer (Meta Ads, content generation) | Per spec: DO NOT BUILD YET |
| SALAM LIT wallet/bank/card system | Per spec: DO NOT BUILD YET |
| HI LIT integration | Per spec: DO NOT BUILD YET |
| Full ERP/CRM/accounting replacement | Per spec: DO NOT BUILD YET |
| Production T3N dependency | Per spec: DO NOT BUILD YET |

---

## Classification Summary

| Capability | Classification |
|-----------|---------------|
| Authentication (Supabase) | **BUILD** |
| Business onboarding | **BUILD** |
| Business profile intake | **BUILD** |
| Virtual AI Office experience | **BUILD** |
| Character rendering architecture | **BUILD** |
| Character state system | **BUILD** |
| Speech bubble system | **BUILD** |
| ZUE orchestrator | **BUILD** |
| Specialist AI agents (ERNI, SHEERA, EDDY, etc.) | **BUILD** |
| Proactive work engine | **BUILD** |
| Conversation memory | **BUILD** |
| Business health pulse | **BUILD** |
| Owner presence (Alberto) | **BUILD** |
| Research layer | **BUILD** |
| Character asset system | **ARCHITECTURE READY** |
| Future HI LIT provider boundary | **ARCHITECTURE READY** |
| Execution layer (content, docs, campaigns) | **DO NOT BUILD** |
| Meta Ads integration (MCP) | **DO NOT BUILD** |
| Direct HI LIT database integration | **DO NOT BUILD** |
| SALAM LIT wallet/bank/card system | **DO NOT BUILD** |
| Unrestricted autonomous financial agent | **DO NOT BUILD** |
| Fake cyber monitoring | **NEVER FAKE** |
| Fake business health score | **NEVER FAKE** |
| Fake AI workforce activity | **NEVER FAKE** |
| Fake external execution | **NEVER FAKE** |
| Fake financial calculations | **NEVER FAKE** |

---

## BLOCKER Items Requiring Human Decision

1. **Which repository is the primary SALAM LIT codebase?**
   - Option A: Adopt `hello-lit` as the base (recommended — has auth, DB, RBAC, tests)
   - Option B: Extend `ai-business-analyst` (would require building auth/DB/RBAC from scratch)
   - Option C: Merge relevant parts of both
   - Option D: Start fresh (not recommended — wastes existing work)

2. **Where is `SALAM_LIT_Master_Build_Specification_v1.0.md`?**
   - Referenced as an attachment but not found on disk
   - Need the actual file to validate against

3. **Where is the Virtual AI Business Office visual reference image?**
   - Referenced as an attachment but not found on disk
   - Need the actual image for visual implementation guidance

4. **Should the virtual office replace or overlay the existing SaaS UI?**
   - hello-lit has a conventional SaaS dashboard
   - SALAM LIT requires a virtual office experience
   - These are fundamentally different UX paradigms

5. **What is the budget allocation for AI API costs?**
   - Multi-agent orchestration will increase API calls
   - Need cost projections before implementing

6. **Should ethnicity data collection be included?**
   - Master Build Specification mentions it
   - Previous validation flagged PDPA risk
   - Need explicit decision

---

*End of Phase 1 Architecture Audit*
