/**
 * Template Configuration System
 * Provides type definitions and default configuration for the template
 */

/**
 * @typedef {Object} FilterConfigItem
 * @property {'multi-select' | 'date-range' | 'search'} type - Type of filter
 * @property {string} [column] - Column name (optional for search)
 * @property {string} label - Display label for the filter
 * @property {string} [dataKey] - Actual field name in data (for multi-select and date-range)
 */

/**
 * @typedef {Object} NavItem
 * @property {string} href - Link URL
 * @property {string} label - Link text
 */

/**
 * @typedef {Object} CreditsItem
 * @property {string} name - Person/entity name
 * @property {string} url - URL (optional)
 */

/**
 * @typedef {Object} TemplateConfig
 * @property {any[]} data - Dataset array
 * @property {string} dateField - Field name for dates
 * @property {string} lastUpdatedField - Field name for last updated timestamp
 * @property {FilterConfigItem[]} filterConfig - Filter configuration array
 * @property {NavItem[]} navItems - Left navigation items
 * @property {string} headline - Main headline text
 * @property {string} subheadline - Subheadline text
 * @property {string} brand - Brand name
 * @property {string} dateLabel - Label for date display
 * @property {string} bylineLabel - Label for byline display
 * @property {string} bodyText - Body content (HTML supported)
 * @property {CreditsItem[]} maintainedBy - Maintained by credits
 * @property {CreditsItem[]} designDevelopment - Design/development credits
 * @property {string} acknowledgements - Acknowledgements text
 * @property {string} byline - Byline text
 * @property {string} bylineUrl - Byline URL
 * @property {Record<string, string>} categoryDefinitions - Category definitions (for timeline)
 * @property {boolean} showYearNavigation - Show year navigation in timeline
 * @property {boolean} showTimeline - Show timeline UI (false = simple card list)
 * @property {number} initialVisibleCount - Initial number of visible items
 */

/**
 * Default template configuration
 * @type {TemplateConfig}
 */
const defaultTemplateConfig = {
	data: [],
	dateField: 'date',
	lastUpdatedField: 'last_updated',
	filterConfig: [],
	navItems: [],
	headline: 'Your Tracker Title',
	subheadline: '',
	brand: '',
	dateLabel: 'Last Updated On',
	bylineLabel: 'Maintained By',
	bodyText: '',
	maintainedBy: [],
	designDevelopment: [],
	acknowledgements: '',
	byline: '',
	bylineUrl: '',
	/** @type {Record<string, string>} */
	categoryDefinitions: {},
	showYearNavigation: false,
	showTimeline: true,
	initialVisibleCount: 20
};

/**
 * Creates a template configuration by merging user config with defaults
 * @param {Partial<TemplateConfig>} userConfig - User's custom configuration
 * @returns {TemplateConfig} Complete configuration object
 */
export function createTemplateConfig(userConfig) {
	return {
		...defaultTemplateConfig,
		...userConfig,
		// Deep merge for nested objects/arrays
		filterConfig: userConfig.filterConfig || defaultTemplateConfig.filterConfig,
		navItems: userConfig.navItems || defaultTemplateConfig.navItems,
		maintainedBy: userConfig.maintainedBy || defaultTemplateConfig.maintainedBy,
		designDevelopment: userConfig.designDevelopment || defaultTemplateConfig.designDevelopment,
		categoryDefinitions: {
			...defaultTemplateConfig.categoryDefinitions,
			...(userConfig.categoryDefinitions || {})
		}
	};
}
