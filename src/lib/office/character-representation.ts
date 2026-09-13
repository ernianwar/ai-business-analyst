/**
 * SALAM LIT — Office Character Representation
 *
 * Maps agent state to visual representation in the office UI.
 * This is the bridge between runtime agent state and the visual office.
 */

import type { AgentKey, AgentRole } from "../agents/definitions";
import type { RuntimeAgentState } from "../state/agent-state";

/**
 * Desk position in the office layout.
 */
export interface DeskPosition {
  /** Horizontal position (left %) */
  x: number;
  /** Vertical position (top %) */
  y: number;
  /** Z-index for layering */
  z: number;
  /** Scale factor (1.0 = normal) */
  scale: number;
}

/**
 * Visual representation of an agent in the office.
 */
export interface OfficeCharacter {
  agent_key: AgentKey;
  display_name: string;
  role: AgentRole;
  desk_position: DeskPosition;
  /** Current visual state (driven by runtime state) */
  visual_state: "idle" | "working" | "thinking" | "error" | "offline";
  /** Speech bubble (if any) */
  speech_bubble: {
    text: string;
    type: "activity" | "recommendation" | "question" | "alert" | "greeting";
  } | null;
}

/**
 * Default desk positions for each agent in the office.
 * These are UI layout coordinates — not business data.
 *
 * Layout follows the visual reference:
 *   - Zue (manager) at top-center
 *   - Specialists along the middle
 *   - Support (Kopi, Adik) at bottom
 */
const DESK_POSITIONS: Record<AgentKey, DeskPosition> = {
  zue:    { x: 45, y: 10, z: 10, scale: 1.1 },
  erni:   { x: 15, y: 30, z: 5,  scale: 1.0 },
  sheera: { x: 35, y: 30, z: 5,  scale: 1.0 },
  eddy:   { x: 55, y: 30, z: 5,  scale: 1.0 },
  carol:  { x: 75, y: 30, z: 5,  scale: 1.0 },
  ayuni:  { x: 15, y: 55, z: 5,  scale: 1.0 },
  alex:   { x: 35, y: 55, z: 5,  scale: 1.0 },
  tehna:  { x: 55, y: 55, z: 5,  scale: 1.0 },
  kopi:   { x: 25, y: 78, z: 3,  scale: 0.9 },
  adik:   { x: 65, y: 78, z: 3,  scale: 0.9 },
};

/**
 * Map a runtime agent status to a visual state for the office UI.
 */
function mapStatusToVisualState(status: RuntimeAgentState["status"]): OfficeCharacter["visual_state"] {
  switch (status) {
    case "AVAILABLE":
      return "idle";
    case "WORKING":
    case "THINKING":
      return "working";
    case "WAITING":
    case "AWAITING_APPROVAL":
      return "working"; // Still visually working, just paused
    case "COMPLETED":
      return "idle";
    case "OFF_DUTY":
      return "offline";
    case "ERROR":
    case "SECURITY_ALERT":
      return "error";
    default:
      return "idle";
  }
}

/**
 * Map an agent status to a speech bubble type for visual display.
 */
function mapStatusToBubbleType(
  status: RuntimeAgentState["status"]
): "activity" | "recommendation" | "question" | "alert" | "greeting" {
  switch (status) {
    case "WORKING":
    case "THINKING":
      return "activity";
    case "AWAITING_APPROVAL":
      return "question";
    case "ERROR":
    case "SECURITY_ALERT":
      return "alert";
    default:
      return "activity";
  }
}

/**
 * Build an OfficeCharacter from a RuntimeAgentState.
 */
export function buildOfficeCharacter(
  state: RuntimeAgentState,
  display_name: string,
  role: AgentRole
): OfficeCharacter {
  const visual_state = mapStatusToVisualState(state.status);
  const desk_position = DESK_POSITIONS[state.agent_key] ?? { x: 50, y: 50, z: 5, scale: 1.0 };

  let speech_bubble: OfficeCharacter["speech_bubble"] = null;
  if (state.current_task_description) {
    speech_bubble = {
      text: state.current_task_description,
      type: mapStatusToBubbleType(state.status),
    };
  }

  return {
    agent_key: state.agent_key,
    display_name,
    role,
    desk_position,
    visual_state,
    speech_bubble,
  };
}
