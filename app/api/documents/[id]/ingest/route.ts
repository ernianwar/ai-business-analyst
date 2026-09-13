/**
 * SALAM LIT — Document Ingestion API
 *
 * Handles document ingestion and processing.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextRequest, NextResponse } from "next/server";
import {
  processIngestionJob,
  retryIngestion,
  getIngestionJobs,
  getIngestionJob,
} from "@/lib/ingestion/ingestion-service";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * POST /api/documents/[id]/ingest
 *
 * Process an ingestion job for a document.
 * Business scope derived from authenticated context — never from client.
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

    if (!ctx.business_id) {
      return NextResponse.json(
        { error: "No business context: complete onboarding first" },
        { status: 400 }
      );
    }

    const { id: document_id } = await params;
    const body = await request.json();
    const { action } = body;

    // Scope jobs to authenticated business only
    const jobs = getIngestionJobs(ctx.business_id);
    const job = jobs.find((j) => j.document_id === document_id);

    if (!job) {
      return NextResponse.json(
        { error: "No ingestion job found for this document" },
        { status: 404 }
      );
    }

    if (action === "retry") {
      const result = await retryIngestion(job.id);
      return NextResponse.json({
        message: result.success ? "Job retried successfully" : "Retry failed",
        job: getIngestionJob(job.id),
        error: result.error,
      });
    }

    // Default: process the job
    const result = await processIngestionJob(job.id);

    return NextResponse.json({
      message: result.success
        ? "Ingestion completed"
        : "Ingestion failed",
      job: getIngestionJob(job.id),
      errors: result.errors,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/documents/[id]/ingest
 *
 * Get ingestion job status for a document.
 * Business scope derived from authenticated context — never from client.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getAuthenticatedContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!ctx.business_id) {
      return NextResponse.json(
        { error: "No business context: complete onboarding first" },
        { status: 400 }
      );
    }

    const { id: document_id } = await params;

    // Scope jobs to authenticated business only
    const jobs = getIngestionJobs(ctx.business_id);
    const job = jobs.find((j) => j.document_id === document_id);

    if (!job) {
      return NextResponse.json(
        { error: "No ingestion job found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ job });
  } catch (error) {
    console.error("Error fetching ingestion job:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
