// ============================================================================
// DATA
// ============================================================================
// This file imports and processes CSV data from data.csv

import { parseCSV } from './lib/csv-utils.js';
import csvData from './data.csv?raw';

/**
 * Normalizes CSV data to match the expected data structure
 * @param {Array<Object>} csvRows - Raw CSV data
 * @returns {Array<Object>} Normalized data array
 */
function normalizeCSVData(csvRows) {
	return csvRows.map((row) => {
		// Extract date from ISO string (format: 2025-01-02T00:00:00)
		let date = null;
		if (row.date) {
			// Extract just the date part (YYYY-MM-DD)
			const dateMatch = row.date.match(/^(\d{4}-\d{2}-\d{2})/);
			if (dateMatch) {
				date = dateMatch[1];
			}
		}

		// Extract last updated date
		let last_updated = null;
		if (row.last_updated_at) {
			const dateMatch = row.last_updated_at.match(/^(\d{4}-\d{2}-\d{2})/);
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

		return {
			_id: row._id || null,
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

// Parse CSV data
const parsedCSV = parseCSV(csvData || '');
export const data = normalizeCSVData(parsedCSV);
