/**
 * SALAM LIT — Office State Read API
 *
 * Single authenticated read boundary for the Virtual Office UI.
 * Aggregates server-side runtime state into one JSON response.
 *
 * GET /api/office/state
 *
 * CRITICAL:
 * - This is a READ-ONLY endpoint. No mutations.
 * - No LLM calls. No proactive evaluation triggered.
 * - All data from existing authoritative sources.
 * - Identity derived from authenticated context — never from query params.
 * - No demo data. No fake agent activity. No fabricated counts.
 *
 * Phase 13C.0: Virtual AI Business Office Experience Hardening
 * Phase 14.2.1: Migrated to authenticated context boundary
 */

import { NextResponse } from "next/server";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import { agentStateStore } from "@/lib/state/agent-state";
import { officeEventStore } from "@/lib/events/office-events";
import { getWorkQueueSummary } from "@/lib/proactive/work-queue";
import { getWorkerStatus } from "@/lib/proactive/event-worker";
import { isAIAvailable } from "@/lib/runtime/model-gateway";
import { getPendingDecisions } from "@/lib/decisions/decision-service";
import { getPendingApprovals } from "@/lib/approval/approval-service";

/**
 * GET /api/office/state
 *
 * Returns aggregated office state for the Virtual Office UI.
 * All data is read-only from existing server-side stores.
 * Business ID resolved from authenticated context — not from query params.
 */
export async function GET() {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    if (!ctx.business_id) {
      return NextResponse.json({
        success: true,
        requires_onboarding: true,
        onboarding_status: ctx.onboarding_status,
        workspace_id: ctx.workspace_id,
        business_id: null,
        agents: [],
        events: [],
        work_queue: { total: 0, critical: 0, important: 0, upcoming: 0, routine: 0, items: [] },
        pending_decisions: 0,
        pending_approvals: 0,
        ai_available: false,
        last_evaluation_at: null,
      });
    }

    const business_id = ctx.business_id;

    // Initialize proactive engine if needed
    const { proactiveWorkEngine } = await import("@/lib/proactive");
    proactiveWorkEngine.initialize();

    // Aggregate data from existing authoritative sources
    const agents = agentStateStore.getAllStates();
    const events = officeEventStore.getRecent(20);
    const work_queue = getWorkQueueSummary(business_id);
    const ai_available = await isAIAvailable();
    const worker_status = getWorkerStatus();

    // Count pending decisions (read-only query)
    const pending_decisions = getPendingDecisions(business_id).length;

    // Count pending approvals (read-only query)
    const pending_approvals = getPendingApprovals(business_id).length;

    return NextResponse.json({
      success: true,
      business_id,
      agents,
      events,
      work_queue: {
        total: work_queue.total,
        critical: work_queue.critical,
        important: work_queue.important,
        upcoming: work_queue.upcoming,
        routine: work_queue.routine,
        items: work_queue.items.map((item) => ({
          trigger_id: item.trigger.id,
          summary: item.event.summary,
          priority: item.trigger.priority,
          status: item.trigger.status,
          status_label: item.status_label,
          recommendation_count: item.recommendation_count,
          agent_keys: item.trigger.assigned_agents,
          created_at: item.trigger.created_at,
        })),
      },
      pending_decisions,
      pending_approvals,
      ai_available,
      last_evaluation_at: worker_status.last_evaluation_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
