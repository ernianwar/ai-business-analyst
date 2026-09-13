/**
 * SALAM LIT — Office Experience Event Contract
 *
 * Defines the events that drive the Virtual AI Business Office experience.
 *
 * Architecture:
 *   Business Event / State Change
 *       ↓
 *   Proactive Work Engine (future)
 *       ↓
 *   Zue (orchestrator)
 *       ↓
 *   Specialist Agent
 *       ↓
 *   Agent Activity Event (this file)
 *       ↓
 *   Office Experience Event
 *       ↓
 *   Character State + Speech Bubble
 *
 * Phase 2: Schema/interface only.
 * Actual event generation will be implemented in later phases.
 * Do not generate fake production events.
 */

import type { AgentKey } from "../agents/definitions";
import type { AgentStatus } from "../state/agent-state";

/**
 * Office Experience Event types.
 * These represent real occurrences in the AI workforce.
 */
export type OfficeEventType =
  // Agent lifecycle
  | "AGENT_STARTED_WORK"
  | "AGENT_THINKING"
  | "AGENT_FOUND_INFORMATION"
  | "AGENT_COMPLETED_WORK"
  | "AGENT_NEEDS_APPROVAL"
  | "AGENT_ERROR"
  | "AGENT_STATE_CHANGED"
  // Security
  | "SECURITY_ALERT"
  // Communication
  | "AGENT_MESSAGE"
  | "AGENT_HANDOFF"
  // Business events (future)
  | "BUSINESS_EVENT_DETECTED"
  | "RECOMMENDATION_READY"
  | "APPROVAL_REQUESTED"
  | "APPROVAL_DECIDED";

/**
 * An event that occurred in the AI Office.
 * This is the contract between the agent system and the office UI.
 */
export interface OfficeExperienceEvent {
  /** Unique event ID */
  id: string;
  /** Type of event */
  type: OfficeEventType;
  /** Which agent triggered this event */
  agent_key: AgentKey;
  /** ISO timestamp */
  timestamp: string;
  /** Human-readable summary of what happened */
  summary: string;
  /** Optional: longer description / detail */
  detail?: string;
  /** Optional: reference to related business entity */
  entity_type?: string;
  /** Optional: reference ID */
  entity_id?: string;
  /** Optional: new agent status after this event */
  new_status?: AgentStatus;
  /** Optional: speech bubble text (what the agent says) */
  speech_text?: string;
  /** Optional: severity for security/alert events */
  severity?: "info" | "warning" | "critical";
  /** Optional: metadata for future extensibility */
  metadata?: Record<string, unknown>;
}

/**
 * Speech bubble content for an agent.
 * Generated from real agent activity — never fake.
 */
export interface AgentSpeechBubble {
  agent_key: AgentKey;
  text: string;
  /** When this speech was generated */
  timestamp: string;
  /** Reference to the event that triggered this speech */
  event_id: string;
  /** Optional: link to the underlying activity/task */
  link_to?: {
    entity_type: string;
    entity_id: string;
  };
}

/**
 * Office chat message — persisted history of agent communications.
 */
export interface OfficeChatMessage {
  id: string;
  agent_key: AgentKey;
  text: string;
  timestamp: string;
  /** Is this a system message (e.g., from KOPI about security) */
  is_system: boolean;
}

/**
 * Office Experience Event Store — in-memory for Phase 2.
 * Future: May move to event queue/stream infrastructure.
 */
class OfficeEventStore {
  private events: OfficeExperienceEvent[] = [];
  private maxEvents = 100; // Keep last N events in memory

  /**
   * Emit a new office event.
   * Only call this when a real event has occurred.
   */
  emit(event: Omit<OfficeExperienceEvent, "id" | "timestamp">): OfficeExperienceEvent {
    const fullEvent: OfficeExperienceEvent = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    };

    this.events.unshift(fullEvent);

    // Trim to max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    return fullEvent;
  }

  /**
   * Get recent events (for office UI rendering).
   */
  getRecent(limit: number = 20): OfficeExperienceEvent[] {
    return this.events.slice(0, limit);
  }

  /**
   * Get events for a specific agent.
   */
  getByAgent(agent_key: AgentKey, limit: number = 10): OfficeExperienceEvent[] {
    return this.events
      .filter((e) => e.agent_key === agent_key)
      .slice(0, limit);
  }

  /**
   * Get events of a specific type.
   */
  getByType(type: OfficeEventType, limit: number = 10): OfficeExperienceEvent[] {
    return this.events
      .filter((e) => e.type === type)
      .slice(0, limit);
  }

  /**
   * Clear all events (for testing/reset).
   */
  clear(): void {
    this.events = [];
  }
}

/**
 * Singleton office event store.
 * In-memory for Phase 2.
 */
export const officeEventStore = new OfficeEventStore();
