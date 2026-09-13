/**
 * SALAM LIT — Data Sources API
 *
 * CRUD operations for data sources within a business.
 *
 * Phase 5: Business Data Sources, Documents & Evidence Ingestion
 * Phase 15.3: Authentication and multi-tenancy hardening
 */

import { NextRequest, NextResponse } from "next/server";
import { businessTruthService } from "@/lib/db/services/business-truth";
import { getAuthenticatedContext } from "@/lib/auth/get-context";

/**
 * GET /api/business/[id]/data-sources
 * List all data sources for a business.
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

    const { id: business_id } = await params;

    if (!ctx.business_id) {
      return NextResponse.json({ error: "No business context" }, { status: 400 });
    }
    if (ctx.business_id !== business_id) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const dataSources = await businessTruthService.getDataSourcesByBusiness(business_id);
    return NextResponse.json({ data_sources: dataSources });
  } catch (error) {
    console.error("Error fetching data sources:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/business/[id]/data-sources
 * Create a new data source for a business.
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

    const body = await request.json();
    const { source_type, provider, name, external_reference, trust_level } = body;

    if (!source_type || !name) {
      return NextResponse.json({ error: "source_type and name are required" }, { status: 400 });
    }

    const validSourceTypes = ["API", "BANK_FEED", "MANUAL", "DOCUMENT", "SCRAPE", "EMAIL"];
    if (!validSourceTypes.includes(source_type)) {
      return NextResponse.json({ error: `Invalid source_type: ${source_type}` }, { status: 400 });
    }

    const validTrustLevels = ["FULLY_TRUSTED", "VERIFIED", "UNVERIFIED"];
    if (trust_level && !validTrustLevels.includes(trust_level)) {
      return NextResponse.json({ error: `Invalid trust_level: ${trust_level}` }, { status: 400 });
    }

    const data_source = await businessTruthService.createDataSource({
      business_id,
      source_type,
      provider: provider ?? null,
      name,
      external_reference: external_reference ?? null,
      status: "ACTIVE",
      trust_level: trust_level ?? "UNVERIFIED",
      last_synced_at: null,
    });

    return NextResponse.json({ data_source }, { status: 201 });
  } catch (error) {
    console.error("Error creating data source:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
