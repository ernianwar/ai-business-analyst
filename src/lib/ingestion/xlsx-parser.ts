/**
 * SALAM LIT — XLSX Parser
 *
 * Handles Excel file parsing with proper cell/worksheet provenance.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 */

import * as XLSX from "xlsx";
import type { ParsedXlsxData, ParsedXlsxWorksheet, IngestionLimits } from "./types";
import { DEFAULT_INGESTION_LIMITS } from "./types";

/**
 * Parse an XLSX file with proper error handling and limits.
 */
export async function parseXlsx(
  content: ArrayBuffer,
  limits: IngestionLimits = DEFAULT_INGESTION_LIMITS
): Promise<ParsedXlsxData> {
  const errors: string[] = [];
  const worksheets: ParsedXlsxWorksheet[] = [];

  try {
    const workbook = XLSX.read(content, { type: "array" });

    const sheetNames = workbook.SheetNames;

    if (sheetNames.length > limits.max_xlsx_worksheets) {
      errors.push(
        `Worksheet limit exceeded: ${sheetNames.length} sheets (max ${limits.max_xlsx_worksheets}). Only first ${limits.max_xlsx_worksheets} sheets processed.`
      );
    }

    const sheetsToProcess = sheetNames.slice(0, limits.max_xlsx_worksheets);

    for (const sheetName of sheetsToProcess) {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) continue;

      try {
        // Convert to JSON with headers
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
          defval: "",
          blankrows: false,
        });

        if (jsonData.length === 0) {
          worksheets.push({
            name: sheetName,
            headers: [],
            rows: [],
            total_rows: 0,
          });
          continue;
        }

        // First row is headers
        const headers = (jsonData[0] as (string | number)[]).map(String);
        const rows: (string | number | boolean | null)[][] = [];

        for (let i = 1; i < jsonData.length; i++) {
          if (rows.length >= limits.max_xlsx_rows_per_sheet) {
            errors.push(
              `Row limit exceeded in sheet "${sheetName}": ${limits.max_xlsx_rows_per_sheet} rows. Remaining rows truncated.`
            );
            break;
          }

          const rowData = jsonData[i] as (string | number | boolean | null)[];
          rows.push(rowData.slice(0, limits.max_csv_columns));
        }

        worksheets.push({
          name: sheetName,
          headers,
          rows,
          total_rows: rows.length,
        });
      } catch (sheetError) {
        errors.push(
          `Error parsing sheet "${sheetName}": ${
            sheetError instanceof Error ? sheetError.message : "Unknown error"
          }`
        );
      }
    }

    return {
      worksheets,
      total_sheets: sheetNames.length,
      parsing_errors: errors,
    };
  } catch (error) {
    errors.push(
      `XLSX parsing error: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return {
      worksheets: [],
      total_sheets: 0,
      parsing_errors: errors,
    };
  }
}

/**
 * Generate cell reference from row/column indices.
 */
export function getCellReference(rowIndex: number, colIndex: number): string {
  const colLetter = String.fromCharCode(65 + (colIndex % 26));
  const rowNum = rowIndex + 2; // +2 because row 1 is header
  return `${colLetter}${rowNum}`;
}

/**
 * Generate range reference from start/end positions.
 */
export function getRangeReference(
  startRow: number,
  startCol: number,
  endRow: number,
  endCol: number
): string {
  const start = getCellReference(startRow, startCol);
  const end = getCellReference(endRow, endCol);
  return `${start}:${end}`;
}
