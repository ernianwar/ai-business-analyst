/**
 * SALAM LIT — AI Provider Configuration
 *
 * Reads API keys from environment variables.
 * Validates configuration at startup.
 * Never exposes secrets to client-side code.
 *
 * Phase 8: AI Provider Integration + Runtime Hardening
 */

import type { AIProvider } from "./types";

/**
 * Provider configuration read from environment.
 */
export interface ProviderConfig {
  provider: AIProvider;
  api_key: string | null;
  base_url: string;
  enabled: boolean;
  default_model: string;
  timeout_ms: number;
  max_retries: number;
  models?: string[];
  http_referer?: string | null;
  title?: string | null;
}

/**
 * All provider configurations.
 * Lazy-initialized on first access.
 */
let configs: Map<AIProvider, ProviderConfig> | null = null;

/**
 * Build provider configurations from environment variables.
 * Runs server-side only.
 */
function buildConfigs(): Map<AIProvider, ProviderConfig> {
  const map = new Map<AIProvider, ProviderConfig>();

  const configuredModels = (value: string | undefined): string[] =>
    (value ?? "")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);

  // OpenRouter model IDs are configuration, not business logic. This also
  // permits the free catalogue to change without a code deployment.
  const openrouterModels = configuredModels(process.env.OPENROUTER_MODELS);
  const openrouterModel = process.env.OPENROUTER_MODEL?.trim() || openrouterModels[0] || null;
  map.set("openrouter", {
    provider: "openrouter",
    api_key: process.env.OPENROUTER_API_KEY ?? null,
    base_url: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
    enabled: !!process.env.OPENROUTER_API_KEY,
    default_model: openrouterModel ?? "",
    models: openrouterModel && !openrouterModels.includes(openrouterModel)
      ? [openrouterModel, ...openrouterModels]
      : openrouterModels,
    timeout_ms: parseInt(process.env.OPENROUTER_TIMEOUT_MS ?? "30000", 10),
    max_retries: parseInt(process.env.OPENROUTER_MAX_RETRIES ?? "2", 10),
    http_referer: process.env.OPENROUTER_HTTP_REFERER ?? null,
    title: process.env.OPENROUTER_TITLE ?? null,
  });

  // OpenAI
  const openaiKey = process.env.OPENAI_API_KEY ?? null;
  map.set("openai", {
    provider: "openai",
    api_key: openaiKey,
    base_url: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    enabled: !!openaiKey,
    default_model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    timeout_ms: parseInt(process.env.OPENAI_TIMEOUT_MS ?? "30000", 10),
    max_retries: parseInt(process.env.OPENAI_MAX_RETRIES ?? "2", 10),
  });

  // Anthropic
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? null;
  map.set("anthropic", {
    provider: "anthropic",
    api_key: anthropicKey,
    base_url: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    enabled: !!anthropicKey,
    default_model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
    timeout_ms: parseInt(process.env.ANTHROPIC_TIMEOUT_MS ?? "30000", 10),
    max_retries: parseInt(process.env.ANTHROPIC_MAX_RETRIES ?? "2", 10),
  });

  // DeepSeek
  const deepseekKey = process.env.DEEPSEEK_API_KEY ?? null;
  map.set("deepseek", {
    provider: "deepseek",
    api_key: deepseekKey,
    base_url: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
    enabled: !!deepseekKey,
    default_model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    timeout_ms: parseInt(process.env.DEEPSEEK_TIMEOUT_MS ?? "30000", 10),
    max_retries: parseInt(process.env.DEEPSEEK_MAX_RETRIES ?? "2", 10),
  });

  return map;
}

/**
 * Get all provider configurations.
 */
export function getProviderConfigs(): Map<AIProvider, ProviderConfig> {
  if (!configs) {
    configs = buildConfigs();
  }
  return configs;
}

/**
 * Get configuration for a specific provider.
 */
export function getProviderConfig(provider: AIProvider): ProviderConfig {
  return getProviderConfigs().get(provider)!;
}

/**
 * Check if a provider has a valid API key configured.
 */
export function isProviderConfigured(provider: AIProvider): boolean {
  const config = getProviderConfig(provider);
  return config.enabled;
}

/**
 * Get the list of configured (enabled) providers.
 */
export function getConfiguredProviders(): AIProvider[] {
  const configs = getProviderConfigs();
  return Array.from(configs.values())
    .filter((c) => c.enabled)
    .map((c) => c.provider);
}

/**
 * Validate environment configuration.
 * Returns warnings for missing API keys.
 */
export function validateConfig(): {
  configured: AIProvider[];
  missing: AIProvider[];
  warnings: string[];
} {
  const allProviders: AIProvider[] = ["openrouter", "openai", "anthropic", "deepseek"];
  const configured = getConfiguredProviders();
  const missing = allProviders.filter((p) => !configured.includes(p));
  const warnings: string[] = [];

  if (configured.length === 0) {
    warnings.push(
      "No AI providers configured. Set OPENROUTER_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or DEEPSEEK_API_KEY in .env.local"
    );
  }

  for (const p of missing) {
    warnings.push(`${p} API key not configured`);
  }

  return { configured, missing, warnings };
}

/** Reset cached configuration for isolated runtime tests. */
export function resetProviderConfigs(): void {
  configs = null;
}
