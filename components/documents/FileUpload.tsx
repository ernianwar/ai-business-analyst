/**
 * SALAM LIT — FileUpload Component
 *
 * Handles file upload with drag-and-drop, validation, and progress tracking.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 */

"use client";

import React, { useState, useRef, useCallback } from "react";

interface FileUploadProps {
  business_id: string;
  onUploadComplete?: (result: any) => void;
  onError?: (error: string) => void;
}

interface UploadState {
  is_dragging: boolean;
  is_uploading: boolean;
  progress: number;
  error: string | null;
  result: any | null;
}

export function FileUpload({
  business_id,
  onUploadComplete,
  onError,
}: FileUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    is_dragging: false,
    is_uploading: false,
    progress: 0,
    error: null,
    result: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadState((prev) => ({ ...prev, is_dragging: true }));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setUploadState((prev) => ({ ...prev, is_dragging: false }));
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setUploadState((prev) => ({ ...prev, is_dragging: false }));

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [business_id]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFileUpload(files[0]);
      }
    },
    [business_id]
  );

  const handleFileUpload = async (file: File) => {
    // Reset state
    setUploadState({
      is_dragging: false,
      is_uploading: true,
      progress: 0,
      error: null,
      result: null,
    });

    try {
      // Create form data
      const formData = new FormData();
      formData.append("file", file);
      formData.append("classification", "INTERNAL");

      // Upload file
      const response = await fetch(`/api/business/${business_id}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadState((prev) => ({
        ...prev,
        is_uploading: false,
        progress: 100,
        result: data,
      }));

      onUploadComplete?.(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Upload failed";

      setUploadState((prev) => ({
        ...prev,
        is_uploading: false,
        error: errorMessage,
      }));

      onError?.(errorMessage);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const resetUpload = () => {
    setUploadState({
      is_dragging: false,
      is_uploading: false,
      progress: 0,
      error: null,
      result: null,
    });
  };

  return (
    <div className="w-full">
      {/* Drop zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${
            uploadState.is_dragging
              ? "border-violet-500 bg-violet-500/10"
              : uploadState.is_uploading
              ? "border-blue-500 bg-blue-500/10"
              : uploadState.error
              ? "border-red-500 bg-red-500/10"
              : "border-zinc-700 bg-zinc-900 hover:border-zinc-600 hover:bg-zinc-800"
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.pdf,.tsv,.ods"
          onChange={handleFileSelect}
          className="hidden"
        />

        {uploadState.is_uploading ? (
          <div className="space-y-3">
            <div className="text-2xl">📤</div>
            <p className="text-sm text-zinc-300">Uploading...</p>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </div>
        ) : uploadState.error ? (
          <div className="space-y-3">
            <div className="text-2xl">❌</div>
            <p className="text-sm text-red-400">{uploadState.error}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                resetUpload();
              }}
              className="text-xs text-zinc-400 hover:text-zinc-300 underline"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-3xl">📁</div>
            <div>
              <p className="text-sm text-zinc-300">
                <span className="text-violet-400 font-medium">
                  Click to upload
                </span>{" "}
                or drag and drop
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                CSV, XLSX, or PDF (max 10MB)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Upload result */}
      {uploadState.result && (
        <div className="mt-4 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">✓</span>
            <span className="text-sm font-medium text-zinc-100">
              Upload Complete
            </span>
          </div>
          <div className="text-xs text-zinc-400 space-y-1">
            <p>File: {uploadState.result.document.file_name}</p>
            <p>Status: {uploadState.result.document.status}</p>
            {uploadState.result.job && (
              <p>
                Evidence extracted: {uploadState.result.job.evidence_count} items
              </p>
            )}
            {uploadState.result.duplicate?.is_duplicate && (
              <p className="text-yellow-400">
                ⚠️ Duplicate file detected. Existing document returned.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
