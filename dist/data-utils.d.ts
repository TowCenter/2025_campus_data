/**
 * Data normalization and validation utilities
 */
/**
 * Checks if a value is valid (not null, undefined, NaN, empty, etc.)
 * @param {any} value - Value to check
 * @returns {boolean}
 */
export function isValidValue(value: any): boolean;
/**
 * Normalizes a value to an array, filtering out invalid values
 * @param {any} value - Value to normalize
 * @returns {any[]} Array of valid values
 */
export function normalizeArray(value: any): any[];
/**
 * Normalizes raw data from JSON format to internal format
 * @param {Array<Object>} rawDataArray - Raw data array from JSON
 * @returns {Array<Object>} Normalized data array
 */
export function normalizeData(rawDataArray: Array<Object>): Array<Object>;
/**
 * Gets the latest date from data and formats it
 * @param {Array<Object>} data - Data array
 * @param {string} [dateField='last_updated'] - Field name for last updated date
 * @param {string} [fallbackField='date'] - Fallback field name for date
 * @returns {string} Formatted date string
 */
export function getLatestDate(data: Array<Object>, dateField?: string, fallbackField?: string): string;
