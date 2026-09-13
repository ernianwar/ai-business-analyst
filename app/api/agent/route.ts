/**
 * SALAM LIT — Agent Invocation API
 *
 * Handles agent invocation requests from Office Chat.
 *
 * Phase 9: Investigation & Intelligence Engine
 */

import { NextRequest, NextResponse } from "next/server";
import {
  analyzeAndRoute,
  executeInvestigation,
  createInvestigation,
  getInvestigation,
  getInvestigationsByBusiness,
} from "@/lib/orchestration/zue";
import {
  invokeAgent,
  getInvocationsByBusiness,
  getFindingsByBusiness,
} from "@/lib/runtime/agent-runtime";
import { isAIAvailable, getAINotAvailableMessage, getUsageSummary } from "@/lib/runtime/model-gateway";
import { getAuthenticatedContext } from "@/lib/auth/get-context";
import type { AgentKey } from "@/lib/agents/definitions";
import { validateTaskInput, validateObjectiveInput } from "@/lib/security/sanitize";

/**
 * POST /api/agent
 *
 * Invoke an agent or start an investigation.
 * All identity and business scope derived from authenticated context.
 */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx || !ctx.business_id) {
      return NextResponse.json(
        { error: "Business context required. Complete onboarding first.", code: "NO_BUSINESS" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      agent_key,
      task,
      mode = "direct",
      objective,
    } = body;

    if (!task) {
      return NextResponse.json(
        { error: "task is required" },
        { status: 400 }
      );
    }

    // M10: Input length validation
    const taskValidation = validateTaskInput(task);
    if (!taskValidation.valid) {
      return NextResponse.json(
        { error: taskValidation.error },
        { status: 400 }
      );
    }

    // M10: Validate objective length if provided
    if (objective) {
      const objValidation = validateObjectiveInput(objective);
      if (!objValidation.valid) {
        return NextResponse.json(
          { error: objValidation.error },
          { status: 400 }
        );
      }
    }

    if (!(await isAIAvailable())) {
      return NextResponse.json(
        {
          error: getAINotAvailableMessage(),
          ai_available: false,
        },
        { status: 503 }
      );
    }

    if (mode === "orchestrate") {
      const investigation = createInvestigation({
        business_id: ctx.business_id,
        initiated_by: "zue",
        trigger_type: "USER_REQUEST",
        trigger_source: task,
        title: task.slice(0, 100),
        description: task,
        objective: objective ?? task,
      });

      const routingResult = await analyzeAndRoute({
        investigation,
        user_request: task,
        business_id: ctx.business_id,
        user_id: ctx.user_id,
        workspace_id: ctx.workspace_id!,
      });

      const executionResult = await executeInvestigation(
        investigation.id,
        ctx.user_id,
        ctx.workspace_id!
      );

      return NextResponse.json({
        mode: "orchestrate",
        investigation_id: investigation.id,
        routing: routingResult,
        execution: executionResult,
        findings_count: investigation.findings.length,
        findings: investigation.findings,
        insights: investigation.insights,
        recommendations: investigation.recommendations,
        data_gaps: investigation.data_gaps,
        specialist_failures: investigation.specialist_failures,
        synthesis: executionResult.synthesis,
      });
    }

    const targetAgent = (agent_key as AgentKey) ?? "zue";

    const result = await invokeAgent({
      agent_key: targetAgent,
      business_id: ctx.business_id,
      user_id: ctx.user_id,
      workspace_id: ctx.workspace_id!,
      task,
    });

    return NextResponse.json({
      mode: "direct",
      agent_key: targetAgent,
      success: result.success,
      invocation_id: result.invocation.id,
      status: result.invocation.status,
      findings: result.invocation.output?.findings ?? [],
      error: result.error,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Unauthenticated")) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("Agent invocation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agent
 *
 * Get agent invocation history, findings, investigations, or usage.
 * Business scope derived from authenticated context.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx || !ctx.business_id) {
      return NextResponse.json(
        { error: "Business context required. Complete onboarding first.", code: "NO_BUSINESS" },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") ?? "invocations";

    if (type === "usage") {
      const usage = await getUsageSummary(ctx.business_id);
      return NextResponse.json({ usage });
    }

    if (type === "findings") {
      const findings = getFindingsByBusiness(ctx.business_id);
      return NextResponse.json({ findings });
    }

    if (type === "investigations") {
      const investigations = getInvestigationsByBusiness(ctx.business_id);
      return NextResponse.json({ investigations });
    }

    const invocations = getInvocationsByBusiness(ctx.business_id);
    return NextResponse.json({ invocations });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Unauthenticated")) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    console.error("Error fetching agent data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
