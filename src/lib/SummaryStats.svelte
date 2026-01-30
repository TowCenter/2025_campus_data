<script>
	import { parseDate } from './date-utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {any[]} [data=[]] - Data array
	 * @property {string} [dateField='date'] - Field name in data that contains dates
	 * @property {string} [orgField='org'] - Field name for organization
	 */

	/** @type {Props} */
	let {
		data = [],
		dateField = 'date',
		orgField = 'org'
	} = $props();

	// Calculate total announcements
	const totalAnnouncements = $derived(data.length);

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
			.slice(0, 20); // Top 20 organizations
	});

	// Get date range
	const dateRange = $derived.by(() => {
		const dates = data
			.map(item => {
				const dateValue = item[dateField];
				if (!dateValue) return null;
				return parseDate(dateValue);
			})
			.filter(d => d && !isNaN(d.getTime()));

		if (dates.length === 0) return null;

		const sorted = dates.sort((a, b) => a.getTime() - b.getTime());
		const earliest = sorted[0];
		const latest = sorted[sorted.length - 1];

		return {
			earliest: earliest.toLocaleDateString('default', { month: 'long', year: 'numeric' }),
			latest: latest.toLocaleDateString('default', { month: 'long', year: 'numeric' })
		};
	});
</script>

<div class="summary-stats">
	<div class="stats-grid">
		<div class="stat-item">
			<div class="stat-value">{totalAnnouncements.toLocaleString()}</div>
			<div class="stat-label">Total Announcements</div>
		</div>
		<div class="stat-item">
			<div class="stat-value">{orgStats.length}</div>
			<div class="stat-label">Organizations</div>
		</div>
	</div>
</div>

<style>
	.summary-stats {
		max-width: 900px;
		margin: 3rem auto 2rem;
		padding: 0 15px;
	}

	.stats-grid {
		display: flex;
		gap: 4rem;
		justify-content: flex-start;
	}

	.stat-item {
		text-align: left;
	}

	.stat-value {
		font-size: 3rem;
		font-weight: 700;
		color: #1a1a1a;
		line-height: 1.1;
		margin-bottom: 0.25rem;
		letter-spacing: -0.02em;
	}

	.stat-label {
		font-size: 0.875rem;
		color: #666;
		font-weight: 400;
		text-transform: none;
		letter-spacing: 0;
	}

	@media (max-width: 768px) {
		.summary-stats {
			margin: 2rem auto 1.5rem;
		}

		.stats-grid {
			flex-direction: column;
			gap: 2rem;
		}

		.stat-value {
			font-size: 2.25rem;
		}
	}
</style>
