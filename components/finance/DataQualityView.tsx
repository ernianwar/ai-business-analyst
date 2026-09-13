/**
 * SALAM LIT — Data Quality View Component
 *
 * Displays data quality checks and completeness for a financial period.
 *
 * Phase 6: Business Metrics & Financial Foundation
 */

"use client";

import React from "react";
import type { DataQualityCheck } from "@/lib/db/types";

interface DataQualityViewProps {
  checks: DataQualityCheck[];
  completenessScore: number;
  overallStatus: "COMPLETE" | "PARTIAL" | "INSUFFICIENT" | "CONFLICTED";
}

const CHECK_STATUS_CONFIG: Record<string, { color: string; icon: string }> = {
  PASS: { color: "text-green-400", icon: "✓" },
  WARN: { color: "text-yellow-400", icon: "⚠" },
  FAIL: { color: "text-red-400", icon: "✗" },
  MISSING: { color: "text-orange-400", icon: "?" },
};

const OVERALL_STATUS_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  COMPLETE: { color: "text-green-400", label: "Complete", bg: "bg-green-500/10 border-green-500/20" },
  PARTIAL: { color: "text-yellow-400", label: "Partial", bg: "bg-yellow-500/10 border-yellow-500/20" },
  INSUFFICIENT: { color: "text-orange-400", label: "Insufficient", bg: "bg-orange-500/10 border-orange-500/20" },
  CONFLICTED: { color: "text-red-400", label: "Conflicted", bg: "bg-red-500/10 border-red-500/20" },
};

export function DataQualityView({
  checks,
  completenessScore,
  overallStatus,
}: DataQualityViewProps) {
  const config = OVERALL_STATUS_CONFIG[overallStatus];
  const passCount = checks.filter((c) => c.status === "PASS").length;
  const totalCount = checks.length;

  return (
    <div className="space-y-4">
      {/* Overall Status */}
      <div className={`p-4 rounded-xl border ${config.bg}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              Data Quality
            </p>
            <p className={`text-xs mt-1 ${config.color}`}>
              {config.label} — {passCount}/{totalCount} checks passed
            </p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${config.color}`}>
              {Math.round(completenessScore * 100)}%
            </p>
            <p className="text-xs text-zinc-500">completeness</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 w-full bg-zinc-800 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              overallStatus === "COMPLETE"
                ? "bg-green-500"
                : overallStatus === "PARTIAL"
                ? "bg-yellow-500"
                : "bg-orange-500"
            }`}
            style={{ width: `${completenessScore * 100}%` }}
          />
        </div>
      </div>

      {/* Individual Checks */}
      <div className="space-y-2">
        {checks.map((check, index) => {
          const statusConfig = CHECK_STATUS_CONFIG[check.status];
          return (
            <div
              key={`${check.check_type}-${index}`}
              className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg"
            >
              <span className={`text-sm ${statusConfig.color}`}>
                {statusConfig.icon}
              </span>
              <div className="flex-1">
                <p className="text-sm text-zinc-200">{check.message}</p>
                {check.affected_field && (
                  <p className="text-xs text-zinc-500 mt-0.5">
                    Field: {check.affected_field}
                  </p>
                )}
              </div>
              <span className={`text-xs ${statusConfig.color}`}>
                {check.status}
              </span>
            </div>
          );
        })}
      </div>

      {checks.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-zinc-500">No quality checks available</p>
        </div>
      )}
    </div>
  );
}
