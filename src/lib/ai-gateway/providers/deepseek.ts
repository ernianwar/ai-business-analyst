/**
 * SALAM LIT — DeepSeek Provider Adapter
 *
 * Fetch-based adapter for DeepSeek's chat completions API.
 * Uses OpenAI-compatible endpoint format.
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
 * DeepSeek model definitions.
 */
const DEEPSEEK_MODELS: AIModelConfig[] = [
  {
    provider: "deepseek",
    model_id: "deepseek-chat",
    display_name: "DeepSeek Chat",
    capabilities: ["reasoning", "analysis", "generation"],
    max_input_tokens: 64000,
    max_output_tokens: 8192,
    tier: "LOW_COST",
    structured_output: true,
    tool_support: false,
    cost_per_1m_input: 0.14,
    cost_per_1m_output: 0.28,
    enabled: true,
  },
  {
    provider: "deepseek",
    model_id: "deepseek-reasoner",
    display_name: "DeepSeek Reasoner",
    capabilities: ["reasoning", "analysis"],
    max_input_tokens: 64000,
    max_output_tokens: 8192,
    tier: "HIGH_QUALITY",
    structured_output: true,
    tool_support: false,
    cost_per_1m_input: 0.55,
    cost_per_1m_output: 2.19,
    enabled: true,
  },
];

/**
 * DeepSeek provider adapter.
 * Uses OpenAI-compatible API format.
 */
export class DeepSeekAdapter implements AIProviderAdapter {
  readonly provider: AIProvider = "deepseek";

  async isAvailable(): Promise<boolean> {
    const config = getProviderConfig("deepseek");
    return config.enabled;
  }

  async getModels(): Promise<AIModelConfig[]> {
    if (!(await this.isAvailable())) return [];
    return DEEPSEEK_MODELS.filter((m) => m.enabled);
  }

  async request(config: AIModelConfig, req: AIGatewayRequest): Promise<AIGatewayResponse> {
    const providerConfig = getProviderConfig("deepseek");
    if (!providerConfig.api_key) {
      throw new AIError({
        code: "AI_NOT_CONFIGURED",
        message: "DeepSeek API key not configured",
        provider: "deepseek",
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
        ? { type: "json_object" }
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
            message: `DeepSeek API error ${response.status}: ${errorBody.slice(0, 200)}`,
            provider: "deepseek",
            request_id,
          });
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content ?? "";
        const usage = data.usage ?? {};

        return {
          content,
          model_used: data.model ?? model,
          provider: "deepseek",
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
            message: `DeepSeek request timed out after ${req.timeout_ms ?? providerConfig.timeout_ms}ms`,
            provider: "deepseek",
            request_id,
          });
        }
        throw error;
      }
    }, "deepseek", { max_retries: providerConfig.max_retries });

    return result;
  }
}
