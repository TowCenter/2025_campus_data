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
	
	// Get selected schools from filterValues
	const selectedOrgs = $derived(filterValues['filter-School'] || []);
	
	// Use Set for faster lookups
	const selectedOrgsSet = $derived(new Set(selectedOrgs));
	
	// Check if an org tag is selected
	function isOrgSelected(orgTag) {
		return selectedOrgs.length > 0 && selectedOrgsSet.has(orgTag);
	}

	// Color palette for schools
	const schoolColors = [
		'#98d7cd', '#7bccbe', '#5dc0b0',
		'#bbdefb', '#9ed1fa', '#77bef8',
		'#a89dfb', '#9789fa', '#8575fa'
	];

	// Generate a unique color for an organization name from palette
	function getOrgColor(orgName) {
		if (!orgName) return '#f0f0f0';

		// Hash the organization name to get a consistent color
		let hash = 0;
		for (let i = 0; i < orgName.length; i++) {
			hash = orgName.charCodeAt(i) + ((hash << 5) - hash);
		}

		// Select from palette
		const colorIndex = Math.abs(hash) % schoolColors.length;
		return schoolColors[colorIndex];
	}

	// Get dark text color based on the background color
	function getOrgTextColor(orgName) {
		if (!orgName) return '#333';
		// Get the background color and darken it for the text
		const bgColor = getOrgColor(orgName);
		// Convert hex to darker shade
		const hex = bgColor.replace('#', '');
		const r = Math.max(0, parseInt(hex.substring(0, 2), 16) - 80);
		const g = Math.max(0, parseInt(hex.substring(2, 4), 16) - 80);
		const b = Math.max(0, parseInt(hex.substring(4, 6), 16) - 80);
		return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
	}

	// Highlight only the searched keyword in text
	function highlightText(text, query) {
		if (!query || !text) return text;
		// Escape the query for use in regex
		const escapedQuery = String(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		const regex = new RegExp(`(${escapedQuery})`, 'gi');
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
	<td class="table-cell table-content">
		{#if item?.title}
			<div class="content-title">
				{#if item.url}
					<a href={item.url} target="_blank" rel="noopener noreferrer" class="title-link">
						{@html highlightText(item.title, searchQuery)}
					</a>
				{:else}
					{@html highlightText(item.title, searchQuery)}
				{/if}
			</div>
		{/if}
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
		-webkit-line-clamp: 2;
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
