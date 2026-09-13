/**
 * SALAM LIT — PDF Parser (Foundation)
 *
 * Handles PDF file parsing with page-level provenance.
 * NOTE: This is a foundation implementation.
 * Full OCR/AI extraction will be added in later phases.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 */

import type { ParsedPdfData, ParsedPdfPage, IngestionLimits } from "./types";
import { DEFAULT_INGESTION_LIMITS } from "./types";

/**
 * Parse a PDF file with proper error handling and limits.
 * NOTE: This uses basic text extraction only.
 * For scanned PDFs or complex layouts, OCR/AI will be needed in later phases.
 */
export async function parsePdf(
  content: ArrayBuffer,
  limits: IngestionLimits = DEFAULT_INGESTION_LIMITS
): Promise<ParsedPdfData> {
  const errors: string[] = [];
  const pages: ParsedPdfPage[] = [];

  try {
    // NOTE: PDF parsing is foundation-only in Phase 5.
    // Full OCR/AI extraction will be added in later phases.
    // For now, we create a placeholder that indicates PDF was received.
    errors.push(
      "PDF text extraction is foundation-only. Full OCR/AI extraction will be added in later phases."
    );

    return {
      total_pages: 0,
      pages: [],
      text_extracted: false,
      parsing_errors: errors,
    };
  } catch (error) {
    errors.push(
      `PDF parsing error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return {
      total_pages: 0,
      pages: [],
      text_extracted: false,
      parsing_errors: errors,
    };
  }
}

/**
 * Detect if PDF text contains financial data patterns.
 */
export function detectFinancialPatterns(
  text: string
): {
  has_currency: boolean;
  has_dates: boolean;
  has_amounts: boolean;
  patterns: string[];
} {
  const patterns: string[] = [];
  let hasCurrency = false;
  let hasDates = false;
  let hasAmounts = false;

  // Currency patterns
  if (/(?:RM|MYR)\s*[\d,]+\.?\d*/i.test(text)) {
    hasCurrency = true;
    patterns.push("MYR currency detected");
  }
  if (/\$[\d,]+\.?\d*/i.test(text)) {
    hasCurrency = true;
    patterns.push("USD currency detected");
  }
  if (/(?:EUR|€)\s*[\d,]+\.?\d*/i.test(text)) {
    hasCurrency = true;
    patterns.push("EUR currency detected");
  }

  // Date patterns
  if (/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/.test(text)) {
    hasDates = true;
    patterns.push("Date format detected");
  }
  if (/(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{4}/i.test(text)) {
    hasDates = true;
    patterns.push("Month-year format detected");
  }

  // Amount patterns
  if (/[\d,]+\.?\d{2}/.test(text)) {
    hasAmounts = true;
    patterns.push("Numeric amounts detected");
  }

  // P&L keywords
  if (/revenue|income|expense|profit|loss|cost|margin/i.test(text)) {
    patterns.push("Financial keywords detected");
  }

  return {
    has_currency: hasCurrency,
    has_dates: hasDates,
    has_amounts: hasAmounts,
    patterns,
  };
}
