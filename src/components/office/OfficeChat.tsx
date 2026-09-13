"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { getCharacterAssets } from "@/lib/office/character-assets";
import type { AgentKey } from "@/lib/agents/definitions";

/**
 * Office Chat Component
 *
 * Provides the AI Office Chat interface.
 * Users can communicate with Zue (primary) or individual agents.
 *
 * Phase 9: Integrates with investigation engine for full investigation flow.
 */

export interface ChatMessage {
  id: string;
  agent_key: AgentKey;
  text: string;
  timestamp: string;
  is_user: boolean;
  is_system?: boolean;
  is_investigation?: boolean;
  findings?: Array<{ title: string; summary: string; epistemic_type: string }>;
  insights?: Array<{ title: string; description: string; confidence: number }>;
  recommendations?: Array<{ title: string; description: string; requires_approval: boolean }>;
  data_gaps?: string[];
  specialist_failures?: Array<{ agent_key: string; error: string }>;
}

export interface OfficeChatProps {
  /** Currently selected agent for chat */
  selected_agent?: AgentKey;
  /** Callback when a message is sent */
  onSendMessage?: (text: string, agent_key: AgentKey) => void;
  /** Whether the AI provider is available */
  ai_available?: boolean;
}

const AVAILABLE_AGENTS: { key: AgentKey; name: string }[] = [
  { key: "zue", name: "Zue" },
  { key: "erni", name: "Erni" },
  { key: "sheera", name: "Sheera" },
  { key: "eddy", name: "Eddy" },
  { key: "carol", name: "Carol" },
  { key: "ayuni", name: "Ayuni" },
  { key: "alex", name: "Alex" },
  { key: "tehna", name: "Tehna" },
  { key: "kopi", name: "Kopi" },
  { key: "adik", name: "Adik" },
];

export function OfficeChat({
  selected_agent = "zue",
  onSendMessage,
  ai_available = false,
}: OfficeChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeAgent, setActiveAgent] = useState<AgentKey>(selected_agent);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      agent_key: activeAgent,
      text: input.trim(),
      timestamp: new Date().toISOString(),
      is_user: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    onSendMessage?.(input.trim(), activeAgent);
    const taskText = input.trim();
    setInput("");

    if (!ai_available) {
      const systemMessage: ChatMessage = {
        id: crypto.randomUUID(),
        agent_key: activeAgent,
        text: "AI provider is not yet configured. Please configure an AI provider to enable the AI workforce.",
        timestamp: new Date().toISOString(),
        is_user: false,
        is_system: true,
      };
      setMessages((prev) => [...prev, systemMessage]);
      return;
    }

    // Invoke agent via API
    setIsProcessing(true);
    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_key: activeAgent,
          task: taskText,
          mode: activeAgent === "zue" ? "orchestrate" : "direct",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          agent_key: activeAgent,
          text: data.error ?? "Failed to process request",
          timestamp: new Date().toISOString(),
          is_user: false,
          is_system: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
        return;
      }

      // Build investigation response
      if (data.mode === "orchestrate") {
        const agentMessage: ChatMessage = {
          id: crypto.randomUUID(),
          agent_key: activeAgent,
          text: data.synthesis ?? "Investigation complete.",
          timestamp: new Date().toISOString(),
          is_user: false,
          is_investigation: true,
          findings: data.findings?.map((f: any) => ({
            title: f.title,
            summary: f.summary,
            epistemic_type: f.epistemic_type,
          })),
          insights: data.insights?.map((i: any) => ({
            title: i.title,
            description: i.description,
            confidence: i.confidence,
          })),
          recommendations: data.recommendations?.map((r: any) => ({
            title: r.title,
            description: r.description,
            requires_approval: r.requires_approval,
          })),
          data_gaps: data.data_gaps,
          specialist_failures: data.specialist_failures,
        };
        setMessages((prev) => [...prev, agentMessage]);
      } else {
        // Direct agent response
        const agentName = AVAILABLE_AGENTS.find((a) => a.key === activeAgent)?.name ?? activeAgent;
        let responseText = "";

        if (data.findings && data.findings.length > 0) {
          const findingParts = data.findings.map((f: any) => {
            const typeLabel = f.epistemic_type === "FACT" ? "[Fact]" : f.epistemic_type === "INFERENCE" ? "[Inference]" : "[Hypothesis]";
            return `${typeLabel} ${f.title}\n${f.summary}`;
          });
          responseText = findingParts.join("\n\n");
        } else {
          responseText = `Analysis complete. No specific findings generated. The ${agentName} team has reviewed your request.`;
        }

        const agentMessage: ChatMessage = {
          id: crypto.randomUUID(),
          agent_key: activeAgent,
          text: responseText,
          timestamp: new Date().toISOString(),
          is_user: false,
          findings: data.findings?.map((f: any) => ({
            title: f.title,
            summary: f.summary,
            epistemic_type: f.epistemic_type,
          })),
        };
        setMessages((prev) => [...prev, agentMessage]);
      }
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        agent_key: activeAgent,
        text: "An error occurred while processing your request. Please try again.",
        timestamp: new Date().toISOString(),
        is_user: false,
        is_system: true,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const agentAssets = getCharacterAssets(activeAgent);

  return (
    <div className="office-panel-elevated flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--office-border)] p-4">
        <div className="flex items-center gap-3">
          <div className="relative h-8 w-8 overflow-hidden rounded-full border border-[var(--office-border)]">
            <Image
              src={agentAssets.avatar}
              alt={activeAgent}
              fill
              className="object-cover"
              sizes="32px"
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--office-text-primary)]">
              AI Office Chat
            </h3>
            <p className="text-[11px] text-[var(--office-text-muted)]">
              Chatting with{" "}
              {AVAILABLE_AGENTS.find((a) => a.key === activeAgent)?.name}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="rounded p-1 text-[var(--office-text-muted)] hover:bg-[var(--office-surface-hover)] hover:text-[var(--office-text-primary)]"
          aria-label={isExpanded ? "Collapse chat" : "Expand chat"}
        >
          {isExpanded ? "−" : "+"}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Agent Selector */}
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--office-border)] p-2">
            {AVAILABLE_AGENTS.map((agent) => {
              const assets = getCharacterAssets(agent.key);
              return (
                <button
                  key={agent.key}
                  onClick={() => setActiveAgent(agent.key)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs transition-colors ${
                    activeAgent === agent.key
                      ? "bg-[var(--office-accent)] text-white"
                      : "text-[var(--office-text-secondary)] hover:bg-[var(--office-surface-hover)]"
                  }`}
                  aria-label={`Chat with ${agent.name}`}
                >
                  <div className="relative h-5 w-5 overflow-hidden rounded-full">
                    <Image
                      src={assets.avatar}
                      alt={agent.name}
                      fill
                      className="object-cover"
                      sizes="20px"
                    />
                  </div>
                  <span>{agent.name}</span>
                </button>
              );
            })}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border-2 border-[var(--office-border)] bg-[var(--office-surface)]">
                  <Image
                    src={agentAssets.avatar}
                    alt={activeAgent}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--office-text-primary)]">
                  {activeAgent === "zue"
                    ? "How can I help coordinate your business today?"
                    : `Ready to assist with ${
                        activeAgent === "erni"
                          ? "business intelligence"
                          : activeAgent === "sheera"
                          ? "marketing"
                          : activeAgent === "eddy"
                          ? "sales"
                          : activeAgent === "carol"
                          ? "finance"
                          : activeAgent === "ayuni"
                          ? "HR"
                          : activeAgent === "alex"
                          ? "funding"
                          : activeAgent === "tehna"
                          ? "operations"
                          : activeAgent === "kopi"
                          ? "security"
                          : "your needs"
                      }.`}
                </p>
                <p className="mt-1 text-xs text-[var(--office-text-muted)]">
                  {ai_available
                    ? "Type a message to start a conversation."
                    : "AI provider not yet configured."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_user ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                        msg.is_user
                          ? "bg-[var(--office-accent)] text-white"
                          : msg.is_system
                          ? "bg-[var(--office-surface)] text-[var(--office-text-muted)] italic"
                          : msg.is_investigation
                          ? "bg-[var(--office-surface-elevated)] text-[var(--office-text-primary)] border border-[var(--office-accent)]/30"
                          : "bg-[var(--office-surface-elevated)] text-[var(--office-text-primary)]"
                      }`}
                    >
                      {/* Main text */}
                      <p className="whitespace-pre-wrap">{msg.text}</p>

                      {/* Investigation details */}
                      {msg.is_investigation && msg.insights && msg.insights.length > 0 && (
                        <div className="mt-3 border-t border-[var(--office-border)] pt-2">
                          <p className="text-xs font-semibold text-[var(--office-accent)] mb-1">Key Insights:</p>
                          {msg.insights.map((insight, idx) => (
                            <p key={idx} className="text-xs text-[var(--office-text-secondary)] mb-1">
                              {insight.title}: {insight.description} ({Math.round(insight.confidence * 100)}% confidence)
                            </p>
                          ))}
                        </div>
                      )}

                      {msg.is_investigation && msg.recommendations && msg.recommendations.length > 0 && (
                        <div className="mt-2 border-t border-[var(--office-border)] pt-2">
                          <p className="text-xs font-semibold text-[var(--office-accent)] mb-1">Recommendations:</p>
                          {msg.recommendations.map((rec, idx) => (
                            <p key={idx} className="text-xs text-[var(--office-text-secondary)] mb-1">
                              {rec.requires_approval ? "[Approval Required] " : ""}{rec.title}
                            </p>
                          ))}
                        </div>
                      )}

                      {msg.is_investigation && msg.data_gaps && msg.data_gaps.length > 0 && (
                        <div className="mt-2 border-t border-[var(--office-border)] pt-2">
                          <p className="text-xs font-semibold text-yellow-500 mb-1">Data Gaps:</p>
                          {msg.data_gaps.map((gap, idx) => (
                            <p key={idx} className="text-xs text-[var(--office-text-muted)] mb-1">{gap}</p>
                          ))}
                        </div>
                      )}

                      <time
                        className="mt-1 block text-[10px] opacity-70"
                        dateTime={msg.timestamp}
                      >
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-[var(--office-border)] p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Type a message..."
                className="chat-input flex-1"
                aria-label="Chat message input"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="rounded-lg bg-[var(--office-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--office-accent-hover)] disabled:opacity-50"
                aria-label="Send message"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
