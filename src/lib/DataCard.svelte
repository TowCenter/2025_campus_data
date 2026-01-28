<script>
	import { onDestroy } from 'svelte';
	
	/**
	 * @typedef {Object} Props
	 * @property {any} item - Data item
	 * @property {string} [dateKey=''] - Formatted date key for timeline (e.g., "January 15, 2025")
	 * @property {string} [searchQuery=''] - Search query for highlighting
	 * @property {Record<string, any>} [filterValues={}] - Filter values for highlighting
	 * @property {number} [index=0] - Card index for unique ID
	 */

	/** @type {Props} */
	let { 
		item,
		dateKey = '',
		searchQuery = '',
		filterValues = {},
		index = 0
	} = $props();

	// Generate unique card ID
	const cardId = $derived(`${dateKey}-${index}-${item?.date || ''}`);

	// Check if card should be expanded (auto-expand only when search is active)
	const shouldAutoExpand = $derived(() => {
		const hasSearch = searchQuery && searchQuery.trim().length > 0;
		return hasSearch;
	});

	// Card expanded state - auto-expand only if search is active
	let isExpanded = $state(shouldAutoExpand());

	// Update expanded state when search changes
	$effect(() => {
		if (shouldAutoExpand()) {
			isExpanded = true;
		}
	});

	function toggleExpand() {
		isExpanded = !isExpanded;
	}

	function handleCardContentClick(event) {
		// Check if text is currently selected/highlighted
		const selection = window.getSelection();
		if (selection && selection.toString().trim().length > 0) {
			return; // Don't collapse if text is selected
		}
		
		// Don't collapse if clicking on links or the collapse button
		const target = event.target;
		if (target.tagName === 'A' || target.closest('a') || target.closest('.collapse-button')) {
			return; // Let links and collapse button work normally
		}
		// Collapse the card when clicking anywhere else
		toggleExpand();
	}

	// Format date for display
	function formatDate(dateStr) {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return dateStr;
			return date.toLocaleDateString('en-US', { 
				year: 'numeric', 
				month: 'short', 
				day: 'numeric' 
			});
		} catch (e) {
			return dateStr;
		}
	}

	// Normalize org to always be an array
	const orgArray = $derived(Array.isArray(item?.org) ? item.org : (item?.org ? [item.org] : []).filter(Boolean));
	
	// Get selected organizations from filterValues
	const selectedOrgs = $derived(filterValues['filter-Organization'] || []);
	
	// Use Set for faster lookups
	const selectedOrgsSet = $derived(new Set(selectedOrgs));
	
	// Check if an org tag is selected
	function isOrgSelected(orgTag) {
		return selectedOrgs.length > 0 && selectedOrgsSet.has(orgTag);
	}

	// Generate a unique color for an organization name
	function getOrgColor(orgName) {
		if (!orgName) return '#f0f0f0';
		
		// Hash the organization name to get a consistent color
		let hash = 0;
		for (let i = 0; i < orgName.length; i++) {
			hash = orgName.charCodeAt(i) + ((hash << 5) - hash);
		}
		
		// Generate a muted, subtle color
		// Use HSL with lower saturation and higher lightness for softer colors
		const hue = Math.abs(hash) % 360;
		const saturation = 15 + (Math.abs(hash) % 10); // 15-25% (muted)
		const lightness = 85 + (Math.abs(hash) % 10); // 85-95% (very light)
		
		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	}

	// Get text color (dark gray for light backgrounds)
	function getOrgTextColor(orgName) {
		if (!orgName) return '#333';
		// Since backgrounds are very light (85-95%), always use dark text
		return '#333';
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

	const description = item?.description || '';
	const highlightedDescription = $derived(searchQuery ? highlightText(description, searchQuery) : description);
	const highlightedTitle = $derived(item?.title ? highlightText(item.title, searchQuery) : '');

	onDestroy(() => {
		// Clear cache to prevent memory leaks
		highlightCache.clear();
	});
</script>

<div class="card" class:collapsed={!isExpanded}>
	<!-- Collapsed Header -->
	{#if !isExpanded}
		<div 
			class="card-header"
			onclick={toggleExpand}
			role="button"
			tabindex="0"
			onkeydown={(e) => e.key === 'Enter' && toggleExpand()}
		>
		<div class="header-content">
			<div class="header-left">
				{#if item?.title}
					<div class="header-item">{@html highlightedTitle}</div>
				{/if}
			</div>
			<div class="header-right-content">
				{#if orgArray.length > 0}
					<div class="header-tags">
						{#each orgArray as org}
							<span 
								class="header-tag" 
								style="background-color: {getOrgColor(org)}; color: {getOrgTextColor(org)};"
							>{@html highlightText(org, searchQuery)}</span>
						{/each}
					</div>
				{/if}
			</div>
		</div>
			<div class="header-right">
				<span class="expand-icon">{isExpanded ? '−' : '+'}</span>
			</div>
		</div>
	{/if}
	
	<!-- Expanded Content -->
	{#if isExpanded}
		<div class="card-content" onclick={handleCardContentClick}>
			<div class="collapse-button" onclick={(e) => { e.stopPropagation(); toggleExpand(); }} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleExpand()}>
				<span class="expand-icon">−</span>
			</div>
			<div class="card-main">
				{#if dateKey}
					<div class="card-date-mobile">
						<span class="date-month-day">{dateKey.split(',')[0]}</span>
						<span class="date-year">{dateKey.split(',')[1]}</span>
					</div>
				{/if}
				{#if item?.title}
					<h3 class="card-title">
						{#if item.url}
							<a href={item.url} target="_blank" rel="noopener noreferrer">
								{@html highlightedTitle}
							</a>
						{:else}
							{@html highlightedTitle}
						{/if}
					</h3>
				{/if}
				<p class="card-description">{@html highlightedDescription}</p>
			</div>

			<div class="card-meta">
				{#if orgArray.length > 0}
					<div class="meta-section">
						<span class="meta-label">Organization</span>
							<div class="tag-list">
								{#each orgArray as org}
									<span 
										class="tag org-tag" 
										class:selected={isOrgSelected(org)}
										style="background-color: {isOrgSelected(org) ? '#fff3cd' : getOrgColor(org)}; color: {isOrgSelected(org) ? '#333' : getOrgTextColor(org)};"
									>{@html highlightText(org, searchQuery)}</span>
								{/each}
							</div>
					</div>
				{/if}

				{#if item?.links && item.links.length > 0}
					<div class="card-links">
						<span class="links-label">Read More</span>
						<ul class="links-list">
							{#each item.links as link}
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
		</div>
	{/if}
</div>

<style>
	.card {
		width: 95%;
		max-width: 95%;
		background-color: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 0;
		box-shadow: none;
		transition: background-color 0.2s ease;
		display: flex;
		flex-direction: column;
		margin: 0.25rem 0;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
	}

	.card.collapsed {
		background-color: #f5f5f5 !important;
	}

	.card:not(.collapsed) {
		background-color: #ffffff;
	}

	/* Remove hover effect on expanded cards */
	.card:not(.collapsed):hover {
		background-color: #ffffff;
	}

	/* Collapsed Header */
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.75rem 1.2rem;
		background-color: #fafafa;
		color: #333;
		font-weight: 600;
		font-size: 0.8rem;
		letter-spacing: 0.5px;
		border-radius: 0;
		cursor: pointer;
		user-select: none;
		transition: background-color 0.2s ease;
		position: relative;
	}

	.card-header:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.card-header > .header-date {
		position: absolute;
		left: 1.2rem;
		top: 0.75rem;
		line-height: 1.5;
		font-size: 0.65rem;
		color: #666;
		font-weight: 500;
		white-space: nowrap;
	}

	.header-content {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.75rem;
		flex: 1;
		min-width: 0;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
		align-items: flex-start;
	}

	.header-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		align-items: center;
		justify-content: flex-end;
	}

	.header-tag {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		font-size: 0.7rem;
		font-weight: 500;
		background-color: #f0f0f0;
		color: #333;
		line-height: 1.4;
		white-space: nowrap;
	}

	.header-right-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex-shrink: 0;
		min-width: 200px;
		max-width: 200px;
		align-items: flex-end;
		margin-left: auto;
	}

	.header-item {
		font-weight: 400;
		font-size: 0.75rem;
		line-height: 1.5;
		color: #333;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-shrink: 0;
		flex-direction: row;
		justify-content: flex-end;
		align-self: flex-start;
	}

	.expand-icon {
		font-size: 1.2rem;
		font-weight: 300;
		line-height: 1.2;
		width: 1.5rem;
		text-align: center;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.2s ease;
		flex-shrink: 0;
		margin: 0;
		padding: 0;
		color: #666;
	}

	/* Expanded Content */
	.card-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.5rem;
		position: relative;
		cursor: pointer;
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

	.collapse-button {
		position: absolute;
		top: 0.5rem;
		right: 1rem;
		cursor: pointer;
		user-select: none;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.collapse-button:hover {
		background-color: #f5f5f5;
	}

	.collapse-button .expand-icon {
		font-size: 1rem;
		color: #666;
	}

	.card-main {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.card-title {
		margin: 0;
		font-size: 1.25rem;
		line-height: 1.4;
		font-weight: 600;
		color: #1a1a1a;
	}

	.card-title a {
		color: #254c6f;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.card-title a:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.card-description {
		font-size: 0.9rem;
		line-height: 1.4;
		color: #1a1a1a;
		margin: 0;
		font-family: Lyon Text Web;
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
		font-family: Lyon Text Web;
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

	.org-tag {
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
		.card {
			padding: 0;
			width: 100%;
			max-width: 100%;
			margin: 0.5rem 0;
		}

		.card-header {
			padding: 0.5rem 0.5rem 0.5rem 0 !important;
			flex-wrap: wrap;
			gap: 0.5rem;
			flex-direction: column;
		}

		.header-right {
			flex-direction: row;
			align-items: center;
			gap: 0.5rem;
			width: 100%;
			justify-content: flex-start;
			order: -1;
			margin-bottom: 0.5rem;
			padding-bottom: 0.5rem;
			border-bottom: 1px solid #e0e0e0;
			margin-left: 0;
			padding-left: 0;
		}

		.header-content {
			gap: 0;
			margin-left: 0 !important;
			margin-bottom: 0;
			padding-left: 0;
			width: 100%;
			order: 1;
			flex-direction: column;
		}

		.header-left {
			width: 100%;
			padding-bottom: 0.5rem;
			border-bottom: none;
			margin-bottom: 0.5rem;
			margin-left: 0;
			padding-left: 0;
		}

		.card-header .header-left::before {
			content: 'Title';
			display: block;
			font-size: 0.65rem;
			font-weight: 500;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: #666;
			margin-bottom: 0.25rem;
		}

		.header-left .header-item {
			font-weight: 400;
			font-size: 0.85rem;
		}

		.header-right-content {
			width: 100%;
			padding-top: 0;
			margin-left: 0;
			padding-left: 0;
			min-width: 0;
			max-width: 100%;
			align-items: flex-start;
		}

		.card-header .header-right-content::before {
			content: 'Organization';
			display: block;
			font-size: 0.65rem;
			font-weight: 500;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: #666;
			margin-bottom: 0.25rem;
		}

		.header-right-content .header-item {
			font-weight: 600;
			font-size: 0.85rem;
		}

		.header-tags {
			justify-content: flex-start;
		}

		.card-content {
			display: flex !important;
			flex-direction: column !important;
			padding: 0.5rem 0.5rem 0.5rem 0;
		}

		.card-main {
			padding: 0 !important;
			margin: 0 !important;
			padding-bottom: 1rem !important;
		}

		.card-meta {
			padding: 0 !important;
			margin: 0 !important;
			padding-left: 0 !important;
			padding-right: 0 !important;
			padding-top: 1rem !important;
			border-left: none !important;
			border-top: 1px solid #e0e0e0;
			width: 100%;
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
