<script>
	/**
	 * @typedef {Object} Props
	 * @property {boolean} [exporting=false] - Whether export is active
	 * @property {number} [progress=0] - Progress ratio (0-1)
	 */

	/** @type {Props} */
	let { exporting = false, progress = 0 } = $props();

	const percent = $derived.by(() =>
		Math.round(Math.min(Math.max(progress || 0, 0), 1) * 100)
	);
</script>

{#if exporting}
	<div class="export-progress">
		<div class="export-progress-bar">
			<div
				class="export-progress-fill"
				style={`width: ${percent}%;`}
			></div>
		</div>
		<span class="export-progress-text">Exporting {percent}%</span>
	</div>
{/if}

<style>
	.export-progress {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		width: 100%;
	}
	.export-progress-bar {
		flex: 1 1 140px;
		height: 8px;
		background: #e6eef5;
		border-radius: 999px;
		overflow: hidden;
	}
	.export-progress-fill {
		height: 100%;
		background: #d6613a;
		width: 0%;
		transition: width 0.2s ease;
	}
	.export-progress-text {
		font-size: 0.9rem;
		font-weight: 600;
		color: #254c6f;
		white-space: nowrap;
	}
</style>
