/**
 * SALAM LIT — Proactive Work Engine
 *
 * The central engine that drives agent activity.
 *
 * Architecture:
 *   Business Event / State Change
 *       ↓
 *   Proactive Work Engine (this file)
 *       ↓
 *   Zue (orchestrator)
 *       ↓
 *   Specialist Agent
 *       ↓
 *   Agent Activity Event
 *       ↓
 *   Office Experience Event
 *       ↓
 *   Character State + Speech Bubble
 *
 * Phase 2: Interface definition only.
 * Actual event detection and orchestration will be built in later phases.
 */

import type { AgentKey } from "../agents/definitions";
import type { OfficeExperienceEvent } from "../events/office-events";

/**
 * A business event that may trigger proactive agent work.
 */
export interface BusinessEvent {
  id: string;
  type: string;
  summary: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * A proactive work task — what an agent should work on.
 */
export interface ProactiveTask {
  id: string;
  agent_key: AgentKey;
  business_event_id: string;
  task_type: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "awaiting_approval";
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

/**
 * Proactive Work Engine
 *
 * Detects business events and triggers agent work.
 * In Phase 2: placeholder only.
 * In later phases: full event detection and orchestration.
 */
export class ProactiveWorkEngine {
  /**
   * Process a business event and determine if proactive work is needed.
   * Returns tasks to be assigned to agents.
   */
  async processEvent(
    _event: BusinessEvent
  ): Promise<ProactiveTask[]> {
    // Phase 2: return empty — no fake tasks
    return [];
  }

  /**
   * Get all pending proactive tasks for an agent.
   */
  async getPendingTasks(
    _agent_key: AgentKey
  ): Promise<ProactiveTask[]> {
    return [];
  }

  /**
   * Check if there are any pending approvals.
   */
  async getPendingApprovals(): Promise<ProactiveTask[]> {
    return [];
  }
}

/**
 * Singleton proactive work engine.
 */
export const proactiveWorkEngine = new ProactiveWorkEngine();
