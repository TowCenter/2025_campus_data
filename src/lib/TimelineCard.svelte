<script>
	import { onDestroy } from 'svelte';
	
	/** @type {{ date?: string, dateKey?: string, title?: string, description?: string, platform?: string | string[], category?: string[], links?: any[], searchQuery?: string, filterValues?: Record<string, any> }} */
	let { 
		date = '',
		dateKey = '',
		title = '',
		description = '',
		platform = [],
		category = [],
		links = [],
		searchQuery = '',
		filterValues = {}
	} = $props();

	// Normalize platform to always be an array
	const platformArray = $derived(Array.isArray(platform) ? platform : [platform].filter(Boolean));
	
	// Get selected platforms and categories from filterValues
	const selectedPlatforms = $derived(filterValues['filter-Platform'] || []);
	const selectedCategories = $derived(filterValues['filter-Category'] || []);
	
	// Use Set for faster lookups
	const selectedPlatformsSet = $derived(new Set(selectedPlatforms));
	const selectedCategoriesSet = $derived(new Set(selectedCategories));
	
	// Check if a platform tag is selected
	function isPlatformSelected(platformTag) {
		return selectedPlatforms.length > 0 && selectedPlatformsSet.has(platformTag);
	}
	
	// Check if a category tag is selected
	function isCategorySelected(categoryTag) {
		return selectedCategories.length > 0 && selectedCategoriesSet.has(categoryTag);
	}

	// Cache for highlighted text to avoid re-computation - instance-level to prevent leaks
	const highlightCache = new Map();
	
	// Function to extract search terms from query (handles AND/OR logic)
	function extractSearchTerms(query) {
		if (!query || !query.trim()) return [];
		
		const uc = query.toUpperCase();
		
		// Handle AND logic
		if (uc.includes(' AND ')) {
			return query.split(/\s+AND\s+/i).map(t => t.trim()).filter(Boolean);
		}
		
		// Handle OR logic
		if (uc.includes(' OR ')) {
			return query.split(/\s+OR\s+/i).map(t => t.trim()).filter(Boolean);
		}
		
		// Single term
		return [query.trim()].filter(Boolean);
	}

	// Escape HTML in the original text
	function escapeHtml(str) {
		if (!str) return '';
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	// Escape special regex characters
	function escapeRegex(str) {
		return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	// Function to highlight matching text
	function highlightText(text, query) {
		if (!query || !text) return text;
		
		// Use cache key based on text and query
		const cacheKey = `${text}|${query}`;
		if (highlightCache.has(cacheKey)) {
			return highlightCache.get(cacheKey);
		}
		
		const terms = extractSearchTerms(query);
		if (terms.length === 0) {
			highlightCache.set(cacheKey, text);
			return text;
		}
		
		let highlighted = escapeHtml(text);
		
		// Highlight each term (case-insensitive) - use single pass with combined regex for better performance
		const allTerms = terms.map(term => escapeRegex(term)).join('|');
		if (allTerms) {
			const regex = new RegExp(`(${allTerms})`, 'gi');
			highlighted = highlighted.replace(regex, '<mark class="search-highlight">$1</mark>');
		}
		
		// Limit cache size to prevent memory bloat
		if (highlightCache.size > 1000) {
			const firstKey = highlightCache.keys().next().value;
			highlightCache.delete(firstKey);
		}
		
		highlightCache.set(cacheKey, highlighted);
		return highlighted;
	}

	const highlightedDescription = $derived(searchQuery ? highlightText(description, searchQuery) : description);

	onDestroy(() => {
		// Clear cache to prevent memory leaks
		highlightCache.clear();
	});
</script>

<div class="timeline-card">
	<div class="card-content">
		<div class="card-main">
			{#if dateKey}
				<div class="card-date-mobile">
					<span class="date-month-day">{dateKey.split(',')[0]}</span>
					<span class="date-year">{dateKey.split(',')[1]}</span>
				</div>
			{/if}
			<p class="card-description">{@html highlightedDescription}</p>

			{#if links && links.length > 0}
				<div class="card-links">
					<span class="links-label">Read More</span>
					<ul class="links-list">
						{#each links as link}
							<li>
								<a
									class="link-item"
									href={link.url}
									target="_blank"
									rel="noopener noreferrer"
									title={link.url}
								>
									{link.text || link.url}
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</div>

		<div class="card-meta">
			{#if platformArray.length > 0}
				<div class="meta-section">
					<span class="meta-label">Platform</span>
					<div class="tag-list">
						{#each platformArray as p}
							<span class="tag platform-tag" class:selected={isPlatformSelected(p)}>{p}</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if category && category.length > 0}
				<div class="meta-section">
					<span class="meta-label">Categories</span>
					<div class="tag-list">
						{#each category as cat}
							<span class="tag category-tag" class:selected={isCategorySelected(cat)}>{cat}</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.timeline-card {
		width: 95%;
		max-width: 95%;
		padding: 1.5rem;
		border: 1px solid #e0e0e0;
		background-color: white;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1rem;
		transition: background-color 0.2s ease;
	}

	.timeline-card:hover {
		background-color: #fafafa;
	}

	.card-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	@media (min-width: 768px) {
		.card-content {
			flex-direction: row;
			gap: 1.25rem;
		}

		.card-main {
			flex: 2;
		}

		.card-meta {
			flex: 1;
			border-left: 1px solid #e0e0e0;
			padding-left: 1rem;
		}
	}

	.card-main {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-title {
		font-size: calc(1.3rem + 0.6vw);
		font-weight: bolder;
		color: #254c6f;
		margin: 0;
		line-height: 1.2;
		: inherit;
	}

	.card-description {
		font-size: 0.9rem;
		line-height: 1.4;
		color: #1a1a1a;
		margin: 0;
		: inherit;
	}

	.search-highlight {
		background-color: #fff3cd;
		padding: 0.1em 0.2em;
		border-radius: 2px;
		font-weight: 500;
	}

	.card-links {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding-top: 0.5rem;
		margin-top: 0.25rem;
	}

	.links-label {
		font-size: 0.7rem;
		: inherit;
		font-weight: 400;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.links-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.link-item {
		font-size: 0.85rem;
		color: #254c6f;
		text-decoration: none;
		transition: color 0.2s ease;
		: inherit;
	}

	.link-item:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.card-meta {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.meta-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.meta-label {
		display: block;
		font-size: 0.7rem;
		: inherit;
		font-weight: 400;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.tag {
		font-size: 0.7rem;
		: inherit;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-weight: 400;
		display: inline-block;
		background-color: #f0f0f0;
		border: none;
		color: #333;
		transition: all 0.2s ease;
	}

	.category-tag {
		background-color: #f0f0f0;
		color: #333;
	}

	.platform-tag {
		background-color: #f0f0f0;
		color: #333;
	}

	.tag.selected {
		background-color: #fff3cd;
		color: #333;
		font-weight: 500;
	}

	.card-date-mobile {
		display: none;
	}

	@media (max-width: 768px) {
		.timeline-card {
			padding: 0.75rem;
			width: 100%;
			max-width: 100%;
			margin: 0.5rem 0;
		}

		.card-title {
			font-size: 1.1rem;
		}

		.card-description {
			font-size: 0.85rem;
		}
		
		.card-date-mobile {
			display: flex;
			flex-direction: column;
			gap: 0.2rem;
			margin-bottom: 0.75rem;
			padding-bottom: 0.75rem;
			border-bottom: 1px solid #e0e0e0;
		}
		
		.card-date-mobile .date-month-day {
			font-size: 0.875rem;
			font-weight: 500;
			color: #333;
			line-height: 1.2;
		}
		
		.card-date-mobile .date-year {
			font-size: 0.75rem;
			font-weight: 400;
			color: #666;
			line-height: 1.2;
		}
	}
</style>
