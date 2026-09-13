"use client";

import type { AgentFinding, Insight } from "@/lib/runtime/types";

/**
 * Evidence Provenance Display Component
 *
 * Shows traceability for every business claim:
 * Finding → Evidence / Fact / Metric
 *
 * Clearly distinguishes:
 * FACT | INFERENCE | COMPUTED_INFERENCE | HYPOTHESIS
 *
 * Phase 11: Recommendation + Decision Center
 */

interface EvidenceProvenanceProps {
  findings: AgentFinding[];
  insights: Insight[];
  evidence: Array<{
    id: string;
    type: string;
    summary: string;
    source: string;
  }>;
}

const EPISTEMIC_COLORS: Record<string, string> = {
  FACT: "bg-green-500/10 text-green-400 border-green-500/20",
  INFERENCE: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  COMPUTED_INFERENCE: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  HYPOTHESIS: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "text-gray-400",
  WARNING: "text-yellow-400",
  CRITICAL: "text-red-400",
  OPPORTUNITY: "text-green-400",
};

export function EvidenceProvenance({ findings, insights, evidence }: EvidenceProvenanceProps) {
  return (
    <div className="space-y-4">
      {/* Findings */}
      {findings.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Findings ({findings.length})
          </h4>
          <div className="space-y-2">
            {findings.map((finding) => (
              <div
                key={finding.id}
                className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-gray-200">
                    {finding.title}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold border ${
                        EPISTEMIC_COLORS[finding.epistemic_type] ?? ""
                      }`}
                    >
                      {finding.epistemic_type}
                    </span>
                    <span className={`text-[10px] font-medium ${SEVERITY_COLORS[finding.severity] ?? ""}`}>
                      {finding.severity}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-400">{finding.summary}</p>

                {/* Evidence chain */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {finding.source_facts.length > 0 && (
                    <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-[10px] text-green-400">
                      {finding.source_facts.length} fact(s)
                    </span>
                  )}
                  {finding.source_evidence.length > 0 && (
                    <span className="rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">
                      {finding.source_evidence.length} evidence(s)
                    </span>
                  )}
                  {finding.source_metrics.length > 0 && (
                    <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-400">
                      {finding.source_metrics.length} metric(s)
                    </span>
                  )}
                </div>

                {/* Assumptions & Uncertainty */}
                {(finding.assumptions.length > 0 || finding.uncertainty.length > 0) && (
                  <div className="mt-2 border-t border-gray-700/50 pt-2">
                    {finding.assumptions.length > 0 && (
                      <p className="text-[10px] text-yellow-400">
                        Assumptions: {finding.assumptions.join("; ")}
                      </p>
                    )}
                    {finding.uncertainty.length > 0 && (
                      <p className="text-[10px] text-orange-400">
                        Uncertainty: {finding.uncertainty.join("; ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Insights ({insights.length})
          </h4>
          <div className="space-y-2">
            {insights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3"
              >
                <p className="text-sm font-medium text-blue-300">
                  {insight.title}
                </p>
                <p className="mt-1 text-xs text-gray-400">{insight.description}</p>

                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-gray-500">
                    Confidence: {Math.round(insight.confidence * 100)}%
                  </span>
                  {insight.contributing_factors.length > 0 && (
                    <span className="text-[10px] text-gray-500">
                      Factors: {insight.contributing_factors.length}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evidence Trail */}
      {evidence.length > 0 && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Evidence Trail ({evidence.length})
          </h4>
          <div className="space-y-1">
            {evidence.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded border border-gray-700/30 bg-gray-800/20 px-2 py-1"
              >
                <span
                  className={`rounded px-1 py-0.5 text-[9px] font-semibold ${
                    item.type === "FACT"
                      ? "bg-green-500/10 text-green-400"
                      : item.type === "METRIC"
                      ? "bg-purple-500/10 text-purple-400"
                      : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {item.type}
                </span>
                <span className="text-[10px] text-gray-400 truncate">
                  {item.summary}
                </span>
                <span className="ml-auto text-[9px] text-gray-600">
                  via {item.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {findings.length === 0 && insights.length === 0 && evidence.length === 0 && (
        <div className="py-4 text-center">
          <p className="text-sm text-gray-500">No evidence available.</p>
          <p className="mt-1 text-xs text-gray-600">
            Evidence will be shown when findings and insights are generated.
          </p>
        </div>
      )}
    </div>
  );
}
