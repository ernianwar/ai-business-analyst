/**
 * SALAM LIT — Runtime Agent State
 *
 * This defines the ephemeral runtime state of an agent.
 * Runtime state is NOT persisted in the business-agent configuration table.
 * It lives in memory/event infrastructure and is projected to the UI.
 *
 * Architecture:
 *   Master Agent Definition (definitions.ts)
 *       ↓
 *   Business Agent Configuration (DB)
 *       ↓
 *   Runtime Agent State (this file — ephemeral)
 *       ↓
 *   Office Representation (UI)
 */

import type { AgentKey } from "../agents/definitions";

/**
 * Supported agent states.
 * These must reflect actual runtime state — never faked.
 */
export type AgentStatus =
  | "AVAILABLE"      // Agent is idle, ready for work
  | "WORKING"        // Agent is actively processing a task
  | "THINKING"       // Agent is reasoning/planning
  | "WAITING"        // Agent is waiting for external data/system
  | "AWAITING_APPROVAL" // Agent needs owner approval for action
  | "COMPLETED"      // Agent finished current task successfully
  | "OFF_DUTY"       // Agent is not available (schedule/config)
  | "ERROR"          // Agent encountered an error
  | "SECURITY_ALERT"; // KOPI only — security event detected

/**
 * Runtime agent state — ephemeral, not persisted in config tables.
 * This is the live state that drives the office UI.
 */
export interface RuntimeAgentState {
  agent_key: AgentKey;
  status: AgentStatus;
  /** What the agent is currently doing (for speech bubble / activity) */
  current_task_description: string | null;
  /** When the agent entered this state */
  state_changed_at: Date;
  /** Optional: reference to the investigation/task being worked on */
  active_task_id: string | null;
  /** Optional: progress percentage (0-100) for long-running tasks */
  progress_pct: number | null;
  /** Optional: brief status message for internal use */
  status_message: string | null;
}

/**
 * In-memory agent state store.
 *
 * Phase 2: Simple Map-based store.
 * Future: May move to Redis or event-driven infrastructure.
 *
 * This is ephemeral runtime state — not business data.
 */
class AgentStateStore {
  private states: Map<AgentKey, RuntimeAgentState> = new Map();

  /**
   * Get current state for an agent.
   * Returns default AVAILABLE state if no state exists.
   */
  getState(agent_key: AgentKey): RuntimeAgentState {
    const existing = this.states.get(agent_key);
    if (existing) return existing;

    // Return default state — agent is available
    return {
      agent_key,
      status: "AVAILABLE",
      current_task_description: null,
      state_changed_at: new Date(),
      active_task_id: null,
      progress_pct: null,
      status_message: null,
    };
  }

  /**
   * Update agent state.
   * Only call this when the agent actually changes state.
   * Never fake state changes.
   */
  setState(
    agent_key: AgentKey,
    status: AgentStatus,
    description?: string | null,
    task_id?: string | null
  ): RuntimeAgentState {
    const state: RuntimeAgentState = {
      agent_key,
      status,
      current_task_description: description ?? null,
      state_changed_at: new Date(),
      active_task_id: task_id ?? null,
      progress_pct: null,
      status_message: null,
    };
    this.states.set(agent_key, state);
    return state;
  }

  /**
   * Get all agent states (for office UI rendering).
   */
  getAllStates(): RuntimeAgentState[] {
    const keys: AgentKey[] = [
      "zue", "erni", "sheera", "eddy", "carol",
      "ayuni", "alex", "tehna", "kopi", "adik",
    ];
    return keys.map((k) => this.getState(k));
  }

  /**
   * Reset an agent to AVAILABLE.
   */
  resetToAvailable(agent_key: AgentKey): RuntimeAgentState {
    return this.setState(agent_key, "AVAILABLE", null, null);
  }

  /**
   * Mark agent as working on a specific task.
   */
  markWorking(
    agent_key: AgentKey,
    task_description: string,
    task_id?: string
  ): RuntimeAgentState {
    return this.setState(agent_key, "WORKING", task_description, task_id);
  }

  /**
   * Mark agent as thinking/planning.
   */
  markThinking(
    agent_key: AgentKey,
    description?: string
  ): RuntimeAgentState {
    return this.setState(agent_key, "THINKING", description ?? "Thinking...");
  }

  /**
   * Mark agent as awaiting approval.
   */
  markAwaitingApproval(
    agent_key: AgentKey,
    task_description: string,
    task_id: string
  ): RuntimeAgentState {
    return this.setState(
      agent_key,
      "AWAITING_APPROVAL",
      task_description,
      task_id
    );
  }

  /**
   * Mark agent as completed.
   */
  markCompleted(
    agent_key: AgentKey,
    description?: string
  ): RuntimeAgentState {
    return this.setState(agent_key, "COMPLETED", description ?? "Task complete");
  }

  /**
   * Mark agent as error.
   */
  markError(
    agent_key: AgentKey,
    error_message?: string
  ): RuntimeAgentState {
    return this.setState(agent_key, "ERROR", error_message ?? "Error occurred");
  }
}

/**
 * Singleton agent state store.
 * In-memory only — not persisted across server restarts.
 * This is intentional: runtime state is ephemeral.
 */
export const agentStateStore = new AgentStateStore();
