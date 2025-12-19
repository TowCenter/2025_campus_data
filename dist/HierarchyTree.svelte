<script>
	import HighlightedText from './HighlightedText.svelte';

	/**
	 * @typedef {Object} Props
	 * @property {Object} tree - Hierarchy tree node
	 * @property {string} [parentName=null] - Parent organization name
	 * @property {string} [interactionType='deal'] - Interaction type
	 * @property {string} [searchQuery=''] - Search query for highlighting
	 * @property {string[]} [searchTerms=[]] - Additional search terms
	 */
	
	/** @type {Props} */
	let { 
		tree,
		parentName = null,
		interactionType = 'deal',
		searchQuery = '',
		searchTerms = []
	} = $props();
</script>

{#snippet renderNode(node, parentName = null)}
	{#each Object.keys(node).sort() as key}
		{@const child = node[key]}
		{#if key === 'publications'}
			{#each child.slice().sort((a, b) => String(a || '').localeCompare(String(b || ''))) as publication}
				{@const normalizedPub = String(publication || '').trim()}
				{@const normalizedParent = parentName ? String(parentName).trim() : ''}
				{#if normalizedPub !== normalizedParent && normalizedPub !== ''}
					<div class="affected-title">
						{#if interactionType === 'grant'}
							<span class="hierarchy-label">Grantee: </span>
						{/if}
						<HighlightedText text={publication} {searchQuery} {searchTerms} />
					</div>
				{/if}
			{/each}
		{:else}
			<div class="hierarchy-intermediate">
				<span class="hierarchy-intermediate-name">
					{#if interactionType === 'grant'}
						<span class="hierarchy-label">Grant Administrator: </span>
					{/if}
					<HighlightedText text={key} {searchQuery} {searchTerms} />
				</span>
				<div class="hierarchy-intermediate-children">
					{@render renderNode(child, key)}
				</div>
			</div>
		{/if}
	{/each}
{/snippet}

{@render renderNode(tree, parentName)}

<style>
	.hierarchy-intermediate {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-left: 0;
		padding-left: 0.5rem;
		position: relative;
		margin-top: 0.1rem;
		margin-bottom: 0.1rem;
	}

	.hierarchy-intermediate::before {
		content: '';
		position: absolute;
		left: -0.5rem;
		top: 0.75rem;
		width: 0.5rem;
		height: 1.5px;
		background-color: #e5e5e5;
	}

	.hierarchy-intermediate-name {
		font-size: 0.8rem;
		color: #333;
		font-weight: 400;
		line-height: 1.5;
		position: relative;
		padding-left: 0;
		margin-bottom: 0;
	}

	.hierarchy-label {
		font-weight: 600;
		color: #666;
		font-size: 0.75rem;
	}

	.hierarchy-intermediate-children {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-left: 1.25rem;
		padding-left: 0.5rem;
		position: relative;
		margin-top: 0.15rem;
		border-left: 1.5px solid #e5e5e5;
		padding-top: 0.15rem;
	}

	.affected-title {
		font-size: 0.8rem;
		color: #555;
		font-weight: 400;
		line-height: 1.5;
		font-style: italic;
		position: relative;
		padding-left: 0.75rem;
		margin: 0;
	}

	.affected-title::before {
		content: '';
		position: absolute;
		left: -0.5rem;
		top: 0.75rem;
		width: 0.5rem;
		height: 1.5px;
		background-color: #e5e5e5;
	}
</style>

