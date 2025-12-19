<script>
	import CardField from './CardField.svelte';
	import HighlightedText from './HighlightedText.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import HierarchyTree from './HierarchyTree.svelte';
	import SourcesList from './SourcesList.svelte';
	import { getInteractionType } from './interaction-utils.js';
	import { buildHierarchyTree } from './hierarchy-utils.js';
	import { getAllPublishers } from './filter-utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Object} row - Data row
	 * @property {string} [searchQuery=''] - Search query for highlighting
	 * @property {string[]} [filterPublishers=[]] - Filter publishers for highlighting
	 */
	
	/** @type {Props} */
	let { 
		row,
		searchQuery = '',
		filterPublishers = []
	} = $props();

	const interactionType = $derived(getInteractionType(row.interaction));
	const allPublishers = $derived(Array.isArray(row.organization_publisher_named_in_deal_suit) ? row.organization_publisher_named_in_deal_suit : []);
	const parentChildMatches = $derived(Array.isArray(row.parent_child_matches) ? row.parent_child_matches : []);
	const orgsToDisplay = $derived(interactionType === 'lawsuit' && Array.isArray(row.plaintiff) && row.plaintiff.length > 0 ? row.plaintiff : allPublishers);
	const hierarchyTree = $derived(buildHierarchyTree(parentChildMatches, orgsToDisplay));
	const searchTerms = $derived(filterPublishers || []);

</script>

<div class="card-content">
	
	<!-- Column 1 -->
	<div class="card-column column-1">
		<CardField label={interactionType === 'lawsuit' ? 'Defendant(s)' : 'AI Company'}>
			{#if interactionType === 'lawsuit' && Array.isArray(row.defendant) && row.defendant.length > 0}
				{#each row.defendant as defendant}
					<div class="field-item">
						<HighlightedText text={defendant} {searchQuery} {searchTerms} />
					</div>
				{/each}
			{:else if Array.isArray(row.platform) && row.platform.length > 0}
				{#each row.platform as platform}
					<div class="field-item">
						<HighlightedText text={platform} {searchQuery} {searchTerms} />
					</div>
				{/each}
			{/if}
		</CardField>

		<CardField label={interactionType === 'lawsuit' ? 'Plaintiff(s)' : 'News Org'} class="news-org-field">
			{#each (interactionType === 'lawsuit' && Array.isArray(row.plaintiff) && row.plaintiff.length > 0 ? row.plaintiff : allPublishers) as org}
				{@const orgTree = hierarchyTree[org] || {}}
				{@const hasMatches = Object.keys(orgTree).length > 0 || (orgTree.publications && orgTree.publications.length > 0)}
				<div class="publisher-item">
					<div class="field-item">
						<HighlightedText text={org} {searchQuery} {searchTerms} />
					</div>
					{#if hasMatches}
						<div class="affected-publications">
							<HierarchyTree tree={orgTree} parentName={org} {interactionType} {searchQuery} {searchTerms} />
						</div>
					{/if}
				</div>
			{/each}
			{#if (interactionType === 'lawsuit' && Array.isArray(row.plaintiff) && row.plaintiff.length > 0 ? row.plaintiff : allPublishers).some(org => {
				const orgTree = hierarchyTree[org] || {};
				return Object.keys(orgTree).length > 0 || (orgTree.publications && orgTree.publications.length > 0);
			})}
				<div class="affected-note">
					(Affected publications named in {interactionType === 'lawsuit' ? 'suit' : interactionType === 'grant' ? 'deal announcement' : 'announcements'})
				</div>
			{/if}
		</CardField>

		<CardField label={interactionType === 'lawsuit' ? 'Complaint' : 'Type'}>
			{#if Array.isArray(row.type) && row.type.length > 0}
				{#each row.type as type}
					<div class="field-item">
						<HighlightedText text={type} {searchQuery} {searchTerms} />
					</div>
				{/each}
			{/if}
		</CardField>

		{#if interactionType === 'lawsuit'}
			{#if row.status}
				<CardField label="Status:">
					<StatusBadge status={row.status} {searchQuery} />
				</CardField>
			{/if}
			{#if row.location}
				<CardField label="Location:">
					<HighlightedText text={row.location} {searchQuery} {searchTerms} />
				</CardField>
			{/if}
		{/if}
	</div>

	<!-- Column 2 -->
	<div class="card-column column-2">
		<CardField label="Reported Details" class="reported-details">
			<span class="reported-text">
				<HighlightedText text={row.reported_details || '—'} {searchQuery} {searchTerms} />
			</span>
		</CardField>

		{#if interactionType === 'lawsuit' && row.case_number && row.case_number}
			{@const caseNumber = String(row.case_number).trim()}
			{@const isUnknown = caseNumber.toLowerCase() === '(unknown)' || caseNumber.toLowerCase() === 'unknown' || caseNumber === '—' || caseNumber === 'nan'}
			{#if !isUnknown}
				<CardField label="Case Details:" class="case-details-field">
					{#if row.case_filing && row.case_filing}
						<a href={row.case_filing} target="_blank" rel="noopener noreferrer" class="source-link">
							<HighlightedText text={caseNumber} {searchQuery} {searchTerms} />
						</a>
					{:else}
						<HighlightedText text={caseNumber} {searchQuery} {searchTerms} />
					{/if}
				</CardField>
			{/if}
		{/if}

		<SourcesList sources={row.sources} {interactionType} {searchQuery} />
	</div>
</div>

<style>
	.card-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
		padding: 1.5rem;
		position: relative;
	}

	.card-column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		overflow-wrap: break-word;
		word-wrap: break-word;
	}

	.card-column.column-1 {
		padding-right: 1.5rem;
		border-right: 1px solid #e0e0e0;
	}

	.card-column.column-2 {
		padding-left: 1.5rem;
	}

	.field-item {
		font-size: 0.9rem;
		color: #1a1a1a;
		font-weight: 500;
		line-height: 1.5;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.field-value:has(.field-item):not(:has(.publisher-item)) {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: flex-start;
	}

	.field-value:has(.publisher-item) {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: flex-start;
	}

	.publisher-item {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		position: relative;
		width: fit-content;
		align-items: flex-start;
		margin-bottom: 0;
	}

	.publisher-item:has(.affected-publications) {
		margin-bottom: 0.3rem;
	}

	.publisher-item:has(.hierarchy-intermediate) {
		margin-bottom: 0.2rem;
	}

	.affected-publications {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-left: 0.5rem;
		padding-left: 0.5rem;
		position: relative;
		margin-top: 0.15rem;
		padding-top: 0.15rem;
		border-left: 1.5px solid #e5e5e5;
	}

	.affected-publications:has(.hierarchy-intermediate) {
		gap: 0.1rem;
	}

	.affected-note {
		font-size: 0.65rem;
		color: #999;
		font-style: italic;
		margin-top: 0.5rem;
		position: relative;
		padding-left: 0;
	}

	.reported-text {
		line-height: 1.6;
		font-weight: 400;
	}

	.source-link {
		color: #254c6f;
		text-decoration: none;
		font-size: 0.9rem;
		transition: color 0.2s ease;
	}

	.source-link:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	@media screen and (max-width: 768px) {
		.card-content {
			display: flex !important;
			flex-direction: column !important;
			grid-template-columns: none !important;
			padding: 1rem;
			gap: 0;
		}

		.card-column.column-1 {
			padding: 0 !important;
			margin: 0 !important;
			padding-bottom: 1.5rem !important;
			border-right: none !important;
			border-bottom: 1px solid #e0e0e0;
			width: 100%;
		}

		.card-column.column-2 {
			padding: 0 !important;
			margin: 0 !important;
			padding-left: 0 !important;
			padding-right: 0 !important;
			padding-top: 1.5rem !important;
			width: 100%;
		}

		.card-column.column-2 .card-field {
			margin-left: 0;
			padding-left: 0;
		}

		.card-field {
			margin-bottom: 1.25rem;
		}

		.field-label {
			font-size: 0.7rem;
			margin-bottom: 0.5rem;
		}

		.field-value {
			font-size: 0.95rem;
			line-height: 1.6;
		}

		.field-item {
			font-size: 0.95rem;
			line-height: 1.6;
			margin-bottom: 0.5rem;
		}

		.publisher-item {
			margin-bottom: 1rem;
		}

		.affected-publications {
			margin-left: 0.75rem;
			padding-left: 0.75rem;
			margin-top: 0.5rem;
		}

		.affected-title {
			font-size: 0.85rem;
			padding-left: 0.75rem;
			margin-bottom: 0.25rem;
		}

		.affected-note {
			font-size: 0.7rem;
			margin-top: 0.75rem;
			padding-left: 0;
		}

		.hierarchy-intermediate {
			padding-left: 0.75rem;
			margin-bottom: 0.5rem;
		}

		.hierarchy-intermediate-name {
			font-size: 0.85rem;
		}

		.hierarchy-intermediate-children {
			margin-left: 1rem;
			padding-left: 0.75rem;
		}

		.reported-text {
			font-size: 0.95rem;
			line-height: 1.7;
		}

		.source-link {
			font-size: 0.95rem;
			word-break: break-word;
		}
	}
</style>

