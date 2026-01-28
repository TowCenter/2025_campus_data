/**
 * Creates a template configuration by merging user config with defaults
 * @param {Partial<TemplateConfig>} userConfig - User's custom configuration
 * @returns {TemplateConfig} Complete configuration object
 */
export function createTemplateConfig(userConfig: Partial<TemplateConfig>): TemplateConfig;
export type FilterConfigItem = {
    /**
     * - Type of filter
     */
    type: "multi-select" | "date-range" | "search";
    /**
     * - Column name (optional for search)
     */
    column?: string | undefined;
    /**
     * - Display label for the filter
     */
    label: string;
    /**
     * - Actual field name in data (for multi-select and date-range)
     */
    dataKey?: string | undefined;
    /**
     * - Whether this filter uses a virtual/computed field
     */
    virtual?: boolean | undefined;
};
export type NavItem = {
    /**
     * - Link URL
     */
    href: string;
    /**
     * - Link text
     */
    label: string;
};
export type CreditsItem = {
    /**
     * - Person/entity name
     */
    name: string;
    /**
     * - URL (optional)
     */
    url: string;
};
export type TemplateConfig = {
    /**
     * - Dataset array
     */
    data: any[];
    /**
     * - Field name for dates
     */
    dateField: string;
    /**
     * - Field name for last updated timestamp
     */
    lastUpdatedField: string;
    /**
     * - Filter configuration array
     */
    filterConfig: FilterConfigItem[];
    /**
     * - Left navigation items
     */
    navItems: NavItem[];
    /**
     * - Main headline text
     */
    headline: string;
    /**
     * - Subheadline text
     */
    subheadline: string;
    /**
     * - Brand name
     */
    brand: string;
    /**
     * - Label for date display
     */
    dateLabel: string;
    /**
     * - Label for byline display
     */
    bylineLabel: string;
    /**
     * - Body content (HTML supported)
     */
    bodyText: string;
    /**
     * - Maintained by credits
     */
    maintainedBy: CreditsItem[];
    /**
     * - Design/development credits
     */
    designDevelopment: CreditsItem[];
    /**
     * - Acknowledgements text
     */
    acknowledgements: string;
    /**
     * - Byline text
     */
    byline: string;
    /**
     * - Byline URL
     */
    bylineUrl: string;
    /**
     * - Category definitions (for timeline)
     */
    categoryDefinitions: Record<string, string>;
    /**
     * - Show year navigation in timeline
     */
    showYearNavigation: boolean;
    /**
     * - Show timeline UI (false = simple card list)
     */
    showTimeline: boolean;
    /**
     * - Initial number of visible items
     */
    initialVisibleCount: number;
};
