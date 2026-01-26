// ============================================================================
// TEMPLATE CONFIGURATION
// ============================================================================
// Customize everything here - this is your main configuration file
// Replace the values below with your own settings

import { createTemplateConfig } from './lib/template-config.js';
import { data } from './data.js';

export const config = createTemplateConfig({
	// YOUR DATA - Imported from data.js
	data,

	// FIELD MAPPINGS - Customize these to match your data structure
	dateField: 'date',                    // Field name in your data that contains dates
	lastUpdatedField: 'last_updated',     // Field name for last updated timestamp

	// FILTER CONFIGURATION - Choose which columns get which filters
	// You can add/remove/reorder filters here
	filterConfig: [
		{
			type: 'multi-select',
			column: 'Organization',
			label: 'Organization',
			dataKey: 'org'  // Actual field name in your data (array of organizations)
		},
		{
			type: 'date-range',
			label: 'Date Range',
			dataKey: 'date'  // Field name for dates
		},
		{
			type: 'search',
			label: 'Search'
		}
	],

	// LEFT NAVIGATION - Customize these links
	navItems: [
		{ href: '/', label: 'Home' },
		{ href: '/announcements', label: 'Data' },
		{ href: '/methodology', label: 'Methodology' },
		{ href: '#', label: 'Documentation' }
	],

	// HEADLINE CONFIGURATION
	headline: 'Component Testing Page',
	subheadline: '',
	brand: '',
	dateLabel: 'Last Updated On',
	bylineLabel: 'Maintained By',

	// BODY CONTENT - HTML supported
	bodyText: `This is a test page for displaying template components. The left navigation sidebar provides quick access to different sections of the page. 

	<br><br>The body content area is where your main content will appear. You can use <strong>HTML formatting</strong>, <a href='#'>links</a>, and other elements as needed.`,

	// CREDITS AND ACKNOWLEDGEMENTS
	maintainedBy: [
		{ name: 'Your Name', url: 'https://example.com' }
	],
	designDevelopment: [
		{ name: 'Designer Name', url: 'https://example.com' },
		{ name: 'Developer Name', url: 'https://example.com' }
	],
	acknowledgements: 'Thanks to all contributors and supporters of this project.',
	byline: '',
	bylineUrl: '',

	// TIMELINE-SPECIFIC SETTINGS
	categoryDefinitions: {},
	showYearNavigation: true,
	showTimeline: true,  // Set to true to show timeline UI with cards
	initialVisibleCount: 200  // Initial number of items to show (increase to see more)
});
