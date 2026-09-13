/**
 * SALAM LIT — AI Provider Status API
 *
 * Returns health status of configured AI providers.
 * Server-side only — never exposes API keys.
 *
 * Phase 8: AI Provider Integration + Runtime Hardening
 * Phase 15.4.1: Authentication required — anonymous access denied.
 */

import { NextResponse } from "next/server";
import { initializeProviders } from "@/lib/ai-gateway/init";
import { validateConfig, getProviderConfig } from "@/lib/ai-gateway/config";
import { getAllProviders } from "@/lib/ai-gateway/registry";
import { isAIAvailable } from "@/lib/runtime/model-gateway";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/ai/status
 *
 * Returns provider configuration and availability status.
 * Does NOT expose API keys.
 * Requires authenticated access.
 */
export async function GET() {
  try {
    // C4: Authentication required — anonymous access denied
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    initializeProviders();
    const configStatus = validateConfig();
    const available = await isAIAvailable();
    const providers = getAllProviders();

    const providerDetails = await Promise.all(
      providers.map(async (adapter) => {
        const cfg = getProviderConfig(adapter.provider);
        const models = await adapter.getModels();
        return {
          provider: adapter.provider,
          configured: cfg.enabled,
          default_model: cfg.default_model,
          models: models.map((m) => ({
            id: m.model_id,
            name: m.display_name,
            max_input: m.max_input_tokens,
            max_output: m.max_output_tokens,
          })),
        };
      })
    );

    return NextResponse.json({
      available,
      configured_providers: configStatus.configured,
      missing_providers: configStatus.missing,
      providers: providerDetails,
      warnings: configStatus.warnings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check AI status" },
      { status: 500 }
    );
  }
}
