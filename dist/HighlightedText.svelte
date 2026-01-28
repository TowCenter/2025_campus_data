<script>
	/**
	 * @typedef {Object} Props
	 * @property {any} text - Text to display and highlight
	 * @property {string} [searchQuery=''] - Search query to highlight
	 * @property {string[]} [searchTerms=[]] - Additional search terms to highlight
	 */
	
	/** @type {Props} */
	let { 
		text = '',
		searchQuery = '',
		searchTerms = []
	} = $props();

	/**
	 * Escapes HTML to prevent XSS attacks
	 * @param {string} text - Text to escape
	 * @returns {string} Escaped HTML
	 */
	function escapeHtml(text) {
		return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	/**
	 * Highlights matching text in search results
	 * @param {any} text - Text to highlight
	 * @param {string[]} searchTerms - Additional search terms
	 * @returns {string} HTML string with highlighted matches
	 */
	function highlightText(text, searchTerms = []) {
		if (!text) return '';

		// Build search patterns
		const searchPatterns = [];
		if (searchQuery?.trim()) {
			searchPatterns.push(searchQuery.trim());
		}
		if (searchTerms.length > 0) {
			searchPatterns.push(...searchTerms);
		}

		// If no patterns, just escape and return
		if (searchPatterns.length === 0) {
			return escapeHtml(text);
		}

		// Escape HTML first to prevent XSS
		const escapedText = escapeHtml(text);
		
		// Escape special regex characters and create pattern
		const escapedPatterns = searchPatterns
			.filter(p => p && String(p).trim())
			.map(p => String(p).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		
		if (escapedPatterns.length === 0) {
			return escapedText;
		}

		const pattern = new RegExp(`(${escapedPatterns.join('|')})`, 'gi');
		const parts = escapedText.split(pattern);
		
		return parts.map(part => {
			if (escapedPatterns.some(p => new RegExp(`^${p}$`, 'i').test(part))) {
				return `<mark class="highlight">${part}</mark>`;
			}
			return part;
		}).join('');
	}

	const highlighted = $derived(highlightText(text, searchTerms));
</script>

{@html highlighted}

<style>
	:global(.highlight) {
		background-color: #ffeb3b;
		padding: 0;
		border-radius: 2px;
		font-weight: 600;
		color: #1a1a1a;
	}
</style>

