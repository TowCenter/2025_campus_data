<script>
	import { formatDate } from './utils.js';
	import { getInteractionType } from './interaction-utils.js';
	import InteractionTag from './InteractionTag.svelte';
	import HighlightedText from './HighlightedText.svelte';

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
	const searchTerms = $derived(filterPublishers || []);
</script>

<div class="card-header {interactionType}">
	{#if row.date}
		<div class="header-date">{formatDate(row.date)}</div>
	{/if}
	<div class="header-content">
		{#if interactionType === 'lawsuit'}
			<div class="header-left">
				{#if Array.isArray(row.defendant) && row.defendant.length > 0}
					{#each row.defendant as defendant}
						<div class="header-item">
							<HighlightedText text={defendant} {searchQuery} {searchTerms} />
						</div>
					{/each}
				{/if}
			</div>
			<div class="header-separator"></div>
			<div class="header-right-content">
				{#if Array.isArray(row.plaintiff) && row.plaintiff.length > 0}
					{#each row.plaintiff as plaintiff}
						<div class="header-item">
							<HighlightedText text={plaintiff} {searchQuery} {searchTerms} />
						</div>
					{/each}
				{/if}
			</div>
		{:else}
			<div class="header-left">
				{#if Array.isArray(row.platform) && row.platform.length > 0}
					{#each row.platform as platform}
						<div class="header-item">
							<HighlightedText text={platform} {searchQuery} {searchTerms} />
						</div>
					{/each}
				{/if}
			</div>
			<div class="header-separator"></div>
			<div class="header-right-content">
				{#if Array.isArray(allPublishers) && allPublishers.length > 0}
					{#each allPublishers as pub}
						<div class="header-item">
							<HighlightedText text={pub} {searchQuery} {searchTerms} />
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
	<div class="header-right">
		<InteractionTag {interactionType} />
	</div>
</div>

<style>
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
		border-bottom: 1px solid #e0e0e0;
		position: relative;
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
		margin-left: 5rem;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex-shrink: 0;
		align-items: flex-start;
	}

	.header-separator {
		width: 1px;
		background-color: #d0d0d0;
		align-self: stretch;
		margin: 0.2rem 0;
		flex-shrink: 0;
	}

	.header-right-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
		align-items: flex-start;
	}

	.header-item {
		font-weight: 600;
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


	@media screen and (max-width: 768px) {
		.card-header {
			padding: 0.75rem 1rem !important;
			flex-wrap: wrap;
			gap: 0.75rem;
			flex-direction: column;
		}

		.card-header > .header-date {
			position: static;
			margin-bottom: 0;
			margin-left: 0;
			padding-left: 0;
			order: -2;
			font-size: 0.75rem;
			color: #666;
		}

		.header-right {
			flex-direction: row;
			align-items: center;
			gap: 0.75rem;
			width: 100%;
			justify-content: space-between;
			order: -1;
			margin-bottom: 0.75rem;
			padding-bottom: 0.75rem;
			border-bottom: 1px solid #e0e0e0;
			margin-left: 0;
			padding-left: 0;
		}

		.header-content {
			gap: 0.75rem;
			margin-left: 0 !important;
			margin-bottom: 0;
			padding-left: 0;
			width: 100%;
			order: 1;
			flex-direction: column;
		}

		.header-left {
			width: 100%;
			padding-bottom: 0.75rem;
			border-bottom: 1px solid #f0f0f0;
			margin-bottom: 0.75rem;
			margin-left: 0;
			padding-left: 0;
		}

		.card-header .header-left::before {
			content: 'AI Company';
			display: block;
			font-size: 0.7rem;
			font-weight: 500;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: #666;
			margin-bottom: 0.5rem;
		}

		.card-header.lawsuit .header-left::before {
			content: 'Defendant';
		}

		.header-left .header-item {
			font-weight: 600;
			font-size: 0.9rem;
			line-height: 1.5;
		}

		.header-right-content {
			width: 100%;
			padding-top: 0;
			margin-left: 0;
			padding-left: 0;
		}

		.card-header .header-right-content::before {
			content: 'News Org';
			display: block;
			font-size: 0.7rem;
			font-weight: 500;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: #666;
			margin-bottom: 0.5rem;
		}

		.card-header.lawsuit .header-right-content::before {
			content: 'Plaintiff';
		}

		.header-right-content .header-item {
			font-weight: 600;
			font-size: 0.9rem;
			line-height: 1.5;
		}

		.header-separator {
			display: none;
		}

		.header-item {
			font-size: 0.9rem;
			line-height: 1.5;
			word-break: break-word;
		}

		.header-date {
			font-size: 0.75rem;
		}
	}
</style>

