/**
 * Filtering utilities for data processing
 */

import { parseArray } from './utils.js';

/**
 * Normalizes a value to an array for filtering
 * @param {any} value - Value to normalize
 * @returns {any[]} Array of values
 */
export function normalizeToArray(value) {
	if (Array.isArray(value)) return value;
	return value != null ? [value] : [];
}

/**
 * Checks if any value in array matches any filter value
 * @param {any[]} values - Values to check
 * @param {any[]} filters - Filter values
 * @returns {boolean}
 */
export function matchesFilter(values, filters) {
	if (!filters?.length) return true;
	return filters.some(filter => values.includes(filter));
}

/**
 * Extracts all organizations from parent_child_matches hierarchy
 * @param {any[]} parentChildMatches - Parent-child matches array
 * @returns {string[]} Array of organization names
 */
export function extractHierarchyOrgs(parentChildMatches) {
	if (!Array.isArray(parentChildMatches)) return [];
	
	const orgs = [];
	parentChildMatches.forEach(match => {
		if (match?.lineage && Array.isArray(match.lineage)) {
			match.lineage.forEach(org => {
				const trimmed = String(org).trim();
				if (trimmed) orgs.push(trimmed);
			});
		}
	});
	return orgs;
}

/**
 * Gets all publishers for a row (including hierarchy)
 * @param {Object} row - Data row
 * @returns {string[]} Array of publisher names
 */
export function getAllPublishers(row) {
	const orgPublishers = normalizeToArray(row.organization_publisher_named_in_deal_suit);
	const affectedPubs = normalizeToArray(row.affected_publications);
	const hierarchyOrgs = extractHierarchyOrgs(row.parent_child_matches);
	return [...orgPublishers, ...affectedPubs, ...hierarchyOrgs];
}

/**
 * Checks if row matches search query
 * @param {Object} row - Data row
 * @param {string} query - Search query
 * @returns {boolean}
 */
export function matchesSearch(row, query) {
	if (!query?.trim()) return true;
	
	const queryLower = query.toLowerCase();
	const searchableFields = [
		row.date,
		row.interaction,
		row.platform,
		row.organization_publisher_named_in_deal_suit,
		row.type,
		row.reported_details,
		row.status,
		row.case_number,
		row.defendant,
		row.plaintiff,
		row.location,
		row.affected_publications
	];
	
	const searchableText = searchableFields
		.filter(f => f)
		.map(f => {
			if (Array.isArray(f)) {
				return f.map(v => String(v).toLowerCase()).join(' ');
			}
			return String(f).toLowerCase();
		})
		.join(' ');
	
	return searchableText.includes(queryLower);
}

/**
 * Filters data based on provided filters
 * @param {Array<Object>} data - Data to filter
 * @param {Object} filters - Filter object with searchQuery, filterInteraction, etc.
 * @returns {Array<Object>} Filtered data
 */
export function filterData(data, filters) {
	const {
		searchQuery = '',
		filterInteraction = [],
		filterType = [],
		filterPlatform = [],
		filterPublishers = []
	} = filters;

	return data.filter(row => {
		// Filter by interaction
		if (filterInteraction?.length > 0) {
			const rowInteractions = normalizeToArray(row.interaction);
			if (!matchesFilter(rowInteractions, filterInteraction)) return false;
		}

		// Filter by type
		if (filterType?.length > 0) {
			const rowTypes = normalizeToArray(row.type);
			if (!matchesFilter(rowTypes, filterType)) return false;
		}

		// Filter by platform
		if (filterPlatform?.length > 0) {
			const platforms = parseArray(row.platform);
			if (!matchesFilter(platforms, filterPlatform)) return false;
		}

		// Filter by publishers (News Org)
		if (filterPublishers?.length > 0) {
			const allPublishers = getAllPublishers(row);
			if (!matchesFilter(allPublishers, filterPublishers)) return false;
		}

		// Search query filter
		if (!matchesSearch(row, searchQuery)) return false;

		return true;
	});
}

