/**
 * Checks if an item matches a multi-select filter
 * @param {Object} item - Data item
 * @param {any[]} selected - Selected values
 * @param {string} dataKey - Field name in data
 * @param {'OR' | 'AND'} [mode='OR'] - Match mode
 * @returns {boolean}
 */
export function filterByMultiSelect(item: Object, selected: any[], dataKey: string, mode?: "OR" | "AND"): boolean;
/**
 * Checks if an item matches a date range filter
 * @param {Object} item - Data item
 * @param {{startDate?: string, endDate?: string}} dateRange - Date range (with startDate/endDate strings)
 * @param {string} dataKey - Field name in data
 * @returns {boolean}
 */
export function filterByDateRange(item: Object, dateRange: {
    startDate?: string;
    endDate?: string;
}, dataKey: string): boolean;
/**
 * Checks if an item matches a search query
 * @param {Object} item - Data item
 * @param {string} query - Search query
 * @returns {boolean}
 */
export function filterBySearch(item: Object, query: string): boolean;
/**
 * Applies all filters to data based on filter configuration
 * @param {any[]} data - Data array
 * @param {Record<string, any>} filterValues - Filter values object (keyed by filter ID)
 * @param {Array<{type: string, dataKey?: string, label: string}>} filterConfig - Filter configuration
 * @param {string} [dateField='date'] - Date field name for date range filters
 * @returns {any[]} Filtered data
 */
export function applyFilters(data: any[], filterValues: Record<string, any>, filterConfig: Array<{
    type: string;
    dataKey?: string;
    label: string;
}>, dateField?: string): any[];
