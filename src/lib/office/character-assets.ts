/**
 * SALAM LIT — Character Asset System
 *
 * Manages character identity, artwork, and representation.
 *
 * Architecture:
 *   Character identity is SEPARATE from artwork.
 *   Replace character assets WITHOUT affecting business logic.
 *   Asset references point to paths under /public/assets/workforce/{agent_key}/
 *
 * Asset structure:
 *   /public/assets/workforce/{agent_key}/
 *       avatar.png          — Small profile icon (48x48 to 96x96)
 *       character-full.png  — Full character illustration (standing)
 *       character-desk.png  — Character at desk (for office view)
 *       character-idle.png  — Character idle animation frame
 *       speaking/           — Speaking animation frames (optional)
 *
 * Phase 2: Asset path registry only.
 * Actual artwork will be added later (NOT faked).
 */

import type { AgentKey } from "../agents/definitions";

/**
 * Character asset paths for an agent.
 * All paths are relative to /public/
 */
export interface CharacterAssets {
  agent_key: AgentKey;
  /** Small profile icon */
  avatar: string;
  /** Full character illustration */
  character_full: string;
  /** Character at desk (for office view) */
  character_desk: string;
  /** Character idle animation frame */
  character_idle: string;
  /** Speaking animation frames (optional) */
  speaking_frames?: string[];
}

/**
 * Asset registry — maps agent keys to their asset paths.
 * Use this to reference character assets in code.
 */
export const CHARACTER_ASSETS: Record<AgentKey, CharacterAssets> = {
  zue: {
    agent_key: "zue",
    avatar: "/assets/workforce/zue/zue_v1.png",
    character_full: "/assets/workforce/zue/zue_v1.png",
    character_desk: "/assets/workforce/zue/zue_v1.png",
    character_idle: "/assets/workforce/zue/zue_v1.png",
  },
  erni: {
    agent_key: "erni",
    avatar: "/assets/workforce/erni/erni_v1.png",
    character_full: "/assets/workforce/erni/erni_v1.png",
    character_desk: "/assets/workforce/erni/erni_v1.png",
    character_idle: "/assets/workforce/erni/erni_v1.png",
  },
  sheera: {
    agent_key: "sheera",
    avatar: "/assets/workforce/sheera/sheera_v1.png",
    character_full: "/assets/workforce/sheera/sheera_v1.png",
    character_desk: "/assets/workforce/sheera/sheera_v1.png",
    character_idle: "/assets/workforce/sheera/sheera_v1.png",
  },
  eddy: {
    agent_key: "eddy",
    avatar: "/assets/workforce/eddy/eddy_v1.png",
    character_full: "/assets/workforce/eddy/eddy_v1.png",
    character_desk: "/assets/workforce/eddy/eddy_v1.png",
    character_idle: "/assets/workforce/eddy/eddy_v1.png",
  },
  carol: {
    agent_key: "carol",
    avatar: "/assets/workforce/carol/carol_v1.png",
    character_full: "/assets/workforce/carol/carol_v1.png",
    character_desk: "/assets/workforce/carol/carol_v1.png",
    character_idle: "/assets/workforce/carol/carol_v1.png",
  },
  ayuni: {
    agent_key: "ayuni",
    avatar: "/assets/workforce/ayuni/ayuni_v1.png",
    character_full: "/assets/workforce/ayuni/ayuni_v1.png",
    character_desk: "/assets/workforce/ayuni/ayuni_v1.png",
    character_idle: "/assets/workforce/ayuni/ayuni_v1.png",
  },
  alex: {
    agent_key: "alex",
    avatar: "/assets/workforce/alex/alex_v1.png",
    character_full: "/assets/workforce/alex/alex_v1.png",
    character_desk: "/assets/workforce/alex/alex_v1.png",
    character_idle: "/assets/workforce/alex/alex_v1.png",
  },
  tehna: {
    agent_key: "tehna",
    avatar: "/assets/workforce/tehna/tehna_v1.png",
    character_full: "/assets/workforce/tehna/tehna_v1.png",
    character_desk: "/assets/workforce/tehna/tehna_v1.png",
    character_idle: "/assets/workforce/tehna/tehna_v1.png",
  },
  kopi: {
    agent_key: "kopi",
    avatar: "/assets/workforce/kopi/kopi_v1.png",
    character_full: "/assets/workforce/kopi/kopi_v1.png",
    character_desk: "/assets/workforce/kopi/kopi_v1.png",
    character_idle: "/assets/workforce/kopi/kopi_v1.png",
  },
  adik: {
    agent_key: "adik",
    avatar: "/assets/workforce/adik/adik_v1.png",
    character_full: "/assets/workforce/adik/adik_v1.png",
    character_desk: "/assets/workforce/adik/adik_v1.png",
    character_idle: "/assets/workforce/adik/adik_v1.png",
  },
};

/**
 * Get character assets for an agent.
 * Returns the asset paths regardless of whether the files exist.
 */
export function getCharacterAssets(agent_key: AgentKey): CharacterAssets {
  return CHARACTER_ASSETS[agent_key];
}

/**
 * Get the avatar path for an agent.
 */
export function getAvatarPath(agent_key: AgentKey): string {
  return CHARACTER_ASSETS[agent_key].avatar;
}

/**
 * Get the desk character path (for office view).
 */
export function getDeskCharacterPath(agent_key: AgentKey): string {
  return CHARACTER_ASSETS[agent_key].character_desk;
}
