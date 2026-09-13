/**
 * SALAM LIT — DocumentsList Component
 *
 * Lists all documents for a business with their status and evidence count.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 */

"use client";

import React, { useState, useEffect } from "react";
import type { Document } from "@/lib/db/types";
import type { IngestionFileType } from "@/lib/ingestion/types";

interface DocumentsListProps {
  business_id: string;
  onDocumentClick?: (document: Document) => void;
}

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  VALIDATING: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  QUEUED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PROCESSING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PROCESSED: "bg-green-500/20 text-green-400 border-green-500/30",
  PARTIALLY_PROCESSED: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  FAILED: "bg-red-500/20 text-red-400 border-red-500/30",
  REJECTED: "bg-red-500/20 text-red-400 border-red-500/30",
  ARCHIVED: "bg-zinc-500/20 text-zinc-500 border-zinc-500/30",
};

const FILE_TYPE_ICONS: Record<string, string> = {
  csv: "📊",
  xlsx: "📈",
  pdf: "📄",
  unknown: "📎",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(filename: string): IngestionFileType {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext === ".csv" || ext === ".tsv") return "csv";
  if (ext === ".xlsx" || ext === ".xls" || ext === ".ods") return "xlsx";
  if (ext === ".pdf") return "pdf";
  return "unknown";
}

export function DocumentsList({
  business_id,
  onDocumentClick,
}: DocumentsListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [business_id]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/business/${business_id}/data-sources`
      );
      const data = await response.json();

      // Fetch documents for each data source
      const allDocuments: Document[] = [];
      for (const ds of data.data_sources || []) {
        const docResponse = await fetch(
          `/api/business/${business_id}/facts?data_source_id=${ds.id}`
        );
        const docData = await docResponse.json();
        // Note: This is a simplified approach. In production, we'd have a dedicated documents endpoint.
      }

      setDocuments(allDocuments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 bg-zinc-900 border border-zinc-800 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchDocuments}
          className="mt-2 text-xs text-zinc-400 hover:text-zinc-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">📁</div>
        <p className="text-sm text-zinc-400">No documents uploaded yet</p>
        <p className="text-xs text-zinc-600 mt-1">
          Upload CSV, XLSX, or PDF files to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {documents.map((doc) => {
        const fileType = getFileType(doc.file_name);
        const icon = FILE_TYPE_ICONS[fileType];
        const statusColor = STATUS_COLORS[doc.status] || STATUS_COLORS.UPLOADED;

        return (
          <div
            key={doc.id}
            onClick={() => onDocumentClick?.(doc)}
            className="flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors cursor-pointer"
          >
            <div className="text-xl">{icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-100 truncate">
                {doc.file_name}
              </p>
              <div className="flex items-center gap-3 text-xs text-zinc-500 mt-1">
                <span>{formatFileSize(doc.file_size)}</span>
                <span>{doc.evidence_count} evidence items</span>
                <span>
                  {new Date(doc.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-medium border ${statusColor}`}
            >
              {doc.status}
            </span>
          </div>
        );
      })}
    </div>
  );
}
