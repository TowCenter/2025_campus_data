<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} interactionType - Type of interaction (lawsuit, deal, grant)
	 */
	
	/** @type {Props} */
	let { interactionType } = $props();

	const displayText = $derived(
		interactionType === 'lawsuit' ? 'Lawsuit' 
		: interactionType === 'grant' ? 'Grant' 
		: 'Deal'
	);
</script>

<span class="interaction-tag {interactionType}">{displayText}</span>

<style>
	.interaction-tag {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		white-space: nowrap;
	}

	.interaction-tag.lawsuit {
		background-color: #f5c2c2;
		color: #8b1a1a;
	}

	.interaction-tag.deal {
		background-color: #c8e6c9;
		color: #2e7d32;
	}

	.interaction-tag.grant {
		background-color: #bbdefb;
		color: #1565c0;
	}
</style>

