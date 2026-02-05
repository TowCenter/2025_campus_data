<script>
	import HighlightedText from './HighlightedText.svelte';
	import { getSnippet } from './search-highlight.js';

	/**
	 * @typedef {Object} Props
	 * @property {any} item - Data item
	 * @property {string} [searchQuery=''] - Search query for highlighting
	 * @property {Record<string, any>} [filterValues={}] - Filter values for highlighting
	 * @property {string} [dateField='date'] - Field name for date
	 */

	/** @type {Props} */
	let { 
		item,
		searchQuery = '',
		filterValues = {},
		dateField = 'date'
	} = $props();

	// Format date for display
	function formatDate(dateStr) {
		if (!dateStr) return '';
		try {
			const date = new Date(dateStr);
			if (isNaN(date.getTime())) return dateStr;
			return date.toLocaleDateString('en-US', { 
				year: 'numeric', 
				month: 'short', 
				day: 'numeric',
				timeZone: 'UTC'
			});
		} catch (e) {
			return dateStr;
		}
	}

	// Normalize org to always be an array
	const orgArray = $derived(Array.isArray(item?.org) ? item.org : (item?.org ? [item.org] : []).filter(Boolean));
	
	// Get selected schools from filterValues
	const selectedOrgs = $derived(filterValues['filter-School'] || []);
	
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
		// Since backgrounds are light gray, always use dark text
		return '#333';
	}

	const descriptionText = $derived(
		item?.description || item?.content || ''
	);
	const descriptionSnippet = $derived(getSnippet(descriptionText, searchQuery));
</script>

<tr class="table-row">
	<td class="table-cell table-date">{formatDate(item[dateField])}</td>
	<td class="table-cell table-org">
		{#if orgArray.length > 0}
			<div class="org-tags">
				{#each orgArray as org}
					<span 
						class="org-tag" 
						style="background-color: {getOrgColor(org)}; color: {getOrgTextColor(org)};"
					><HighlightedText text={org} searchQuery={searchQuery} /></span>
				{/each}
			</div>
		{/if}
	</td>
	<td class="table-cell table-content">
		{#if item?.title}
			<div class="content-title">
				{#if item.url}
					<a href={item.url} target="_blank" rel="noopener noreferrer" class="title-link" data-umami-event="result-link-click" data-umami-event-title={item.title}>
						<HighlightedText text={item.title} searchQuery={searchQuery} />
					</a>
				{:else}
					<HighlightedText text={item.title} searchQuery={searchQuery} />
				{/if}
			</div>
		{/if}
		{#if descriptionSnippet}
			<div class="description-text">
				<HighlightedText text={descriptionSnippet} searchQuery={searchQuery} />
			</div>
		{/if}
	</td>
</tr>

<style>
	.table-row {
		border-bottom: 1px solid #e0e0e0;
		transition: background-color 0.2s ease;
	}

	.table-row:hover {
		background-color: #fafafa;
	}

	.table-cell {
		padding: 1.25rem 1rem;
		vertical-align: top;
		font-size: 0.9rem;
		line-height: 1.6;
	}

	.table-date {
		white-space: nowrap;
		color: #666;
		font-size: 0.85rem;
		min-width: 120px;
	}

	.table-org {
		min-width: 150px;
	}

	.org-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.org-tag {
		font-size: 0.7rem;
		font-family: inherit;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		font-weight: 500;
		display: inline-block;
		transition: all 0.2s ease;
		word-break: break-word;
		white-space: nowrap;
		max-width: none;
	}

	.org-tag.selected {
		font-weight: 600;
		box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.1);
	}

	.table-content {
		min-width: 350px;
	}

	.content-title {
		font-weight: 500;
		font-size: 0.9rem;
		margin-bottom: 0.35rem;
	}

	.title-link {
		color: #254c6f;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.title-link:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.description-text {
		color: #555;
		font-size: 0.82rem;
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.table-links {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.link-item {
		font-size: 0.85rem;
		color: #254c6f;
		text-decoration: none;
		transition: color 0.2s ease;
	}

	.link-item:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.table-content mark,
	.table-org mark {
		background-color: #BBDEFB;
		padding: 0.1em 0.2em;
		border-radius: 2px;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.table-cell {
			padding: 0.75rem 0.5rem;
			font-size: 0.85rem;
		}

		.table-date {
			min-width: 100px;
		}

		.table-org {
			min-width: 120px;
		}

		.table-content {
			min-width: 200px;
		}
	}
</style>
