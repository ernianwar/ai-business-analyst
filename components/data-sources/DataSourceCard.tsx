/**
 * SALAM LIT — DataSourceCard Component
 *
 * Displays a data source with its status, trust level, and document count.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 */

"use client";

import React from "react";
import type { DataSource } from "@/lib/db/types";

interface DataSourceCardProps {
  data_source: DataSource;
  document_count?: number;
  onRefresh?: () => void;
}

const SOURCE_TYPE_ICONS: Record<string, string> = {
  API: "🔌",
  BANK_FEED: "🏦",
  MANUAL: "📝",
  DOCUMENT: "📄",
  SCRAPE: "🌐",
  EMAIL: "📧",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  API: "API Connection",
  BANK_FEED: "Bank Feed",
  MANUAL: "Manual Entry",
  DOCUMENT: "Document Upload",
  SCRAPE: "Web Scrape",
  EMAIL: "Email",
};

const TRUST_LEVEL_COLORS: Record<string, string> = {
  FULLY_TRUSTED: "text-green-400",
  VERIFIED: "text-blue-400",
  UNVERIFIED: "text-yellow-400",
};

const TRUST_LEVEL_LABELS: Record<string, string> = {
  FULLY_TRUSTED: "Fully Trusted",
  VERIFIED: "Verified",
  UNVERIFIED: "Unverified",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-500/20 text-green-400 border-green-500/30",
  ERROR: "bg-red-500/20 text-red-400 border-red-500/30",
  PAUSED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

export function DataSourceCard({
  data_source,
  document_count = 0,
  onRefresh,
}: DataSourceCardProps) {
  const icon = SOURCE_TYPE_ICONS[data_source.source_type] || "📦";
  const sourceLabel =
    SOURCE_TYPE_LABELS[data_source.source_type] || data_source.source_type;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-zinc-100 truncate">
              {data_source.name}
            </h3>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium border ${
                STATUS_COLORS[data_source.status] || "bg-zinc-800 text-zinc-400"
              }`}
            >
              {data_source.status}
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1">{sourceLabel}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-zinc-400">
            <span>
              Trust:{" "}
              <span
                className={
                  TRUST_LEVEL_COLORS[data_source.trust_level] || "text-zinc-400"
                }
              >
                {TRUST_LEVEL_LABELS[data_source.trust_level] ||
                  data_source.trust_level}
              </span>
            </span>
            <span>Documents: {document_count}</span>
          </div>
          {data_source.last_synced_at && (
            <p className="text-xs text-zinc-600 mt-1">
              Last synced:{" "}
              {new Date(data_source.last_synced_at).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
