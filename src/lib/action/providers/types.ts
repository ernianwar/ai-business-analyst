export interface ExecutionProvider {
  readonly name: string;
  readonly supports_idempotency: boolean;

  execute(params: {
    operation: string;
    idempotency_key: string;
    parameters: Record<string, unknown>;
    timeout_ms?: number;
  }): Promise<{
    success: boolean;
    external_reference: string | null;
    response_metadata: Record<string, unknown>;
    error_code: string | null;
    error_message: string | null;
  }>;

  reconcile(params: {
    external_reference: string;
    operation: string;
  }): Promise<{
    status: "SUCCEEDED" | "FAILED" | "UNKNOWN";
    details: Record<string, unknown>;
  }>;
}
