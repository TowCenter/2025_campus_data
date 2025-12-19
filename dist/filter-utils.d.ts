/**
 * Normalizes a value to an array for filtering
 * @param {any} value - Value to normalize
 * @returns {any[]} Array of values
 */
export function normalizeToArray(value: any): any[];
/**
 * Checks if any value in array matches any filter value
 * @param {any[]} values - Values to check
 * @param {any[]} filters - Filter values
 * @returns {boolean}
 */
export function matchesFilter(values: any[], filters: any[]): boolean;
/**
 * Extracts all organizations from parent_child_matches hierarchy
 * @param {any[]} parentChildMatches - Parent-child matches array
 * @returns {string[]} Array of organization names
 */
export function extractHierarchyOrgs(parentChildMatches: any[]): string[];
/**
 * Gets all publishers for a row (including hierarchy)
 * @param {Object} row - Data row
 * @returns {string[]} Array of publisher names
 */
export function getAllPublishers(row: Object): string[];
/**
 * Checks if row matches search query
 * @param {Object} row - Data row
 * @param {string} query - Search query
 * @returns {boolean}
 */
export function matchesSearch(row: Object, query: string): boolean;
/**
 * Filters data based on provided filters
 * @param {Array<Object>} data - Data to filter
 * @param {Object} filters - Filter object with searchQuery, filterInteraction, etc.
 * @returns {Array<Object>} Filtered data
 */
export function filterData(data: Array<Object>, filters: Object): Array<Object>;
