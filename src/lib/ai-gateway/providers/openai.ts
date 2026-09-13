/**
 * SALAM LIT — OpenAI Provider Adapter
 *
 * Fetch-based adapter for OpenAI's chat completions API.
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
 * OpenAI model definitions.
 */
const OPENAI_MODELS: AIModelConfig[] = [
  {
    provider: "openai",
    model_id: "gpt-4o",
    display_name: "GPT-4o",
    capabilities: ["reasoning", "analysis", "generation"],
    max_input_tokens: 128000,
    max_output_tokens: 16384,
    tier: "HIGH_QUALITY",
    structured_output: true,
    tool_support: true,
    cost_per_1m_input: 2.5,
    cost_per_1m_output: 10,
    enabled: true,
  },
  {
    provider: "openai",
    model_id: "gpt-4o-mini",
    display_name: "GPT-4o Mini",
    capabilities: ["reasoning", "analysis", "generation"],
    max_input_tokens: 128000,
    max_output_tokens: 16384,
    tier: "LOW_COST",
    structured_output: true,
    tool_support: true,
    cost_per_1m_input: 0.15,
    cost_per_1m_output: 0.6,
    enabled: true,
  },
  {
    provider: "openai",
    model_id: "gpt-4-turbo",
    display_name: "GPT-4 Turbo",
    capabilities: ["reasoning", "analysis", "generation"],
    max_input_tokens: 128000,
    max_output_tokens: 4096,
    tier: "HIGH_QUALITY",
    structured_output: true,
    tool_support: true,
    cost_per_1m_input: 10,
    cost_per_1m_output: 30,
    enabled: true,
  },
];

/**
 * OpenAI provider adapter.
 */
export class OpenAIAdapter implements AIProviderAdapter {
  readonly provider: AIProvider = "openai";

  async isAvailable(): Promise<boolean> {
    const config = getProviderConfig("openai");
    return config.enabled;
  }

  async getModels(): Promise<AIModelConfig[]> {
    if (!(await this.isAvailable())) return [];
    return OPENAI_MODELS.filter((m) => m.enabled);
  }

  async request(config: AIModelConfig, req: AIGatewayRequest): Promise<AIGatewayResponse> {
    const providerConfig = getProviderConfig("openai");
    if (!providerConfig.api_key) {
      throw new AIError({
        code: "AI_NOT_CONFIGURED",
        message: "OpenAI API key not configured",
        provider: "openai",
      });
    }

    const request_id = crypto.randomUUID();
    const model = config.model_id || providerConfig.default_model;

    const body = {
      model,
      messages: [
        ...(req.system_message ? [{ role: "system", content: req.system_message }] : []),
        { role: "user", content: req.prompt },
      ],
      temperature: req.temperature ?? 0.3,
      max_tokens: req.max_tokens ?? config.max_output_tokens ?? 2000,
      response_format: req.output_schema
        ? {
            type: "json_schema",
            json_schema: {
              name: "salam_lit_agent_output",
              strict: true,
              schema: req.output_schema,
            },
          }
        : undefined,
    };

    const result = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), req.timeout_ms ?? providerConfig.timeout_ms);

      try {
        const response = await fetch(`${providerConfig.base_url}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${providerConfig.api_key}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          throw new AIError({
            code: mapStatusToErrorCode(response.status),
            message: `OpenAI API error ${response.status}: ${errorBody.slice(0, 200)}`,
            provider: "openai",
            request_id,
          });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        const usage = data.usage ?? {};

        return {
          content,
          model_used: data.model ?? model,
          provider: "openai",
          usage: {
            input_tokens: usage.prompt_tokens ?? 0,
            output_tokens: usage.completion_tokens ?? 0,
            total_tokens: usage.total_tokens ?? 0,
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
            message: `OpenAI request timed out after ${req.timeout_ms ?? providerConfig.timeout_ms}ms`,
            provider: "openai",
            request_id,
          });
        }
        throw error;
      }
    }, "openai", { max_retries: providerConfig.max_retries });

    return result;
  }
}
