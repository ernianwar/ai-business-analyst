/**
 * SALAM LIT — File Upload API
 *
 * Handles file upload with validation, hashing, and duplicate detection.
 * Files are NOT automatically converted to Business Truth.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextRequest, NextResponse } from "next/server";
import { uploadDocument, processIngestionJob } from "@/lib/ingestion/ingestion-service";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * POST /api/business/[id]/upload
 * Upload a file for ingestion.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: business_id } = await params;

    if (!ctx.business_id) {
      return NextResponse.json({ error: "No business context" }, { status: 400 });
    }
    if (ctx.business_id !== business_id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const classification = (formData.get("classification") as string) || "INTERNAL";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const validClassifications = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "SENSITIVE", "RESTRICTED"];
    if (!validClassifications.includes(classification)) {
      return NextResponse.json({ error: `Invalid classification: ${classification}` }, { status: 400 });
    }

    const content = await file.arrayBuffer();
    const { document, validation, duplicate } = await uploadDocument({
      business_id,
      file_name: file.name,
      mime_type: file.type,
      content,
      classification: classification as any,
    });

    if (duplicate.is_duplicate) {
      return NextResponse.json({ message: "Duplicate file detected", document, duplicate, validation }, { status: 200 });
    }

    if (!validation.valid) {
      return NextResponse.json({ message: "File validation failed", document, validation, duplicate }, { status: 400 });
    }

    const job = Array.from(
      (await import("@/lib/ingestion/ingestion-service")).getIngestionJobs(business_id)
    ).find((j) => j.document_id === document.id);

    if (job) {
      const result = await processIngestionJob(job.id);
      return NextResponse.json({
        message: "File uploaded and processed",
        document, validation, duplicate,
        job: { id: job.id, status: result.success ? "COMPLETED" : "FAILED", evidence_count: result.evidence_count, errors: result.errors },
      }, { status: 201 });
    }

    return NextResponse.json({ message: "File uploaded", document, validation, duplicate }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
