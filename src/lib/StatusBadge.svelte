<script>
	/**
	 * @typedef {Object} Props
	 * @property {string} status - Status text
	 * @property {string} [searchQuery=''] - Search query for highlighting
	 */
	
	/** @type {Props} */
	let { 
		status,
		searchQuery = ''
	} = $props();

	const statusLower = $derived(String(status || '').toLowerCase().trim());
	const statusClass = $derived(
		statusLower.includes('progress') || statusLower.includes('pending') || statusLower.includes('ongoing') 
			? 'in-progress' 
			: statusLower.includes('settled') || statusLower.includes('resolved') || statusLower.includes('closed') || statusLower.includes('summary judgement')
			? 'settled'
			: statusLower.includes('dismissed') || statusLower.includes('dropped')
			? 'dismissed'
			: 'default'
	);
</script>

<span class="status-badge {statusClass}">
	<span class="status-indicator"></span>
	<span class="status-text">{status}</span>
</span>

<style>
	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.6rem;
		border-radius: 4px;
		background-color: #f5f5f5;
		font-size: 0.85rem;
	}

	.status-indicator {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-badge.in-progress .status-indicator {
		background-color: #ffb300;
		box-shadow: 0 0 0 2px rgba(255, 179, 0, 0.2);
	}

	.status-badge.settled .status-indicator {
		background-color: #4caf50;
		box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
	}

	.status-badge.dismissed .status-indicator {
		background-color: #9e9e9e;
		box-shadow: 0 0 0 2px rgba(158, 158, 158, 0.2);
	}

	.status-badge.default .status-indicator {
		background-color: #666;
		box-shadow: 0 0 0 2px rgba(102, 102, 102, 0.2);
	}

	.status-text {
		color: #333;
		font-weight: 400;
	}
</style>

