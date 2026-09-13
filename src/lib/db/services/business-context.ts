/**
 * SALAM LIT — Business Context Service
 *
 * Handles CRUD operations for business context.
 * This is the foundation for business-scoped operations.
 *
 * Phase 4: Business Context + Business Truth Foundation
 */

import type {
  Business,
  BusinessJurisdiction,
  CurrencyContext,
  MarketProfile,
  BusinessGoal,
  BusinessConstraint,
  AiReadiness,
  BusinessContextBundle,
} from "../types";

/**
 * In-memory business context store.
 * Phase 4: In-memory for development.
 * Production: Will use Supabase PostgreSQL.
 */
class BusinessContextService {
  private businesses: Map<string, Business> = new Map();
  private jurisdictions: Map<string, BusinessJurisdiction> = new Map();
  private currencies: Map<string, CurrencyContext> = new Map();
  private marketProfiles: Map<string, MarketProfile[]> = new Map();
  private goals: Map<string, BusinessGoal[]> = new Map();
  private constraints: Map<string, BusinessConstraint[]> = new Map();
  private aiReadiness: Map<string, AiReadiness[]> = new Map();

  // ============================================================
  // Business CRUD
  // ============================================================

  async createBusiness(
    data: Omit<Business, "id" | "created_at" | "updated_at">
  ): Promise<Business> {
    const business: Business = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.businesses.set(business.id, business);
    return business;
  }

  async getBusiness(id: string): Promise<Business | null> {
    return this.businesses.get(id) ?? null;
  }

  async getBusinessesByWorkspace(
    workspace_id: string
  ): Promise<Business[]> {
    return Array.from(this.businesses.values()).filter(
      (b) => b.workspace_id === workspace_id
    );
  }

  async updateBusiness(
    id: string,
    data: Partial<Omit<Business, "id" | "created_at" | "updated_at">>
  ): Promise<Business | null> {
    const existing = this.businesses.get(id);
    if (!existing) return null;

    const updated: Business = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.businesses.set(id, updated);
    return updated;
  }

  async deleteBusiness(id: string): Promise<boolean> {
    return this.businesses.delete(id);
  }

  // ============================================================
  // Jurisdiction CRUD
  // ============================================================

  async setJurisdiction(
    business_id: string,
    data: Omit<BusinessJurisdiction, "id" | "business_id" | "created_at" | "updated_at">
  ): Promise<BusinessJurisdiction> {
    const existing = this.jurisdictions.get(business_id);
    if (existing) {
      const updated: BusinessJurisdiction = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString(),
      };
      this.jurisdictions.set(business_id, updated);
      return updated;
    }

    const jurisdiction: BusinessJurisdiction = {
      ...data,
      id: crypto.randomUUID(),
      business_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.jurisdictions.set(business_id, jurisdiction);
    return jurisdiction;
  }

  async getJurisdiction(
    business_id: string
  ): Promise<BusinessJurisdiction | null> {
    return this.jurisdictions.get(business_id) ?? null;
  }

  // ============================================================
  // Currency Context CRUD
  // ============================================================

  async setCurrencyContext(
    business_id: string,
    data: Omit<CurrencyContext, "id" | "business_id" | "created_at" | "updated_at">
  ): Promise<CurrencyContext> {
    const existing = this.currencies.get(business_id);
    if (existing) {
      const updated: CurrencyContext = {
        ...existing,
        ...data,
        updated_at: new Date().toISOString(),
      };
      this.currencies.set(business_id, updated);
      return updated;
    }

    const currency: CurrencyContext = {
      ...data,
      id: crypto.randomUUID(),
      business_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.currencies.set(business_id, currency);
    return currency;
  }

  async getCurrencyContext(
    business_id: string
  ): Promise<CurrencyContext | null> {
    return this.currencies.get(business_id) ?? null;
  }

  // ============================================================
  // Market Profile CRUD
  // ============================================================

  async addMarketProfile(
    business_id: string,
    data: Omit<MarketProfile, "id" | "business_id" | "created_at" | "updated_at">
  ): Promise<MarketProfile> {
    const profile: MarketProfile = {
      ...data,
      id: crypto.randomUUID(),
      business_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existing = this.marketProfiles.get(business_id) ?? [];
    existing.push(profile);
    this.marketProfiles.set(business_id, existing);
    return profile;
  }

  async getMarketProfiles(business_id: string): Promise<MarketProfile[]> {
    return this.marketProfiles.get(business_id) ?? [];
  }

  async updateMarketProfile(
    id: string,
    data: Partial<Omit<MarketProfile, "id" | "business_id" | "created_at" | "updated_at">>
  ): Promise<MarketProfile | null> {
    for (const [businessId, profiles] of this.marketProfiles.entries()) {
      const index = profiles.findIndex((p) => p.id === id);
      if (index !== -1) {
        const updated: MarketProfile = {
          ...profiles[index],
          ...data,
          updated_at: new Date().toISOString(),
        };
        profiles[index] = updated;
        this.marketProfiles.set(businessId, profiles);
        return updated;
      }
    }
    return null;
  }

  async deleteMarketProfile(id: string): Promise<boolean> {
    for (const [businessId, profiles] of this.marketProfiles.entries()) {
      const index = profiles.findIndex((p) => p.id === id);
      if (index !== -1) {
        profiles.splice(index, 1);
        this.marketProfiles.set(businessId, profiles);
        return true;
      }
    }
    return false;
  }

  // ============================================================
  // Goals CRUD
  // ============================================================

  async addGoal(
    business_id: string,
    data: Omit<BusinessGoal, "id" | "business_id" | "created_at" | "updated_at">
  ): Promise<BusinessGoal> {
    const goal: BusinessGoal = {
      ...data,
      id: crypto.randomUUID(),
      business_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existing = this.goals.get(business_id) ?? [];
    existing.push(goal);
    this.goals.set(business_id, existing);
    return goal;
  }

  async getGoals(business_id: string): Promise<BusinessGoal[]> {
    return this.goals.get(business_id) ?? [];
  }

  async updateGoal(
    id: string,
    data: Partial<Omit<BusinessGoal, "id" | "business_id" | "created_at" | "updated_at">>
  ): Promise<BusinessGoal | null> {
    for (const [businessId, goals] of this.goals.entries()) {
      const index = goals.findIndex((g) => g.id === id);
      if (index !== -1) {
        const updated: BusinessGoal = {
          ...goals[index],
          ...data,
          updated_at: new Date().toISOString(),
        };
        goals[index] = updated;
        this.goals.set(businessId, goals);
        return updated;
      }
    }
    return null;
  }

  async deleteGoal(id: string): Promise<boolean> {
    for (const [businessId, goals] of this.goals.entries()) {
      const index = goals.findIndex((g) => g.id === id);
      if (index !== -1) {
        goals.splice(index, 1);
        this.goals.set(businessId, goals);
        return true;
      }
    }
    return false;
  }

  // ============================================================
  // Constraints CRUD
  // ============================================================

  async addConstraint(
    business_id: string,
    data: Omit<BusinessConstraint, "id" | "business_id" | "created_at" | "updated_at">
  ): Promise<BusinessConstraint> {
    const constraint: BusinessConstraint = {
      ...data,
      id: crypto.randomUUID(),
      business_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const existing = this.constraints.get(business_id) ?? [];
    existing.push(constraint);
    this.constraints.set(business_id, existing);
    return constraint;
  }

  async getConstraints(business_id: string): Promise<BusinessConstraint[]> {
    return this.constraints.get(business_id) ?? [];
  }

  async updateConstraint(
    id: string,
    data: Partial<Omit<BusinessConstraint, "id" | "business_id" | "created_at" | "updated_at">>
  ): Promise<BusinessConstraint | null> {
    for (const [businessId, constraints] of this.constraints.entries()) {
      const index = constraints.findIndex((c) => c.id === id);
      if (index !== -1) {
        const updated: BusinessConstraint = {
          ...constraints[index],
          ...data,
          updated_at: new Date().toISOString(),
        };
        constraints[index] = updated;
        this.constraints.set(businessId, constraints);
        return updated;
      }
    }
    return null;
  }

  async deleteConstraint(id: string): Promise<boolean> {
    for (const [businessId, constraints] of this.constraints.entries()) {
      const index = constraints.findIndex((c) => c.id === id);
      if (index !== -1) {
        constraints.splice(index, 1);
        this.constraints.set(businessId, constraints);
        return true;
      }
    }
    return false;
  }

  // ============================================================
  // AI Readiness CRUD
  // ============================================================

  async setAiReadiness(
    business_id: string,
    dimension: AiReadiness["dimension"],
    data: Omit<AiReadiness, "id" | "business_id" | "dimension" | "created_at" | "updated_at">
  ): Promise<AiReadiness> {
    const existing = this.aiReadiness.get(business_id) ?? [];
    const index = existing.findIndex((r) => r.dimension === dimension);

    if (index !== -1) {
      const updated: AiReadiness = {
        ...existing[index],
        ...data,
        updated_at: new Date().toISOString(),
      };
      existing[index] = updated;
      this.aiReadiness.set(business_id, existing);
      return updated;
    }

    const readiness: AiReadiness = {
      ...data,
      id: crypto.randomUUID(),
      business_id,
      dimension,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    existing.push(readiness);
    this.aiReadiness.set(business_id, existing);
    return readiness;
  }

  async getAiReadiness(business_id: string): Promise<AiReadiness[]> {
    return this.aiReadiness.get(business_id) ?? [];
  }

  // ============================================================
  // Bundle Operations
  // ============================================================

  async getBusinessContextBundle(
    business_id: string
  ): Promise<BusinessContextBundle | null> {
    const business = await this.getBusiness(business_id);
    if (!business) return null;

    const [jurisdiction, currency, market_profiles, goals, constraints, ai_readiness] =
      await Promise.all([
        this.getJurisdiction(business_id),
        this.getCurrencyContext(business_id),
        this.getMarketProfiles(business_id),
        this.getGoals(business_id),
        this.getConstraints(business_id),
        this.getAiReadiness(business_id),
      ]);

    return {
      business,
      jurisdiction,
      currency,
      market_profiles,
      goals,
      constraints,
      ai_readiness,
    };
  }
}

/**
 * Singleton business context service.
 * In-memory for Phase 4 development.
 * Production: Will use Supabase PostgreSQL.
 */
export const businessContextService = new BusinessContextService();
