/**
 * CSV parsing utilities
 */

/**
 * Parses a CSV string into an array of objects
 * @param {string} csvText - CSV text content
 * @returns {Array<Object>} Array of objects with keys from header row
 */
export function parseCSV(csvText) {
	const lines = csvText.split('\n').filter(line => line.trim());
	if (lines.length === 0) return [];

	// Parse header
	const headers = parseCSVLine(lines[0]);
	
	// Parse data rows
	const data = [];
	for (let i = 1; i < lines.length; i++) {
		const values = parseCSVLine(lines[i]);
		if (values.length === 0) continue;
		
		const row = {};
		headers.forEach((header, index) => {
			row[header] = values[index] || '';
		});
		data.push(row);
	}
	
	return data;
}

/**
 * Parses a single CSV line, handling quoted fields
 * @param {string} line - CSV line
 * @returns {string[]} Array of field values
 */
function parseCSVLine(line) {
	const fields = [];
	let currentField = '';
	let inQuotes = false;
	
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		const nextChar = line[i + 1];
		
		if (char === '"') {
			if (inQuotes && nextChar === '"') {
				// Escaped quote
				currentField += '"';
				i++; // Skip next quote
			} else {
				// Toggle quote state
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			// Field separator
			fields.push(currentField.trim());
			currentField = '';
		} else {
			currentField += char;
		}
	}
	
	// Add last field
	fields.push(currentField.trim());
	
	return fields;
}
