/**
 * SALAM LIT — Ingestion Service
 *
 * Orchestrates the document ingestion pipeline:
 *   USER / FILE / DOCUMENT
 *       ↓
 *   DATA SOURCE
 *       ↓
 *   DOCUMENT
 *       ↓
 *   VALIDATE
 *       ↓
 *   STORE
 *       ↓
 *   PARSE / INGEST
 *       ↓
 *   EVIDENCE
 *       ↓
 *   CANDIDATE FACT (where appropriate)
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 *
 * CRITICAL: Uploaded data is NOT automatically Business Truth.
 * The pipeline preserves provenance and uncertainty.
 */

import type {
  Document,
  DataSource,
  Evidence,
  DocumentStatus,
  Classification,
} from "../db/types";
import { businessTruthService } from "../db/services/business-truth";
import {
  validateFile,
  calculateFileHash,
  calculateContentHash,
  generateStorageKey,
  detectFileType,
} from "./file-utils";
import { parseCsv, detectColumnTypes, detectCurrency } from "./csv-parser";
import { parseXlsx, getCellReference } from "./xlsx-parser";
import { parsePdf, detectFinancialPatterns } from "./pdf-parser";
import type {
  IngestionJob,
  IngestionJobStatus,
  IngestionFileType,
  ParsedCsvData,
  ParsedXlsxData,
  ParsedPdfData,
  ExtractedEvidence,
  DuplicateDetectionResult,
  ImportPreviewItem,
  IngestionLimits,
  DEFAULT_INGESTION_LIMITS,
} from "./types";

/**
 * In-memory ingestion job store.
 * Production: Will use PostgreSQL + job queue.
 */
const ingestionJobs: Map<string, IngestionJob> = new Map();

/**
 * In-memory evidence store for extracted evidence.
 * Production: Will use PostgreSQL via businessTruthService.
 */
const extractedEvidence: Map<string, ExtractedEvidence[]> = new Map();

/**
 * In-memory document store for uploaded files.
 * In production, files are stored in object storage.
 * This is for development/preview only.
 */
const fileContents: Map<string, ArrayBuffer> = new Map();

/**
 * Upload and validate a file for ingestion.
 */
export async function uploadDocument(params: {
  business_id: string;
  file_name: string;
  mime_type: string;
  content: ArrayBuffer;
  classification?: Classification;
  uploaded_by?: string;
  limits?: IngestionLimits;
}): Promise<{
  document: Document;
  validation: ReturnType<typeof validateFile>;
  duplicate: DuplicateDetectionResult;
}> {
  const {
    business_id,
    file_name,
    mime_type,
    content,
    classification = "INTERNAL",
    uploaded_by,
    limits,
  } = params;

  // 1. Validate file
  const validation = validateFile(file_name, mime_type, content.byteLength, limits);

  if (!validation.valid) {
    // Create document with error status
    const doc = await businessTruthService.createDocument({
      business_id,
      data_source_id: null,
      file_name,
      mime_type,
      storage_key: null,
      file_size: content.byteLength,
      file_hash: null,
      classification,
      status: "REJECTED",
      uploaded_by: uploaded_by ?? null,
      processing_error: validation.errors.join("; "),
      processing_started_at: null,
      processing_completed_at: null,
      evidence_count: 0,
    });
    return { document: doc, validation, duplicate: { is_duplicate: false, existing_document_id: null, existing_file_hash: null, match_type: "NONE" } };
  }

  // 2. Calculate file hash
  const file_hash = await calculateFileHash(content);

  // 3. Check for duplicates
  const duplicate = await detectDuplicate(business_id, file_hash);

  if (duplicate.is_duplicate) {
    // Get existing document
    const existingDoc = await businessTruthService.getDocument(
      duplicate.existing_document_id!
    );
    if (existingDoc) {
      return { document: existingDoc, validation, duplicate };
    }
  }

  // 4. Create or get data source
  const dataSources = await businessTruthService.getDataSourcesByBusiness(
    business_id
  );
  let dataSource = dataSources.find(
    (s) => s.source_type === "DOCUMENT" && s.provider === validation.file_type
  );

  if (!dataSource) {
    dataSource = await businessTruthService.createDataSource({
      business_id,
      source_type: "DOCUMENT",
      provider: validation.file_type,
      name: `${validation.file_type.toUpperCase()} Uploads`,
      external_reference: null,
      status: "ACTIVE",
      trust_level: "MEDIUM",
      last_synced_at: null,
    });
  }

  // 5. Store file content (in-memory for development)
  const storage_key = generateStorageKey(business_id, file_name, file_hash);
  fileContents.set(storage_key, content);

  // 6. Create document
  const document = await businessTruthService.createDocument({
    business_id,
    data_source_id: dataSource.id,
    file_name,
    mime_type,
    storage_key,
    file_size: content.byteLength,
    file_hash,
    classification,
    status: "UPLOADED",
    uploaded_by: uploaded_by ?? null,
    processing_error: null,
    processing_started_at: null,
    processing_completed_at: null,
    evidence_count: 0,
  });

  // 7. Create ingestion job
  const job: IngestionJob = {
    id: crypto.randomUUID(),
    document_id: document.id,
    business_id,
    status: "QUEUED",
    file_type: validation.file_type,
    started_at: null,
    completed_at: null,
    error: null,
    evidence_created: 0,
    retry_count: 0,
    created_at: new Date().toISOString(),
  };
  ingestionJobs.set(job.id, job);

  return { document, validation, duplicate };
}

/**
 * Detect duplicate content by file hash.
 */
export async function detectDuplicate(
  business_id: string,
  file_hash: string
): Promise<DuplicateDetectionResult> {
  const documents = await businessTruthService.getDocumentsByBusiness(
    business_id
  );

  const existing = documents.find((d) => d.file_hash === file_hash);

  if (existing) {
    return {
      is_duplicate: true,
      existing_document_id: existing.id,
      existing_file_hash: file_hash,
      match_type: "EXACT_HASH",
    };
  }

  return {
    is_duplicate: false,
    existing_document_id: null,
    existing_file_hash: null,
    match_type: "NONE",
  };
}

/**
 * Process an ingestion job.
 * This is the main ingestion pipeline.
 */
export async function processIngestionJob(
  job_id: string
): Promise<{
  success: boolean;
  evidence_count: number;
  errors: string[];
}> {
  const job = ingestionJobs.get(job_id);
  if (!job) {
    return { success: false, evidence_count: 0, errors: ["Job not found"] };
  }

  // Update job status
  job.status = "PROCESSING";
  job.started_at = new Date().toISOString();
  ingestionJobs.set(job_id, job);

  // Update document status
  await businessTruthService.updateDocument(job.document_id, {
    status: "PROCESSING",
    processing_started_at: new Date().toISOString(),
  });

  try {
    // Get document
    const document = await businessTruthService.getDocument(job.document_id);
    if (!document) {
      throw new Error("Document not found");
    }

    // Get file content
    const content = fileContents.get(document.storage_key!);
    if (!content) {
      throw new Error("File content not found");
    }

    // Parse based on file type
    let evidenceItems: ExtractedEvidence[] = [];
    const errors: string[] = [];

    switch (job.file_type) {
      case "csv":
        const csvResult = await parseCsv(content);
        evidenceItems = await extractEvidenceFromCsv(
          document,
          job.business_id,
          csvResult
        );
        errors.push(...csvResult.parsing_errors);
        break;

      case "xlsx":
        const xlsxResult = await parseXlsx(content);
        evidenceItems = await extractEvidenceFromXlsx(
          document,
          job.business_id,
          xlsxResult
        );
        errors.push(...xlsxResult.parsing_errors);
        break;

      case "pdf":
        const pdfResult = await parsePdf(content);
        evidenceItems = await extractEvidenceFromPdf(
          document,
          job.business_id,
          pdfResult
        );
        errors.push(...pdfResult.parsing_errors);
        break;

      default:
        throw new Error(`Unsupported file type: ${job.file_type}`);
    }

    // Store extracted evidence
    extractedEvidence.set(job.document_id, evidenceItems);

    // Update document
    await businessTruthService.updateDocument(job.document_id, {
      status: errors.length > 0 ? "PARTIALLY_PROCESSED" : "PROCESSED",
      processing_completed_at: new Date().toISOString(),
      processing_error: errors.length > 0 ? errors.join("; ") : null,
      evidence_count: evidenceItems.length,
    });

    // Update job
    job.status = "COMPLETED";
    job.completed_at = new Date().toISOString();
    job.evidence_created = evidenceItems.length;
    job.error = errors.length > 0 ? errors.join("; ") : null;
    ingestionJobs.set(job_id, job);

    return {
      success: true,
      evidence_count: evidenceItems.length,
      errors,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown processing error";

    // Update job
    job.status = "FAILED";
    job.completed_at = new Date().toISOString();
    job.error = errorMessage;
    ingestionJobs.set(job_id, job);

    // Update document
    await businessTruthService.updateDocument(job.document_id, {
      status: "FAILED",
      processing_completed_at: new Date().toISOString(),
      processing_error: errorMessage,
    });

    return { success: false, evidence_count: 0, errors: [errorMessage] };
  }
}

/**
 * Extract evidence from CSV data.
 */
async function extractEvidenceFromCsv(
  document: Document,
  business_id: string,
  data: ParsedCsvData
): Promise<ExtractedEvidence[]> {
  const evidenceItems: ExtractedEvidence[] = [];
  const dataSourceId = document.data_source_id!;

  // Create evidence for headers
  const headerEvidence: ExtractedEvidence = {
    id: crypto.randomUUID(),
    document_id: document.id,
    data_source_id: dataSourceId,
    business_id,
    evidence_type: "DOCUMENT_EXCERPT",
    content_reference: `CSV headers: ${data.headers.join(", ")}`,
    excerpt: JSON.stringify(data.headers),
    source_timestamp: null,
    classification: document.classification,
    source_reliability: "MEDIUM",
    content_hash: await calculateContentHash(data.headers.join(",")),
  };
  evidenceItems.push(headerEvidence);

  // Create evidence for each row (limited for performance)
  const maxEvidenceRows = Math.min(data.rows.length, 100);

  for (let i = 0; i < maxEvidenceRows; i++) {
    const row = data.rows[i];
    const rowContent = data.headers
      .map((h, idx) => `${h}: ${row[idx] ?? ""}`)
      .join("; ");

    const evidence: ExtractedEvidence = {
      id: crypto.randomUUID(),
      document_id: document.id,
      data_source_id: dataSourceId,
      business_id,
      evidence_type: "DOCUMENT_EXCERPT",
      content_reference: `CSV row ${i + 2}`,
      excerpt: rowContent,
      source_timestamp: null,
      classification: document.classification,
      source_reliability: "MEDIUM",
      content_hash: await calculateContentHash(rowContent),
      row_index: i + 1,
    };
    evidenceItems.push(evidence);
  }

  // Detect column types
  const columnTypes = detectColumnTypes(data.headers, data.rows);
  const typeEvidence: ExtractedEvidence = {
    id: crypto.randomUUID(),
    document_id: document.id,
    data_source_id: dataSourceId,
    business_id,
    evidence_type: "DOCUMENT_EXCERPT",
    content_reference: "Column type analysis",
    excerpt: JSON.stringify(
      columnTypes.map((ct) => ({
        column: ct.column_name,
        type: ct.detected_type,
        confidence: ct.confidence,
      }))
    ),
    source_timestamp: null,
    classification: document.classification,
    source_reliability: "LOW",
    content_hash: await calculateContentHash(JSON.stringify(columnTypes)),
  };
  evidenceItems.push(typeEvidence);

  // Detect currency
  const currencyDetection = detectCurrency(data.headers, data.rows);
  if (currencyDetection.detected) {
    const currencyEvidence: ExtractedEvidence = {
      id: crypto.randomUUID(),
      document_id: document.id,
      data_source_id: dataSourceId,
      business_id,
      evidence_type: "DOCUMENT_EXCERPT",
      content_reference: "Currency detection",
      excerpt: `Detected currency: ${currencyDetection.currency_code} (confidence: ${currencyDetection.confidence})`,
      source_timestamp: null,
      classification: document.classification,
      source_reliability: "LOW",
      content_hash: await calculateContentHash(
        `currency:${currencyDetection.currency_code}`
      ),
    };
    evidenceItems.push(currencyEvidence);
  }

  return evidenceItems;
}

/**
 * Extract evidence from XLSX data.
 */
async function extractEvidenceFromXlsx(
  document: Document,
  business_id: string,
  data: ParsedXlsxData
): Promise<ExtractedEvidence[]> {
  const evidenceItems: ExtractedEvidence[] = [];
  const dataSourceId = document.data_source_id!;

  for (const worksheet of data.worksheets) {
    // Create evidence for worksheet
    const worksheetEvidence: ExtractedEvidence = {
      id: crypto.randomUUID(),
      document_id: document.id,
      data_source_id: dataSourceId,
      business_id,
      evidence_type: "DOCUMENT_EXCERPT",
      content_reference: `XLSX worksheet: ${worksheet.name}`,
      excerpt: `Headers: ${worksheet.headers.join(", ")}`,
      source_timestamp: null,
      classification: document.classification,
      source_reliability: "MEDIUM",
      content_hash: await calculateContentHash(
        `${worksheet.name}:${worksheet.headers.join(",")}`
      ),
      worksheet_name: worksheet.name,
    };
    evidenceItems.push(worksheetEvidence);

    // Create evidence for each row (limited)
    const maxEvidenceRows = Math.min(worksheet.rows.length, 50);

    for (let i = 0; i < maxEvidenceRows; i++) {
      const row = worksheet.rows[i];
      const cellRef = getCellReference(i, 0);
      const rowContent = worksheet.headers
        .map((h, idx) => `${h}: ${row[idx] ?? ""}`)
        .join("; ");

      const evidence: ExtractedEvidence = {
        id: crypto.randomUUID(),
        document_id: document.id,
        data_source_id: dataSourceId,
        business_id,
        evidence_type: "DOCUMENT_EXCERPT",
        content_reference: `XLSX ${worksheet.name} row ${i + 2} (${cellRef})`,
        excerpt: rowContent,
        source_timestamp: null,
        classification: document.classification,
        source_reliability: "MEDIUM",
        content_hash: await calculateContentHash(
          `${worksheet.name}:${i}:${rowContent}`
        ),
        row_index: i + 1,
        worksheet_name: worksheet.name,
        cell_reference: cellRef,
      };
      evidenceItems.push(evidence);
    }
  }

  return evidenceItems;
}

/**
 * Extract evidence from PDF data.
 */
async function extractEvidenceFromPdf(
  document: Document,
  business_id: string,
  data: ParsedPdfData
): Promise<ExtractedEvidence[]> {
  const evidenceItems: ExtractedEvidence[] = [];
  const dataSourceId = document.data_source_id!;

  if (!data.text_extracted) {
    // No text could be extracted
    const errorEvidence: ExtractedEvidence = {
      id: crypto.randomUUID(),
      document_id: document.id,
      data_source_id: dataSourceId,
      business_id,
      evidence_type: "DOCUMENT_EXCERPT",
      content_reference: "PDF text extraction failed",
      excerpt: "No text could be extracted. This may be a scanned document.",
      source_timestamp: null,
      classification: document.classification,
      source_reliability: "UNVERIFIED",
      content_hash: null,
    };
    evidenceItems.push(errorEvidence);
    return evidenceItems;
  }

  for (const page of data.pages) {
    const pageEvidence: ExtractedEvidence = {
      id: crypto.randomUUID(),
      document_id: document.id,
      data_source_id: dataSourceId,
      business_id,
      evidence_type: "DOCUMENT_EXCERPT",
      content_reference: `PDF page ${page.page_number}`,
      excerpt: page.text.slice(0, 5000),
      source_timestamp: null,
      classification: document.classification,
      source_reliability: "MEDIUM",
      content_hash: await calculateContentHash(page.text),
      page_number: page.page_number,
    };
    evidenceItems.push(pageEvidence);

    // Detect financial patterns
    const patterns = detectFinancialPatterns(page.text);
    if (patterns.patterns.length > 0) {
      const patternEvidence: ExtractedEvidence = {
        id: crypto.randomUUID(),
        document_id: document.id,
        data_source_id: dataSourceId,
        business_id,
        evidence_type: "DOCUMENT_EXCERPT",
        content_reference: `PDF page ${page.page_number} - Pattern analysis`,
        excerpt: patterns.patterns.join("; "),
        source_timestamp: null,
        classification: document.classification,
        source_reliability: "LOW",
        content_hash: await calculateContentHash(
          `patterns:${patterns.patterns.join(",")}`
        ),
        page_number: page.page_number,
      };
      evidenceItems.push(patternEvidence);
    }
  }

  return evidenceItems;
}

/**
 * Get import preview for a document.
 */
export async function getImportPreview(
  document_id: string
): Promise<ImportPreviewItem | null> {
  const document = await businessTruthService.getDocument(document_id);
  if (!document) return null;

  const job = Array.from(ingestionJobs.values()).find(
    (j) => j.document_id === document_id
  );

  const evidence = extractedEvidence.get(document_id) ?? [];

  return {
    id: document.id,
    document_id: document.id,
    file_name: document.file_name,
    file_type: detectFileType(document.mime_type ?? "", document.file_name),
    file_size: document.file_size ?? 0,
    file_hash: document.file_hash ?? "",
    status: document.status,
    evidence_count: evidence.length,
    errors: document.processing_error ? [document.processing_error] : [],
    warnings: [],
  };
}

/**
 * Retry a failed ingestion job.
 */
export async function retryIngestion(
  job_id: string
): Promise<{ success: boolean; error?: string }> {
  const job = ingestionJobs.get(job_id);
  if (!job) {
    return { success: false, error: "Job not found" };
  }

  if (job.status !== "FAILED") {
    return { success: false, error: "Only failed jobs can be retried" };
  }

  // Reset job
  job.status = "QUEUED";
  job.started_at = null;
  job.completed_at = null;
  job.error = null;
  job.retry_count++;
  ingestionJobs.set(job_id, job);

  // Update document status
  await businessTruthService.updateDocument(job.document_id, {
    status: "QUEUED",
    processing_error: null,
    processing_started_at: null,
    processing_completed_at: null,
  });

  // Process job
  const result = await processIngestionJob(job_id);
  return { success: result.success, error: result.errors[0] };
}

/**
 * Get all ingestion jobs for a business.
 */
export function getIngestionJobs(
  business_id: string
): IngestionJob[] {
  return Array.from(ingestionJobs.values()).filter(
    (j) => j.business_id === business_id
  );
}

/**
 * Get an ingestion job by ID.
 */
export function getIngestionJob(job_id: string): IngestionJob | null {
  return ingestionJobs.get(job_id) ?? null;
}

/**
 * Get extracted evidence for a document.
 */
export function getExtractedEvidence(
  document_id: string
): ExtractedEvidence[] {
  return extractedEvidence.get(document_id) ?? [];
}
