/**
 * Data normalization and validation utilities
 */

/**
 * Checks if a value is valid (not null, undefined, NaN, empty, etc.)
 * @param {any} value - Value to check
 * @returns {boolean}
 */
export function isValidValue(value) {
	if (value === null || value === undefined) return false;
	// Handle NaN (can be literal NaN or string "NaN")
	if (typeof value === 'number' && isNaN(value)) return false;
	if (value === 'NaN' || value === 'nan' || (typeof value === 'string' && value.toLowerCase() === 'nan')) return false;
	// Handle Infinity
	if (value === Infinity || value === -Infinity) return false;
	if (typeof value === 'string' && value.trim() === '') return false;
	if (Array.isArray(value) && value.length === 0) return false;
	return true;
}

/**
 * Normalizes a value to an array, filtering out invalid values
 * @param {any} value - Value to normalize
 * @returns {any[]} Array of valid values
 */
export function normalizeArray(value) {
	if (!isValidValue(value)) return [];
	if (Array.isArray(value)) return value.filter(v => isValidValue(v));
	return [value].filter(v => isValidValue(v));
}

/**
 * Normalizes raw data from JSON format to internal format
 * @param {Array<Object>} rawDataArray - Raw data array from JSON
 * @returns {Array<Object>} Normalized data array
 */
export function normalizeData(rawDataArray) {
	if (!Array.isArray(rawDataArray)) {
		console.error('rawDataArray is not an array:', rawDataArray);
		return [];
	}
	
	return rawDataArray.map((row, index) => {
		try {
			return {
				date: row?.Date || null,
				interaction: row?.Interaction || null,
				platform: normalizeArray(row?.['AI Company']),
				publishers: normalizeArray(row?.['News Org(s)']),
				type: normalizeArray(row?.Type),
				reported_details: row?.['Reported Details'] || '',
				organization_publisher_named_in_deal_suit: normalizeArray(row?.['News Org(s)']),
				affected_publications: normalizeArray(row?.['Affected Publications']),
				parent_child_matches: Array.isArray(row?.['parent_child_matches']) ? row['parent_child_matches'] : [],
				sources: normalizeArray(row?.Sources),
				// Lawsuit-specific fields
				status: isValidValue(row?.Status) ? String(row.Status) : null,
				case_number: isValidValue(row?.['Case Number']) ? String(row['Case Number']) : null,
				defendant: normalizeArray(row?.Defendant),
				plaintiff: normalizeArray(row?.Plaintiff),
				case_filing: isValidValue(row?.['Case Filing']) ? String(row['Case Filing']) : null,
				location: isValidValue(row?.Location) ? String(row.Location) : null,
			};
		} catch (error) {
			console.error(`Error processing row ${index}:`, error, row);
			return null;
		}
	}).filter(row => row !== null);
}

/**
 * Gets the latest "Last Modified" date from data and formats it
 * @param {Array<Object>} data - Data array
 * @returns {string} Formatted date string
 */
export function getLatestDate(data) {
	if (!Array.isArray(data) || data.length === 0) {
		return 'Date unavailable';
	}
	
	const dates = data
		.map(row => row['Last Modified'])
		.filter(Boolean)
		.sort()
		.reverse();
	
	if (dates.length === 0) {
		return 'Date unavailable';
	}
	
	const latestDate = new Date(dates[0]);
	
	// Check if date is valid
	if (isNaN(latestDate.getTime())) {
		return 'Date unavailable';
	}
	
	const months = ['January', 'February', 'March', 'April', 'May', 'June', 
	               'July', 'August', 'September', 'October', 'November', 'December'];
	
	const month = months[latestDate.getMonth()];
	const day = String(latestDate.getDate()).padStart(2, '0');
	const year = latestDate.getFullYear();
	
	return `${month} ${day}, ${year}`;
}

