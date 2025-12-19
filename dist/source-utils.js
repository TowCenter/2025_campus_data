/**
 * Source URL processing utilities
 */

// Cache for normalized sources to avoid re-processing
const sourceCache = new Map();
const getHostnameCache = new Map();
const archiveInfoCache = new Map();
const sourceDisplayTextCache = new Map();

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
		// Limit cache size to prevent memory issues
		if (cache.size > maxSize) {
			const firstKey = cache.keys().next().value;
			cache.delete(firstKey);
		}
		return result;
	};
}

function getHostnameImpl(url) {
	try {
		return new URL(url).hostname.replace('www.', '');
	} catch (e) {
		return url;
	}
}

export const getHostname = memoizePrimitive(getHostnameImpl, getHostnameCache, 500);

/**
 * Check if URL is an Archive.org URL and extract the original URL
 */
function getArchiveInfoImpl(url) {
	try {
		const archivePattern = /^https?:\/\/web\.archive\.org\/web\/\d+\/(.+)$/;
		const match = url.match(archivePattern);
		if (match && match[1]) {
			return {
				isArchive: true,
				originalUrl: match[1],
				archiveUrl: url
			};
		}
	} catch (e) {
		// Not an archive URL or parsing failed
	}
	return {
		isArchive: false,
		originalUrl: null,
		archiveUrl: url
	};
}

export const getArchiveInfo = memoizePrimitive(getArchiveInfoImpl, archiveInfoCache, 500);

/**
 * Get display text for a source URL
 */
function getSourceDisplayTextImpl(url) {
	const archiveInfo = getArchiveInfo(url);
	if (archiveInfo.isArchive) {
		// For archives, show the hostname of the original URL
		try {
			return new URL(archiveInfo.originalUrl).hostname.replace('www.', '');
		} catch (e) {
			// If URL parsing fails, try to extract hostname manually
			const urlMatch = archiveInfo.originalUrl.match(/https?:\/\/([^\/]+)/);
			if (urlMatch && urlMatch[1]) {
				return urlMatch[1].replace('www.', '');
			}
			return archiveInfo.originalUrl;
		}
	} else {
		// For regular URLs, show the hostname
		return getHostname(url);
	}
}

export const getSourceDisplayText = memoizePrimitive(getSourceDisplayTextImpl, sourceDisplayTextCache, 500);

function cleanUrl(url) {
	if (!url) return url;
	// Remove leading slash if present before http/https
	url = url.replace(/^\/+(https?:\/\/)/, '$1');
	// Remove any trailing slashes or whitespace
	url = url.trim();
	return url;
}

/**
 * Normalizes sources from various formats to an array of URLs
 */
export function normalizeSources(value) {
	if (!value) return [];
	
	// Check cache first
	const cacheKey = typeof value === 'string' ? value : JSON.stringify(value);
	if (sourceCache.has(cacheKey)) {
		return sourceCache.get(cacheKey);
	}
	
	let result;
	if (Array.isArray(value)) {
		result = value
			.filter(s => s && String(s).trim())
			.map(s => cleanUrl(String(s).trim()));
	} else if (typeof value === 'string') {
		const trimmed = value.trim();
		const results = [];
		
		// Step 1: Extract URLs from array format (complete or incomplete)
		// Pattern 1: Complete array format: ['https://...'] or ["https://..."]
		let match;
		const completeArrayPattern = /\[['"](https?:\/\/[^'"]+)['"]/g;
		while ((match = completeArrayPattern.exec(trimmed)) !== null) {
			const url = match[1].trim();
			if (url) {
				const cleaned = cleanUrl(url);
				if (cleaned && !results.includes(cleaned)) {
					results.push(cleaned);
				}
			}
		}
		
		// Pattern 2: Incomplete array format: ['https://... (missing closing quote/bracket)
		const incompleteArrayPattern1 = /\[['"](https?:\/\/[^\s,]+)/g;
		while ((match = incompleteArrayPattern1.exec(trimmed)) !== null) {
			let url = match[1].trim();
			url = url.replace(/['"]+$/, '').replace(/\]$/, '').trim();
			if (url) {
				const cleaned = cleanUrl(url);
				if (cleaned && !results.includes(cleaned)) {
					results.push(cleaned);
				}
			}
		}
		
		// Pattern 2b: More aggressive - match ['https:// and capture everything to end of string
		if (trimmed.includes("['https://") || trimmed.includes('["https://')) {
			const aggressivePattern = /\[['"](https?:\/\/.+?)(?=['"]\]|$)/;
			const aggressiveMatch = trimmed.match(aggressivePattern);
			if (aggressiveMatch) {
				let url = aggressiveMatch[1].trim();
				url = url.replace(/['"]+$/, '').replace(/\]$/, '').trim();
				if (url && !results.some(r => r.includes(url.replace(/^https?:\/\//, '')))) {
					const cleaned = cleanUrl(url);
					if (cleaned && !results.includes(cleaned)) {
						results.push(cleaned);
					}
				}
			}
		}
		
		// Pattern 3: Just the URL in quotes: 'https://...' or "https://..." (with or without closing quote)
		const quotedUrlPattern = /['"](https?:\/\/[^'"]+)['"]?/g;
		while ((match = quotedUrlPattern.exec(trimmed)) !== null) {
			const url = match[1].trim();
			if (url) {
				const cleaned = cleanUrl(url);
				if (cleaned && !results.includes(cleaned)) {
					results.push(cleaned);
				}
			}
		}
		
		// Pattern 3b: URL starting with quote but no closing quote (at end of string or before comma/space)
		const unclosedQuotePattern = /['"](https?:\/\/[^\s,]+)/g;
		while ((match = unclosedQuotePattern.exec(trimmed)) !== null) {
			const url = match[1].trim();
			if (url && !results.some(r => r === url || r.includes(url))) {
				const cleaned = cleanUrl(url);
				if (cleaned && !results.includes(cleaned)) {
					results.push(cleaned);
				}
			}
		}
		
		// Pattern 4: Plain URL starting with http (not in quotes)
		const plainUrlPattern = /(https?:\/\/[^\s,\[\]'"]+)/g;
		while ((match = plainUrlPattern.exec(trimmed)) !== null) {
			const url = match[1] ? match[1].trim() : match[0].trim();
			if (url && url.startsWith('http') && !results.some(r => r === url || r.includes(url))) {
				const cleaned = cleanUrl(url);
				if (cleaned && !results.includes(cleaned)) {
					results.push(cleaned);
				}
			}
		}
		
		// Step 2: Process the remaining string for plain domains
		let remaining = trimmed;
		remaining = remaining.replace(/\[['"](https?:\/\/[^\s,]+)/g, '');
		remaining = remaining.replace(/\[['"](https?:\/\/[^'"]+)['"]/g, '');
		remaining = remaining.replace(/\[['"]?/g, '').replace(/['"]?\]?/g, '');
		
		// Split by comma and process each part for plain domains
		const parts = remaining.split(',');
		for (const part of parts) {
			const cleaned = part.trim();
			if (!cleaned) continue;
			
			if (cleaned === '[' || cleaned === ']' || cleaned === "'" || cleaned === '"' || cleaned.length < 3) {
				continue;
			}
			
			if (cleaned.includes('://') || cleaned.startsWith('www.')) {
				continue;
			}
			
			if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
				const url = cleanUrl(cleaned);
				if (url && !results.includes(url)) {
					results.push(url);
				}
			} else if (cleaned.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/)) {
				const url = `https://${cleaned}`;
				if (!results.includes(url)) {
					results.push(url);
				}
			}
		}
		
		if (results.length > 0) {
			result = results;
		} else {
			// Try to parse as complete JSON array string
			if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
				try {
					let cleaned = trimmed.replace(/,\s*\]$/, ']');
					const jsonStr = cleaned.replace(/'/g, '"');
					const parsed = JSON.parse(jsonStr);
					result = Array.isArray(parsed) 
						? parsed.filter(s => s && String(s).trim()).map(s => cleanUrl(String(s).trim()))
						: [];
				} catch (e) {
					result = [];
				}
			} else {
				const cleaned = cleanUrl(trimmed);
				if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
					result = [cleaned];
				} else if (cleaned.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/)) {
					result = [`https://${cleaned}`];
				} else {
					result = [];
				}
			}
		}
	} else {
		result = [];
	}
	
	// Cache the result
	if (result && result.length > 0) {
		sourceCache.set(cacheKey, result);
		// Limit cache size to prevent memory issues
		if (sourceCache.size > 1000) {
			const firstKey = sourceCache.keys().next().value;
			sourceCache.delete(firstKey);
		}
	}
	
	return result || [];
}

