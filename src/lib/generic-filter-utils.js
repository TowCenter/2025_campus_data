/**
 * Generic filter utilities
 * Works with any data structure and configurable filter types
 */

/**
 * Normalizes a value to an array
 * @param {any} value - Value to normalize
 * @returns {any[]} Array of values
 */
function normalizeToArray(value) {
	if (!value) return [];
	if (Array.isArray(value)) return value.filter(v => v != null && v !== '');
	if (typeof value === 'string') {
		// Try to parse as comma-separated or semicolon-separated
		const parsed = value.split(/[,;]/).map(v => v.trim()).filter(Boolean);
		return parsed.length > 0 ? parsed : [value];
	}
	return [value].filter(v => v != null && v !== '');
}

/**
 * Checks if an item matches a multi-select filter
 * @param {Object} item - Data item
 * @param {any[]} selected - Selected values
 * @param {string} dataKey - Field name in data
 * @param {'OR' | 'AND'} [mode='OR'] - Match mode
 * @returns {boolean}
 */
export function filterByMultiSelect(item, selected, dataKey, mode = 'OR') {
	if (!selected || selected.length === 0) return true;
	if (!item || !dataKey) return false;

	const itemValues = normalizeToArray(item[dataKey]);
	if (itemValues.length === 0) return false;

	if (mode === 'AND') {
		// All selected values must be present in item
		return selected.every(selectedValue => 
			itemValues.some(itemValue => 
				String(itemValue).toLowerCase() === String(selectedValue).toLowerCase()
			)
		);
	} else {
		// At least one selected value must be present in item (OR mode)
		return selected.some(selectedValue => 
			itemValues.some(itemValue => 
				String(itemValue).toLowerCase() === String(selectedValue).toLowerCase()
			)
		);
	}
}

/**
 * Checks if an item matches a date range filter
 * @param {Object} item - Data item
 * @param {{startDate?: string, endDate?: string}} dateRange - Date range (with startDate/endDate strings)
 * @param {string} dataKey - Field name in data
 * @returns {boolean}
 */
export function filterByDateRange(item, dateRange, dataKey) {
	if (!dateRange || (!dateRange.startDate && !dateRange.endDate)) return true;
	if (!item || !dataKey) return false;

	const itemDateStr = item[dataKey];
	if (!itemDateStr) return false;

	// Parse item date - handle YYYY-MM-DD format
	let itemDate;
	if (typeof itemDateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(itemDateStr)) {
		const [year, month, day] = itemDateStr.split('-').map(Number);
		itemDate = new Date(year, month - 1, day);
	} else {
		itemDate = new Date(itemDateStr);
	}

	if (isNaN(itemDate.getTime())) return false;

	// Parse filter dates
	if (dateRange.startDate) {
		const startDate = new Date(dateRange.startDate);
		if (!isNaN(startDate.getTime()) && itemDate < startDate) return false;
	}

	if (dateRange.endDate) {
		const endDate = new Date(dateRange.endDate);
		// Set end date to end of day for inclusive comparison
		endDate.setHours(23, 59, 59, 999);
		if (!isNaN(endDate.getTime()) && itemDate > endDate) return false;
	}

	return true;
}

/**
 * Checks if an item matches a search query
 * @param {Object} item - Data item
 * @param {string} query - Search query
 * @returns {boolean}
 */
export function filterBySearch(item, query) {
	if (!query || !query.trim()) return true;
	if (!item) return false;

	const queryLower = query.toLowerCase().trim();
	
	// Search in all string fields of the item
	const searchableText = Object.values(item)
		.filter(v => v != null)
		.map(v => {
			if (Array.isArray(v)) {
				return v.map(val => String(val).toLowerCase()).join(' ');
			}
			return String(v).toLowerCase();
		})
		.join(' ');

	return searchableText.includes(queryLower);
}

/**
 * Applies all filters to data based on filter configuration
 * @param {any[]} data - Data array
 * @param {Record<string, any>} filterValues - Filter values object (keyed by filter ID)
 * @param {Array<{type: string, dataKey?: string, label: string}>} filterConfig - Filter configuration
 * @param {string} [dateField='date'] - Date field name for date range filters
 * @returns {any[]} Filtered data
 */
export function applyFilters(data, filterValues, filterConfig, dateField = 'date') {
	if (!Array.isArray(data)) return [];
	if (!filterConfig || filterConfig.length === 0) return data;

	return data.filter(item => {
		// Apply each filter in the configuration
		for (const filter of filterConfig) {
			let filterId;
			if (filter.type === 'search') {
				filterId = 'search';
			} else if (filter.type === 'date-range') {
				filterId = 'filter-DateRange';
			} else {
				filterId = `filter-${filter.label}`;
			}
			
			const value = filterValues[filterId] || null;

			// For date range, check if both dates are empty
			if (filter.type === 'date-range') {
				const dateRange = value || { startDate: '', endDate: '' };
				if (!dateRange.startDate && !dateRange.endDate) {
					continue; // Skip empty date range
				}
			} else if (value === null || value === undefined || value === '') {
				continue; // Skip empty filters
			}

			let matches = true;

			switch (filter.type) {
				case 'multi-select':
					if (filter.dataKey) {
						matches = filterByMultiSelect(item, value, filter.dataKey);
					}
					break;

				case 'date-range':
					const dateKey = filter.dataKey || dateField;
					matches = filterByDateRange(item, value, dateKey);
					break;

				case 'search':
					matches = filterBySearch(item, value);
					break;

				default:
					// Unknown filter type, skip it
					continue;
			}

			if (!matches) {
				return false; // Item doesn't match this filter
			}
		}

		return true; // Item matches all filters
	});
}
