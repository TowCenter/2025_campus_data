<script>
	import { onDestroy } from 'svelte';
	import { getSnippet } from './search-highlight.js';
	import HighlightedText from './HighlightedText.svelte';
	
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

	// Cards are always expanded (not collapsible)
	const isExpanded = $state(true);

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

	// Generate a muted neutral color for an organization name
	function getOrgColor(orgName) {
		if (!orgName) return '#f5f5f5';
		
		// Use a single muted gray color for all university tags
		// This provides a consistent, less colorful appearance
		return '#f5f5f5';
	}

	// Get text color (dark gray for light backgrounds)
	function getOrgTextColor(orgName) {
		if (!orgName) return '#333';
		// Since backgrounds are very light (85-95%), always use dark text
		return '#333';
	}

	const description = item?.description || '';
	// Use getSnippet to match table's text display (same as DataTableRow)
	const descriptionSnippet = $derived(getSnippet(description, searchQuery));
</script>

<div class="card">
	<!-- Card Content (always expanded) -->
	<div class="card-content">
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
							<HighlightedText text={item.title} {searchQuery} />
							</a>
						{:else}
						<HighlightedText text={item.title} {searchQuery} />
						{/if}
					</h3>
				{/if}
			{#if descriptionSnippet}
				<p class="card-description">
					<HighlightedText text={descriptionSnippet} {searchQuery} />
				</p>
			{/if}
			</div>

			<div class="card-meta">
				{#if orgArray.length > 0}
					<div class="meta-section">
							<div class="tag-list">
								{#each orgArray as org}
									<span 
										class="tag org-tag" 
										style="background-color: {getOrgColor(org)}; color: {getOrgTextColor(org)};"
									>
										<HighlightedText text={org} {searchQuery} />
									</span>
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
</div>

<style>
	.card {
		width: 100%;
		max-width: 100%;
		background-color: #ffffff;
		border: 1px solid #e0e0e0;
		border-radius: 0;
		box-shadow: none;
		transition: background-color 0.2s ease;
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 1.5rem;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
	}

	.card:hover {
		background-color: #fafafa;
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

	/* Card Content */
	.card-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0;
		position: relative;
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
		font-size: 0.82rem;
		line-height: 1.5;
		color: #555;
		margin: 0;
		font-family: inherit;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	:global(.card mark) {
		background-color: #BBDEFB;
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
		font-family: inherit;
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
		font-family: inherit;
	}

	.link-item:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.card-meta {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	.meta-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.meta-label {
		display: block;
		font-size: 0.7rem;
		font-family: inherit;
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
		font-family: inherit;
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

	@media (max-width: 767px) {
		.card {
			padding: 1rem;
			width: 100%;
			max-width: 100%;
			margin: 0;
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
			order: 2; /* Show after organization */
		}

		.card-meta {
			padding: 0 !important;
			margin: 0 !important;
			margin-bottom: 0 !important;
			padding-left: 0 !important;
			padding-right: 0 !important;
			padding-bottom: 0 !important;
			border-left: none !important;
			border-bottom: none !important;
			width: 100%;
			order: 1; /* Show first on mobile */
		}

		.card-title {
			font-size: 1.1rem;
		}

		.card-description {
			font-size: 0.85rem;
			line-height: 1.5;
		}

		.card-title {
			line-height: 1.4;
		}

		.card-links a {
			min-height: 36px;
			padding: 0.5rem 0.75rem;
			touch-action: manipulation;
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
