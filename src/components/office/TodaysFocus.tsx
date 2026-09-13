"use client";

import type { AgentKey } from "@/lib/agents/definitions";
import { getCharacterAssets } from "@/lib/office/character-assets";

/**
 * Today's Focus Component
 *
 * Displays the "Today's Tasks" panel from the Virtual Office.
 *
 * Phase 3: UI foundation only.
 * Tasks must come from real data — not fabricated.
 */

export interface Task {
  id: string;
  title: string;
  agent_key: AgentKey;
  status: "pending" | "in_progress" | "completed" | "awaiting_approval";
}

export interface TodaysFocusProps {
  /** Tasks from real system events — not fabricated */
  tasks?: Task[];
}

export function TodaysFocus({ tasks = [] }: TodaysFocusProps) {
  return (
    <div className="office-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--office-text-secondary)]">
          Today&apos;s Focus
        </h2>
      </div>

      {tasks.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-[var(--office-text-muted)]">
            No active work yet.
          </p>
          <p className="mt-1 text-xs text-[var(--office-text-muted)]">
            Tasks will appear here when your AI workforce starts working.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const assets = getCharacterAssets(task.agent_key);
            return (
              <div key={task.id} className="activity-item">
                <div className="flex items-center gap-3">
                  <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-[var(--office-border)]">
                    <img
                      src={assets.avatar}
                      alt={task.agent_key}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[var(--office-text-primary)]">
                      {task.title}
                    </p>
                    <p className="text-[11px] capitalize text-[var(--office-text-muted)]">
                      {task.status.replace("_", " ")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-semibold uppercase ${
                      task.status === "completed"
                        ? "text-[var(--office-success)]"
                        : task.status === "awaiting_approval"
                        ? "text-[var(--office-warning)]"
                        : task.status === "in_progress"
                        ? "text-[var(--office-accent)]"
                        : "text-[var(--office-text-muted)]"
                    }`}
                  >
                    {task.status === "completed"
                      ? "Done"
                      : task.status === "awaiting_approval"
                      ? "Approval"
                      : task.status === "in_progress"
                      ? "Active"
                      : "Pending"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
