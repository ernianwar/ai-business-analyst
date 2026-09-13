/**
 * SALAM LIT — Speech Bubble Architecture
 *
 * Contextual character conversation system.
 *
 * Architecture:
 *   Business Event / State Change
 *       ↓
 *   Proactive Work Engine
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
 * CRITICAL: Speech bubbles must NOT be static/decorative.
 * They MUST be driven by actual agent activity.
 *
 * Phase 2: Type definitions and placeholder logic.
 * Real speech bubble generation requires the full agent pipeline.
 */

import type { AgentKey } from "../agents/definitions";
import type { OfficeExperienceEvent } from "../events/office-events";
import type { AgentStatus } from "../state/agent-state";

/**
 * Speech bubble content types.
 */
export type SpeechBubbleType =
  | "activity_update"     // Agent reports on current work
  | "recommendation"      // Agent suggests an action
  | "question"            // Agent asks for input
  | "completion"          // Agent reports task completion
  | "alert"               // Agent flags an issue
  | "greeting"            // Agent greets the user
  | "idle";               // Agent is idle, says something light

/**
 * A speech bubble displayed above a character in the office.
 */
export interface SpeechBubble {
  id: string;
  agent_key: AgentKey;
  text: string;
  type: SpeechBubbleType;
  /** Timestamp */
  timestamp: string;
  /** Optional: event that triggered this speech */
  triggering_event_id?: string;
  /** Optional: urgency level */
  urgency?: "low" | "medium" | "high";
  /** Optional: link to the related activity/investigation */
  link_to?: {
    entity_type: string;
    entity_id: string;
  };
}

/**
 * Speech Bubble Generator
 *
 * Generates speech bubbles from real agent activity.
 * In Phase 2: basic implementations only.
 * In later phases: AI-generated contextual speech.
 */
export class SpeechBubbleGenerator {
  /**
   * Generate a speech bubble from an office event.
   * Only call this with REAL events.
   */
  generateFromEvent(event: OfficeExperienceEvent): SpeechBubble | null {
    // Phase 2: basic text mapping from event summaries
    // Later: AI-generated contextual speech
    const text = this.mapEventToSpeech(event);
    if (!text) return null;

    return {
      id: crypto.randomUUID(),
      agent_key: event.agent_key,
      text,
      type: this.mapEventTypeToSpeechType(event.type),
      timestamp: new Date().toISOString(),
      triggering_event_id: event.id,
      urgency: event.severity === "critical" ? "high" : event.severity === "warning" ? "medium" : "low",
    };
  }

  /**
   * Generate a greeting speech bubble for an agent.
   */
  generateGreeting(agent_key: AgentKey): SpeechBubble {
    const greetings: Record<AgentKey, string> = {
      zue: "How can I help coordinate your business today?",
      erni: "Ready to dive into your business insights.",
      sheera: "Let's make your marketing shine!",
      eddy: "Let's find your next opportunity.",
      carol: "Your finances are my priority.",
      ayuni: "Your people operations are in good hands.",
      alex: "Let's explore funding opportunities.",
      tehna: "Operations are running smoothly.",
      kopi: "Security is being monitored.",
      adik: "Hey there! Need a break?",
    };

    return {
      id: crypto.randomUUID(),
      agent_key,
      text: greetings[agent_key] ?? "Hello!",
      type: "greeting",
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Map an event type to a speech bubble type.
   */
  private mapEventTypeToSpeechType(
    event_type: OfficeExperienceEvent["type"]
  ): SpeechBubbleType {
    switch (event_type) {
      case "AGENT_STARTED_WORK":
      case "AGENT_THINKING":
        return "activity_update";
      case "AGENT_FOUND_INFORMATION":
      case "RECOMMENDATION_READY":
        return "recommendation";
      case "AGENT_NEEDS_APPROVAL":
      case "APPROVAL_REQUESTED":
        return "question";
      case "AGENT_COMPLETED_WORK":
        return "completion";
      case "AGENT_ERROR":
      case "SECURITY_ALERT":
        return "alert";
      default:
        return "activity_update";
    }
  }

  /**
   * Map an event to speech text.
   * Phase 2: uses event summary.
   * Later: AI-generated contextual speech.
   */
  private mapEventToSpeech(event: OfficeExperienceEvent): string | null {
    // Use the event summary as speech text
    if (event.summary) return event.summary;
    if (event.detail) return event.detail;
    return null;
  }
}

/**
 * Singleton speech bubble generator.
 */
export const speechBubbleGenerator = new SpeechBubbleGenerator();
