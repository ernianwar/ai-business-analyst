/**
 * SALAM LIT — CSV Parser
 *
 * Handles CSV file parsing with proper provenance.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 */

import Papa from "papaparse";
import type { ParsedCsvData, IngestionLimits } from "./types";
import { DEFAULT_INGESTION_LIMITS } from "./types";

/**
 * Parse a CSV file with proper error handling and limits.
 */
export async function parseCsv(
  content: ArrayBuffer,
  limits: IngestionLimits = DEFAULT_INGESTION_LIMITS
): Promise<ParsedCsvData> {
  const text = new TextDecoder("utf-8").decode(content);

  return new Promise((resolve) => {
    const results: string[][] = [];
    const errors: string[] = [];
    let delimiter = ",";
    let headers: string[] = [];
    let totalRows = 0;

    Papa.parse(text, {
      header: false,
      skipEmptyLines: true,
      dynamicTyping: false,
      step: (row) => {
        totalRows++;

        if (totalRows > limits.max_csv_rows) {
          errors.push(
            `Row limit exceeded: ${limits.max_csv_rows} rows. Remaining rows truncated.`
          );
          return;
        }

        const rowData = row.data as string[];

        if (rowData.length > limits.max_csv_columns) {
          errors.push(
            `Column limit exceeded at row ${totalRows}: ${rowData.length} columns (max ${limits.max_csv_columns})`
          );
        }

        // Detect delimiter from first row
        if (totalRows === 1 && row.meta?.delimiter) {
          delimiter = row.meta.delimiter;
        }

        // First row is headers
        if (totalRows === 1) {
          headers = rowData.slice(0, limits.max_csv_columns);
        } else {
          results.push(rowData.slice(0, limits.max_csv_columns));
        }
      },
      error: (error: any) => {
        errors.push(`CSV parsing error: ${error.message}`);
      },
      complete: () => {
        resolve({
          headers,
          rows: results,
          total_rows: totalRows - 1, // Exclude header row
          delimiter,
          encoding: "utf-8",
          parsing_errors: errors,
        });
      },
    });
  });
}

/**
 * Detect data types for CSV columns.
 */
export function detectColumnTypes(
  headers: string[],
  rows: string[][]
): Array<{
  column_name: string;
  column_index: number;
  detected_type: string;
  confidence: number;
  sample_values: string[];
  null_count: number;
  total_count: number;
}> {
  return headers.map((header, colIndex) => {
    const values = rows.map((row) => row[colIndex] ?? "");
    const nonEmpty = values.filter((v) => v !== "");
    const nullCount = values.length - nonEmpty.length;

    // Sample up to 10 values
    const sampleValues = nonEmpty.slice(0, 10);

    // Detect type
    let detectedType = "text";
    let confidence = 0.5;

    if (nonEmpty.length === 0) {
      detectedType = "text";
      confidence = 0;
    } else {
      // Check integer
      const integerCount = nonEmpty.filter((v) => /^\d+$/.test(v.trim())).length;
      if (integerCount / nonEmpty.length > 0.8) {
        detectedType = "integer";
        confidence = integerCount / nonEmpty.length;
      }

      // Check decimal
      const decimalCount = nonEmpty.filter((v) =>
        /^\d+\.?\d*$/.test(v.trim())
      ).length;
      if (decimalCount / nonEmpty.length > 0.8) {
        detectedType = "decimal";
        confidence = decimalCount / nonEmpty.length;
      }

      // Check currency
      const currencyCount = nonEmpty.filter((v) =>
        /^[\$€£¥RM]\s*[\d,]+\.?\d*$|^\d+\.?\d*\s*(USD|EUR|GBP|MYR|SGD)$/i.test(
          v.trim()
        )
      ).length;
      if (currencyCount / nonEmpty.length > 0.8) {
        detectedType = "currency";
        confidence = currencyCount / nonEmpty.length;
      }

      // Check percentage
      const percentCount = nonEmpty.filter((v) =>
        /^\d+\.?\d*\s*%$/.test(v.trim())
      ).length;
      if (percentCount / nonEmpty.length > 0.8) {
        detectedType = "percentage";
        confidence = percentCount / nonEmpty.length;
      }

      // Check date
      const dateCount = nonEmpty.filter((v) => {
        const d = new Date(v.trim());
        return !isNaN(d.getTime());
      }).length;
      if (dateCount / nonEmpty.length > 0.8) {
        detectedType = "date";
        confidence = dateCount / nonEmpty.length;
      }

      // Check boolean
      const boolCount = nonEmpty.filter((v) =>
        /^(true|false|yes|no|y|n)$/i.test(v.trim())
      ).length;
      if (boolCount / nonEmpty.length > 0.8) {
        detectedType = "boolean";
        confidence = boolCount / nonEmpty.length;
      }
    }

    return {
      column_name: header,
      column_index: colIndex,
      detected_type: detectedType,
      confidence,
      sample_values: sampleValues,
      null_count: nullCount,
      total_count: values.length,
    };
  });
}

/**
 * Detect currency from CSV data.
 */
export function detectCurrency(
  headers: string[],
  rows: string[][]
): { detected: boolean; currency_code: string | null; confidence: number } {
  // Check headers for currency indicators
  const currencyHeaders = headers.filter((h) =>
    /currency|rm|usd|eur|gbp|myr|sgd|\$|€|£|¥/i.test(h)
  );

  if (currencyHeaders.length > 0) {
    const headerText = currencyHeaders[0].toLowerCase();
    if (/rm|myr/i.test(headerText))
      return { detected: true, currency_code: "MYR", confidence: 0.9 };
    if (/usd|\$/i.test(headerText))
      return { detected: true, currency_code: "USD", confidence: 0.9 };
    if (/eur|€/i.test(headerText))
      return { detected: true, currency_code: "EUR", confidence: 0.9 };
    if (/gbp|£/i.test(headerText))
      return { detected: true, currency_code: "GBP", confidence: 0.9 };
    if (/sgd/i.test(headerText))
      return { detected: true, currency_code: "SGD", confidence: 0.9 };
  }

  // Check cell values for currency symbols
  const flatValues = rows.flat().slice(0, 100);
  const rmCount = flatValues.filter((v) => /^RM\s/i.test(v)).length;
  const usdCount = flatValues.filter((v) => /^\$/.test(v)).length;

  if (rmCount > 5)
    return { detected: true, currency_code: "MYR", confidence: 0.7 };
  if (usdCount > 5)
    return { detected: true, currency_code: "USD", confidence: 0.7 };

  return { detected: false, currency_code: null, confidence: 0 };
}
