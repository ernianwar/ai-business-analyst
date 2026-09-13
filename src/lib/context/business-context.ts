/**
 * SALAM LIT — Context Resolution
 *
 * Provides business context for all AI agents.
 *
 * Architecture:
 *   Context Resolution is the single source for:
 *     - User Country
 *     - Business Jurisdiction
 *     - Operating Country
 *     - Registered Country
 *     - Target Market
 *     - Market Profile
 *     - Currency
 *     - Locale
 *     - Timezone
 *
 * SALAM LIT must NOT assume Malaysia.
 * These values come from the business setup or from the
 * context information form during onboarding.
 *
 * Phase 2: Interface and default resolution only.
 * Business context data will be stored in DB in later phases.
 */

/**
 * Business context — the resolved context for a business.
 */
export interface BusinessContext {
  /** ISO country code where the business was registered */
  registered_country: string;
  /** ISO country code where the business operates */
  operating_country: string;
  /** ISO country code of the user (for personalization) */
  user_country: string;
  /** Primary business jurisdiction */
  business_jurisdiction: string;
  /** Target market country/countries */
  target_market: string[];
  /** Market profile identifier */
  market_profile: string | null;
  /** ISO currency code */
  currency: string;
  /** Locale (e.g., en-MY, ms-MY) */
  locale: string;
  /** IANA timezone */
  timezone: string;
}

/**
 * Default business context (used when no business context is configured).
 * These are fallbacks — NOT assumptions.
 */
const DEFAULT_CONTEXT: BusinessContext = {
  registered_country: "MY",
  operating_country: "MY",
  user_country: "MY",
  business_jurisdiction: "MY",
  target_market: ["MY", "SG", "ID", "TH", "PH"],
  market_profile: null,
  currency: "MYR",
  locale: "en-MY",
  timezone: "Asia/Kuala_Lumpur",
};

/**
 * Business Context Store.
 * In Phase 2: uses defaults.
 * In later phases: resolves from business configuration in DB.
 */
class BusinessContextStore {
  private contexts: Map<string, BusinessContext> = new Map();

  /**
   * Get business context for a given business ID.
   * Falls back to defaults if no context exists.
   */
  getContext(business_id?: string): BusinessContext {
    if (!business_id) return DEFAULT_CONTEXT;
    return this.contexts.get(business_id) ?? DEFAULT_CONTEXT;
  }

  /**
   * Set business context for a business.
   */
  setContext(business_id: string, context: Partial<BusinessContext>): void {
    const existing = this.contexts.get(business_id) ?? DEFAULT_CONTEXT;
    this.contexts.set(business_id, { ...existing, ...context });
  }

  /**
   * Resolve currency for a business context.
   */
  getCurrency(context: BusinessContext): string {
    return context.currency;
  }

  /**
   * Resolve locale for a business context.
   */
  getLocale(context: BusinessContext): string {
    return context.locale;
  }

  /**
   * Resolve timezone for a business context.
   */
  getTimezone(context: BusinessContext): string {
    return context.timezone;
  }

  /**
   * Check if a country is in the target market.
   */
  isInTargetMarket(context: BusinessContext, country: string): boolean {
    return context.target_market.includes(country);
  }
}

/**
 * Singleton business context store.
 */
export const businessContextStore = new BusinessContextStore();
