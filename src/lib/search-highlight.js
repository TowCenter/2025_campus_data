export const escapeRegExp = (string) => String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Parse a search query with boolean operators and quoted phrases
 * Examples:
 *   "funding cut" → { type: 'phrase', value: 'funding cut' }
 *   funding → { type: 'word', value: 'funding' }
 *   "funding cut" OR schools → { type: 'or', terms: [...] }
 *   "funding cut" AND schools → { type: 'and', terms: [...] }
 *   funding budget (no operator) → { type: 'and', terms: [...] } (default AND)
 *
 * @param {string} raw - Raw search query
 * @returns {{ type: string, terms?: Array, value?: string }}
 */
export const parseSearchQuery = (raw) => {
	const input = (raw || '').trim();
	if (!input) return { type: 'empty' };

	// Tokenize: extract quoted phrases and words, preserving AND/OR operators
	const tokens = [];
	let remaining = input;

	while (remaining.length > 0) {
		remaining = remaining.trimStart();
		if (!remaining) break;

		// Check for quoted phrase
		if (remaining.startsWith('"')) {
			const endQuote = remaining.indexOf('"', 1);
			if (endQuote > 1) {
				const phrase = remaining.slice(1, endQuote).trim();
				if (phrase) {
					tokens.push({ type: 'phrase', value: phrase.toLowerCase() });
				}
				remaining = remaining.slice(endQuote + 1);
				continue;
			}
		}

		// Extract next word
		const match = remaining.match(/^(\S+)/);
		if (match) {
			const originalWord = match[1];
			// Check if it's an operator - ONLY when uppercase
			if (originalWord === 'AND') {
				tokens.push({ type: 'operator', value: 'AND' });
			} else if (originalWord === 'OR') {
				tokens.push({ type: 'operator', value: 'OR' });
			} else {
				// Regular word - strip any stray quotes and lowercase
				const cleanWord = originalWord.toLowerCase().replace(/^"+|"+$/g, '');
				if (cleanWord) {
					tokens.push({ type: 'word', value: cleanWord });
				}
			}
			remaining = remaining.slice(match[1].length);
		}
	}

	// Filter out operators at start/end
	while (tokens.length > 0 && tokens[0].type === 'operator') tokens.shift();
	while (tokens.length > 0 && tokens[tokens.length - 1].type === 'operator') tokens.pop();

	if (tokens.length === 0) return { type: 'empty' };

	// Single term (no operators)
	if (tokens.length === 1) {
		return tokens[0];
	}

	// Check if there are any explicit operators
	const hasExplicitOperator = tokens.some(t => t.type === 'operator');

	if (!hasExplicitOperator) {
		// Default: treat multiple terms as AND (require all words)
		const terms = tokens.filter(t => t.type !== 'operator');
		return { type: 'and', terms };
	}

	// Parse with operators - handle AND having higher precedence than OR
	// Split by OR first, then within each OR group, split by AND
	const orGroups = [];
	let currentAndGroup = [];

	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];

		if (token.type === 'operator' && token.value === 'OR') {
			// End current AND group, add to OR groups
			if (currentAndGroup.length > 0) {
				if (currentAndGroup.length === 1) {
					orGroups.push(currentAndGroup[0]);
				} else {
					orGroups.push({ type: 'and', terms: currentAndGroup });
				}
				currentAndGroup = [];
			}
		} else if (token.type === 'operator' && token.value === 'AND') {
			// Continue AND group (just skip the operator)
			continue;
		} else {
			// Term (phrase or word)
			currentAndGroup.push(token);
		}
	}

	// Don't forget the last AND group
	if (currentAndGroup.length > 0) {
		if (currentAndGroup.length === 1) {
			orGroups.push(currentAndGroup[0]);
		} else {
			orGroups.push({ type: 'and', terms: currentAndGroup });
		}
	}

	if (orGroups.length === 0) return { type: 'empty' };
	if (orGroups.length === 1) return orGroups[0];

	return { type: 'or', terms: orGroups };
};

// Common stop words to exclude from highlighting
const STOP_WORDS = new Set([
	'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
	'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
	'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
	'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
	'it', 'its', 'this', 'that', 'these', 'those', 'not', 'no'
]);

/**
 * Get all search terms (words and phrases) for highlighting
 * For quoted phrases, keep them as complete phrases to avoid highlighting individual words
 * @param {string} raw - Raw search query
 * @returns {Array<{type: 'word' | 'phrase', value: string}>}
 */
export const getAllSearchTerms = (raw) => {
	const parsed = parseSearchQuery(raw);
	const terms = [];

	const collectTerms = (node) => {
		if (!node) return;
		if (node.type === 'word') {
			terms.push({ type: 'word', value: node.value });
		} else if (node.type === 'phrase') {
			// If a phrase is a single token (e.g., "visa"), treat it as a word for highlighting/snippets.
			const phraseTokens = getSearchTokens(node.value);
			if (phraseTokens.length <= 1) {
				const token = phraseTokens[0] || node.value;
				if (token) terms.push({ type: 'word', value: token });
			} else {
				// Keep multi-word phrases as complete units - don't break them into individual words
				// This prevents highlighting words like "of" when searching for "Office of Civil Rights"
				terms.push({ type: 'phrase', value: node.value });
			}
		} else if (node.type === 'or' || node.type === 'and') {
			node.terms?.forEach(collectTerms);
		}
	};

	collectTerms(parsed);
	return terms;
};

export const escapeHtml = (str) => {
	if (!str) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
};

export const getSearchTokens = (raw) => {
	return (raw || '')
		.trim()
		.toLowerCase()
		.split(/\s+/)
		.map((t) => t.replace(/^\"+|\"+$/g, ''))
		.filter(Boolean);
};

export const getQuotedPhrase = (raw) => {
	const trimmed = (raw || '').trim();
	const match = trimmed.match(/^\"(.*)\"$/);
	if (!match) return null;
	const phrase = match[1].trim();
	return phrase || null;
};

export const buildExactTokenRegex = (term, flags = 'gi') => {
	const tokens = getSearchTokens(term);
	if (!tokens.length) return null;

	const patterns = tokens.map((token) => {
		const escaped = escapeRegExp(token);
		return /^[a-z0-9]+$/i.test(token) ? `\\b${escaped}\\b` : escaped;
	});

	return new RegExp(`(${patterns.join('|')})`, flags);
};

export const buildPhraseRegex = (term, flags = 'gi') => {
	const tokens = getSearchTokens(term);
	if (tokens.length < 2) return null;

	// For quoted phrases, match the exact phrase with words in order
	// Use word boundaries for each word to ensure exact matching
	const parts = tokens.map((token) => {
		const escaped = escapeRegExp(token);
		return /^[a-z0-9]+$/i.test(token) ? `\\b${escaped}\\b` : escaped;
	});

	// Join with \s+ to match one or more whitespace characters between words
	// This ensures the phrase matches as a contiguous phrase, not individual words
	return new RegExp(`(${parts.join('\\s+')})`, flags);
};

export const highlight = (text, term) => {
	if (!text) return '';

	// Use the new parser to get all search terms (words and phrases)
	const allTerms = getAllSearchTerms(term);
	if (allTerms.length === 0) return escapeHtml(text);

	// Build regex patterns - handle phrases and words differently
	const patterns = [];
	
	// First, add phrase patterns (they take precedence to avoid highlighting individual words)
	const phrasePatterns = allTerms
		.filter(t => t.type === 'phrase')
		.map(t => {
			// For phrases, build a regex that matches the phrase as a whole
			// Extract tokens and build pattern similar to buildPhraseRegex but without the outer capturing group
			const tokens = getSearchTokens(t.value);
			if (tokens.length < 2) return null;
			
			const parts = tokens.map((token) => {
				const escaped = escapeRegExp(token);
				return /^[a-z0-9]+$/i.test(token) ? `\\b${escaped}\\b` : escaped;
			});
			
			// Return pattern without outer capturing group (we'll add it in the final regex)
			return parts.join('\\s+');
		})
		.filter(Boolean);
	
	// Then add word patterns (only for words that aren't part of phrases)
	const wordTerms = allTerms.filter(t => t.type === 'word');
	const wordPatterns = wordTerms.map((token) => {
		const escaped = escapeRegExp(token.value);
		return /^[a-z0-9]+$/i.test(token.value) ? `\\b${escaped}\\b` : escaped;
	});
	
	// Combine patterns - phrases first, then words
	// This ensures phrases are matched before individual words, preventing "of" from being highlighted
	// when searching for "Office of Civil Rights"
	const allPatterns = [...phrasePatterns, ...wordPatterns];
	if (allPatterns.length === 0) return escapeHtml(text);
	
	// Create a regex that matches phrases first, then individual words
	// The capturing group is needed for split() to work correctly
	const regex = new RegExp(`(${allPatterns.join('|')})`, 'gi');

	const parts = String(text).split(regex);

	return parts
		.map((part, i) =>
			i % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)
		)
		.join('');
};

export const getSnippet = (content, term, maxLen = 240, context = 100) => {
	if (!content) return '';

	const leadingSnippet = () => {
		let text = String(content).slice(0, maxLen);
		const lastSpace = text.lastIndexOf(' ');
		if (lastSpace > 0 && String(content).length > maxLen) {
			text = text.slice(0, lastSpace);
			return text + '...';
		}
		return String(content).length > maxLen ? text + '...' : text;
	};

	const terms = getAllSearchTerms(term);
	const phraseTerms = terms.filter((t) => t.type === 'phrase').map((t) => t.value);
	const wordTerms = terms.filter((t) => t.type === 'word').map((t) => t.value);
	const phraseRegexes = phraseTerms
		.map((phrase) => buildPhraseRegex(phrase, 'i'))
		.filter(Boolean);
	const tokenRegex = wordTerms.length > 0
		? buildExactTokenRegex(wordTerms.join(' '), 'i')
		: null;
	const minContext = 30;

	if (phraseRegexes.length === 0 && !tokenRegex) {
		return leadingSnippet();
	}

	const collectMatches = (regex, tokenKey = null) => {
		if (!regex) return [];
		const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
		const globalRegex = new RegExp(regex.source, flags);
		const matches = [];
		let match;
		while ((match = globalRegex.exec(String(content))) !== null) {
			const key = tokenKey || (match[0] ? match[0].toLowerCase() : '');
			matches.push({ index: match.index, length: match[0].length, text: match[0], tokenKey: key });
			if (match[0].length === 0) {
				globalRegex.lastIndex += 1;
			}
		}
		return matches;
	};

	const adjustWindow = (start, end) => {
		let s = Math.max(0, start);
		let e = Math.min(String(content).length, end);

		if (s > 0) {
			const prevSpace = String(content).lastIndexOf(' ', s);
			if (prevSpace !== -1) s = prevSpace + 1;
		}

		if (e < String(content).length) {
			const nextSpace = String(content).indexOf(' ', e);
			if (nextSpace !== -1) e = nextSpace;
		}

		return { start: s, end: e };
	};

	const buildSegment = (start, end, allowLeadingEllipsis = true, allowTrailingEllipsis = true) => {
		const { start: s, end: e } = adjustWindow(start, end);
		let segment = String(content).slice(s, e);
		if (s > 0 && allowLeadingEllipsis) segment = '...' + segment;
		if (e < String(content).length && allowTrailingEllipsis) segment = segment + '...';
		return segment;
	};

	const trimToLength = (text, limit) => {
		if (text.length <= limit) return text;
		let trimmed = text.slice(0, Math.max(0, limit - 1));
		const lastSpace = trimmed.lastIndexOf(' ');
		if (lastSpace > 0 && lastSpace > trimmed.length - 20) {
			trimmed = trimmed.slice(0, lastSpace);
		}
		return trimmed.replace(/\.{0,3}$/, '') + '...';
	};

	const mergeMatchesToSegments = (matches, ctx) => {
		const sorted = [...matches].sort((a, b) => a.index - b.index);
		const merged = [];

		let currentStart = sorted[0].index - ctx;
		let currentEnd = sorted[0].index + sorted[0].length + ctx;

		for (let i = 1; i < sorted.length; i++) {
			const m = sorted[i];
			const windowStart = m.index - ctx;
			const windowEnd = m.index + m.length + ctx;

			if (windowStart <= currentEnd) {
				currentEnd = Math.max(currentEnd, windowEnd);
			} else {
				merged.push(adjustWindow(currentStart, currentEnd));
				currentStart = windowStart;
				currentEnd = windowEnd;
			}
		}

		merged.push(adjustWindow(currentStart, currentEnd));
		return merged;
	};

	const estimateLength = (segments) =>
		segments.reduce((sum, seg, idx) => {
			const len = seg.end - seg.start;
			const leading = seg.start > 0 ? 1 : 0;
			const trailing = seg.end < String(content).length ? 1 : 0;
			const spacer = idx > 0 ? 1 : 0;
			return sum + len + leading + trailing + spacer;
		}, 0);

	const desiredTokens = new Set();
	phraseTerms.forEach((phrase) => desiredTokens.add(`phrase:${phrase}`));
	wordTerms.forEach((word) => desiredTokens.add(word.toLowerCase()));

	const matches = [];
	phraseTerms.forEach((phrase) => {
		const regex = buildPhraseRegex(phrase, 'i');
		if (!regex) return;
		matches.push(...collectMatches(regex, `phrase:${phrase}`));
	});

	if (tokenRegex) {
		matches.push(...collectMatches(tokenRegex));
	}

	if (matches.length === 0) {
		return leadingSnippet();
	}

	let tokenContext = Math.min(
		context,
		Math.floor((maxLen / Math.max(matches.length, 1)) / 2)
	);
	tokenContext = Math.max(minContext, tokenContext);

	let segments = mergeMatchesToSegments(matches, tokenContext);
	while (segments.length > 1 && tokenContext > minContext) {
		const estimated = estimateLength(segments);
		if (estimated <= maxLen) break;

		const nextContext = Math.max(minContext, Math.floor(tokenContext * 0.75));
		if (nextContext === tokenContext) break;

		tokenContext = nextContext;
	segments = mergeMatchesToSegments(matches, tokenContext);
	}

	const segmentTokens = segments.map(() => new Set());
	matches.forEach((m) => {
		const token = m.tokenKey || '';
		if (!token || !desiredTokens.has(token)) return;
		const segIdx = segments.findIndex((seg) => m.index >= seg.start && m.index <= seg.end);
		if (segIdx !== -1) {
			segmentTokens[segIdx].add(token);
		}
	});

	const prioritized = [];
	const extras = [];
	const covered = new Set();
	segments.forEach((seg, idx) => {
		const tokens = segmentTokens[idx];
		const hasNew = Array.from(tokens).some((t) => !covered.has(t));
		if (hasNew) {
			tokens.forEach((t) => covered.add(t));
			prioritized.push({ seg, idx });
		} else {
			extras.push({ seg, idx });
		}
	});

	const orderedSegments = [...prioritized, ...extras];

	let remaining = maxLen;
	const parts = [];

	for (let i = 0; i < orderedSegments.length && remaining > 0; i++) {
		const { seg } = orderedSegments[i];
		const separator = parts.length ? ' ' : '';
		const available = remaining - separator.length;
		if (available <= 0) break;

		let segmentText = buildSegment(seg.start, seg.end, true, true);
		if (segmentText.length > available) {
			segmentText = trimToLength(segmentText, available);
		}

		if (!segmentText) continue;

		parts.push(segmentText);
		remaining -= segmentText.length + separator.length;
	}

	return parts.length ? parts.join(' ') : leadingSnippet();
};
