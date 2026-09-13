/**
 * SALAM LIT — Anthropic Provider Adapter
 *
 * Fetch-based adapter for Anthropic's Messages API.
 * No SDK dependency — uses native fetch.
 *
 * Phase 8: AI Provider Integration + Runtime Hardening
 */

import type {
  AIProvider,
  AIProviderAdapter,
  AIModelConfig,
  AIGatewayRequest,
  AIGatewayResponse,
} from "../types";
import { getProviderConfig } from "../config";
import { AIError, mapStatusToErrorCode } from "../errors";
import { withRetry } from "../retry";

/**
 * Anthropic model definitions.
 */
const ANTHROPIC_MODELS: AIModelConfig[] = [
  {
    provider: "anthropic",
    model_id: "claude-sonnet-4-20250514",
    display_name: "Claude Sonnet 4",
    capabilities: ["reasoning", "analysis", "generation"],
    max_input_tokens: 200000,
    max_output_tokens: 8192,
    tier: "HIGH_QUALITY",
    structured_output: true,
    tool_support: true,
    cost_per_1m_input: 3,
    cost_per_1m_output: 15,
    enabled: true,
  },
  {
    provider: "anthropic",
    model_id: "claude-3-5-haiku-20241022",
    display_name: "Claude 3.5 Haiku",
    capabilities: ["reasoning", "analysis", "generation"],
    max_input_tokens: 200000,
    max_output_tokens: 8192,
    tier: "LOW_COST",
    structured_output: true,
    tool_support: true,
    cost_per_1m_input: 0.8,
    cost_per_1m_output: 4,
    enabled: true,
  },
  {
    provider: "anthropic",
    model_id: "claude-3-opus-20240229",
    display_name: "Claude 3 Opus",
    capabilities: ["reasoning", "analysis", "generation"],
    max_input_tokens: 200000,
    max_output_tokens: 4096,
    tier: "HIGH_TRUST",
    structured_output: true,
    tool_support: true,
    cost_per_1m_input: 15,
    cost_per_1m_output: 75,
    enabled: true,
  },
];

/**
 * Anthropic provider adapter.
 */
export class AnthropicAdapter implements AIProviderAdapter {
  readonly provider: AIProvider = "anthropic";

  async isAvailable(): Promise<boolean> {
    const config = getProviderConfig("anthropic");
    return config.enabled;
  }

  async getModels(): Promise<AIModelConfig[]> {
    if (!(await this.isAvailable())) return [];
    return ANTHROPIC_MODELS.filter((m) => m.enabled);
  }

  async request(config: AIModelConfig, req: AIGatewayRequest): Promise<AIGatewayResponse> {
    const providerConfig = getProviderConfig("anthropic");
    if (!providerConfig.api_key) {
      throw new AIError({
        code: "AI_NOT_CONFIGURED",
        message: "Anthropic API key not configured",
        provider: "anthropic",
      });
    }

    const request_id = crypto.randomUUID();
    const model = config.model_id || providerConfig.default_model;

    const body: Record<string, unknown> = {
      model,
      max_tokens: req.max_tokens ?? config.max_output_tokens ?? 2000,
      messages: [
        { role: "user", content: req.prompt },
      ],
      temperature: req.temperature ?? 0.3,
    };

    if (req.system_message) {
      body.system = req.system_message;
    }

    const result = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), req.timeout_ms ?? providerConfig.timeout_ms);

      try {
        const response = await fetch(`${providerConfig.base_url}/v1/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": providerConfig.api_key!,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          throw new AIError({
            code: mapStatusToErrorCode(response.status),
            message: `Anthropic API error ${response.status}: ${errorBody.slice(0, 200)}`,
            provider: "anthropic",
            request_id,
          });
        }

        const data = await response.json();
        const content = data.content?.[0]?.text ?? "";
        const usage = data.usage ?? {};

        return {
          content,
          model_used: data.model ?? model,
          provider: "anthropic",
          usage: {
            input_tokens: usage.input_tokens ?? 0,
            output_tokens: usage.output_tokens ?? 0,
            total_tokens: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
          },
          from_cache: false,
          request_id,
          latency_ms: 0,
        } satisfies AIGatewayResponse;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof AIError) throw error;
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new AIError({
            code: "AI_TIMEOUT",
            message: `Anthropic request timed out after ${req.timeout_ms ?? providerConfig.timeout_ms}ms`,
            provider: "anthropic",
            request_id,
          });
        }
        throw error;
      }
    }, "anthropic", { max_retries: providerConfig.max_retries });

    return result;
  }
}
