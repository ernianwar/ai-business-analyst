"use client";

import type { OfficeExperienceEvent } from "@/lib/events/office-events";
import { getCharacterAssets } from "@/lib/office/character-assets";

/**
 * Activity Feed Component
 *
 * Displays recent office activity from real Office Experience Events.
 *
 * Phase 3: UI foundation only.
 * Activity must come from real events — not fabricated.
 */

export interface ActivityFeedProps {
  /** Real office events — not fabricated */
  events?: OfficeExperienceEvent[];
  /** Maximum number of events to display */
  max_items?: number;
}

function getEventIcon(type: OfficeExperienceEvent["type"]): string {
  switch (type) {
    case "AGENT_STARTED_WORK":
      return "▶";
    case "AGENT_THINKING":
      return "◉";
    case "AGENT_FOUND_INFORMATION":
      return "📋";
    case "AGENT_COMPLETED_WORK":
      return "✓";
    case "AGENT_NEEDS_APPROVAL":
      return "⚠";
    case "AGENT_ERROR":
      return "✕";
    case "SECURITY_ALERT":
      return "🛡";
    case "AGENT_MESSAGE":
      return "💬";
    case "RECOMMENDATION_READY":
      return "💡";
    case "APPROVAL_REQUESTED":
      return "⏳";
    default:
      return "●";
  }
}

function getEventTypeLabel(type: OfficeExperienceEvent["type"]): string {
  switch (type) {
    case "AGENT_STARTED_WORK":
      return "Started working";
    case "AGENT_THINKING":
      return "Analyzing";
    case "AGENT_FOUND_INFORMATION":
      return "Found information";
    case "AGENT_COMPLETED_WORK":
      return "Completed";
    case "AGENT_NEEDS_APPROVAL":
      return "Needs approval";
    case "AGENT_ERROR":
      return "Error";
    case "SECURITY_ALERT":
      return "Security alert";
    case "AGENT_MESSAGE":
      return "Message";
    case "RECOMMENDATION_READY":
      return "Recommendation";
    case "APPROVAL_REQUESTED":
      return "Approval requested";
    default:
      return type;
  }
}

export function ActivityFeed({
  events = [],
  max_items = 10,
}: ActivityFeedProps) {
  const displayEvents = events.slice(0, max_items);

  return (
    <div className="office-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--office-text-secondary)]">
          Activity Feed
        </h2>
        {events.length > max_items && (
          <span className="text-[11px] text-[var(--office-text-muted)]">
            +{events.length - max_items} more
          </span>
        )}
      </div>

      {displayEvents.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-[var(--office-text-muted)]">
            No recent activity.
          </p>
          <p className="mt-1 text-xs text-[var(--office-text-muted)]">
            Activity will appear here as your workforce operates.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayEvents.map((event) => {
            const assets = getCharacterAssets(event.agent_key);
            return (
              <div key={event.id} className="activity-item">
                <div className="flex items-start gap-3">
                  <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-[var(--office-border)]">
                    <img
                      src={assets.avatar}
                      alt={event.agent_key}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{getEventIcon(event.type)}</span>
                      <span className="text-xs font-medium text-[var(--office-text-secondary)]">
                        {getEventTypeLabel(event.type)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-[var(--office-text-primary)]">
                      {event.summary}
                    </p>
                  </div>
                  <time
                    className="shrink-0 text-[10px] text-[var(--office-text-muted)]"
                    dateTime={event.timestamp}
                  >
                    {new Date(event.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
