/**
 * SALAM LIT — File Utilities
 *
 * File validation, hashing, and type detection.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 */

import type { IngestionFileType, FileValidationResult, IngestionLimits } from "./types";
import { DEFAULT_INGESTION_LIMITS } from "./types";

/**
 * Supported MIME types for ingestion.
 */
const SUPPORTED_MIME_TYPES: Record<string, IngestionFileType> = {
  "text/csv": "csv",
  "application/csv": "csv",
  "text/plain": "csv", // May be CSV
  "application/vnd.ms-excel": "xlsx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.oasis.opendocument.spreadsheet": "xlsx",
  "application/pdf": "pdf",
};

/**
 * Supported file extensions for ingestion.
 */
const SUPPORTED_EXTENSIONS: Record<string, IngestionFileType> = {
  ".csv": "csv",
  ".tsv": "csv",
  ".xlsx": "xlsx",
  ".xls": "xlsx",
  ".ods": "xlsx",
  ".pdf": "pdf",
};

/**
 * Detect file type from MIME type and extension.
 */
export function detectFileType(
  mime_type: string,
  file_name: string
): IngestionFileType {
  // Try MIME type first
  const fromMime = SUPPORTED_MIME_TYPES[mime_type.toLowerCase()];
  if (fromMime) return fromMime;

  // Try extension
  const ext = file_name.toLowerCase().match(/\.[^.]+$/)?.[0];
  if (ext) {
    const fromExt = SUPPORTED_EXTENSIONS[ext];
    if (fromExt) return fromExt;
  }

  return "unknown";
}

/**
 * Validate a file for ingestion.
 */
export function validateFile(
  file_name: string,
  mime_type: string,
  file_size: number,
  limits: IngestionLimits = DEFAULT_INGESTION_LIMITS
): FileValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const file_type = detectFileType(mime_type, file_name);

  // Check file type
  if (file_type === "unknown") {
    errors.push(
      `Unsupported file type: ${mime_type || "unknown"} (${file_name})`
    );
  }

  // Check file size
  if (file_size <= 0) {
    errors.push("File is empty");
  } else if (file_size > limits.max_file_size_bytes) {
    errors.push(
      `File size ${(file_size / 1024 / 1024).toFixed(1)}MB exceeds limit of ${
        limits.max_file_size_bytes / 1024 / 1024
      }MB`
    );
  }

  // Check file name
  if (!file_name || file_name.trim().length === 0) {
    errors.push("File name is required");
  }

  // Warnings
  if (file_size > limits.max_file_size_bytes * 0.8) {
    warnings.push("File is close to size limit");
  }

  return {
    valid: errors.length === 0,
    file_type,
    mime_type,
    file_size,
    errors,
    warnings,
  };
}

/**
 * Calculate SHA-256 hash of file content.
 * Used for duplicate detection.
 */
export async function calculateFileHash(
  content: ArrayBuffer
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Calculate content hash for evidence deduplication.
 */
export async function calculateContentHash(
  content: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate storage key for a file.
 */
export function generateStorageKey(
  business_id: string,
  file_name: string,
  file_hash: string
): string {
  const timestamp = Date.now();
  const safeName = file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `businesses/${business_id}/documents/${timestamp}_${file_hash.slice(0, 8)}_${safeName}`;
}
