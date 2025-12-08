/**
 * Date parsing and formatting utilities
 */

// Cache for parsed dates
const parseDateCache = new Map();

/**
 * Memoization helper for functions with primitive parameters
 */
function memoizePrimitive(fn, cache, maxSize = 1000) {
	return function(...args) {
		const key = JSON.stringify(args);
		if (cache.has(key)) {
			return cache.get(key);
		}
		const result = fn.apply(this, args);
		cache.set(key, result);
		if (cache.size > maxSize) {
			const firstKey = cache.keys().next().value;
			cache.delete(firstKey);
		}
		return result;
	};
}

/**
 * Parses a date string to a Date object
 */
function parseDateImpl(dateStr) {
	if (!dateStr) return new Date(0);
	const str = String(dateStr).trim();
	const [year, month, day] = str.split('-');
	if (year && month && day) {
		return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
	}
	return new Date(str);
}

export const parseDate = memoizePrimitive(parseDateImpl, parseDateCache, 500);

/**
 * Groups items by month and year
 */
export function groupByMonth(items) {
	const groups = {};
	items.forEach((item) => {
		if (!item.date) return;
		const dateObj = parseDate(item.date);
		if (isNaN(dateObj.getTime())) return;
		const key = `${dateObj.toLocaleString('default', {
			month: 'long'
		})} ${dateObj.getFullYear()}`;
		groups[key] = groups[key] || [];
		groups[key].push(item);
	});

	// Sort items within each group by date descending
	Object.keys(groups).forEach(key => {
		groups[key].sort((a, b) => {
			const aDate = parseDate(a.date);
			const bDate = parseDate(b.date);
			return bDate.getTime() - aDate.getTime();
		});
	});

	// Sort groups by date descending (newest first)
	const sortedGroups = {};
	Object.keys(groups)
		.sort((a, b) => {
			const firstItemA = groups[a][0];
			const firstItemB = groups[b][0];
			if (!firstItemA || !firstItemB) return 0;
			const dateA = parseDate(firstItemA.date);
			const dateB = parseDate(firstItemB.date);
			return dateB.getTime() - dateA.getTime();
		})
		.forEach((key) => {
			sortedGroups[key] = groups[key];
		});

	return sortedGroups;
}

