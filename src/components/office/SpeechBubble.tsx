"use client";

import { useEffect, useState } from "react";

/**
 * Speech Bubble Component
 *
 * Renders a contextual speech bubble for an agent in the office.
 *
 * Architecture:
 *   Event → Speech Bubble Generator → This Component
 *
 * Phase 3: Renders text from Office Experience Events.
 * If no real event exists, shows nothing (not fake text).
 */

export interface SpeechBubbleProps {
  /** Agent key for the speaker */
  agent_key: string;
  /** Display name of the agent */
  display_name: string;
  /** The text to display */
  text: string;
  /** Timestamp for accessibility */
  timestamp: string;
  /** Optional: type of speech for visual differentiation */
  type?: "activity" | "recommendation" | "question" | "alert" | "greeting";
  /** Optional: urgency level */
  urgency?: "low" | "medium" | "high";
  /** Optional: callback when bubble is clicked */
  onClick?: () => void;
  /** Optional: auto-dismiss after milliseconds (0 = no dismiss) */
  autoDismissMs?: number;
}

export function SpeechBubble({
  agent_key,
  display_name,
  text,
  timestamp,
  type = "activity",
  urgency = "low",
  onClick,
  autoDismissMs = 0,
}: SpeechBubbleProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoDismissMs > 0) {
      const timer = setTimeout(() => setVisible(false), autoDismissMs);
      return () => clearTimeout(timer);
    }
  }, [autoDismissMs]);

  if (!visible || !text) return null;

  const typeStyles: Record<string, string> = {
    activity: "",
    recommendation: "border-l-2 border-l-[var(--office-info)]",
    question: "border-l-2 border-l-[var(--office-warning)]",
    alert: "border-l-2 border-l-[var(--office-danger)]",
    greeting: "border-l-2 border-l-[var(--office-success)]",
  };

  const urgencyLabel =
    urgency === "high"
      ? "Urgent"
      : urgency === "medium"
      ? "Important"
      : null;

  return (
    <div
      className={`speech-bubble ${typeStyles[type] || ""} ${
        onClick ? "cursor-pointer hover:opacity-90" : ""
      }`}
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
      aria-label={`${display_name} says: ${text}`}
    >
      <p className="text-[var(--office-text-primary)]">{text}</p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <time
          className="text-[11px] text-[var(--office-text-muted)]"
          dateTime={timestamp}
        >
          {new Date(timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
        {urgencyLabel && (
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide ${
              urgency === "high"
                ? "text-[var(--office-danger)]"
                : "text-[var(--office-warning)]"
            }`}
          >
            {urgencyLabel}
          </span>
        )}
      </div>
    </div>
  );
}
