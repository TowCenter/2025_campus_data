<script>
	import HighlightedText from './HighlightedText.svelte';
	import { normalizeSources, getArchiveInfo, getSourceDisplayText } from './source-utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {any} sources - Sources data
	 * @property {string} [interactionType='deal'] - Interaction type
	 * @property {string} [searchQuery=''] - Search query for highlighting
	 */
	
	/** @type {Props} */
	let { 
		sources,
		interactionType = 'deal',
		searchQuery = ''
	} = $props();

	const allSources = $derived(normalizeSources(sources));
</script>

{#if allSources.length > 0}
	<div class="citations-section">
		<div class="citations-label">{interactionType === 'lawsuit' ? 'read more' : 'Sources:'}</div>
		<div class="citations">
			{#each allSources as source, index}
				{@const archiveInfo = getArchiveInfo(source)}
				{@const displayUrl = archiveInfo.isArchive ? archiveInfo.archiveUrl : source}
				{@const displayText = getSourceDisplayText(source)}
				<a href={displayUrl} target="_blank" rel="noopener noreferrer" class="citation-link">
					<HighlightedText text={displayText} {searchQuery} />
				</a>
				{#if index < allSources.length - 1}
					<span class="citation-separator">, </span>
				{/if}
			{/each}
		</div>
	</div>
{/if}

<style>
	.citations-section {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.citations-label {
		font-size: 0.65rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #999;
		margin-bottom: 0.3rem;
	}

	.citations {
		display: block;
		line-height: 1.6;
		word-wrap: break-word;
		overflow-wrap: break-word;
		word-break: break-all;
	}

	.citation-link {
		color: #254c6f;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 400;
		transition: color 0.2s ease;
		word-break: break-all;
	}

	.citation-link:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.citation-separator {
		color: #666;
		margin: 0 0.15rem;
	}
</style>

