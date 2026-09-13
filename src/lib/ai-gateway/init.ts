/**
 * SALAM LIT — Provider Initialization
 *
 * Registers all provider adapters at application startup.
 * This is the single entry point for provider registration.
 *
 * Phase 8: AI Provider Integration + Runtime Hardening
 */

import { registerProvider } from "./registry";
import { OpenAIAdapter } from "./providers/openai";
import { AnthropicAdapter } from "./providers/anthropic";
import { DeepSeekAdapter } from "./providers/deepseek";
import { OpenRouterAdapter } from "./providers/openrouter";
import { validateConfig } from "./config";

/**
 * Whether providers have been initialized.
 */
let initialized = false;

/**
 * Initialize all provider adapters.
 * Safe to call multiple times — only registers once.
 * Should be called once at application startup (server-side).
 */
export function initializeProviders(): void {
  if (initialized) return;

  // Register OpenAI
  registerProvider(new OpenRouterAdapter());

  // Register OpenAI
  registerProvider(new OpenAIAdapter());

  // Register Anthropic
  registerProvider(new AnthropicAdapter());

  // Register DeepSeek
  registerProvider(new DeepSeekAdapter());

  initialized = true;

  // Log configuration status
  const status = validateConfig();
  if (status.configured.length > 0) {
    console.log(`[AI Gateway] Configured providers: ${status.configured.join(", ")}`);
  }
  if (status.warnings.length > 0) {
    console.warn(`[AI Gateway] ${status.warnings.join("; ")}`);
  }
}

/**
 * Check if providers have been initialized.
 */
export function isInitialized(): boolean {
  return initialized;
}
