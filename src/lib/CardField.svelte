<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} label - Field label
	 * @property {import('svelte').Snippet} [children] - Slot content for field value
	 */
	
	/** @type {Props} */
	let { label, children } = $props();
</script>

<div class="card-field">
	<div class="field-label">{label}</div>
	<div class="field-value">
		{#if children}
			{@render children()}
		{/if}
	</div>
</div>

<style>
	.card-field {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.field-label {
		font-size: 0.65rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #999;
		margin-bottom: 0.05rem;
	}

	.field-value {
		font-size: 0.9rem;
		line-height: 1.5;
		color: #1a1a1a;
		font-weight: 500;
		word-wrap: break-word;
		overflow-wrap: break-word;
		word-break: break-word;
		min-width: 0;
	}

	.field-item {
		font-size: 0.9rem;
		color: #1a1a1a;
		font-weight: 500;
		line-height: 1.5;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}
</style>

