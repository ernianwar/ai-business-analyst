/**
 * SALAM LIT — Proactive Worker Status API
 *
 * Provides endpoint for:
 *   GET /api/proactive/status — Worker status
 */

import { NextRequest, NextResponse } from "next/server";
import { getWorkerStatus } from "@/lib/proactive/event-worker";
import { getEnabledRules, getAllRules } from "@/lib/proactive/rule-engine";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/proactive/status
 *
 * Requires authenticated context. Business-scoped rules returned
 * are global to the proactive engine (system-wide configuration),
 * not business-owned resources.
 */
export async function GET(req: NextRequest) {
  try {
    const ctx = await getAuthenticatedContext();

    if (!ctx) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }

    const status = getWorkerStatus();
    const allRules = getAllRules();
    const enabledRules = getEnabledRules();

    return NextResponse.json({
      success: true,
      business_id: ctx.business_id,
      worker: status,
      rules: {
        total: allRules.length,
        enabled: enabledRules.length,
        disabled: allRules.length - enabledRules.length,
        list: allRules.map((r) => ({
          id: r.id,
          name: r.name,
          event_type: r.event_type,
          enabled: r.enabled,
          priority: r.priority,
          cooldown_ms: r.cooldown_ms,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Unauthenticated")) {
      return NextResponse.json({ success: false, error: "Unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
