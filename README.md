# SALAM LIT

SALAM LIT is a simple MVP for an **Agentic AI Business Opportunity Scout**. A user enters a business idea, product, service, or target market, and the app demonstrates a full agentic loop:

**User Goal → Planning → Tool Selection → Research → Analysis → Decision → Report**

This project is intentionally lightweight and built for learning/demo purposes.

## What Agentic AI Means Here

Agentic AI in this project means the system does more than answer in one shot. It:

1. Receives a high-level objective.
2. Creates a research plan.
3. Chooses which research actions to take.
4. Collects evidence.
5. Decides whether more research is needed.
6. Waits for optional human approval.
7. Analyzes the findings.
8. Produces a recommendation and final brief.

## Architecture

The MVP uses five logical stages:

- **Planner** — turns the objective into a research plan.
- **Researcher** — gathers findings with `search_web` or demo mode.
- **Analyst** — scores opportunity dimensions and computes an overall score.
- **Strategist** — converts the analysis into a practical market strategy.
- **Report Generator** — formats the final brief.

### Diagram

```text
                    USER
                     │
                     ▼
                  PLANNER
                     │
              ┌──────┴──────┐
              ▼             ▼
         RESEARCHER      TOOL SELECTION
              │
              ▼
         WEB SEARCH
              │
              ▼
         RESEARCH DATA
              │
              ▼
            ANALYST
              │
              ▼
          STRATEGIST
              │
              ▼
        REPORT GENERATOR
              │
              ▼
          SALAM LIT
          OPPORTUNITY
             BRIEF
```

## How the Agents Interact

- The **Planner** examines the input and adjusts the research plan based on keywords.
- The **Researcher** tries to use web search. If API credentials are unavailable, it switches to clearly labeled demo data.
- The **Researcher** can keep the loop going by gathering more information if the notes look insufficient.
- The **Analyst** scores the opportunity using the collected notes.
- The **Strategist** recommends target customer, offer, positioning, pricing, and acquisition channel.
- The **Report Generator** compiles the final **SALAM LIT Opportunity Brief**.

There is also an optional **human approval checkpoint** before the final analysis.

## Tools

This MVP intentionally keeps the toolset small:

- `search_web(query)` — gather external information.
- `save_research(data)` — persist structured research notes.
- `generate_report(data)` — produce the final Opportunity Brief.

## Installation

```bash
npm install
```

## Configure API Keys

Create an `.env.local` file if you want real web search integration.

Example:

```bash
SEARCH_WEB_API_KEY=your_key_here
NEXT_PUBLIC_SEARCH_WEB_API_KEY=your_key_here
```

If credentials are missing, the app automatically uses demo mode.

## Run Locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Demo Mode

Use this example input:

```text
Evaluate the opportunity for LIT Digital Creators to provide AI workforce training to Malaysian SMEs.
```

Demo mode is enabled in the UI and produces clearly labeled mock research:

**DEMO DATA. NOT LIVE RESEARCH.**

## Expected Output

The app should show:

- a research plan,
- an activity panel,
- structured research notes,
- an optional approval checkpoint,
- and a final **SALAM LIT Opportunity Brief**.

## Notes

This is an MVP and does not include authentication, payments, multi-tenant architecture, CRM integration, or enterprise infrastructure.
