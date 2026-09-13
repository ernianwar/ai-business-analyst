/**
 * TEST ONLY provider for execution engine testing.
 *
 * This provider simulates external execution for deterministic testing.
 * It does NOT connect to any real external system.
 *
 * All results are synthetic. Do not present as real execution.
 */
import type { ExecutionProvider } from "./types";

export interface TestProviderConfig {
  succeed_by_default: boolean;
  simulate_timeout_ms: number | null;
  simulate_unknown: boolean;
  execution_log: Array<{
    operation: string;
    idempotency_key: string;
    parameters: Record<string, unknown>;
    timestamp: string;
  }>;
}

const defaultConfig: TestProviderConfig = {
  succeed_by_default: true,
  simulate_timeout_ms: null,
  simulate_unknown: false,
  execution_log: [],
};

let config: TestProviderConfig = { ...defaultConfig, execution_log: [] };

export function configureTestProvider(overrides: Partial<TestProviderConfig>): void {
  config = { ...config, ...overrides, execution_log: [...config.execution_log] };
}

export function resetTestProvider(): void {
  config = {
    succeed_by_default: true,
    simulate_timeout_ms: null,
    simulate_unknown: false,
    execution_log: [],
  };
}

export function getTestProviderLog(): TestProviderConfig["execution_log"] {
  return [...config.execution_log];
}

/**
 * TEST ONLY provider — simulates external execution for testing.
 * All results are synthetic. Do not use for real business execution.
 */
export const testProvider: ExecutionProvider = {
  name: "test-provider",
  supports_idempotency: true,

  async execute(params) {
    config.execution_log.push({
      operation: params.operation,
      idempotency_key: params.idempotency_key,
      parameters: params.parameters,
      timestamp: new Date().toISOString(),
    });

    if (config.simulate_timeout_ms !== null) {
      await new Promise((resolve) => setTimeout(resolve, config.simulate_timeout_ms ?? 0));
      return {
        success: false,
        external_reference: null,
        response_metadata: { error: "timeout" },
        error_code: "PROVIDER_TIMEOUT",
        error_message: `Provider timed out after ${config.simulate_timeout_ms}ms`,
      };
    }

    if (config.simulate_unknown) {
      return {
        success: false,
        external_reference: `test-ext-${crypto.randomUUID().slice(0, 8)}`,
        response_metadata: { uncertain: true },
        error_code: "UNKNOWN_RESULT",
        error_message: "Provider returned ambiguous result",
      };
    }

    if (config.succeed_by_default) {
      return {
        success: true,
        external_reference: `test-ext-${crypto.randomUUID().slice(0, 8)}`,
        response_metadata: { test: true, simulated: true },
        error_code: null,
        error_message: null,
      };
    }

    return {
      success: false,
      external_reference: null,
      response_metadata: { test: true },
      error_code: "TEST_FAILURE",
      error_message: "Test provider configured to fail",
    };
  },

  async reconcile(params) {
    return {
      status: "SUCCEEDED",
      details: { test: true, external_reference: params.external_reference },
    };
  },
};
