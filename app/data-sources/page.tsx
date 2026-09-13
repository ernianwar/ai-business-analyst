/**
 * SALAM LIT — Data Sources Page
 *
 * Manages data sources, documents, and evidence ingestion.
 * This is the control center for feeding business data into the Truth Layer.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 * Phase 15.3: Uses authenticated context for business_id.
 *
 * CRITICAL: Uploaded data is NOT automatically Business Truth.
 * Every document/evidence preserves provenance and uncertainty.
 */

"use client";

import React, { useState, useEffect } from "react";
import { DataSourceCard } from "@/components/data-sources/DataSourceCard";
import { FileUpload } from "@/components/documents/FileUpload";
import { DocumentsList } from "@/components/documents/DocumentsList";
import type { DataSource } from "@/lib/db/types";
import type { IngestionJob } from "@/lib/ingestion/types";

type Tab = "sources" | "upload" | "documents" | "evidence";

interface MeContext {
  business_id: string | null;
}

export default function DataSourcesPage() {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("sources");
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [ingestionJobs, setIngestionJobs] = useState<IngestionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then((res) => {
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        return res.json();
      })
      .then((data: MeContext | undefined) => {
        if (data?.business_id) {
          setBusinessId(data.business_id);
        } else {
          window.location.href = "/onboarding";
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!businessId) return;
    fetchDataSources();
    fetchIngestionJobs();
  }, [businessId]);

  const fetchDataSources = async () => {
    if (!businessId) return;
    try {
      const response = await fetch(
        `/api/business/${businessId}/data-sources`
      );
      const data = await response.json();
      setDataSources(data.data_sources || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load data sources"
      );
    } finally {
      setLoading(false);
    }
  };

  const fetchIngestionJobs = async () => {
    if (!businessId) return;
    try {
      const response = await fetch(
        `/api/business/${businessId}/data-sources`
      );
      const data = await response.json();
      // Jobs would be fetched from a dedicated endpoint in production
    } catch (err) {
      // Silent fail for jobs
    }
  };

  const handleUploadComplete = (result: any) => {
    // Refresh data sources and jobs
    fetchDataSources();
    fetchIngestionJobs();
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "sources", label: "Data Sources", icon: "🔌" },
    { key: "upload", label: "Upload Files", icon: "📤" },
    { key: "documents", label: "Documents", icon: "📁" },
    { key: "evidence", label: "Evidence", icon: "🔍" },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--office-bg)]">
        <p className="text-sm text-[var(--office-text-muted)]">Loading...</p>
      </div>
    );
  }

  if (!businessId) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--office-bg)]">
        <p className="text-sm text-[var(--office-text-muted)]">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--office-bg)]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--office-text-primary)]">
              Data Sources & Documents
            </h1>
            <p className="text-sm text-[var(--office-text-muted)] mt-1">
              Feed business data into the Truth Layer with full provenance
            </p>
          </div>
          <a
            href="/"
            className="rounded-lg bg-[var(--office-surface-elevated)] px-4 py-2 text-sm text-[var(--office-text-secondary)] hover:bg-[var(--office-surface-hover)]"
          >
            ← Back to Office
          </a>
        </div>

        {/* Warning Banner */}
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-yellow-400 text-lg">⚠️</span>
            <div>
              <p className="text-sm font-medium text-yellow-400">
                Important: Uploaded Data ≠ Business Truth
              </p>
              <p className="text-xs text-[var(--office-text-muted)] mt-1">
                All uploaded documents and extracted evidence preserve
                provenance and uncertainty. Data goes through validation before
                becoming Business Facts. Raw uploads remain as Evidence only.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 office-panel">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                transition-colors
                ${
                  activeTab === tab.key
                    ? "bg-[var(--office-surface-elevated)] text-[var(--office-text-primary)]"
                    : "text-[var(--office-text-muted)] hover:text-[var(--office-text-secondary)] hover:bg-[var(--office-surface-hover)]"
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="mt-6">
          {activeTab === "sources" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-[var(--office-text-primary)]">
                  Connected Sources
                </h2>
                <button className="px-4 py-2 bg-[var(--office-accent)] hover:bg-[var(--office-accent-hover)] text-white text-sm font-medium rounded-lg transition-colors">
                  Add Source
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-32 office-panel animate-pulse"
                    />
                  ))}
                </div>
              ) : error ? (
                <div className="text-center py-12">
                  <p className="text-sm text-red-400">{error}</p>
                  <button
                    onClick={fetchDataSources}
                    className="mt-2 text-xs text-[var(--office-text-muted)] hover:text-[var(--office-text-secondary)] underline"
                  >
                    Retry
                  </button>
                </div>
              ) : dataSources.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-4">🔌</div>
                  <p className="text-sm text-[var(--office-text-muted)]">
                    No data sources connected
                  </p>
                  <p className="text-xs text-[var(--office-border)] mt-1">
                    Upload files or connect APIs to feed data into the Truth
                    Layer
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dataSources.map((ds) => (
                    <DataSourceCard key={ds.id} data_source={ds} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "upload" && (
            <div className="max-w-2xl">
              <h2 className="text-lg font-medium text-[var(--office-text-primary)] mb-4">
                Upload Files
              </h2>
              <FileUpload
                business_id={businessId}
                onUploadComplete={handleUploadComplete}
              />
              <div className="mt-6 p-4 office-panel">
                <h3 className="text-sm font-medium text-[var(--office-text-primary)] mb-2">
                  Supported File Types
                </h3>
                <div className="grid grid-cols-3 gap-4 text-xs text-[var(--office-text-muted)]">
                  <div>
                    <p className="font-medium text-[var(--office-text-secondary)]">📊 CSV</p>
                    <p>Tabular data exports</p>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--office-text-secondary)]">📈 XLSX</p>
                    <p>Excel spreadsheets</p>
                  </div>
                  <div>
                    <p className="font-medium text-[var(--office-text-secondary)]">📄 PDF</p>
                    <p>Documents & reports</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <div>
              <h2 className="text-lg font-medium text-[var(--office-text-primary)] mb-4">
                Uploaded Documents
              </h2>
              <DocumentsList business_id={businessId} />
            </div>
          )}

          {activeTab === "evidence" && (
            <div>
              <h2 className="text-lg font-medium text-[var(--office-text-primary)] mb-4">
                Extracted Evidence
              </h2>
              <p className="text-sm text-[var(--office-text-muted)] mb-4">
                Evidence extracted from uploaded documents. This data preserves
                provenance and uncertainty — it is NOT automatically Business
                Truth.
              </p>
              <div className="text-center py-12">
                <div className="text-4xl mb-4">🔍</div>
                <p className="text-sm text-[var(--office-text-muted)]">
                  Select a document to view its extracted evidence
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
