"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import {
  AGENT_DEFINITIONS,
  getAgentDefinition,
  type AgentKey,
} from "@/lib/agents/definitions";
import { getCharacterAssets } from "@/lib/office/character-assets";
import { SpeechBubble } from "./SpeechBubble";
import { OfficeChat } from "./OfficeChat";

/**
 * SALAM LIT — Virtual AI Business Office Component
 *
 * The primary product experience.
 * Users should feel: "I have walked into my AI business office."
 *
 * Phase 13C.0: Refactored to use authenticated API boundary.
 * All server-side runtime state is fetched via GET /api/office/state.
 * No direct imports of server-side runtime stores.
 *
 * CRITICAL: This component MUST NOT import:
 * - agentStateStore
 * - officeEventStore
 * - isAIAvailable
 * - Any server-side runtime module
 *
 * All data flows through: API → React state → UI
 */

// ─── Types ──────────────────────────────────────────────────────

interface OfficeAgent {
  agent_key: AgentKey;
  status: string;
  current_task_description: string | null;
  state_changed_at: string;
  active_task_id: string | null;
}

interface OfficeEvent {
  id: string;
  type: string;
  agent_key: AgentKey;
  summary: string;
  timestamp: string;
  severity?: string;
}

interface WorkQueueItem {
  trigger_id: string;
  summary: string;
  priority: string;
  status: string;
  status_label: string;
  recommendation_count: number;
  agent_keys: string[];
  created_at: string;
}

interface OfficeState {
  success: boolean;
  business_id: string;
  agents: OfficeAgent[];
  events: OfficeEvent[];
  work_queue: {
    total: number;
    critical: number;
    important: number;
    upcoming: number;
    routine: number;
    items: WorkQueueItem[];
  };
  pending_decisions: number;
  pending_approvals: number;
  ai_available: boolean;
  last_evaluation_at: string | null;
}

export interface VirtualOfficeProps {
  onAgentClick?: (agent_key: AgentKey) => void;
  onOpenChat?: (agent_key?: AgentKey) => void;
}

// ─── Constants ──────────────────────────────────────────────────

const DESK_POSITIONS: Record<AgentKey, { x: number; y: number }> = {
  zue:    { x: 50, y: 8 },
  erni:   { x: 15, y: 28 },
  sheera: { x: 38, y: 28 },
  eddy:   { x: 62, y: 28 },
  carol:  { x: 85, y: 28 },
  ayuni:  { x: 15, y: 55 },
  alex:   { x: 38, y: 55 },
  tehna:  { x: 62, y: 55 },
  kopi:   { x: 25, y: 78 },
  adik:   { x: 75, y: 78 },
};

const AGENT_GREETINGS: Record<AgentKey, string> = {
  zue: "Ready to coordinate your business.",
  erni: "Ready to analyze your business intelligence.",
  sheera: "Ready to assist with marketing.",
  eddy: "Ready to find opportunities.",
  carol: "Ready to review finances.",
  ayuni: "Ready to help with people operations.",
  alex: "Ready to explore funding options.",
  tehna: "Ready to optimize operations.",
  kopi: "Security is being monitored.",
  adik: "Hey there! Need a break?",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-400/10",
  IMPORTANT: "text-orange-400 bg-orange-400/10",
  UPCOMING: "text-yellow-400 bg-yellow-400/10",
  ROUTINE: "text-blue-400 bg-blue-400/10",
  INFO: "text-gray-400 bg-gray-400/10",
};

const POLL_INTERVAL_MS = 10_000;

const VALID_ROUTES: Record<string, string> = {
  BUSINESS: "/business",
  DECISIONS: "/decisions",
  FINANCE: "/finance",
  "DATA SOURCES": "/data-sources",
};

// ─── Component ──────────────────────────────────────────────────

export function VirtualOffice({ onAgentClick, onOpenChat }: VirtualOfficeProps) {
  const [officeData, setOfficeData] = useState<OfficeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentKey | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  const fetchingRef = useRef(false);

  // ─── Data Fetching ──────────────────────────────────────────

  const fetchOfficeState = useCallback(async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const res = await fetch("/api/office/state", { cache: "no-store" });

      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }

      const data = await res.json();

      if (data.requires_onboarding) {
        window.location.href = "/onboarding";
        return;
      }

      if (data.success) {
        setOfficeData(data);
        setError(null);
      } else {
        setError(data.error ?? "Failed to load office state");
      }
    } catch {
      setError("Could not connect to office state");
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchOfficeState();
    const interval = setInterval(fetchOfficeState, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOfficeState]);

  // ─── Run Business Check ─────────────────────────────────────

  const handleRunCheck = useCallback(async () => {
    if (isChecking) return;
    setIsChecking(true);
    setCheckMessage(null);
    try {
      const res = await fetch("/api/proactive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
          action: "evaluate",
          specialist_scope: ["erni"],
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCheckMessage(data.message ?? "Business check complete.");
        await fetchOfficeState();
      } else {
        setCheckMessage(data.error ?? "Business check failed.");
      }
    } catch {
      setCheckMessage("Could not complete business check.");
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, fetchOfficeState]);

  // ─── Agent Interaction ──────────────────────────────────────

  const handleAgentClick = (key: AgentKey) => {
    setSelectedAgent(key === selectedAgent ? null : key);
    onAgentClick?.(key);
  };

  // ─── Loading State ──────────────────────────────────────────

  if (loading && !officeData) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-[var(--office-bg)]">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[var(--office-accent)] border-t-transparent" />
          <p className="mt-4 text-sm text-[var(--office-text-muted)]">
            Loading office state...
          </p>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────

  if (error && !officeData) {
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-[var(--office-bg)]">
        <div className="text-center">
          <p className="text-sm text-[var(--office-danger)]">{error}</p>
          <button
            onClick={fetchOfficeState}
            className="mt-4 rounded-lg bg-[var(--office-accent)] px-4 py-2 text-sm text-white hover:bg-[var(--office-accent-hover)]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const data = officeData!;
  const agentKeys = Object.keys(AGENT_DEFINITIONS) as AgentKey[];

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      {/* Office Background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 50% 0%, rgba(249, 115, 22, 0.08) 0%, transparent 50%),
            radial-gradient(ellipse at 20% 50%, rgba(59, 130, 246, 0.04) 0%, transparent 40%),
            radial-gradient(ellipse at 80% 50%, rgba(34, 197, 94, 0.04) 0%, transparent 40%),
            linear-gradient(180deg, #0f1724 0%, #1a2332 100%)
          `,
        }}
        aria-hidden="true"
      />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, rgba(249, 115, 22, 0.06) 0%, transparent 60%)`,
        }}
        aria-hidden="true"
      />

      {/* Top Bar */}
      <header className="relative z-10 flex items-center justify-between border-b border-[var(--office-border)] bg-[var(--office-surface)]/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--office-accent)]">
              <span className="text-sm font-bold text-white">SL</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--office-text-primary)]">SALAM LIT</h1>
              <p className="text-[10px] text-[var(--office-text-muted)]">AI Business Office</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">👥</span>
            <div>
              <p className="text-xs text-[var(--office-text-muted)]">AI Staff</p>
              <p className="text-sm font-bold text-[var(--office-text-primary)]">{agentKeys.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <div>
              <p className="text-xs text-[var(--office-text-muted)]">Active</p>
              <p className="text-sm font-bold text-[var(--office-accent)]">
                {data.agents.filter((s) => s.status === "WORKING" || s.status === "THINKING").length || "\u2014"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <div>
              <p className="text-xs text-[var(--office-text-muted)]">Alerts</p>
              <p className="text-sm font-bold text-[var(--office-text-primary)]">
                {data.work_queue.total || "\u2014"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">⚖️</span>
            <div>
              <p className="text-xs text-[var(--office-text-muted)]">Decisions</p>
              <p className="text-sm font-bold text-[var(--office-accent)]">
                {data.pending_decisions || "\u2014"}
              </p>
            </div>
          </div>
          <a
            href="/decisions?tab=approvals"
            className="flex items-center gap-2"
          >
            <span className="text-lg">✅</span>
            <div>
              <p className="text-xs text-[var(--office-text-muted)]">Approvals</p>
              <p className="text-sm font-bold text-[var(--office-accent)]">
                {data.pending_approvals || "\u2014"}
              </p>
            </div>
          </a>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-lg">{data.ai_available ? "🟢" : "⚪"}</span>
          <div>
            <p className="text-xs text-[var(--office-text-muted)]">AI Status</p>
            <p className="text-sm font-bold text-[var(--office-text-muted)]">
              {data.ai_available ? "Available" : "Not Configured"}
            </p>
          </div>
        </div>
      </header>

      {/* Main Office Area */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        {/* Left Sidebar — Today's Focus */}
        <aside className="hidden w-64 shrink-0 border-r border-[var(--office-border)] bg-[var(--office-surface)]/60 p-4 backdrop-blur-sm lg:block">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--office-text-secondary)]">
              Today&apos;s Focus
            </h2>
            <button
              onClick={handleRunCheck}
              disabled={isChecking}
              className="rounded-md bg-[var(--office-accent)] px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-[var(--office-accent-hover)] disabled:opacity-50"
              aria-label="Run business check"
            >
              {isChecking ? "Checking..." : "Run Check"}
            </button>
          </div>

          {checkMessage && (
            <div className="mb-3 rounded-md border border-[var(--office-border)] bg-[var(--office-surface)] p-2">
              <p className="text-[10px] text-[var(--office-text-secondary)]">{checkMessage}</p>
            </div>
          )}

          {data.work_queue.items.length > 0 ? (
            <div className="space-y-2">
              {data.work_queue.items.map((item) => (
                <div
                  key={item.trigger_id}
                  className="rounded-lg border border-[var(--office-border)] bg-[var(--office-surface)] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-[var(--office-text-primary)] line-clamp-2">
                      {item.summary}
                    </p>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_COLORS[item.priority] ?? ""}`}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] text-[var(--office-text-muted)]">
                      {item.status_label}
                    </span>
                    {item.recommendation_count > 0 && (
                      <span className="text-[10px] text-[var(--office-accent)]">
                        {item.recommendation_count} recommendation(s)
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-[var(--office-text-muted)]">No active alerts.</p>
              <p className="mt-1 text-xs text-[var(--office-text-muted)]">
                No business events currently require attention.
              </p>
              {!data.ai_available && (
                <p className="mt-2 text-[10px] text-[var(--office-text-muted)]">
                  Configure an AI provider to enable proactive monitoring.
                </p>
              )}
            </div>
          )}

          {/* Recent Activity */}
          <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wider text-[var(--office-text-secondary)]">
            Recent Activity
          </h2>
          <div className="space-y-2">
            {data.events.slice(0, 5).map((event) => (
              <div
                key={event.id}
                className="rounded border border-[var(--office-border)] bg-[var(--office-surface)] p-2"
              >
                <p className="text-[10px] text-[var(--office-text-muted)]">
                  {getAgentDefinition(event.agent_key).default_display_name}: {event.summary}
                </p>
                <time className="text-[9px] text-[var(--office-text-muted)]">
                  {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
            ))}
            {data.events.length === 0 && (
              <p className="text-xs text-[var(--office-text-muted)]">No workforce activity yet.</p>
            )}
          </div>
        </aside>

        {/* Center — Office Space */}
        <main className="relative flex-1">
          {agentKeys.map((key) => {
            const def = getAgentDefinition(key);
            const assets = getCharacterAssets(key);
            const agentState = data.agents.find((s) => s.agent_key === key);
            const position = DESK_POSITIONS[key];
            const status = agentState?.status ?? "AVAILABLE";

            const speechText =
              agentState?.current_task_description ||
              (status === "AVAILABLE" ? AGENT_GREETINGS[key] : null);

            return (
              <div
                key={key}
                className="absolute flex flex-col items-center"
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  transform: "translate(-50%, 0)",
                }}
              >
                {speechText && (
                  <div className="mb-2 w-48">
                    <SpeechBubble
                      agent_key={key}
                      display_name={def.default_display_name}
                      text={speechText}
                      timestamp={agentState?.state_changed_at ?? new Date().toISOString()}
                      type={
                        status === "WORKING"
                          ? "activity"
                          : status === "THINKING"
                          ? "activity"
                          : status === "AWAITING_APPROVAL"
                          ? "question"
                          : status === "ERROR" || status === "SECURITY_ALERT"
                          ? "alert"
                          : "greeting"
                      }
                    />
                  </div>
                )}

                <button
                  onClick={() => handleAgentClick(key)}
                  className={`group relative h-20 w-20 overflow-hidden rounded-full border-2 transition-all duration-200 ${
                    selectedAgent === key
                      ? "border-[var(--office-accent)] shadow-lg shadow-[var(--office-glow)]"
                      : "border-[var(--office-border)] hover:border-[var(--office-accent)]/50 hover:shadow-md"
                  } bg-[var(--office-surface)]`}
                  aria-label={`${def.default_display_name} — ${def.description}. Status: ${status}`}
                >
                  <Image
                    src={assets.avatar}
                    alt={def.default_display_name}
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                  <span
                    className={`status-dot absolute bottom-0.5 right-0.5 ${
                      status === "AVAILABLE" || status === "COMPLETED"
                        ? "status-dot-available"
                        : status === "WORKING" || status === "THINKING"
                        ? "status-dot-working"
                        : status === "ERROR" || status === "SECURITY_ALERT"
                        ? "status-dot-error"
                        : "status-dot-offline"
                    }`}
                    aria-hidden="true"
                  />
                </button>

                <div className="mt-1.5 text-center">
                  <p className="text-xs font-semibold text-[var(--office-text-primary)]">
                    {def.default_display_name}
                  </p>
                  <p className="text-[10px] text-[var(--office-text-muted)]">
                    {def.role === "orchestrator"
                      ? "Workforce Manager"
                      : def.role === "business_intelligence"
                      ? "BI & Strategy"
                      : def.role === "marketing"
                      ? "Marketing"
                      : def.role === "sales"
                      ? "Sales"
                      : def.role === "finance"
                      ? "Finance"
                      : def.role === "hr"
                      ? "HR"
                      : def.role === "funding"
                      ? "Funding"
                      : def.role === "operations"
                      ? "Operations"
                      : def.role === "security"
                      ? "Security"
                      : "Companion"}
                  </p>
                </div>
              </div>
            );
          })}
        </main>

        {/* Right Sidebar — AI Office Chat */}
        <aside className="hidden w-72 shrink-0 border-l border-[var(--office-border)] bg-[var(--office-surface)]/60 backdrop-blur-sm xl:flex xl:flex-col">
          <OfficeChat
            selected_agent={selectedAgent ?? "zue"}
            ai_available={data.ai_available}
          />
        </aside>
      </div>

      {/* Bottom Navigation */}
      <nav className="relative z-10 flex items-center justify-center gap-8 border-t border-[var(--office-border)] bg-[var(--office-surface)]/80 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[var(--office-accent)]">
            <span className="text-[10px] font-bold text-white">SL</span>
          </div>
          <span className="text-xs font-semibold text-[var(--office-text-muted)]">SALAM LIT</span>
        </div>
        {Object.entries(VALID_ROUTES).map(([label, path]) => (
          <a
            key={label}
            href={path}
            className="text-xs font-medium text-[var(--office-text-muted)] transition-colors hover:text-[var(--office-text-primary)]"
          >
            {label}
            {label === "DECISIONS" && data.pending_decisions > 0 && (
              <span className="ml-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {data.pending_decisions}
              </span>
            )}
          </a>
        ))}
      </nav>
    </div>
  );
}
