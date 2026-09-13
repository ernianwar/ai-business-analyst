/**
 * SALAM LIT — Business Truth Service
 *
 * Handles CRUD operations for business facts, evidence, and provenance.
 * This is the foundation for evidence-backed business intelligence.
 *
 * Phase 4: Business Context + Business Truth Foundation
 *
 * CRITICAL: This service distinguishes:
 *   - FACT: Validated business information with provenance
 *   - INFERENCE: AI-generated interpretation (NOT stored as fact)
 *   - COMPUTED: Derived from facts (NOT stored as fact)
 *   - HYPOTHESIS: Unverified speculation (NOT stored as fact)
 */

import type {
  DataSource,
  Document,
  Evidence,
  BusinessFact,
  FactEvidence,
  BusinessMetric,
  MetricSource,
  MetricKey,
  FactType,
  FactLifecycleStatus,
  FreshnessStatus,
  EvidenceStrength,
  CreatedByType,
  FactEvidenceRelationship,
} from "../types";

/**
 * In-memory business truth store.
 * Phase 4: In-memory for development.
 * Production: Will use Supabase PostgreSQL.
 */
class BusinessTruthService {
  private dataSources: Map<string, DataSource> = new Map();
  private documents: Map<string, Document> = new Map();
  private evidence: Map<string, Evidence> = new Map();
  private facts: Map<string, BusinessFact> = new Map();
  private factEvidence: Map<string, FactEvidence[]> = new Map();
  private metrics: Map<string, BusinessMetric> = new Map();
  private metricSources: Map<string, MetricSource[]> = new Map();

  // ============================================================
  // Data Source Registry
  // ============================================================

  async createDataSource(
    data: Omit<DataSource, "id" | "created_at" | "updated_at">
  ): Promise<DataSource> {
    const source: DataSource = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.dataSources.set(source.id, source);
    return source;
  }

  async getDataSource(id: string): Promise<DataSource | null> {
    return this.dataSources.get(id) ?? null;
  }

  async getDataSourcesByBusiness(
    business_id: string
  ): Promise<DataSource[]> {
    return Array.from(this.dataSources.values()).filter(
      (s) => s.business_id === business_id
    );
  }

  async updateDataSource(
    id: string,
    data: Partial<Omit<DataSource, "id" | "created_at" | "updated_at">>
  ): Promise<DataSource | null> {
    const existing = this.dataSources.get(id);
    if (!existing) return null;

    const updated: DataSource = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.dataSources.set(id, updated);
    return updated;
  }

  // ============================================================
  // Document Metadata
  // ============================================================

  async createDocument(
    data: Omit<Document, "id" | "created_at" | "updated_at">
  ): Promise<Document> {
    const doc: Document = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.documents.set(doc.id, doc);
    return doc;
  }

  async getDocument(id: string): Promise<Document | null> {
    return this.documents.get(id) ?? null;
  }

  async getDocumentsByBusiness(
    business_id: string
  ): Promise<Document[]> {
    return Array.from(this.documents.values()).filter(
      (d) => d.business_id === business_id
    );
  }

  async updateDocument(
    id: string,
    data: Partial<Omit<Document, "id" | "created_at" | "updated_at">>
  ): Promise<Document | null> {
    const existing = this.documents.get(id);
    if (!existing) return null;

    const updated: Document = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    this.documents.set(id, updated);
    return updated;
  }

  // ============================================================
  // Evidence Layer
  // ============================================================

  async createEvidence(
    data: Omit<Evidence, "id" | "created_at">
  ): Promise<Evidence> {
    const evidenceItem: Evidence = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };
    this.evidence.set(evidenceItem.id, evidenceItem);
    return evidenceItem;
  }

  async getEvidence(id: string): Promise<Evidence | null> {
    return this.evidence.get(id) ?? null;
  }

  async getEvidenceByBusiness(
    business_id: string
  ): Promise<Evidence[]> {
    return Array.from(this.evidence.values()).filter(
      (e) => e.business_id === business_id
    );
  }

  async getEvidenceByFact(
    fact_id: string
  ): Promise<Array<{ evidence: Evidence; relationship_type: FactEvidenceRelationship }>> {
    const links = this.factEvidence.get(fact_id) ?? [];
    const result: Array<{ evidence: Evidence; relationship_type: FactEvidenceRelationship }> = [];

    for (const link of links) {
      const evidenceItem = this.evidence.get(link.evidence_id);
      if (evidenceItem) {
        result.push({
          evidence: evidenceItem,
          relationship_type: link.relationship_type,
        });
      }
    }

    return result;
  }

  async supersedeEvidence(id: string): Promise<Evidence | null> {
    const existing = this.evidence.get(id);
    if (!existing) return null;

    const updated: Evidence = {
      ...existing,
      status: "SUPERSEDED",
    };
    this.evidence.set(id, updated);
    return updated;
  }

  async retractEvidence(id: string): Promise<Evidence | null> {
    const existing = this.evidence.get(id);
    if (!existing) return null;

    const updated: Evidence = {
      ...existing,
      status: "RETRACTED",
    };
    this.evidence.set(id, updated);
    return updated;
  }

  // ============================================================
  // Business Facts
  // ============================================================

  async createFact(
    data: Omit<BusinessFact, "id" | "created_at" | "updated_at">
  ): Promise<BusinessFact> {
    const fact: BusinessFact = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.facts.set(fact.id, fact);
    return fact;
  }

  async getFact(id: string): Promise<BusinessFact | null> {
    return this.facts.get(id) ?? null;
  }

  async getFactsByBusiness(
    business_id: string
  ): Promise<BusinessFact[]> {
    return Array.from(this.facts.values()).filter(
      (f) => f.business_id === business_id
    );
  }

  async getActiveFactsByBusiness(
    business_id: string
  ): Promise<BusinessFact[]> {
    return Array.from(this.facts.values()).filter(
      (f) => f.business_id === business_id && f.lifecycle_status === "ACTIVE"
    );
  }

  async getFactsByType(
    business_id: string,
    fact_type: FactType
  ): Promise<BusinessFact[]> {
    return Array.from(this.facts.values()).filter(
      (f) => f.business_id === business_id && f.fact_type === fact_type
    );
  }

  /**
   * Create a superseding fact.
   * The old fact is marked as SUPERSEDED, the new fact becomes ACTIVE.
   * Historical record is preserved.
   */
  async supersedeFact(
    old_fact_id: string,
    new_fact_data: Omit<BusinessFact, "id" | "created_at" | "updated_at" | "lifecycle_status">
  ): Promise<{ old_fact: BusinessFact; new_fact: BusinessFact }> {
    const oldFact = this.facts.get(old_fact_id);
    if (!oldFact) throw new Error("Original fact not found");

    // Mark old fact as superseded
    const updatedOldFact: BusinessFact = {
      ...oldFact,
      lifecycle_status: "SUPERSEDED" as FactLifecycleStatus,
      updated_at: new Date().toISOString(),
    };
    this.facts.set(old_fact_id, updatedOldFact);

    // Create new active fact
    const newFact: BusinessFact = {
      ...new_fact_data,
      id: crypto.randomUUID(),
      lifecycle_status: "ACTIVE",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.facts.set(newFact.id, newFact);

    return { old_fact: updatedOldFact, new_fact: newFact };
  }

  /**
   * Mark a fact as expired.
   */
  async expireFact(id: string): Promise<BusinessFact | null> {
    const existing = this.facts.get(id);
    if (!existing) return null;

    const updated: BusinessFact = {
      ...existing,
      lifecycle_status: "EXPIRED",
      valid_to: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.facts.set(id, updated);
    return updated;
  }

  /**
   * Mark a fact as retracted.
   */
  async retractFact(id: string): Promise<BusinessFact | null> {
    const existing = this.facts.get(id);
    if (!existing) return null;

    const updated: BusinessFact = {
      ...existing,
      lifecycle_status: "RETRACTED",
      updated_at: new Date().toISOString(),
    };
    this.facts.set(id, updated);
    return updated;
  }

  /**
   * Detect conflicts between facts of the same type for the same period.
   */
  async detectConflicts(
    business_id: string,
    fact_type: FactType,
    period_start: string,
    period_end: string
  ): Promise<BusinessFact[]> {
    return Array.from(this.facts.values()).filter(
      (f) =>
        f.business_id === business_id &&
        f.fact_type === fact_type &&
        f.lifecycle_status === "ACTIVE" &&
        f.period_start === period_start &&
        f.period_end === period_end
    );
  }

  /**
   * Mark conflicting facts as CONFLICTED.
   */
  async markConflicted(
    fact_ids: string[]
  ): Promise<BusinessFact[]> {
    const updated: BusinessFact[] = [];

    for (const id of fact_ids) {
      const existing = this.facts.get(id);
      if (existing) {
        const conflicted: BusinessFact = {
          ...existing,
          lifecycle_status: "CONFLICTED",
          updated_at: new Date().toISOString(),
        };
        this.facts.set(id, conflicted);
        updated.push(conflicted);
      }
    }

    return updated;
  }

  // ============================================================
  // Fact Evidence Provenance
  // ============================================================

  async linkFactEvidence(
    fact_id: string,
    evidence_id: string,
    relationship_type: FactEvidenceRelationship
  ): Promise<FactEvidence> {
    const link: FactEvidence = {
      id: crypto.randomUUID(),
      fact_id,
      evidence_id,
      relationship_type,
      created_at: new Date().toISOString(),
    };

    const existing = this.factEvidence.get(fact_id) ?? [];
    existing.push(link);
    this.factEvidence.set(fact_id, existing);

    return link;
  }

  async getFactProvenance(
    fact_id: string
  ): Promise<FactEvidence[]> {
    return this.factEvidence.get(fact_id) ?? [];
  }

  // ============================================================
  // Business Metrics
  // ============================================================

  async createMetric(
    data: Omit<BusinessMetric, "id" | "created_at" | "updated_at">
  ): Promise<BusinessMetric> {
    const metric: BusinessMetric = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.metrics.set(metric.id, metric);
    return metric;
  }

  async getMetric(id: string): Promise<BusinessMetric | null> {
    return this.metrics.get(id) ?? null;
  }

  async getMetricsByBusiness(
    business_id: string
  ): Promise<BusinessMetric[]> {
    return Array.from(this.metrics.values()).filter(
      (m) => m.business_id === business_id
    );
  }

  async getMetricByKey(
    business_id: string,
    metricKey: MetricKey,
    periodStart: string,
    periodEnd: string
  ): Promise<BusinessMetric | null> {
    return (
      Array.from(this.metrics.values()).find(
        (m) =>
          m.business_id === business_id &&
          m.metric_key === metricKey &&
          m.period_start === periodStart &&
          m.period_end === periodEnd
      ) ?? null
    );
  }

  async getMetricsByKey(
    business_id: string,
    metricKey: MetricKey
  ): Promise<BusinessMetric[]> {
    return Array.from(this.metrics.values()).filter(
      (m) => m.business_id === business_id && m.metric_key === metricKey
    );
  }

  async getMetricsForPeriod(
    business_id: string,
    periodStart: string,
    periodEnd: string
  ): Promise<BusinessMetric[]> {
    return Array.from(this.metrics.values()).filter(
      (m) =>
        m.business_id === business_id &&
        m.period_start === periodStart &&
        m.period_end === periodEnd
    );
  }

  async getLatestMetric(
    business_id: string,
    metricKey: MetricKey
  ): Promise<BusinessMetric | null> {
    const metrics = Array.from(this.metrics.values())
      .filter(
        (m) => m.business_id === business_id && m.metric_key === metricKey
      )
      .sort((a, b) => {
        if (!a.period_end || !b.period_end) return 0;
        return b.period_end.localeCompare(a.period_end);
      });
    return metrics[0] ?? null;
  }

  async deleteMetric(id: string): Promise<boolean> {
    return this.metrics.delete(id);
  }

  async deleteMetricsByPeriod(
    business_id: string,
    periodStart: string,
    periodEnd: string
  ): Promise<number> {
    let count = 0;
    for (const [id, metric] of this.metrics) {
      if (
        metric.business_id === business_id &&
        metric.period_start === periodStart &&
        metric.period_end === periodEnd
      ) {
        this.metrics.delete(id);
        count++;
      }
    }
    return count;
  }

  // ============================================================
  // Metric Source Provenance
  // ============================================================

  async addMetricSource(
    data: Omit<MetricSource, "id" | "created_at">
  ): Promise<MetricSource> {
    const source: MetricSource = {
      ...data,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
    };

    const existing = this.metricSources.get(data.metric_id) ?? [];
    existing.push(source);
    this.metricSources.set(data.metric_id, existing);

    return source;
  }

  async getMetricSources(
    metric_id: string
  ): Promise<MetricSource[]> {
    return this.metricSources.get(metric_id) ?? [];
  }

  async getMetricWithProvenance(
    metric_id: string
  ): Promise<{
    metric: BusinessMetric;
    sources: Array<{
      metric_source: MetricSource;
      fact: BusinessFact | null;
    }>;
  } | null> {
    const metric = this.metrics.get(metric_id);
    if (!metric) return null;

    const sources = await this.getMetricSources(metric_id);
    const enriched = sources.map((ms) => ({
      metric_source: ms,
      fact: this.facts.get(ms.fact_id) ?? null,
    }));

    return { metric, sources: enriched };
  }

  // ============================================================
  // Utility Functions
  // ============================================================

  /**
   * Calculate freshness status based on source and retrieved timestamps.
   */
  calculateFreshness(
    source_timestamp: string | null,
    retrieved_at: string,
    max_age_days: number = 30
  ): FreshnessStatus {
    if (!source_timestamp) return "UNKNOWN";

    const sourceDate = new Date(source_timestamp);
    const now = new Date();
    const diffDays = (now.getTime() - sourceDate.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays <= max_age_days) return "CURRENT";
    if (diffDays <= max_age_days * 2) return "STALE";
    return "STALE";
  }

  /**
   * Calculate evidence strength based on source reliability and number of sources.
   */
  calculateEvidenceStrength(
    source_reliability: string,
    source_count: number
  ): EvidenceStrength {
    if (source_reliability === "HIGH" && source_count >= 2) return "STRONG";
    if (source_reliability === "HIGH" || source_count >= 3) return "MODERATE";
    if (source_reliability === "MEDIUM" && source_count >= 1) return "MODERATE";
    return "WEAK";
  }

  /**
   * Get fact summary with provenance.
   */
  async getFactSummary(
    fact_id: string
  ): Promise<{
    fact: BusinessFact;
    provenance: Array<{
      evidence: Evidence;
      relationship_type: FactEvidenceRelationship;
      data_source: DataSource | null;
    }>;
  } | null> {
    const fact = this.facts.get(fact_id);
    if (!fact) return null;

    const provenanceLinks = await this.getEvidenceByFact(fact_id);
    const provenance = provenanceLinks.map((link) => ({
      ...link,
      data_source: this.dataSources.get(link.evidence.data_source_id) ?? null,
    }));

    return { fact, provenance };
  }
}

/**
 * Singleton business truth service.
 * In-memory for Phase 4 development.
 * Production: Will use Supabase PostgreSQL.
 */
export const businessTruthService = new BusinessTruthService();
