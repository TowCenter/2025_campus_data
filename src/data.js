// ============================================================================
// DATA
// ============================================================================
// This file imports and processes JSON data from sampledata.json

import jsonData from './data.json';

/**
 * Normalizes JSON data to match the expected data structure
 * @param {Array<Object>} jsonRows - Raw JSON data
 * @returns {Array<Object>} Normalized data array
 */
function normalizeJSONData(jsonRows) {
	return jsonRows.map((row) => {
		// Extract date from MongoDB-style date object or ISO string
		let date = null;
		if (row.date) {
			const dateStr = row.date.$date || row.date;
			const dateMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
			if (dateMatch) {
				date = dateMatch[1];
			}
		}

		// Extract last updated date
		let last_updated = null;
		if (row.last_updated_at) {
			const dateStr = row.last_updated_at.$date || row.last_updated_at;
			const dateMatch = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
			if (dateMatch) {
				last_updated = dateMatch[1] + 'T00:00:00.000Z';
			}
		}

		// Parse org as array (in case it's comma-separated)
		const orgArray = row.org ? (row.org.includes(',') ? row.org.split(',').map(o => o.trim()) : [row.org]) : [];

		// Create links array from URL
		const links = [];
		if (row.url) {
			try {
				const urlObj = new URL(row.url);
				links.push({
					text: urlObj.hostname.replace('www.', ''),
					url: row.url
				});
			} catch (e) {
				// Invalid URL, skip
			}
		}

		// Get MongoDB ObjectId as string
		const id = row._id?.$oid || row._id || null;

		return {
			_id: id,
			date: date,
			last_updated: last_updated,
			org: orgArray,
			title: row.title || '',
			description: row.content || '',
			url: row.url || '',
			links: links,
			// Map to expected filter fields
			platform: orgArray, // Using org as platform for filtering
			category: [] // Can be customized based on your needs
		};
	}).filter(row => row.date !== null); // Filter out rows without dates
}

export const data = normalizeJSONData(jsonData);
