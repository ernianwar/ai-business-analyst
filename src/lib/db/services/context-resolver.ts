/**
 * SALAM LIT — Context Resolution Service
 *
 * Resolves the correct business context for operations.
 *
 * Architecture:
 *   USER REQUEST
 *       ↓
 *   CONTEXT RESOLVER (this service)
 *       ↓
 *   USER CONTEXT
 *   WORKSPACE CONTEXT
 *   BUSINESS CONTEXT
 *   MARKET CONTEXT
 *   JURISDICTION
 *   TASK CONTEXT
 *   DATA PERMISSIONS
 *       ↓
 *   FUTURE ZUE / SPECIALIST AGENTS
 *
 * Phase 4: Foundation context resolution.
 * Business scope must be explicit.
 */

import type {
  Business,
  BusinessJurisdiction,
  CurrencyContext,
  MarketProfile,
  BusinessContextBundle,
} from "../types";
import { businessContextService } from "./business-context";

/**
 * Resolved context for a specific operation.
 */
export interface ResolvedOperationContext {
  /** The business being operated on */
  business: Business;
  /** Jurisdiction context */
  jurisdiction: BusinessJurisdiction;
  /** Currency context */
  currency: CurrencyContext;
  /** Relevant market profiles */
  market_profiles: MarketProfile[];
  /** Resolved locale */
  locale: string;
  /** Resolved timezone */
  timezone: string;
  /** Whether this context is complete */
  is_complete: boolean;
  /** Any missing context fields */
  missing_fields: string[];
}

/**
 * Context Resolution Service.
 *
 * Ensures business-scoped operations use the correct context.
 * Prevents cross-business contamination.
 */
class ContextResolverService {
  /**
   * Resolve the full context for a business operation.
   */
  async resolveContext(
    business_id: string
  ): Promise<ResolvedOperationContext | null> {
    const bundle = await businessContextService.getBusinessContextBundle(business_id);
    if (!bundle) return null;

    const missing_fields: string[] = [];

    // Resolve jurisdiction
    const jurisdiction = bundle.jurisdiction ?? {
      id: "",
      business_id,
      registered_country: "UNKNOWN",
      operating_country: "UNKNOWN",
      business_jurisdiction: "UNKNOWN",
      user_country: "UNKNOWN",
      created_at: "",
      updated_at: "",
    };

    if (jurisdiction.registered_country === "UNKNOWN") {
      missing_fields.push("registered_country");
    }
    if (jurisdiction.operating_country === "UNKNOWN") {
      missing_fields.push("operating_country");
    }
    if (jurisdiction.business_jurisdiction === "UNKNOWN") {
      missing_fields.push("business_jurisdiction");
    }

    // Resolve currency
    const currency = bundle.currency ?? {
      id: "",
      business_id,
      default_currency: "USD",
      display_currency: null,
      created_at: "",
      updated_at: "",
    };

    // Resolve market profiles
    const market_profiles = bundle.market_profiles;

    // Resolve locale and timezone from market profiles or defaults
    const primary_market = market_profiles.find((m) => m.market_status === "ACTIVE");
    const locale = primary_market?.locale ?? "en";
    const timezone = primary_market?.timezone ?? "UTC";

    return {
      business: bundle.business,
      jurisdiction,
      currency,
      market_profiles,
      locale,
      timezone,
      is_complete: missing_fields.length === 0,
      missing_fields,
    };
  }

  /**
   * Resolve the financial context for Carol (finance agent).
   */
  async resolveFinancialContext(
    business_id: string
  ): Promise<{
    currency: string;
    jurisdiction: string;
    tax_jurisdiction: string | null;
    reporting_currency: string;
  } | null> {
    const context = await this.resolveContext(business_id);
    if (!context) return null;

    return {
      currency: context.currency.default_currency,
      jurisdiction: context.jurisdiction.business_jurisdiction,
      tax_jurisdiction: context.market_profiles.find(
        (m) => m.market_status === "ACTIVE"
      )?.tax_jurisdiction ?? null,
      reporting_currency: context.currency.display_currency ?? context.currency.default_currency,
    };
  }

  /**
   * Resolve the marketing context for Sheera (marketing agent).
   */
  async resolveMarketingContext(
    business_id: string
  ): Promise<{
    target_markets: MarketProfile[];
    primary_language: string;
    primary_currency: string;
    marketing_preferences: Record<string, unknown>;
  } | null> {
    const context = await this.resolveContext(business_id);
    if (!context) return null;

    const active_markets = context.market_profiles.filter(
      (m) => m.market_status === "ACTIVE" || m.market_status === "TARGETED"
    );

    const primary_market = active_markets[0];

    return {
      target_markets: active_markets,
      primary_language: primary_market?.language ?? "English",
      primary_currency: primary_market?.currency ?? context.currency.default_currency,
      marketing_preferences: primary_market?.marketing_preferences ?? {},
    };
  }

  /**
   * Resolve the sales context for Eddy (sales agent).
   */
  async resolveSalesContext(
    business_id: string
  ): Promise<{
    target_markets: MarketProfile[];
    currency: string;
    jurisdiction: string;
  } | null> {
    const context = await this.resolveContext(business_id);
    if (!context) return null;

    return {
      target_markets: context.market_profiles.filter(
        (m) => m.market_status === "ACTIVE" || m.market_status === "TARGETED"
      ),
      currency: context.currency.default_currency,
      jurisdiction: context.jurisdiction.business_jurisdiction,
    };
  }

  /**
   * Resolve the HR context for Ayuni (HR agent).
   */
  async resolveHrContext(
    business_id: string
  ): Promise<{
    operating_country: string;
    employment_jurisdiction: string;
    currency: string;
  } | null> {
    const context = await this.resolveContext(business_id);
    if (!context) return null;

    return {
      operating_country: context.jurisdiction.operating_country,
      employment_jurisdiction: context.jurisdiction.business_jurisdiction,
      currency: context.currency.default_currency,
    };
  }

  /**
   * Resolve the funding context for Alex (funding agent).
   */
  async resolveFundingContext(
    business_id: string
  ): Promise<{
    registered_country: string;
    jurisdiction: string;
    currency: string;
    business_stage: string | null;
  } | null> {
    const context = await this.resolveContext(business_id);
    if (!context) return null;

    return {
      registered_country: context.jurisdiction.registered_country,
      jurisdiction: context.jurisdiction.business_jurisdiction,
      currency: context.currency.default_currency,
      business_stage: context.business.business_stage,
    };
  }

  /**
   * Validate that a business_id is accessible by the current user.
   * This is a placeholder for actual RLS/authorization checks.
   */
  async validateBusinessAccess(
    _user_id: string,
    business_id: string
  ): Promise<boolean> {
    // Phase 4: In-memory validation
    // Production: Will use Supabase RLS + application authorization
    const business = await businessContextService.getBusiness(business_id);
    return business !== null;
  }

  /**
   * Validate that two business IDs are different businesses.
   * Prevents cross-business contamination.
   */
  validateBusinessIsolation(
    business_id_a: string,
    business_id_b: string
  ): boolean {
    return business_id_a !== business_id_b;
  }
}

/**
 * Singleton context resolver service.
 */
export const contextResolverService = new ContextResolverService();
