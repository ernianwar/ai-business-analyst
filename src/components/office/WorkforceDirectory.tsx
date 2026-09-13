"use client";

import {
  AGENT_DEFINITIONS,
  getAgentDefinition,
  type AgentKey,
} from "@/lib/agents/definitions";
import { getCharacterAssets } from "@/lib/office/character-assets";
import type { RuntimeAgentState } from "@/lib/state/agent-state";
import { CharacterCard } from "./CharacterCard";

/**
 * AI Workforce Directory Component
 *
 * Displays all agents with their current status.
 * Data-driven — not hard-coded to any specific number of agents.
 *
 * Phase 3: Displays agents from AGENT_DEFINITIONS with runtime state.
 */

export interface WorkforceDirectoryProps {
  /** Runtime states for all agents */
  agent_states: RuntimeAgentState[];
  /** Optional: callback when an agent is clicked */
  onAgentClick?: (agent_key: AgentKey) => void;
  /** Optional: filter by category */
  filter_category?: "core" | "specialist" | "support";
}

export function WorkforceDirectory({
  agent_states,
  onAgentClick,
  filter_category,
}: WorkforceDirectoryProps) {
  const agentKeys = Object.keys(AGENT_DEFINITIONS) as AgentKey[];

  const filteredKeys = filter_category
    ? agentKeys.filter(
        (key) => getAgentDefinition(key).category === filter_category
      )
    : agentKeys;

  return (
    <div className="office-panel p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--office-text-primary)]">
          AI Workforce
        </h2>
        <span className="text-sm text-[var(--office-text-muted)]">
          {filteredKeys.length} agent{filteredKeys.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="space-y-1">
        {filteredKeys.map((key) => {
          const def = getAgentDefinition(key);
          const assets = getCharacterAssets(key);
          const state = agent_states.find((s) => s.agent_key === key);

          return (
            <CharacterCard
              key={key}
              agent_key={key}
              display_name={def.default_display_name}
              role={def.role}
              status={state?.status ?? "AVAILABLE"}
              avatar_path={assets.avatar}
              compact
              onClick={onAgentClick ? () => onAgentClick(key) : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
