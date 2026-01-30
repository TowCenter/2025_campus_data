<script>
	/**
	 * @typedef {Object} Props
	 * @property {any[]} [data=[]] - Data array
	 * @property {string} [orgField='org'] - Field name for organization
	 * @property {number} [maxItems=20] - Maximum number of organizations to show
	 */

	/** @type {Props} */
	let {
		data = [],
		orgField = 'org',
		maxItems = 20
	} = $props();

	// Group by organization
	const orgStats = $derived.by(() => {
		const orgMap = new Map();
		
		data.forEach((item) => {
			const orgs = Array.isArray(item[orgField]) ? item[orgField] : (item[orgField] ? [item[orgField]] : []);
			orgs.forEach(org => {
				if (!org) return;
				const count = orgMap.get(org) || 0;
				orgMap.set(org, count + 1);
			});
		});

		// Convert to array and sort by count
		return Array.from(orgMap.entries())
			.map(([org, count]) => ({ org, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, maxItems);
	});
</script>

{#if orgStats.length > 0}
	<div class="organization-list-container">
		<h3 class="section-title">Largest Organizations</h3>
		<div class="organization-table">
			{#each orgStats as { org, count }}
				<a href="/timeline?org={encodeURIComponent(org)}" class="org-row">
					<span class="org-name">{org}</span>
					<span class="org-count">{count.toLocaleString()}</span>
				</a>
			{/each}
		</div>
	</div>
{/if}

<style>
	.organization-list-container {
		max-width: 900px;
		margin: 3rem auto;
		padding: 0 15px;
	}

	.section-title {
		font-size: 1.125rem;
		font-weight: 600;
		color: #1a1a1a;
		margin-bottom: 1.5rem;
		margin-top: 0;
	}

	.organization-table {
		display: flex;
		flex-direction: column;
	}

	.org-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.875rem 0;
		border-bottom: 1px solid #e5e5e5;
		text-decoration: none;
		color: #1a1a1a;
		transition: background-color 0.15s ease;
	}

	.org-row:hover {
		background-color: #f8f8f8;
		margin-left: -8px;
		margin-right: -8px;
		padding-left: 8px;
		padding-right: 8px;
	}

	.org-row:last-child {
		border-bottom: none;
	}

	.org-name {
		font-weight: 400;
		flex: 1;
		font-size: 0.9375rem;
	}

	.org-count {
		font-size: 0.9375rem;
		color: #1a1a1a;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.organization-list-container {
			margin: 2rem auto;
			padding: 0 1rem;
		}

		.section-title {
			font-size: 1rem;
			margin-bottom: 1rem;
		}

		.org-row {
			padding: 0.75rem 0;
		}

		.org-name,
		.org-count {
			font-size: 0.875rem;
		}
	}
</style>
