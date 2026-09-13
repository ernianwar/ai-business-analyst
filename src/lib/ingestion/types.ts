/**
 * SALAM LIT — Ingestion Types
 *
 * Types for the document ingestion pipeline.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 */

import type { DocumentStatus, Classification } from "../db/types";

/**
 * Supported file types for ingestion.
 */
export type IngestionFileType = "csv" | "xlsx" | "pdf" | "unknown";

/**
 * Ingestion configuration limits.
 */
export interface IngestionLimits {
  max_file_size_bytes: number;
  max_csv_rows: number;
  max_csv_columns: number;
  max_xlsx_worksheets: number;
  max_xlsx_rows_per_sheet: number;
  max_pdf_pages: number;
  processing_timeout_ms: number;
}

/**
 * Default ingestion limits.
 */
export const DEFAULT_INGESTION_LIMITS: IngestionLimits = {
  max_file_size_bytes: 10 * 1024 * 1024, // 10MB
  max_csv_rows: 10000,
  max_csv_columns: 100,
  max_xlsx_worksheets: 20,
  max_xlsx_rows_per_sheet: 10000,
  max_pdf_pages: 100,
  processing_timeout_ms: 60000,
};

/**
 * File validation result.
 */
export interface FileValidationResult {
  valid: boolean;
  file_type: IngestionFileType;
  mime_type: string;
  file_size: number;
  errors: string[];
  warnings: string[];
}

/**
 * Parsed data from a CSV file.
 */
export interface ParsedCsvData {
  headers: string[];
  rows: string[][];
  total_rows: number;
  delimiter: string;
  encoding: string;
  parsing_errors: string[];
}

/**
 * Parsed data from an XLSX file.
 */
export interface ParsedXlsxData {
  worksheets: ParsedXlsxWorksheet[];
  total_sheets: number;
  parsing_errors: string[];
}

export interface ParsedXlsxWorksheet {
  name: string;
  headers: string[];
  rows: (string | number | boolean | null)[][];
  total_rows: number;
}

/**
 * Parsed data from a PDF file.
 */
export interface ParsedPdfData {
  total_pages: number;
  pages: ParsedPdfPage[];
  text_extracted: boolean;
  parsing_errors: string[];
}

export interface ParsedPdfPage {
  page_number: number;
  text: string;
  char_count: number;
}

/**
 * Ingestion job status.
 */
export type IngestionJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "RETRYING";

/**
 * Ingestion job.
 */
export interface IngestionJob {
  id: string;
  document_id: string;
  business_id: string;
  status: IngestionJobStatus;
  file_type: IngestionFileType;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  evidence_created: number;
  retry_count: number;
  created_at: string;
}

/**
 * Extracted evidence item from ingestion.
 */
export interface ExtractedEvidence {
  id: string;
  document_id: string;
  data_source_id: string;
  business_id: string;
  evidence_type: "DOCUMENT_EXCERPT";
  content_reference: string;
  excerpt: string | null;
  source_timestamp: string | null;
  classification: Classification;
  source_reliability: "HIGH" | "MEDIUM" | "LOW" | "UNVERIFIED";
  content_hash: string | null;
  row_index?: number;
  column_index?: number;
  column_name?: string;
  cell_reference?: string;
  worksheet_name?: string;
  page_number?: number;
}

/**
 * Import preview item.
 */
export interface ImportPreviewItem {
  id: string;
  document_id: string;
  file_name: string;
  file_type: IngestionFileType;
  file_size: number;
  file_hash: string;
  status: DocumentStatus;
  evidence_count: number;
  preview_data?: {
    headers?: string[];
    sample_rows?: string[][];
    total_rows?: number;
    worksheets?: string[];
    pages?: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * Duplicate detection result.
 */
export interface DuplicateDetectionResult {
  is_duplicate: boolean;
  existing_document_id: string | null;
  existing_file_hash: string | null;
  match_type: "EXACT_HASH" | "NONE";
}

/**
 * Data type detection result.
 */
export type DetectedDataType =
  | "text"
  | "integer"
  | "decimal"
  | "date"
  | "datetime"
  | "boolean"
  | "currency"
  | "percentage"
  | "unknown";

/**
 * Column type detection.
 */
export interface ColumnTypeDetection {
  column_name: string;
  column_index: number;
  detected_type: DetectedDataType;
  confidence: number;
  sample_values: string[];
  null_count: number;
  total_count: number;
}

/**
 * Currency detection result.
 */
export interface CurrencyDetection {
  detected: boolean;
  currency_code: string | null;
  confidence: number;
  source: string;
}

/**
 * Date ambiguity detection.
 */
export interface DateAmbiguity {
  has_ambiguity: boolean;
  ambiguous_dates: Array<{
    raw_value: string;
    possible_interpretations: string[];
    recommended?: string;
  }>;
}
