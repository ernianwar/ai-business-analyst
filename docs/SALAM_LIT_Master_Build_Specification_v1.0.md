# SALAM LIT Master Build Specification v1.0

**Status:** Architecture Locked / Master Source of Truth\
**Product:** SALAM LIT\
**Core Positioning:** AI Workforce for Business Growth & Execution

------------------------------------------------------------------------

## 1. Executive Product Definition

SALAM LIT is an **AI Business Decision & Execution Platform** for
founder-led and lean businesses.

It provides an AI workforce that understands business context,
investigates issues, identifies opportunities, recommends actions,
prepares work, executes authorized actions, monitors outcomes, and
learns from results.

> **You don't have to run the business alone.**

SALAM LIT is not merely an AI chatbot, dashboard, CRM, ERP, LMS, HRMS,
accounting replacement, or collection of disconnected AI tools.

------------------------------------------------------------------------

## 2. Product Philosophy & Core Principles

### AI has initiative. The owner has authority.

AI may detect, investigate, research, collaborate, recommend, prepare,
execute authorized work, monitor and learn. Consequential decisions
remain under authorized human control.

### Evidence before confidence

SALAM LIT distinguishes: - Fact - Calculation - Inference - Hypothesis -
Recommendation

Confidence is not truth.

### Never manufacture business truth

Missing information must be requested or marked unavailable. Conflicts
must be surfaced. Stale information must be marked stale. Weak evidence
must be disclosed.

### Recommendation is not decision

``` text
Finding → Insight → Recommendation → Decision → Approval → Action → Outcome → Learning
```

### Approval is not permission

Permission defines what an actor may do. Approval authorizes a specific
action and scope.

### Context before action

``` text
User Context
+ Workspace Context
+ Business Context
+ Market Context
+ Jurisdiction
+ Task Context
+ Data Permissions
        ↓
Context Resolution
        ↓
Zue / Specialist Agent
```

Country, business jurisdiction and target market are separate concepts.
Never assume Malaysia, US, MYR, USD, tax, employment or funding rules
without applicable context.

### Selective multi-agent collaboration

Zue should activate only relevant specialists. Do not invoke the whole
workforce for every problem.

### Central memory, controlled retrieval

Business memory is centrally governed. Agents receive only relevant,
authorized context.

### Proactive, not noisy

Priorities: - Critical - Important - Upcoming - Routine - Informational

### Real state only

Never fake AI activity, agent thinking, security monitoring, integration
success, execution, metrics, evidence, completion or health scores.

### Privacy by architecture

Use data minimization, purpose limitation, classification, consent,
access control, audit, retention/deletion, processor governance and
cross-border controls.

### Architectural simplicity

MVP uses **Modular Monolith + Asynchronous Workers**. PostgreSQL is the
system of record. Microservices are deferred until justified.

------------------------------------------------------------------------

## 3. Target Users & Commercial Model

### Primary target

-   Solopreneurs
-   Micro businesses
-   Founder-led SMEs
-   Lean teams
-   Businesses where the founder carries multiple functions

`<10 employees` is an ICP/marketing segmentation, not a technical limit.

### Subscription

Subscription is user-level. One account can manage multiple businesses
subject to plan entitlements.

### Workspace

Workspace is the collaboration and security boundary. Workspace
membership does not automatically grant unrestricted access to every
business.

### Business limits

  Plan         Maximum Businesses
  ---------- --------------------
  Free                          1
  Starter                       3
  Growth                        5
  Business                     10

These must be entitlement-driven, not hard-coded.

### Entitlement model

Potential entitlements: - `businesses.max` - `members.max` -
`ai.usage` - `documents.max` - `storage.max` - `integrations.max` -
`advanced_analytics` - `workflow.advanced` - `execution.external` -
`export.enabled` - `marketing.attribution.required`

Custom deals use `entitlement_overrides`.

### Free plan

Free provides genuine SALAM LIT value rather than an intentionally
useless demo.

Eligible public-facing AI-generated outputs from Free users carry:

> **Powered by SALAM LIT**

This applies across the AI workforce, not only Sheera.

Eligible examples: - posters - social creatives - videos - carousels -
public presentations - public proposals - public-facing AI-generated
business materials

Private/internal/confidential outputs should not automatically be
branded.

### Attribution removal

Free users cannot remove the attribution through SALAM LIT controls.
Attempting to remove it opens an upgrade/subscription gate.

For video, attribution is rendered into actual frames and may move
approximately every 3 seconds. The requirement is non-removable through
SALAM LIT controls and resistant to simple cropping/covering, not
mathematically impossible to remove with external editing tools.

### Product-led growth

``` text
Free User
 ↓
Uses AI Workforce
 ↓
Creates Useful Output
 ↓
Shares Output
 ↓
Powered by SALAM LIT
 ↓
Discovery
 ↓
Free → Paid
```

------------------------------------------------------------------------

## 4. AI Workforce Architecture

### Hierarchy

``` text
                         ZUE
              AI WORKFORCE MANAGER
                         │
        ┌────────────────┼───────────────────────────────┐
        │        │       │       │        │        │
        ▼        ▼       ▼       ▼        ▼        ▼
      ERNI    SHEERA    EDDY    CAROL    AYUNI    ALEX
    Business  Marketing Sales  Finance    HR     Funding
    Analyst   & Market  & Opp. & Acct.  People   & Growth
              Intelligence Intelligence Operations
                         │
                         ▼
                       TEHNA
                Operations Intelligence
```

Additional layers: - KOPI = AI Security Guardian - Adik = AI Office
Companion

### Zue

**AI Workforce Manager & Orchestrator**

Can: - understand - plan - route - coordinate - synthesize -
prioritize - present - monitor

Cannot: - bypass permissions - approve its own actions - invent
evidence - access unrestricted sensitive data - execute arbitrary tools

### Erni

**Business Intelligence & Strategy Specialist**

Business diagnosis, root-cause analysis, SWOT, BMC, USP, business health
analysis, opportunity identification, strategy, AI adoption readiness
and business intelligence.

### Sheera

**Marketing, Creative & Social Media Manager**

Market intelligence, customer trends, competitor marketing, positioning,
messaging, campaigns, content strategy, TOFU/MOFU/BOFU, content
calendars, copy, creative briefs, posters, carousels, image creatives,
short-form video concepts/scripts/shot lists/captions, social media,
advertising, analytics, social listening, paid campaign planning,
audience/budget/creative recommendations, monitoring and optimization.

MVP does not require a full professional video editor.

### Eddy

**Sales & Opportunity Intelligence Specialist**

Lead strategy, qualification, follow-up, funnel/conversion analysis,
forecasting, dormant lead/customer reactivation, objections,
acquisition, churn signals, upsell/cross-sell, opportunity discovery and
quotation/proposal workflows where integrated.

### Carol

**Finance & Accounting Intelligence Specialist**

Revenue, COGS, gross profit/margin, operating expenses, profitability,
cash flow, AR/AP, assets/liabilities, loans/financing, trends, financial
implications, invoice/expense/payment patterns, reconciliation support,
month-end close preparation, audit readiness, tax preparation support,
payroll/statutory reminders.

Carol does not replace licensed accountants, auditors, tax professionals
or statutory accounting systems.

### Ayuni

**HR & People Operations Specialist**

Employee records, onboarding/offboarding, probation, leave/attendance,
HR documents, workforce capacity, headcount planning, job descriptions,
recruitment workflows, candidate pipeline, interview coordination,
employee lifecycle, performance-cycle reminders and HR policy workflows.

Ayuni does not depend on HI LIT.

### Alex

**Funding & Growth Intelligence Specialist**

Grants, funding opportunities, eligibility, funding readiness, capital
strategy, loans/equity/investors, growth financing, expansion
opportunities and application preparation.

Funding recommendations must consider strategic fit, financial
readiness, research and jurisdiction.

### Tehna

**Operations Intelligence**

SOP management/versioning, process management, workflow governance, task
governance, approvals, SLA/deadline tracking, exception detection,
quality control and process compliance.

Future/reserved: procurement, suppliers, inventory, supply chain.

Tehna does not outrank Zue or the business owner.

### KOPI

**AI Security Guardian**

Actual security events only: authentication anomalies, authorization
failures, suspicious application activity, integration/token issues and
security policy violations.

### Adik

**AI Office Companion**

Greeting, contextual companionship and break suggestions based on actual
signals. Not part of business reasoning.

### Configurable names

Stable `agent_key` remains fixed. Display names are configurable per
workspace/business.

------------------------------------------------------------------------

## 5. Business Context & Global Jurisdiction

### Owner context

-   name
-   preferred name
-   role
-   communication preference
-   responsibilities
-   decision preference
-   country/home context
-   locale
-   timezone
-   default currency

### Business context

-   business name
-   SSM registration number where applicable
-   SSM registered address where applicable
-   office phone
-   SSM nature of business where applicable
-   business type
-   industry
-   location
-   registered country
-   operating country
-   jurisdiction
-   years operating
-   business stage
-   products/services
-   revenue sources
-   customer type
-   current challenge
-   biggest concern
-   founders/owners/decision-makers

### Goals

-   goal
-   target
-   timeline
-   priority

### Constraints

-   budget
-   team capacity
-   time
-   skills
-   technology
-   cash availability
-   operational limitations
-   AI adoption readiness

### Financial context

Revenue, COGS, gross profit, OPEX, net profit, AR, AP, cash, assets,
liabilities, financing and inventory as applicable.

Do not store monthly revenue directly in the core `businesses` table.

### Historical data

Support arbitrary historical periods. Do not hard-code a six-month
limit.

### Market profiles

Businesses can target multiple markets. A market profile may contain
country, region/state, locale, language, currency, timezone, formatting,
measurement system, marketing preferences, tax jurisdiction, target
audience and market status.

------------------------------------------------------------------------

## 6. Business Truth & Intelligence Contract

### Lifecycle

``` text
DATA SOURCE
 ↓
RAW DATA
 ↓
EVIDENCE
 ↓
BUSINESS FACT
 ↓
BUSINESS METRIC
 ↓
AGENT FINDING
 ↓
INSIGHT
 ↓
RECOMMENDATION
 ↓
DECISION
 ↓
ACTION
 ↓
OUTCOME
 ↓
LEARNING
```

### Epistemic levels

**Fact:** August revenue = RM80,000.

**Computed metric:** Revenue decreased 14%.

**Inference:** Revenue appears to have declined.

**Hypothesis:** The decline may be related to conversion.

**Recommendation:** Investigate the conversion funnel before increasing
ad spend.

### Freshness

-   CURRENT
-   STALE
-   UNKNOWN
-   UNAVAILABLE
-   SYNC_ERROR

### Fact lifecycle

-   ACTIVE
-   SUPERSEDED
-   HISTORICAL
-   EXPIRED
-   RETRACTED
-   CONFLICTED

### Conflict handling

Conflicting sources are retained and surfaced. The system must never
silently choose one.

### External research

Preserve source URL/reference, retrieved date, source type,
jurisdiction, relevant period, confidence and reliability.

### Classification

-   PUBLIC
-   INTERNAL
-   CONFIDENTIAL
-   SENSITIVE
-   RESTRICTED

Also distinguish PII and NON_PII.

------------------------------------------------------------------------

## 7. Memory Architecture

Central business memory is the source for shared context.

``` text
BUSINESS MEMORY
 ↓
SHARED CONTEXT
 ↓
PERMISSION FILTER
 ↓
ZUE
 ↓
SPECIALIST AGENT
```

### Decision memory

Remember issue, recommendation, decision, decision-maker, reason, date,
status and scope.

### Action memory

``` text
Recommendation
 ↓
Approved
 ↓
Task
 ↓
Assigned
 ↓
Completed
 ↓
Result
 ↓
Learning
```

### Memory lifecycle

Distinguish long-term, temporary, historical and superseded information.

------------------------------------------------------------------------

## 8. Proactive Work Engine

### Core flow

``` text
BUSINESS EVENT / STATE
 ↓
PROACTIVE WORK ENGINE
 ↓
ZUE
 ↓
RELEVANT SPECIALIST
 ↓
INVESTIGATION
 ↓
RECOMMENDATION
 ↓
OWNER
 ↓
APPROVAL
 ↓
EXECUTION
 ↓
OUTCOME
 ↓
LEARNING
```

### Trigger types

-   time-based
-   threshold-based
-   pattern-based
-   event-based
-   external-event-based
-   business-state-based
-   outcome-based

### Examples

Eddy: dormant customer → investigation → reactivation → approval →
outreach → measurement.

Carol: overdue invoice → collection workflow → reminder →
reconciliation.

Ayuni: probation/onboarding/document expiry → workflow.

Tehna: SOP violation → exception workflow.

KOPI: high-severity security event → escalation.

### Deduplication

Recurring conditions must support idempotency/deduplication.

------------------------------------------------------------------------

## 9. AI Investigation & Collaboration

``` text
User Request / Trigger
 ↓
Context Resolution
 ↓
Permission Check
 ↓
Investigation Plan
 ↓
Relevant Agents
 ↓
Evidence Retrieval
 ↓
Parallel / Sequential Work
 ↓
Structured Findings
 ↓
Cross-Agent Synthesis
 ↓
Insight
 ↓
Recommendation
 ↓
Decision Brief
```

Zue should not activate every agent by default.

------------------------------------------------------------------------

## 10. Decision, Approval & Execution

### Decision types

-   APPROVE
-   APPROVE_WITH_CHANGES
-   REJECT
-   INVESTIGATE_FURTHER

### Approval

Approval is specific, scoped and time-bound.

### Risk levels

-   L0: internal cognitive
-   L1: low-risk internal
-   L2: consequential business action
-   L3: high-impact/sensitive/irreversible
-   L4: enhanced cryptographic/enterprise trust

### Money rule

Every payment/money action requires explicit user approval by default,
regardless of amount.

A narrow standing authorization may be configured with amount, currency,
vendor/category, purpose, frequency, time period, business and agent
scope.

### Execution

Execution must enforce authorization, scope validation, idempotency,
provider interaction, audit and reconciliation.

Unknown external execution status must reconcile before retry.

------------------------------------------------------------------------

## 11. AI Trust & Verification Policy

### Global principle

> **AI assists. The user verifies. The authorized human decides.**

AI outputs are not automatically authoritative business truth.

### High-impact output verification

For P&L, cash flow, tax-related analysis, payroll/statutory
calculations, legal/compliance recommendations, funding applications,
financial projections and other high-impact outputs, show a verification
warning.

Example:

> **Please Review Before Use**
>
> This analysis was generated from the business information and evidence
> currently available to SALAM LIT. Verify figures, classifications and
> supporting records before relying on it for financial, tax,
> accounting, statutory or other high-impact decisions.

### Evidence visibility

Users should be able to inspect source, evidence, period, freshness,
confidence, assumptions, conflicts and limitations.

### Carol P&L

P&L should support drill-down:

``` text
P&L
 ↓
Category
 ↓
Supplier / Transaction
 ↓
Invoice / Evidence
```

If classification is unclear, Carol asks.

### Conflict warning

Show `Data Conflict Detected` with competing values and sources.

------------------------------------------------------------------------

## 12. Financial Intelligence

### Management P&L

``` text
REVENUE
  Product Sales
  Service Revenue
  Other Operating Revenue
TOTAL REVENUE

COGS
  Raw Materials
  Inventory / Merchandise Cost
  Direct Labour
  Packaging
  Shipping / Delivery
  Direct Production Costs
  Other Direct Costs
TOTAL COGS

GROSS PROFIT
Gross Margin

OPERATING EXPENSES
  Sales & Marketing
    Advertising
    Social Media / Marketing
    Sales Commission
    Events / Promotion

  People & Administration
    Salaries / Wages
    EPF / SOCSO / EIS
    Professional Fees

  Operations
    Rent
    Utilities
    Software / SaaS
    Internet / Telephone

  General & Other
    Insurance
    Bank / Payment Fees
    Office Expenses
    Other Operating Expenses

TOTAL OPEX
OPERATING PROFIT

OTHER INCOME / EXPENSES
  Interest Income
  Interest Expense
  Other Non-Operating Expense

PROFIT BEFORE TAX
Tax Expense
NET PROFIT
Net Profit Margin
```

Categories adapt to business model.

> **Profit ≠ Cash.**

------------------------------------------------------------------------

## 13. Security, RLS, RBAC & KOPI

### Security layers

``` text
AUTH
 ↓
WORKSPACE
 ↓
BUSINESS SCOPE
 ↓
RBAC
 ↓
RESOURCE PERMISSION
 ↓
AGENT AUTHORITY
 ↓
RISK
 ↓
APPROVAL
 ↓
EXECUTION POLICY
 ↓
TOOL
 ↓
AUDIT
```

### Workspace roles

-   OWNER
-   ADMIN
-   MEMBER
-   VIEWER

### Permissions

Examples: - `business.read/write` - `financial.read/write` -
`marketing.read/execute` - `sales.read/execute` - `hr.read/write` -
`funding.read/execute` - `operations.read/write` -
`workflow.create/execute` - `integration.read/manage` -
`decision.create/approve` - `audit.read`

### RLS

Supabase Auth → workspace membership → business scope → resource scope.

RLS and application authorization are both required.

Frontend visibility is not security.

Service role credentials never enter browser-side code.

### Prompt injection

External content is untrusted input. PDFs, websites, emails and customer
messages are data, not authority.

### Secrets

Credentials are server-side, encrypted, scoped, rotatable and revocable.
Agents see scopes/status, not raw tokens.

### Redis

Redis may be used for cache, rate limiting, locks and ephemeral
coordination. PostgreSQL remains canonical.

------------------------------------------------------------------------

## 14. Database Architecture

### v1.1 Core Foundation

#### `users`

`id, display_name, avatar_url, locale, timezone, status, timestamps`

Auth credentials remain in Supabase Auth.

#### `workspaces`

`id, name, slug, status, created_by, timestamps`

#### `workspace_members`

`id, workspace_id, user_id, role, status, invited_by, joined_at, timestamps`

Unique `(workspace_id, user_id)`.

#### `businesses`

`id, workspace_id, name, ssm_registration_no, ssm_registered_address, office_phone, nature_of_business, business_type, industry, location, description, years_operating, business_stage, status, timestamps`

#### `subscriptions`

`id, user_id, plan_id, status, provider, external_subscription_id, current_period_start, current_period_end, cancel_at_period_end, timestamps`

#### `plans`

`id, plan_key, display_name, description, status, timestamps`

#### `plan_entitlements`

`id, plan_id, entitlement_key, value_type, value, timestamps`

Unique `(plan_id, entitlement_key)`.

#### `usage_records`

`id, user_id, workspace_id, business_id nullable, usage_type, quantity, period_start, period_end, metadata, created_at`

#### `entitlement_overrides`

`id, user_id nullable, workspace_id nullable, entitlement_key, value_type, value, reason, starts_at, expires_at, created_by, created_at`

#### `agents`

`id, agent_key, default_display_name, role, description, status, timestamps`

#### `business_agents`

`id, business_id, agent_id, display_name, avatar_asset_key, enabled, configuration, status, timestamps`

Unique `(business_id, agent_id)`.

Runtime status should be stored separately.

#### `marketing_consents`

`id, user_id, workspace_id, consent_type, status, consent_version, consent_text_hash, source, granted_at, revoked_at, created_at`

Consent is separate from access permission.

### v1.2 Business Truth

Tables:

-   `data_sources`
-   `documents`
-   `evidence`
-   `business_facts`
-   `fact_evidence`
-   `business_metrics`
-   `metric_sources`

### v1.3 AI Intelligence

Tables:

-   `business_events`
-   `business_rules`
-   `triggers`
-   `investigations`
-   `investigation_agents`
-   `agent_findings`
-   `finding_evidence`
-   `insights`
-   `recommendations`

### v1.4 Execution

Tables:

-   `decisions`
-   `approvals`
-   `actions`
-   `tasks`
-   `workflows`
-   `workflow_steps`
-   `workflow_runs`
-   `workflow_step_runs`
-   `executions`
-   `outcomes`
-   `learnings`

All business-level resources must be correctly scoped to business.

------------------------------------------------------------------------

## 15. Integration Architecture

General pattern:

``` text
AI AGENT
 ↓
CAPABILITY REQUEST
 ↓
AUTHORIZATION
 ↓
INTEGRATION LAYER
 ↓
PROVIDER ADAPTER
 ↓
EXTERNAL PLATFORM
```

Separate read and write capabilities.

External writes require authentication, authorization, validation,
scope, audit, idempotency and approval where consequential.

### HELLO LIT

Optional integration only.

Never direct-connect to the HELLO LIT database.

> **HELLO LIT owns the transaction/document. SALAM LIT owns the
> intelligence and decision around the transaction.**

### HI LIT

No integration at this stage.

Do not create shared DB, employee/capability sync or HI LIT dependency.

### Provider abstraction

Use adapters for AI models, research, FX, integrations, billing,
storage, notifications and trust providers.

------------------------------------------------------------------------

## 16. Currency, Tax & Payment Architecture

Separate:

-   business default currency
-   campaign currency
-   ad account currency
-   transaction currency
-   display currency

Historical actuals must not be silently rewritten using today's FX.

FX records preserve source, rate, timestamp, base and quote currency.

Tax rules must be jurisdiction/provider/product/billing-path aware and
time-bounded.

If current tax cannot be verified:

> Estimate unavailable / verify at checkout.

Do not hard-code Apple or any platform fee percentage.

### Advertising

Preferred model:

``` text
User owns ad account
 ↓
User owns payment method
 ↓
SALAM LIT authorized access
 ↓
Recommendation / preparation
 ↓
Owner approval
 ↓
Authorized execution
 ↓
Platform charges user
```

SALAM LIT does not hold ad money or store card details.

------------------------------------------------------------------------

## 17. Virtual AI Business Office UX

Primary experience:

> **Virtual AI Business Office**

Visual direction: - professional - clean - premium - cinematic -
spacious

Main areas:

-   Virtual Office
-   Workforce
-   Office Chat
-   Decision Center
-   Task Board
-   Business
-   Knowledge
-   Reports
-   Integrations
-   Settings
-   Billing
-   Notifications
-   Export

### Agent status

-   AVAILABLE
-   WORKING
-   THINKING
-   WAITING
-   AWAITING_APPROVAL
-   COMPLETED
-   OFF_DUTY
-   ERROR
-   SECURITY_ALERT

Statuses must reflect real state.

### Speech bubbles

Agents may communicate contextually, but only from actual
activity/findings/requests. Full history is in Office Chat/Activity
Feed.

### Decision Center

Must show:

-   issue
-   what we found
-   evidence
-   confidence
-   recommendation
-   expected impact
-   risk
-   approval requirement

Actions:

-   Approve
-   Approve with Changes
-   Reject
-   Investigate Further

No fabricated generic business health score.

### Character assets

Final character assets will be supplied later. Use replaceable asset
slots/configuration.

### Responsive

Desktop-primary, simplified mobile experience, accessible.

------------------------------------------------------------------------

## 18. Data Portability & Customer Lifecycle

### Export

``` text
User
 ↓
Export Request
 ↓
Authorization
 ↓
Scope Check
 ↓
Classification Check
 ↓
Generate
 ↓
Audit
 ↓
Download
```

Possible formats: - PDF - XLSX - CSV - JSON

### Lifecycle

``` text
ACTIVE SUBSCRIPTION
 ↓
FULL ACCESS
 ↓
SUBSCRIPTION EXPIRES
 ↓
READ-ONLY / LIMITED ACCESS
 ↓
INACTIVE / ARCHIVED
 ↓
PERMANENT DELETION
```

Retention is policy/configuration-driven.

------------------------------------------------------------------------

## 19. T3N Trust Architecture

T3N is **experimental/prototype only**, not a core production dependency
for MVP.

Potential use: - high-value financial actions - sensitive external
actions - agent-to-agent delegation - enterprise trust - cryptographic
assurance

Trust levels: - L0 - L1 - L2 - L3 - L4

Provider abstraction:

``` text
Agent
 ↓
Agent Trust & Authorization Layer
 ↓
LocalTrustProvider / T3NProvider / FutureProvider
```

If T3N is removed, local/future providers must remain usable without
architectural collapse.

------------------------------------------------------------------------

## 20. Technical Architecture

``` text
Browser
 ↓
Next.js Application
 ↓
Application / API Layer
 ↓
Authorization + Policy
 ↓
SALAM LIT Core
 ├── Zue Orchestrator
 ├── Proactive Work Engine
 ├── Intelligence Engine
 ├── Decision Engine
 ├── Approval Engine
 ├── Execution Engine
 └── Memory / Knowledge
          ↓
     PostgreSQL
          ↓
 Integrations / AI Models
```

### Stack direction

-   Next.js
-   React
-   Tailwind
-   shadcn/ui
-   Supabase Auth
-   Supabase PostgreSQL
-   RLS
-   object storage
-   asynchronous workers
-   queue
-   Redis where justified
-   AI model gateway
-   Cloudflare deployment direction where compatible

Do not assume Vercel hosting is required by AI SDKs.

------------------------------------------------------------------------

## 21. MVP Scope

MVP must prove:

> A founder can onboard a business, provide/import data, interact with
> Zue, delegate work to specialist AI staff, receive evidence-backed
> findings and recommendations, make decisions, approve consequential
> actions, execute authorized work, observe outcomes and preserve
> business memory.

### MVP includes

-   authentication
-   workspace/business onboarding
-   business context
-   all core AI workforce roles
-   Zue
-   business truth/evidence/metrics
-   documents
-   proactive triggers
-   investigations
-   recommendations
-   Decision Center
-   approvals
-   tasks
-   basic workflows
-   outcomes/learning
-   financial P&L/basic analysis
-   marketing/creative/social intelligence
-   sales intelligence
-   HR/people operations
-   funding intelligence
-   operations intelligence
-   KOPI
-   Adik
-   export
-   subscription/entitlements
-   core security/RLS
-   virtual office
-   selected real integrations
-   file import

### MVP excludes

-   full ERP
-   full accounting replacement
-   full CRM
-   full HRMS
-   LMS/TNA
-   professional video editor
-   fully autonomous financial agent
-   SALAM LIT wallet/bank/card storage
-   massive integration catalogue
-   microservices
-   production T3N dependency
-   HI LIT integration
-   direct HELLO LIT DB connection
-   fake health scores
-   fake AI activity
-   fake cyber monitoring

------------------------------------------------------------------------

## 22. BUILD / ARCHITECTURE READY / MOCK / DO NOT BUILD / NEVER FAKE

### BUILD

Build real:

-   authentication
-   authorization
-   RLS
-   onboarding
-   business data
-   evidence
-   documents
-   agent registry
-   permissions
-   Zue orchestration
-   investigations
-   recommendations
-   Decision Center
-   approvals
-   tasks
-   workflows
-   execution governance
-   outcomes
-   learning
-   memory
-   entitlements
-   attribution
-   audit
-   export
-   virtual office state

### ARCHITECTURE READY

Prepare clean boundaries for:

-   HELLO LIT API
-   future HI LIT API
-   T3N
-   additional AI models
-   FX providers
-   research providers
-   integrations
-   portfolio intelligence
-   enterprise trust
-   supply chain

Do not implement future systems merely for theoretical future-proofing.

### MOCK ONLY

-   final character art before assets arrive
-   unavailable third-party credentials
-   future integrations without production credentials
-   future T3N trust flow

Mocks must be clearly identifiable.

### DO NOT BUILD

-   direct HELLO LIT DB integration
-   HI LIT integration
-   full ERP
-   full CRM
-   full HRMS
-   full accounting replacement
-   LMS/TNA
-   full video editor
-   SALAM LIT wallet
-   bank/card storage
-   massive microservices
-   production T3N dependency
-   generic AI marketplace

### NEVER FAKE

Never fake:

-   financial figures
-   evidence
-   provenance
-   business metrics
-   research
-   agent activity
-   security events
-   integration status
-   external execution
-   payment success
-   workflow completion
-   confidence
-   health scores
-   cyber monitoring

------------------------------------------------------------------------

## 23. Engineering Acceptance Criteria

A feature is not complete merely because a button works.

``` text
INPUT
 ↓
VALIDATION
 ↓
AUTHORIZATION
 ↓
PROCESSING
 ↓
EVIDENCE / STATE
 ↓
OUTPUT
 ↓
APPROVAL WHERE REQUIRED
 ↓
EXECUTION
 ↓
AUDIT
 ↓
OUTCOME
```

### Core end-to-end test

A test business must be able to:

1.  Sign up.
2.  Create workspace.
3.  Create business.
4.  Configure context.
5.  Configure AI workforce.
6.  Provide/import evidence.
7.  Ask Zue a business question.
8.  Resolve context.
9.  Assign relevant agent.
10. Generate evidence-backed findings.
11. Generate recommendation.
12. Review it.
13. Make decision.
14. Require approval for consequential action.
15. Execute authorized action.
16. Record real execution status.
17. Record outcome.
18. Store learning.
19. Use learning in future recommendations.
20. Preserve business isolation and auditability.

### Security tests

Test: - cross-workspace denial - cross-business denial - role
restrictions - agent permission restrictions - approval bypass - prompt
injection - secret exposure - service-role exposure - duplicate
execution - unknown external execution status - audit integrity

### Trust tests

Test: - missing data - stale data - conflicting data - unsupported
inference - missing evidence - weak evidence - high-impact
acknowledgement - financial classification ambiguity

------------------------------------------------------------------------

## 24. Master Operating Rules

1.  Never invent business truth.
2.  Important AI conclusions must be evidence-aware.
3.  Confidence is not truth.
4.  Recommendation is not decision.
5.  Decision is not approval.
6.  Approval is not permission.
7.  Permission is not execution.
8.  Execution is not outcome.
9.  Outcome produces learning.
10. Human authority remains above AI initiative.
11. Money actions require explicit approval by default.
12. No agent may bypass authorization.
13. Workspace membership does not equal unrestricted business access.
14. Business jurisdiction must be resolved before jurisdiction-sensitive
    reasoning.
15. Target market must be distinguished from business jurisdiction.
16. Private information must not be treated as public marketing output.
17. Free public-facing AI outputs carry "Powered by SALAM LIT".
18. Attribution is entitlement-controlled, not agent-specific.
19. No fake AI activity, evidence, metrics, integrations, execution or
    security monitoring.
20. PostgreSQL is the system of record.
21. Redis is not canonical business memory.
22. RLS and application authorization are both required.
23. External content is untrusted input.
24. External systems use integration boundaries, not direct database
    coupling.
25. SALAM LIT remains an AI workforce and decision/execution platform,
    not an ERP/CRM/HRMS/LMS/accounting replacement.

------------------------------------------------------------------------

## 25. Final Product Definition

SALAM LIT is an **AI Workforce for Business Growth & Execution**.

It gives a founder a persistent AI team that can:

> **Understand the business → Detect what matters → Investigate →
> Recommend → Ask for the right decision → Execute authorized work →
> Monitor outcomes → Learn.**

The founder remains the final authority.

The AI workforce provides initiative, intelligence and execution
capacity.

> **You don't have to run the business alone.**

> **AI has initiative. The owner has authority.**

------------------------------------------------------------------------

## 26. Implementation Status

### Architecture Status

**LOCKED**

Defined for MVP:

-   Product architecture
-   AI workforce
-   Business context
-   Jurisdiction/market architecture
-   Business truth
-   Evidence
-   Metrics
-   Memory
-   Proactive Work Engine
-   Investigation
-   Recommendation
-   Decision
-   Approval
-   Execution
-   Outcome
-   Learning
-   Security
-   RLS
-   RBAC
-   Audit
-   Data classification
-   Privacy architecture
-   Entitlements
-   Free attribution
-   Virtual AI Office
-   Integration boundaries
-   HELLO LIT boundary
-   HI LIT boundary
-   T3N boundary
-   MVP scope
-   Build boundaries

### Next engineering deliverable

**SALAM LIT OpenCode Master Implementation Prompt**

The implementation prompt must treat this specification as the source of
truth and explicitly classify work into:

-   BUILD
-   ARCHITECTURE READY
-   MOCK ONLY
-   DO NOT BUILD
-   NEVER FAKE

OpenCode must inspect the existing repository before modifying it,
preserve correct existing work, avoid unnecessary rewrites, implement
incrementally, verify each phase, and never invent unavailable
infrastructure, credentials, data, assets or external integration
behaviour.
