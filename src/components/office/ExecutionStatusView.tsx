"use client";

import type { Action, Execution } from "@/lib/runtime/types";

interface ExecutionStatusViewProps {
  action: Action;
  executions: Execution[];
}

const STATUS_COLORS: Record<string, string> = {
  PROPOSED: "bg-gray-100 text-gray-700",
  AUTHORIZED: "bg-blue-100 text-blue-700",
  QUEUED: "bg-yellow-100 text-yellow-700",
  EXECUTING: "bg-orange-100 text-orange-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  BLOCKED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-500",
  PENDING: "bg-gray-100 text-gray-600",
  RUNNING: "bg-orange-100 text-orange-700",
  SUCCEEDED: "bg-green-100 text-green-700",
  UNKNOWN: "bg-amber-100 text-amber-700",
};

export function ExecutionStatusView({ action, executions }: ExecutionStatusViewProps) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{action.action_description}</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[action.status] ?? "bg-gray-100"}`}>
          {action.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
        <div>Type: {action.action_type}</div>
        <div>Target: {action.target_type}</div>
        <div>Risk: {action.risk_level}</div>
        <div>Created: {new Date(action.created_at).toLocaleString()}</div>
      </div>

      {action.failure_reason && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{action.failure_reason}</div>
      )}

      {executions.length > 0 && (
        <div className="border-t pt-2 space-y-1">
          <div className="text-xs font-medium text-gray-500">Executions</div>
          {executions.map((exec) => (
            <div key={exec.id} className="flex items-center gap-2 text-xs">
              <span className={`px-1.5 py-0.5 rounded ${STATUS_COLORS[exec.status] ?? "bg-gray-100"}`}>
                {exec.status}
              </span>
              <span className="text-gray-500">{exec.provider}</span>
              <span className="text-gray-400">{exec.operation}</span>
              {exec.error_code && <span className="text-red-500">{exec.error_code}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
