/** SALAM LIT — OpenRouter provider adapter (native fetch). */

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

function modelConfig(model_id: string): AIModelConfig {
  return {
    provider: "openrouter",
    model_id,
    display_name: model_id,
    capabilities: ["analysis", "reasoning", "generation"],
    max_input_tokens: 128000,
    max_output_tokens: 2000,
    tier: model_id.endsWith(":free") ? "EXPERIMENTATION" : "LOW_COST",
    structured_output: true,
    tool_support: false,
    enabled: true,
  };
}

export class OpenRouterAdapter implements AIProviderAdapter {
  readonly provider: AIProvider = "openrouter";

  async isAvailable(): Promise<boolean> {
    const config = getProviderConfig("openrouter");
    return config.enabled && Boolean(config.default_model || config.models?.length);
  }

  async getModels(): Promise<AIModelConfig[]> {
    if (!(await this.isAvailable())) return [];
    const config = getProviderConfig("openrouter");
    return (config.models ?? []).map(modelConfig);
  }

  async request(config: AIModelConfig, req: AIGatewayRequest): Promise<AIGatewayResponse> {
    const providerConfig = getProviderConfig("openrouter");
    if (!providerConfig.api_key) {
      throw new AIError({ code: "AI_NOT_CONFIGURED", message: "OpenRouter API key not configured", provider: "openrouter" });
    }

    const requestedModel = config.model_id || providerConfig.default_model;
    if (!requestedModel) {
      throw new AIError({ code: "AI_INVALID_REQUEST", message: "OpenRouter model is not configured", provider: "openrouter" });
    }

    const candidates = req.metadata?.candidate_models?.filter((model) => model.includes("/"));
    const requestId = crypto.randomUUID();
    const body: Record<string, unknown> = {
      model: requestedModel,
      messages: [
        ...(req.system_message ? [{ role: "system", content: req.system_message }] : []),
        { role: "user", content: req.prompt },
      ],
      temperature: req.temperature ?? 0.3,
      max_tokens: req.max_tokens ?? config.max_output_tokens ?? 2000,
    };

    if (candidates && candidates.length > 0) {
      body.models = candidates;
      body.route = "fallback";
    }
    if (req.output_schema) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: "salam_lit_agent_output",
          strict: true,
          schema: req.output_schema,
        },
      };
    }

    return withRetry(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), req.timeout_ms ?? providerConfig.timeout_ms);
      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${providerConfig.api_key}`,
        };
        if (providerConfig.http_referer) headers["HTTP-Referer"] = providerConfig.http_referer;
        if (providerConfig.title) headers["X-OpenRouter-Title"] = providerConfig.title;

        const response = await fetch(`${providerConfig.base_url}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!response.ok) {
          const errorBody = await response.text().catch(() => "");
          throw new AIError({
            code: mapStatusToErrorCode(response.status),
            message: `OpenRouter API error ${response.status}: ${errorBody.slice(0, 200)}`,
            provider: "openrouter",
            request_id: requestId,
          });
        }
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        if (typeof content !== "string" || !content.trim()) {
          throw new AIError({ code: "AI_RESPONSE_INVALID", message: "OpenRouter returned no textual content", provider: "openrouter", request_id: requestId });
        }
        const usage = data.usage ?? {};
        return {
          content,
          model_used: data.model ?? requestedModel,
          provider: "openrouter",
          usage: {
            input_tokens: usage.prompt_tokens ?? 0,
            output_tokens: usage.completion_tokens ?? 0,
            total_tokens: usage.total_tokens ?? 0,
          },
          from_cache: false,
          request_id: requestId,
          latency_ms: 0,
        } satisfies AIGatewayResponse;
      } catch (error) {
        if (error instanceof AIError) throw error;
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new AIError({ code: "AI_TIMEOUT", message: `OpenRouter request timed out after ${req.timeout_ms ?? providerConfig.timeout_ms}ms`, provider: "openrouter", request_id: requestId });
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    }, "openrouter", { max_retries: providerConfig.max_retries });
  }
}
