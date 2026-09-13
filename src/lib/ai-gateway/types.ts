/**
 * SALAM LIT — AI Model Gateway Types
 *
 * Defines the abstraction layer between SALAM LIT and AI model providers.
 * SALAM LIT must NOT be hard-coded to one AI provider.
 *
 * Architecture:
 *   SALAM LIT
 *       ↓
 *   AI Model Gateway
 *       ↓
 *   Provider Adapter
 *       ↓
 *   Model
 */

/**
 * Supported AI model providers.
 */
export type AIProvider = "tavily" | "openrouter" | "openai" | "anthropic" | "deepseek" | "local";

export type ModelTier = "EXPERIMENTATION" | "LOW_COST" | "HIGH_QUALITY" | "HIGH_TRUST";

export type ModelTaskType =
  | "SPECIALIST_ANALYSIS"
  | "INSIGHT_GENERATION"
  | "RECOMMENDATION_GENERATION"
  | "SYNTHESIS"
  | "RESEARCH"
  | "CLASSIFICATION";

/**
 * Model capability categories.
 */
export type ModelCapability =
  | "reasoning"
  | "research"
  | "analysis"
  | "generation"
  | "classification"
  | "embedding";

/**
 * Configuration for an AI model.
 */
export interface AIModelConfig {
  /** Provider identifier */
  provider: AIProvider;
  /** Model identifier (provider-specific) */
  model_id: string;
  /** Human-readable name */
  display_name: string;
  /** What this model is good at */
  capabilities: ModelCapability[];
  /** Max tokens for input */
  max_input_tokens: number;
  /** Max tokens for output */
  max_output_tokens: number;
  /** Cost per 1M input tokens (USD) — for budget tracking */
  cost_per_1m_input?: number;
  /** Cost per 1M output tokens (USD) — for budget tracking */
  cost_per_1m_output?: number;
  tier?: ModelTier;
  structured_output?: boolean;
  tool_support?: boolean;
  /** Is this model currently enabled */
  enabled: boolean;
}

/**
 * A request to the AI Model Gateway.
 */
export interface AIGatewayRequest {
  /** Which model to use (if null, gateway selects based on task) */
  model?: string;
  /** The prompt/instruction */
  prompt: string;
  /** Optional system message */
  system_message?: string;
  /** Optional: structured output schema */
  output_schema?: Record<string, unknown>;
  /** Optional: temperature */
  temperature?: number;
  /** Optional: max tokens */
  max_tokens?: number;
  /** Optional: timeout in milliseconds */
  timeout_ms?: number;
  /** Optional: request metadata for tracking */
  metadata?: {
    agent_key?: string;
    task_type?: string;
    business_id?: string;
    risk_level?: string;
    required_capabilities?: ModelCapability[];
    structured_output_required?: boolean;
    candidate_models?: string[];
    routing_policy_version?: string;
    [key: string]: unknown;
  };
}

/**
 * Response from the AI Model Gateway.
 */
export interface AIGatewayResponse {
  /** The generated content */
  content: string;
  /** Which model actually responded */
  model_used: string;
  /** Which provider */
  provider: string;
  /** Token usage */
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  /** Whether the response was from cache (future) */
  from_cache: boolean;
  /** Request ID for tracing */
  request_id: string;
  /** Latency in milliseconds */
  latency_ms: number;
}

/**
 * Error from the AI Model Gateway.
 */
export interface AIGatewayError {
  /** Error code */
  code: string;
  /** Human-readable message */
  message: string;
  /** Which provider caused the error */
  provider: string;
  /** Which model was attempted */
  model?: string;
  /** Whether this is retryable */
  retryable: boolean;
  /** Request ID for tracing */
  request_id: string;
}

/**
 * Provider adapter interface.
 * Each AI provider implements this.
 */
export interface AIProviderAdapter {
  /** Provider identifier */
  provider: AIProvider;

  /** Send a request to this provider */
  request(config: AIModelConfig, req: AIGatewayRequest): Promise<AIGatewayResponse>;

  /** Check if this provider is available (has API key, etc.) */
  isAvailable(): Promise<boolean>;

  /** Get available models from this provider */
  getModels(): Promise<AIModelConfig[]>;
}
