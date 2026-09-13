/**
 * SALAM LIT — Product Navigation Structure
 *
 * Defines the navigation architecture for the product.
 *
 * Architecture:
 *   Navigation is NOT gated by feature flags during Phase 1-3.
 *   Feature flags activate capability depth, not product presence.
 *   Navigation reveals functional depth progressively.
 *
 * Phase 2: Navigation structure only.
 * UI implementation will be built in later phases.
 */

/**
 * Navigation item definition.
 */
export interface NavItem {
  /** Unique key */
  key: string;
  /** Display label */
  label: string;
  /** Route path */
  path: string;
  /** Icon name (for icon library) */
  icon: string;
  /** Description for accessibility */
  description: string;
  /** Is this a top-level section */
  is_top_level: boolean;
  /** Parent section key (if nested) */
  parent_key?: string;
  /** Feature flag required (null = always visible) */
  required_feature?: string;
  /** Is this item enabled */
  enabled: boolean;
}

/**
 * Product navigation structure.
 * Based on the Master Build Specification:
 *   People | Ideas | Growth | Impact
 *
 * This is the canonical navigation for SALAM LIT.
 */
export const PRODUCT_NAVIGATION: NavItem[] = [
  // ─── People ───
  {
    key: "people",
    label: "People",
    path: "/people",
    icon: "users",
    description: "Your AI Workforce — agents, roles, and workforce health",
    is_top_level: true,
    enabled: true,
  },
  {
    key: "people-workforce",
    label: "Workforce",
    path: "/people/workforce",
    icon: "users",
    description: "All AI agents and their status",
    is_top_level: false,
    parent_key: "people",
    enabled: true,
  },
  {
    key: "people-health",
    label: "Workforce Health",
    path: "/people/health",
    icon: "heart-pulse",
    description: "Agent performance and health metrics",
    is_top_level: false,
    parent_key: "people",
    enabled: true,
  },
  {
    key: "people-approvals",
    label: "Pending Approvals",
    path: "/people/approvals",
    icon: "check-circle",
    description: "Actions requiring owner approval",
    is_top_level: false,
    parent_key: "people",
    enabled: true,
  },

  // ─── Ideas ───
  {
    key: "ideas",
    label: "Ideas",
    path: "/ideas",
    icon: "lightbulb",
    description: "Innovations, opportunities, and business ideas",
    is_top_level: true,
    enabled: true,
  },
  {
    key: "ideas-opportunities",
    label: "Opportunities",
    path: "/ideas/opportunities",
    icon: "target",
    description: "Discovered business opportunities",
    is_top_level: false,
    parent_key: "ideas",
    enabled: true,
  },
  {
    key: "ideas-research",
    label: "Research",
    path: "/ideas/research",
    icon: "search",
    description: "Research reports and insights",
    is_top_level: false,
    parent_key: "ideas",
    enabled: true,
  },
  {
    key: "ideas-brainstorm",
    label: "Brainstorm",
    path: "/ideas/brainstorm",
    icon: "sparkles",
    description: "AI-assisted brainstorming sessions",
    is_top_level: false,
    parent_key: "ideas",
    enabled: true,
  },

  // ─── Growth ───
  {
    key: "growth",
    label: "Growth",
    path: "/growth",
    icon: "trending-up",
    description: "Business growth strategies and market expansion",
    is_top_level: true,
    enabled: true,
  },
  {
    key: "growth-marketing",
    label: "Marketing",
    path: "/growth/marketing",
    icon: "megaphone",
    description: "Marketing campaigns and content",
    is_top_level: false,
    parent_key: "growth",
    enabled: true,
  },
  {
    key: "growth-sales",
    label: "Sales",
    path: "/growth/sales",
    icon: "shopping-cart",
    description: "Sales pipeline and opportunities",
    is_top_level: false,
    parent_key: "growth",
    enabled: true,
  },
  {
    key: "growth-funding",
    label: "Funding",
    path: "/growth/funding",
    icon: "banknote",
    description: "Grants, loans, and funding opportunities",
    is_top_level: false,
    parent_key: "growth",
    enabled: true,
  },

  // ─── Business ───
  {
    key: "business",
    label: "Business",
    path: "/business",
    icon: "building",
    description: "Business context, goals, and configuration",
    is_top_level: true,
    enabled: true,
  },
  {
    key: "business-data-sources",
    label: "Data Sources",
    path: "/data-sources",
    icon: "database",
    description: "Upload files, manage data sources, and review evidence",
    is_top_level: true,
    enabled: true,
  },

  // ─── Impact ───
  {
    key: "impact",
    label: "Impact",
    path: "/impact",
    icon: "bar-chart-3",
    description: "Business performance and financial intelligence",
    is_top_level: true,
    enabled: true,
  },
  {
    key: "impact-finance",
    label: "Finance",
    path: "/finance",
    icon: "calculator",
    description: "Business Financial Analysis & Verification",
    is_top_level: true,
    enabled: true,
  },
  {
    key: "impact-finance-sub",
    label: "Finance Details",
    path: "/impact/finance",
    icon: "calculator",
    description: "Financial health and accounting",
    is_top_level: false,
    parent_key: "impact",
    enabled: true,
  },
  {
    key: "impact-operations",
    label: "Operations",
    path: "/impact/operations",
    icon: "settings",
    description: "Operational health and process management",
    is_top_level: false,
    parent_key: "impact",
    enabled: true,
  },
  {
    key: "impact-insights",
    label: "Insights",
    path: "/impact/insights",
    icon: "brain",
    description: "AI-powered business insights",
    is_top_level: false,
    parent_key: "impact",
    enabled: true,
  },
];

/**
 * Get top-level navigation items.
 */
export function getTopLevelNav(): NavItem[] {
  return PRODUCT_NAVIGATION.filter((item) => item.is_top_level);
}

/**
 * Get child navigation items for a parent.
 */
export function getChildNav(parent_key: string): NavItem[] {
  return PRODUCT_NAVIGATION.filter((item) => item.parent_key === parent_key);
}

/**
 * Get navigation item by key.
 */
export function getNavItem(key: string): NavItem | undefined {
  return PRODUCT_NAVIGATION.find((item) => item.key === key);
}

/**
 * Get navigation item by path.
 */
export function getNavItemByPath(path: string): NavItem | undefined {
  return PRODUCT_NAVIGATION.find((item) => item.path === path);
}
