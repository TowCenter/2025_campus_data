<script>
	/**
	 * @typedef {Object} Props
	 * @property {boolean} [loading=false] - Whether loading is active
	 * @property {number} [progress=0] - Progress ratio (0-1)
	 * @property {boolean} [showProgress=false] - Whether to show percent label
	 * @property {string} [label='Loading database...'] - Loading label
	 * @property {string} [note=''] - Optional note below label
	 */

	/** @type {Props} */
	let {
		loading = false,
		progress = 0,
		showProgress = false,
		label = 'Loading database...',
		note = ''
	} = $props();

	const percent = $derived.by(() =>
		Math.round(Math.min(Math.max(progress || 0, 0), 1) * 100)
	);
</script>

{#if loading}
	<div class="loading">
		<div class="spinner">
			<div class="spinner-ring"></div>
			{#if showProgress}
				<span class="spinner-label">{percent}%</span>
			{/if}
		</div>
		<p>{label}</p>
		{#if note}
			<p class="loading-note">{note}</p>
		{/if}
	</div>
{/if}

<style>
	/* Loading States */
	.loading {
		text-align: center;
		padding: 3rem 2rem;
	}

	.spinner {
		width: 50px;
		height: 50px;
		margin: 0 auto 1rem;
		position: relative;
	}

	.spinner-ring {
		position: absolute;
		inset: 0;
		border: 4px solid #f3f3f3;
		border-top: 4px solid #254c6f;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	.spinner-label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 700;
		color: #254c6f;
	}

	.loading-note {
		margin: 0;
		color: #666;
		font-size: 0.95rem;
		text-align: center;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
