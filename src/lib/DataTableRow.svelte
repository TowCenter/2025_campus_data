<script>
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
		const hue = Math.abs(hash) % 360;
		const saturation = 15 + (Math.abs(hash) % 10); // 15-25% (muted)
		const lightness = 85 + (Math.abs(hash) % 10); // 85-95% (very light)
		
		return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
	}

	// Get text color (dark gray for light backgrounds)
	function getOrgTextColor(orgName) {
		if (!orgName) return '#333';
		return '#333';
	}

	// Simple text highlighting function
	function highlightText(text, query) {
		if (!query || !text) return text;
		const escaped = String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(${escaped})`, 'gi');
		return String(text).replace(regex, '<mark class="search-highlight">$1</mark>');
	}
</script>

<tr class="table-row">
	<td class="table-cell table-date">{formatDate(item[dateField])}</td>
	<td class="table-cell table-org">
		{#if orgArray.length > 0}
			<div class="org-tags">
				{#each orgArray as org}
					<span 
						class="org-tag" 
						class:selected={isOrgSelected(org)}
						style="background-color: {isOrgSelected(org) ? '#fff3cd' : getOrgColor(org)}; color: {getOrgTextColor(org)};"
					>{@html highlightText(org, searchQuery)}</span>
				{/each}
			</div>
		{/if}
	</td>
	<td class="table-cell table-title">
		{#if item?.title}
			{#if item.url}
				<a href={item.url} target="_blank" rel="noopener noreferrer" class="title-link">
					{@html highlightText(item.title, searchQuery)}
				</a>
			{:else}
				{@html highlightText(item.title, searchQuery)}
			{/if}
		{/if}
	</td>
	<td class="table-cell table-description">
		{#if item?.description}
			<div class="description-text">{@html highlightText(item.description, searchQuery)}</div>
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
		padding: 1rem;
		vertical-align: top;
		font-size: 0.9rem;
		line-height: 1.5;
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
		gap: 0.4rem;
	}

	.org-tag {
		font-size: 0.7rem;
		font-family: inherit;
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-weight: 400;
		display: inline-block;
		transition: all 0.2s ease;
	}

	.org-tag.selected {
		font-weight: 500;
	}

	.table-title {
		font-weight: 400;
		font-size: 0.85rem;
		min-width: 200px;
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

	.table-description {
		color: #333;
		min-width: 300px;
		max-width: 400px;
	}

	.description-text {
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

	.search-highlight {
		background-color: #fff3cd;
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

		.table-title {
			min-width: 150px;
		}

		.table-description {
			min-width: 200px;
			max-width: 250px;
		}
	}
</style>
