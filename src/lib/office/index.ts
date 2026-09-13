/**
 * SALAM LIT — Office Module
 *
 * Re-export all office-related types and utilities.
 */

export {
  CHARACTER_ASSETS,
  getCharacterAssets,
  getAvatarPath,
  getDeskCharacterPath,
  type CharacterAssets,
} from "./character-assets";

export {
  buildOfficeCharacter,
  type OfficeCharacter,
  type DeskPosition,
} from "./character-representation";

export {
  SpeechBubbleGenerator,
  speechBubbleGenerator,
  type SpeechBubble,
  type SpeechBubbleType,
} from "./speech-bubbles";

export {
  getTopLevelNav,
  getChildNav,
  getNavItem,
  getNavItemByPath,
  PRODUCT_NAVIGATION,
  type NavItem,
} from "./navigation";
