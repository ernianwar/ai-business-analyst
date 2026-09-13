"use client";

import Image from "next/image";
import type { AgentKey, AgentRole } from "@/lib/agents/definitions";
import type { AgentStatus } from "@/lib/state/agent-state";

/**
 * Character Card Component
 *
 * Renders an agent character in the Virtual Office.
 * Shows character image, name, role, status, and speech bubble.
 *
 * The character artwork is loaded from /public/assets/workforce/{agent_key}/{agent_key}_v1.png
 * The character identity is determined by agent_key, not by the image filename.
 */

export interface CharacterCardProps {
  agent_key: AgentKey;
  display_name: string;
  role: AgentRole;
  status: AgentStatus;
  avatar_path: string;
  speech_text?: string | null;
  speech_type?: "activity" | "recommendation" | "question" | "alert" | "greeting";
  /** Position styles for the office layout */
  position_style?: React.CSSProperties;
  /** Optional: scale factor for the character */
  scale?: number;
  /** Optional: callback when character is clicked */
  onClick?: () => void;
  /** Optional: show as compact (for sidebar/directory) */
  compact?: boolean;
}

/**
 * Map agent status to visual state label.
 */
function getStatusLabel(status: AgentStatus): string {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "WORKING":
      return "Working";
    case "THINKING":
      return "Thinking";
    case "WAITING":
      return "Waiting";
    case "AWAITING_APPROVAL":
      return "Needs Approval";
    case "COMPLETED":
      return "Completed";
    case "OFF_DUTY":
      return "Off Duty";
    case "ERROR":
      return "Error";
    case "SECURITY_ALERT":
      return "Security Alert";
    default:
      return "Unknown";
  }
}

/**
 * Map agent role to display label.
 */
function getRoleLabel(role: AgentRole): string {
  const labels: Record<AgentRole, string> = {
    orchestrator: "Workforce Manager",
    business_intelligence: "BI & Strategy",
    marketing: "Marketing & Creative",
    sales: "Sales & Opportunities",
    finance: "Finance & Accounting",
    hr: "HR & People Ops",
    funding: "Funding & Growth",
    operations: "Operations",
    security: "Security Guardian",
    companion: "Office Companion",
  };
  return labels[role] || role;
}

/**
 * Get status dot CSS class.
 */
function getStatusDotClass(status: AgentStatus): string {
  switch (status) {
    case "AVAILABLE":
    case "COMPLETED":
      return "status-dot-available";
    case "WORKING":
    case "THINKING":
    case "WAITING":
    case "AWAITING_APPROVAL":
      return "status-dot-working";
    case "ERROR":
    case "SECURITY_ALERT":
      return "status-dot-error";
    case "OFF_DUTY":
      return "status-dot-offline";
    default:
      return "status-dot-offline";
  }
}

export function CharacterCard({
  agent_key,
  display_name,
  role,
  status,
  avatar_path,
  speech_text,
  position_style,
  scale = 1,
  onClick,
  compact = false,
}: CharacterCardProps) {
  if (compact) {
    return (
      <div
        className="character-card flex items-center gap-3 rounded-lg p-3 hover:bg-[var(--office-surface-hover)]"
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 border-[var(--office-border)]">
          <Image
            src={avatar_path}
            alt={display_name}
            fill
            className="object-cover"
            sizes="40px"
          />
          <span
            className={`status-dot absolute bottom-0 right-0 ${getStatusDotClass(status)}`}
            aria-label={`Status: ${getStatusLabel(status)}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--office-text-primary)]">
            {display_name}
          </p>
          <p className="truncate text-xs text-[var(--office-text-muted)]">
            {getRoleLabel(role)}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-[var(--office-text-muted)]">
          {getStatusLabel(status)}
        </span>
      </div>
    );
  }

  return (
    <div
      className="character-card relative flex flex-col items-center"
      style={{
        ...position_style,
        transform: `scale(${scale})`,
        transformOrigin: "bottom center",
      }}
    >
      {/* Speech Bubble */}
      {speech_text && (
        <div className="speech-bubble absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full">
          <p className="text-[var(--office-text-primary)]">{speech_text}</p>
        </div>
      )}

      {/* Character Image */}
      <div
        className="relative h-24 w-24 overflow-hidden rounded-full border-3 border-[var(--office-border)] bg-[var(--office-surface)] shadow-lg"
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
      >
        <Image
          src={avatar_path}
          alt={display_name}
          fill
          className="object-cover"
          sizes="96px"
        />
        <span
          className={`status-dot absolute bottom-1 right-1 ${getStatusDotClass(status)}`}
          aria-label={`Status: ${getStatusLabel(status)}`}
        />
      </div>

      {/* Name & Role */}
      <div className="mt-2 text-center">
        <p className="text-sm font-semibold text-[var(--office-text-primary)]">
          {display_name}
        </p>
        <p className="text-[11px] text-[var(--office-text-muted)]">
          {getRoleLabel(role)}
        </p>
      </div>
    </div>
  );
}
