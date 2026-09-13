/**
 * SALAM LIT — Retry Utility
 *
 * Exponential backoff with jitter for transient provider failures.
 * Never retries non-retryable errors (auth, invalid request).
 *
 * Phase 8: AI Provider Integration + Runtime Hardening
 * Phase 15.4.3: Circuit breaker + bounded retry/fallback
 */

import { AIError, normalizeProviderError } from "./errors";
import { MAX_RETRIES_PER_PROVIDER } from "../security/sanitize";

/**
 * Retry configuration.
 */
export interface RetryConfig {
  max_retries: number;
  base_delay_ms: number;
  max_delay_ms: number;
  jitter: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  max_retries: MAX_RETRIES_PER_PROVIDER,
  base_delay_ms: 1000,
  max_delay_ms: 10000,
  jitter: true,
};

/**
 * Sleep for the specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and optional jitter.
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = Math.min(
    config.base_delay_ms * Math.pow(2, attempt),
    config.max_delay_ms
  );

  if (config.jitter) {
    const jitter = Math.random() * 0.3 * exponentialDelay;
    return Math.floor(exponentialDelay + jitter);
  }

  return exponentialDelay;
}

/**
 * Execute a function with retry logic.
 * Only retries on retryable AIErrors.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  provider: string,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: AIError | null = null;

  for (let attempt = 0; attempt <= retryConfig.max_retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = normalizeProviderError(error, provider);

      // Don't retry non-retryable errors
      if (!lastError.retryable) {
        throw lastError;
      }

      // Don't retry if we've exhausted attempts
      if (attempt >= retryConfig.max_retries) {
        break;
      }

      // Wait before retrying
      const delay = calculateDelay(attempt, retryConfig);
      await sleep(delay);
    }
  }

  throw lastError ?? new AIError({
    code: "AI_PROVIDER_ERROR",
    message: `All retry attempts exhausted for ${provider}`,
    provider,
  });
}
