<!--
  TEMPLATE: CardContent Customization Example
  
  This file shows how to customize CardContent.svelte for your data structure.
  Copy the relevant sections to your CardContent.svelte file.
-->

<script>
	import CardField from './CardField.svelte';
	import HighlightedText from './HighlightedText.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import SourcesList from './SourcesList.svelte';

	/** @type {Props} */
	let { 
		row,
		searchQuery = '',
		filterPublishers = []
	} = $props();

	const searchTerms = $derived(filterPublishers || []);
</script>

<div class="card-content">
	<!-- Column 1: Main Information -->
	<div class="card-column column-1">
		<!-- Example: Title Field -->
		<CardField label="Title">
			<HighlightedText text={row.title} {searchQuery} {searchTerms} />
		</CardField>

		<!-- Example: Category Field (array) -->
		<CardField label="Category">
			{#if Array.isArray(row.category) && row.category.length > 0}
				{#each row.category as cat}
					<div class="field-item">
						<HighlightedText text={cat} {searchQuery} {searchTerms} />
					</div>
				{/each}
			{/if}
		</CardField>

		<!-- Example: Status Field -->
		{#if row.status}
			<CardField label="Status">
				<StatusBadge status={row.status} {searchQuery} />
			</CardField>
		{/if}

		<!-- Example: Tags Field -->
		{#if Array.isArray(row.tags) && row.tags.length > 0}
			<CardField label="Tags">
				{#each row.tags as tag}
					<div class="field-item">
						<HighlightedText text={tag} {searchQuery} {searchTerms} />
					</div>
				{/each}
			</CardField>
		{/if}
	</div>

	<!-- Column 2: Additional Information -->
	<div class="card-column column-2">
		<!-- Example: Description Field -->
		<CardField label="Description" class="reported-details">
			<span class="reported-text">
				<HighlightedText text={row.description || '—'} {searchQuery} {searchTerms} />
			</span>
		</CardField>

		<!-- Example: Sources Field -->
		{#if row.sources}
			<SourcesList sources={row.sources} interactionType="deal" {searchQuery} />
		{/if}

		<!-- Example: Custom Date Field -->
		{#if row.date}
			<CardField label="Date">
				<HighlightedText text={row.date} {searchQuery} {searchTerms} />
			</CardField>
		{/if}
	</div>
</div>

<!--
  CUSTOMIZATION NOTES:
  
  1. Replace field names (title, category, status, etc.) with your data fields
  2. Add/remove CardField components as needed
  3. Use HighlightedText for searchable text
  4. Use StatusBadge for status indicators
  5. Use SourcesList for sources/citations
  6. Customize labels to match your data
  7. Add conditional rendering for optional fields
-->

