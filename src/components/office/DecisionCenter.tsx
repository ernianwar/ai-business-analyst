"use client";

import { useState, useEffect, useCallback } from "react";
import { EvidenceProvenance } from "./EvidenceProvenance";
import type {
  DecisionCenterItem,
  DecisionType,
  ApprovalStatus,
} from "@/lib/runtime/types";

/**
 * Decision Center Component
 *
 * The primary Decision Center experience.
 * Turns validated recommendations into explicit business decisions.
 *
 * CRITICAL:
 * - RECOMMENDATION ≠ DECISION ≠ APPROVAL ≠ EXECUTION
 * - Buttons do NOT execute anything
 * - Buttons record the OWNER'S DECISION only
 *
 * Phase 11/12: Recommendation + Decision Center + Approval Integration
 */

interface DecisionCenterProps {
  business_id: string;
  onDecisionMade?: (decision_id: string) => void;
}

type TabType = "pending" | "decided" | "approvals" | "history";

export function DecisionCenter({
  business_id,
  onDecisionMade,
}: DecisionCenterProps) {
  const [activeTab, setActiveTab] = useState<TabType>("pending");
  const [pendingItems, setPendingItems] = useState<DecisionCenterItem[]>([]);
  const [decidedItems, setDecidedItems] = useState<DecisionCenterItem[]>([]);
  const [approvalItems, setApprovalItems] = useState<Array<{
    decision_id: string;
    recommendation_title: string;
    approval_status: ApprovalStatus;
    approval_id: string | null;
    risk_level: string;
    requested_at: string;
    approved_at: string | null;
    expires_at: string | null;
    scope_mismatch: string | null;
  }>>([]);
  const [selectedItem, setSelectedItem] = useState<DecisionCenterItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showChangesForm, setShowChangesForm] = useState(false);
  const [modifiedScope, setModifiedScope] = useState("");
  const [decisionReason, setDecisionReason] = useState("");

  /**
   * Load decision center data.
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pendingRes, decidedRes, approvalsRes] = await Promise.all([
        fetch(`/api/decisions?business_id=${business_id}&filter=pending`),
        fetch(`/api/decisions?business_id=${business_id}&filter=decided`),
        fetch(`/api/approvals?business_id=${business_id}&filter=all`),
      ]);

      const pendingData = await pendingRes.json();
      const decidedData = await decidedRes.json();
      const approvalsData = await approvalsRes.json();

      if (pendingData.success) setPendingItems(pendingData.items);
      if (decidedData.success) setDecidedItems(decidedData.items);
      if (approvalsData.success) {
        // Build approval items from decisions that have approval requests
        const approvalMap = new Map();
        for (const approval of approvalsData.approvals ?? []) {
          if (approval.decision_id) {
            approvalMap.set(approval.decision_id, approval);
          }
        }
        const items = decidedItems.map((item) => {
          const approval = approvalMap.get(item.existing_decision?.id ?? "");
          return {
            decision_id: item.existing_decision?.id ?? "",
            recommendation_title: item.recommendation.title,
            approval_status: approval?.status ?? "NO_APPROVAL_REQUESTED",
            approval_id: approval?.id ?? null,
            risk_level: approval?.risk_level ?? "L0",
            requested_at: approval?.requested_at ?? "",
            approved_at: approval?.approved_at ?? null,
            expires_at: approval?.expires_at ?? null,
            scope_mismatch: null, // Could be populated from audit
          };
        });
        setApprovalItems(items);
      }
    } catch (error) {
      console.error("Failed to load decision center:", error);
    } finally {
      setLoading(false);
    }
  }, [business_id, decidedItems]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Handle decision submission.
   */
  const handleDecision = async (
    recommendation_id: string,
    decision_type: DecisionType,
    reason: string,
    modified_scope?: string
  ) => {
    setSubmitting(true);
    try {
      const response = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id,
          recommendation_id,
          decision_type,
          reason,
          modified_scope,
        }),
      });

      const result = await response.json();
      if (result.success) {
        onDecisionMade?.(result.decision.id);
        setSelectedItem(null);
        setShowChangesForm(false);
        setModifiedScope("");
        setDecisionReason("");
        loadData();
      } else {
        alert(result.error || "Failed to record decision");
      }
    } catch (error) {
      console.error("Failed to submit decision:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: "pending", label: "Pending Decisions", count: pendingItems.length },
    { key: "decided", label: "Decided", count: decidedItems.length },
    { key: "approvals", label: "Approvals", count: approvalItems.length },
    { key: "history", label: "Decision Memory", count: 0 },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-gray-700/50 px-4 py-3">
        <h2 className="text-lg font-semibold text-white">Decision Center</h2>
        <p className="text-xs text-gray-400">
          Recommendations require your explicit decision
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700/50">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-orange-500 text-orange-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 rounded-full bg-gray-700 px-1.5 py-0.5 text-[10px]">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        ) : activeTab === "pending" ? (
          <PendingDecisions
            items={pendingItems}
            onSelect={setSelectedItem}
            selectedItem={selectedItem}
          />
        ) : activeTab === "decided" ? (
          <DecidedItems items={decidedItems} onSelect={setSelectedItem} selectedItem={selectedItem} />
        ) : activeTab === "approvals" ? (
          <ApprovalStatusList items={approvalItems} />
        ) : (
          <DecisionMemory business_id={business_id} />
        )}
      </div>

      {/* Decision Modal */}
      {selectedItem && (
        <DecisionModal
          item={selectedItem}
          onClose={() => {
            setSelectedItem(null);
            setShowChangesForm(false);
            setModifiedScope("");
            setDecisionReason("");
          }}
          onDecision={handleDecision}
          submitting={submitting}
          showChangesForm={showChangesForm}
          setShowChangesForm={setShowChangesForm}
          modifiedScope={modifiedScope}
          setModifiedScope={setModifiedScope}
          decisionReason={decisionReason}
          setDecisionReason={setDecisionReason}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ──────────────────────────────────────────────────────────────────────

function PendingDecisions({
  items,
  onSelect,
  selectedItem,
}: {
  items: DecisionCenterItem[];
  onSelect: (item: DecisionCenterItem) => void;
  selectedItem: DecisionCenterItem | null;
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-400">No pending decisions.</p>
        <p className="mt-1 text-xs text-gray-500">
          Recommendations from investigations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button
          key={item.recommendation.id}
          onClick={() => onSelect(item)}
          className={`w-full rounded-lg border p-3 text-left transition-colors ${
            selectedItem?.recommendation.id === item.recommendation.id
              ? "border-orange-500/50 bg-orange-500/5"
              : "border-gray-700/50 bg-gray-800/30 hover:border-gray-600/50"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-200">
              {item.recommendation.title}
            </p>
            {item.recommendation.requires_approval && (
              <span className="shrink-0 rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-400">
                Approval Required
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-400 line-clamp-2">
            {item.recommendation.description}
          </p>
          <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-500">
            <span>Impact: {item.recommendation.expected_impact ?? "Unknown"}</span>
            <span>Risk: {item.recommendation.risk ?? "Unknown"}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function DecidedItems({
  items,
  onSelect,
  selectedItem,
}: {
  items: DecisionCenterItem[];
  onSelect: (item: DecisionCenterItem) => void;
  selectedItem: DecisionCenterItem | null;
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-400">No decisions made yet.</p>
      </div>
    );
  }

  const decisionTypeColors: Record<string, string> = {
    APPROVE: "bg-green-500/10 text-green-400",
    APPROVE_WITH_CHANGES: "bg-blue-500/10 text-blue-400",
    REJECT: "bg-red-500/10 text-red-400",
    INVESTIGATE_FURTHER: "bg-yellow-500/10 text-yellow-400",
  };

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <button
          key={item.recommendation.id}
          onClick={() => onSelect(item)}
          className={`w-full rounded-lg border p-3 text-left transition-colors ${
            selectedItem?.recommendation.id === item.recommendation.id
              ? "border-orange-500/50 bg-orange-500/5"
              : "border-gray-700/50 bg-gray-800/30 hover:border-gray-600/50"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-200">
              {item.recommendation.title}
            </p>
            {item.existing_decision && (
              <span
                className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  decisionTypeColors[item.existing_decision.decision_type] ?? ""
                }`}
              >
                {item.existing_decision.decision_type.replace("_", " ")}
              </span>
            )}
          </div>
          {item.existing_decision && (
            <p className="mt-1 text-xs text-gray-400">
              Reason: {item.existing_decision.reason}
            </p>
          )}
        </button>
      ))}
    </div>
  );
}

const approvalStatusColors: Record<ApprovalStatus, string> = {
  PENDING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  APPROVED: "bg-green-500/10 text-green-400 border-green-500/20",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  EXPIRED: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  REVOKED: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const approvalStatusLabels: Record<ApprovalStatus, string> = {
  PENDING: "⏳ Pending",
  APPROVED: "✅ Approved",
  REJECTED: "❌ Rejected",
  EXPIRED: "⏰ Expired",
  REVOKED: "🚫 Revoked",
};

function ApprovalStatusList({
  items,
}: {
  items: Array<{
    decision_id: string;
    recommendation_title: string;
    approval_status: ApprovalStatus;
    approval_id: string | null;
    risk_level: string;
    requested_at: string;
    approved_at: string | null;
    expires_at: string | null;
    scope_mismatch: string | null;
  }>;
}) {
  if (items.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-400">No approval requests yet.</p>
        <p className="mt-1 text-xs text-gray-500">
          When you approve a recommendation, an approval request is created here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.decision_id}
          className="rounded-lg border border-gray-700/30 bg-gray-800/20 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-200">{item.recommendation_title}</p>
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold border ${
                approvalStatusColors[item.approval_status] ?? "bg-gray-500/10 text-gray-400 border-gray-500/20"
              }`}
            >
              {approvalStatusLabels[item.approval_status] ?? item.approval_status}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-400">
            <span>Risk: <span className="text-gray-300">{item.risk_level}</span></span>
            <span>Requested: <span className="text-gray-300">{new Date(item.requested_at).toLocaleDateString()}</span></span>
            {item.approved_at && (
              <span>Approved: <span className="text-gray-300">{new Date(item.approved_at).toLocaleDateString()}</span></span>
            )}
            {item.expires_at && (
              <span>Expires: <span className="text-gray-300">{new Date(item.expires_at).toLocaleDateString()}</span></span>
            )}
            {item.scope_mismatch && (
              <span className="text-red-400">Scope Mismatch: {item.scope_mismatch}</span>
            )}
          </div>
          {item.approval_status === "PENDING" && (
            <p className="mt-2 text-xs text-yellow-400">
              Awaiting approval from an authorized user.
            </p>
          )}
          {item.scope_mismatch && (
            <p className="mt-2 text-xs text-red-400">
              Scope mismatch detected. Action does not match approved scope.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function DecisionMemory({ business_id }: { business_id: string }) {
  const [memory, setMemory] = useState<
    Array<{
      id: string;
      decision_summary: string;
      decision_reason: string;
      decision_scope: string | null;
      decision_type: string;
      created_at: string;
    }>
  >([]);

  useEffect(() => {
    fetch(`/api/decisions?business_id=${business_id}&filter=memory`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setMemory(data.memory);
      });
  }, [business_id]);

  if (memory.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-400">No decision history.</p>
        <p className="mt-1 text-xs text-gray-500">
          Past decisions will be preserved here for future reference.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {memory.map((m) => (
        <div
          key={m.id}
          className="rounded-lg border border-gray-700/30 bg-gray-800/20 p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-medium text-gray-300">{m.decision_summary}</p>
            <span className="text-[9px] text-gray-500">
              {new Date(m.created_at).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-1 text-[10px] text-gray-400">{m.decision_reason}</p>
          {m.decision_scope && (
            <p className="mt-1 text-[10px] text-gray-500">Scope: {m.decision_scope}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// DECISION MODAL
// ──────────────────────────────────────────────────────────────────────

function DecisionModal({
  item,
  onClose,
  onDecision,
  submitting,
  showChangesForm,
  setShowChangesForm,
  modifiedScope,
  setModifiedScope,
  decisionReason,
  setDecisionReason,
}: {
  item: DecisionCenterItem;
  onClose: () => void;
  onDecision: (recommendation_id: string, type: DecisionType, reason: string, scope?: string) => void;
  submitting: boolean;
  showChangesForm: boolean;
  setShowChangesForm: (v: boolean) => void;
  modifiedScope: string;
  setModifiedScope: (v: string) => void;
  decisionReason: string;
  setDecisionReason: (v: string) => void;
}) {
  const rec = item.recommendation;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-gray-700/50 bg-gray-900 shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-700/50 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-white">
                {rec.title}
              </h3>
              <p className="mt-1 text-sm text-gray-400">{rec.description}</p>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 text-gray-400 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4 px-6 py-4">
          {/* What happened? */}
          {item.investigation && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                What Happened
              </h4>
              <p className="mt-1 text-sm text-gray-300">{item.investigation.title}</p>
              <p className="text-xs text-gray-400">{item.investigation.description}</p>
            </div>
          )}

          {/* Evidence & Provenance */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Evidence & Provenance
            </h4>
            <div className="mt-2">
              <EvidenceProvenance
                findings={item.findings}
                insights={item.insights}
                evidence={item.evidence}
              />
            </div>
          </div>

          {/* Why it matters */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Why It Matters
            </h4>
            <div className="mt-1 grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gray-700/30 bg-gray-800/20 p-2">
                <p className="text-[10px] text-gray-500">Expected Impact</p>
                <p className="text-sm text-gray-300">{rec.expected_impact ?? "Unknown"}</p>
              </div>
              <div className="rounded-lg border border-gray-700/30 bg-gray-800/20 p-2">
                <p className="text-[10px] text-gray-500">Risk</p>
                <p className="text-sm text-gray-300">{rec.risk ?? "Unknown"}</p>
              </div>
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Our Recommendation
            </h4>
            <div className="mt-1 rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
              <p className="text-sm text-orange-200">{rec.title}</p>
              <p className="mt-1 text-xs text-orange-300/70">{rec.description}</p>
              {rec.rationale && (
                <p className="mt-2 text-xs text-gray-400">
                  <span className="font-medium">Rationale:</span> {rec.rationale}
                </p>
              )}
            </div>
          </div>

          {/* Dependencies & Assumptions */}
          {(rec.dependencies?.length ?? 0) > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Dependencies
              </h4>
              <div className="mt-1 flex flex-wrap gap-1">
                {rec.dependencies?.map((dep, i) => (
                  <span
                    key={i}
                    className="rounded bg-gray-700/50 px-2 py-0.5 text-[10px] text-gray-300"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Existing decision */}
          {item.existing_decision && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
              <p className="text-xs font-medium text-blue-400">
                Decision already made: {item.existing_decision.decision_type}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                Reason: {item.existing_decision.reason}
              </p>
            </div>
          )}

          {/* Decision form */}
          {!item.existing_decision && (
            <div className="border-t border-gray-700/50 pt-4">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Your Decision
              </h4>

              {/* Reason input */}
              <div className="mt-2">
                <label className="text-[10px] text-gray-500">Decision Reason (required)</label>
                <textarea
                  value={decisionReason}
                  onChange={(e) => setDecisionReason(e.target.value)}
                  placeholder="Why are you making this decision?"
                  className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                  rows={2}
                />
              </div>

              {/* Approve With Changes form */}
              {showChangesForm && (
                <div className="mt-2">
                  <label className="text-[10px] text-gray-500">Modified Scope</label>
                  <textarea
                    value={modifiedScope}
                    onChange={(e) => setModifiedScope(e.target.value)}
                    placeholder="Describe your modified scope (e.g., 'Start with 30 customers instead of 100')"
                    className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-orange-500 focus:outline-none"
                    rows={2}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => {
                    if (!decisionReason.trim()) {
                      alert("Please provide a reason for your decision.");
                      return;
                    }
                    onDecision(rec.id, "APPROVE", decisionReason);
                  }}
                  disabled={submitting || !decisionReason.trim()}
                  className="flex-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
                >
                  Approve
                </button>

                <button
                  onClick={() => {
                    if (!showChangesForm) {
                      setShowChangesForm(true);
                      return;
                    }
                    if (!decisionReason.trim() || !modifiedScope.trim()) {
                      alert("Please provide a reason and modified scope.");
                      return;
                    }
                    onDecision(rec.id, "APPROVE_WITH_CHANGES", decisionReason, modifiedScope);
                  }}
                  disabled={submitting || !decisionReason.trim()}
                  className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {showChangesForm ? "Confirm Changes" : "Approve with Changes"}
                </button>

                <button
                  onClick={() => {
                    if (!decisionReason.trim()) {
                      alert("Please provide a reason for your decision.");
                      return;
                    }
                    onDecision(rec.id, "REJECT", decisionReason);
                  }}
                  disabled={submitting || !decisionReason.trim()}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Reject
                </button>

                <button
                  onClick={() => {
                    if (!decisionReason.trim()) {
                      alert("Please provide a reason for your decision.");
                      return;
                    }
                    onDecision(rec.id, "INVESTIGATE_FURTHER", decisionReason);
                  }}
                  disabled={submitting || !decisionReason.trim()}
                  className="flex-1 rounded-lg bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-500 disabled:opacity-50"
                >
                  Investigate Further
                </button>
              </div>

              <p className="mt-2 text-center text-[10px] text-gray-500">
                Your decision is recorded. No action will be executed without your explicit approval.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
