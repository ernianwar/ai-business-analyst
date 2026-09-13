/**
 * SALAM LIT — AI Model Gateway Registry
 *
 * Central registry for AI providers.
 * Providers are NOT hard-coded — they register at runtime.
 *
 * Phase 2: Stub registry with provider interface.
 * Actual provider implementations will be added when AI integration is built.
 */

import type {
  AIProvider,
  AIProviderAdapter,
  AIModelConfig,
} from "./types";

/**
 * Registry of registered AI provider adapters.
 */
const providers: Map<AIProvider, AIProviderAdapter> = new Map();

/**
 * Register an AI provider adapter.
 * Call this during application initialization.
 */
export function registerProvider(adapter: AIProviderAdapter): void {
  providers.set(adapter.provider, adapter);
}

/**
 * Get a registered provider adapter.
 */
export function getProvider(provider: AIProvider): AIProviderAdapter | undefined {
  return providers.get(provider);
}

/**
 * Get all registered providers.
 */
export function getAllProviders(): AIProviderAdapter[] {
  return Array.from(providers.values());
}

/**
 * Get all available providers (those that have API keys configured).
 */
export async function getAvailableProviders(): Promise<AIProviderAdapter[]> {
  const available: AIProviderAdapter[] = [];
  for (const adapter of providers.values()) {
    if (await adapter.isAvailable()) {
      available.push(adapter);
    }
  }
  return available;
}

/**
 * List all models across all registered providers.
 */
export async function getAllModels(): Promise<AIModelConfig[]> {
  const models: AIModelConfig[] = [];
  for (const adapter of providers.values()) {
    if (await adapter.isAvailable()) {
      const providerModels = await adapter.getModels();
      models.push(...providerModels);
    }
  }
  return models;
}

/**
 * Check if any provider is available.
 */
export async function hasAvailableProvider(): Promise<boolean> {
  for (const adapter of providers.values()) {
    if (await adapter.isAvailable()) return true;
  }
  return false;
}
