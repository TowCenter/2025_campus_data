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

	import { highlight } from './search-highlight.js';

	const highlighted = $derived.by(() => {
		const extra = Array.isArray(searchTerms) && searchTerms.length
			? searchTerms.filter(Boolean).join(' ')
			: '';
		const combined = [searchQuery, extra].filter(Boolean).join(' ').trim();
		return highlight(text, combined);
	});
</script>

{@html highlighted}

<style>
	:global(mark) {
		background-color: #ffeb3b;
		padding: 0;
		border-radius: 2px;
		font-weight: 600;
		color: #1a1a1a;
	}
</style>
