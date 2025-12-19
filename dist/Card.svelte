<script>
	import CardHeader from './CardHeader.svelte';
	import CardContent from './CardContent.svelte';
	import { getInteractionType } from './interaction-utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Object} row - Data row
	 * @property {string} cardId - Unique card identifier
	 * @property {string} [searchQuery=''] - Search query for highlighting
	 * @property {string[]} [filterPublishers=[]] - Filter publishers for highlighting
	 */
	
	/** @type {Props} */
	let { 
		row,
		cardId,
		searchQuery = '',
		filterPublishers = []
	} = $props();

	const interactionType = $derived(getInteractionType(row.interaction));
</script>

<div class="card-wrapper">
	<div class="card {interactionType}">
		<CardHeader 
			{row} 
			{searchQuery}
			{filterPublishers}
		/>
		
		<CardContent 
			{row}
			{searchQuery}
			{filterPublishers}
		/>
	</div>
</div>

<style>
	.card-wrapper {
		width: 100%;
		overflow: visible;
		position: relative;
		min-width: 0;
		margin-left: 0;
		padding-left: 0;
	}

	.card {
		width: 100%;
		min-width: 0;
		background-color: #ffffff;
		border: 1px solid #e0e0e0;
		border-radius: 0;
		box-shadow: none;
		transition: background-color 0.2s ease;
		display: flex;
		flex-direction: column;
		margin-bottom: 0;
		margin-left: 0;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
	}

	.card.lawsuit {
		border-left: 3px solid #e57373;
	}

	.card.grant {
		border-left: 3px solid #64b5f6;
	}

	.card.deal {
		border-left: 3px solid #81c784;
	}

	@media screen and (max-width: 768px) {
		.card-wrapper {
			margin-bottom: 0;
		}

		.card {
			margin-bottom: 0;
			border-left-width: 4px;
		}
	}
</style>

