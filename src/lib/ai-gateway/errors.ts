/**
 * SALAM LIT — AI Gateway Error Types
 *
 * Normalized error codes for provider failures.
 * All provider errors are mapped to these codes before reaching the runtime.
 *
 * Phase 8: AI Provider Integration + Runtime Hardening
 */

/**
 * Normalized AI error codes.
 */
export type AIErrorCode =
  | "AI_NOT_CONFIGURED"
  | "AI_AUTH_ERROR"
  | "AI_RATE_LIMITED"
  | "AI_TIMEOUT"
  | "AI_PROVIDER_UNAVAILABLE"
  | "AI_INVALID_REQUEST"
  | "AI_RESPONSE_INVALID"
  | "AI_PROVIDER_ERROR"
  | "AI_FALLBACK_EXHAUSTED";

/**
 * Whether this error is safely retryable.
 */
const RETRYABLE_CODES: Set<AIErrorCode> = new Set([
  "AI_TIMEOUT",
  "AI_RATE_LIMITED",
  "AI_PROVIDER_UNAVAILABLE",
  "AI_PROVIDER_ERROR",
]);

/**
 * Structured AI error.
 */
export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly provider: string;
  readonly retryable: boolean;
  readonly request_id: string;
  readonly cause?: unknown;

  constructor(params: {
    code: AIErrorCode;
    message: string;
    provider: string;
    request_id?: string;
    cause?: unknown;
  }) {
    super(params.message);
    this.name = "AIError";
    this.code = params.code;
    this.provider = params.provider;
    this.retryable = RETRYABLE_CODES.has(params.code);
    this.request_id = params.request_id ?? crypto.randomUUID();
    this.cause = params.cause;
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      provider: this.provider,
      retryable: this.retryable,
      request_id: this.request_id,
    };
  }
}

/**
 * Map a provider HTTP status code to an AIErrorCode.
 */
export function mapStatusToErrorCode(status: number): AIErrorCode {
  if (status === 401 || status === 403) return "AI_AUTH_ERROR";
  if (status === 429) return "AI_RATE_LIMITED";
  if (status === 400) return "AI_INVALID_REQUEST";
  if (status >= 500) return "AI_PROVIDER_ERROR";
  return "AI_PROVIDER_ERROR";
}

/**
 * Create an AIError from a caught error.
 */
export function normalizeProviderError(
  error: unknown,
  provider: string,
  request_id?: string
): AIError {
  if (error instanceof AIError) return error;

  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("timeout") || message.includes("TIMEOUT")) {
    return new AIError({ code: "AI_TIMEOUT", message: `Provider ${provider} timed out`, provider, request_id });
  }
  if (message.includes("401") || message.includes("403") || message.includes("unauthorized") || message.includes("Forbidden")) {
    return new AIError({ code: "AI_AUTH_ERROR", message: `Authentication failed with ${provider}`, provider, request_id });
  }
  if (message.includes("429") || message.includes("rate limit")) {
    return new AIError({ code: "AI_RATE_LIMITED", message: `Rate limited by ${provider}`, provider, request_id });
  }
  if (message.includes("400") || message.includes("bad request")) {
    return new AIError({ code: "AI_INVALID_REQUEST", message: `Invalid request to ${provider}: ${message}`, provider, request_id });
  }
  if (message.includes("fetch") || message.includes("ECONNREFUSED") || message.includes("network")) {
    return new AIError({ code: "AI_PROVIDER_UNAVAILABLE", message: `Provider ${provider} is unreachable: ${message}`, provider, request_id });
  }

  return new AIError({
    code: "AI_PROVIDER_ERROR",
    message: `Provider ${provider} error: ${message}`,
    provider,
    request_id,
    cause: error,
  });
}
