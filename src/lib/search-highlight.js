export const escapeRegExp = (string) => String(string || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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

	const parts = tokens.map((token) => {
		const escaped = escapeRegExp(token);
		return /^[a-z0-9]+$/i.test(token) ? `\\b${escaped}\\b` : escaped;
	});

	return new RegExp(`(${parts.join('\\s+')})`, flags);
};

export const highlight = (text, term) => {
	if (!text) return '';
	const quotedPhrase = getQuotedPhrase(term);
	if (quotedPhrase) {
		const phraseRegex = buildPhraseRegex(quotedPhrase, 'gi');
		const tokenRegex = buildExactTokenRegex(quotedPhrase, 'gi');
		const chosenRegex = phraseRegex || tokenRegex;
		if (!chosenRegex) return escapeHtml(text);

		const parts = String(text).split(chosenRegex);
		return parts
			.map((part, i) =>
				i % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)
			)
			.join('');
	}

	const phraseRegex = buildPhraseRegex(term, 'gi');
	const tokenRegex = buildExactTokenRegex(term, 'gi');
	if (!tokenRegex) return escapeHtml(text);

	let chosenRegex = tokenRegex;
	if (phraseRegex) {
		phraseRegex.lastIndex = 0;
		if (phraseRegex.test(String(text))) {
			chosenRegex = phraseRegex;
		}
		phraseRegex.lastIndex = 0;
	}

	const parts = String(text).split(chosenRegex);

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

	const phraseRegex = buildPhraseRegex(term, 'i');
	const tokenRegex = buildExactTokenRegex(term, 'i');
	const minContext = 30;

	if (!phraseRegex && !tokenRegex) {
		return leadingSnippet();
	}

	const collectMatches = (regex) => {
		if (!regex) return [];
		const flags = regex.flags.includes('g') ? regex.flags : `${regex.flags}g`;
		const globalRegex = new RegExp(regex.source, flags);
		const matches = [];
		let match;
		while ((match = globalRegex.exec(String(content))) !== null) {
			matches.push({ index: match.index, length: match[0].length, text: match[0] });
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

	const phraseMatches = collectMatches(phraseRegex);
	if (phraseMatches.length > 0) {
		const { index, length } = phraseMatches[0];
		let segment = buildSegment(index - context, index + length + context);
		if (segment.length > maxLen) {
			segment = trimToLength(segment, maxLen);
		}
		return segment;
	}

	const tokenMatches = collectMatches(tokenRegex);
	if (!tokenMatches.length) {
		return leadingSnippet();
	}

	const searchTokens = new Set(getSearchTokens(term).map((t) => t.toLowerCase()));

	let tokenContext = Math.min(
		context,
		Math.floor((maxLen / Math.max(tokenMatches.length, 1)) / 2)
	);
	tokenContext = Math.max(minContext, tokenContext);

	let segments = mergeMatchesToSegments(tokenMatches, tokenContext);
	while (segments.length > 1 && tokenContext > minContext) {
		const estimated = estimateLength(segments);
		if (estimated <= maxLen) break;

		const nextContext = Math.max(minContext, Math.floor(tokenContext * 0.75));
		if (nextContext === tokenContext) break;

		tokenContext = nextContext;
		segments = mergeMatchesToSegments(tokenMatches, tokenContext);
	}

	const segmentTokens = segments.map(() => new Set());
	tokenMatches.forEach((m) => {
		const token = m.text ? m.text.toLowerCase() : '';
		if (!searchTokens.has(token)) return;
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
