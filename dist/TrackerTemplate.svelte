<script>
	import Head from './Head.svelte';
	import Article from './Article.svelte';
	import Header from './Header.svelte';
	import Headline from './Headline.svelte';
	import Footer from './Footer.svelte';
	import BodyText from './BodyText.svelte';
	import Body from './Body.svelte';
	import Filters from './Filters.svelte';
	import CardView from './CardView.svelte';
	import { normalizeData, getLatestDate } from './data-utils.js';

	/**
	 * @typedef {Object} TrackerConfig
	 * @property {string} title - Page title
	 * @property {string} description - Page description
	 * @property {string} bodyText - Body text content (HTML supported)
	 * @property {Array<Object>} data - Data array
	 * @property {string[]} columns - Column names for display
	 * @property {Object} [meta] - Meta tags configuration
	 */

	/** @type {TrackerConfig} */
	let {
		title = 'Data Tracker',
		description = 'A customizable data tracker',
		bodyText = 'This is a template tracker. Customize the data and content to match your needs.',
		data = [],
		columns = ['Date', 'Category', 'Status', 'Title'],
		meta = {}
	} = $props();

	// Normalize data
	const normalizedData = $derived(normalizeData(data));
	const latestDate = $derived(getLatestDate(data));

	// Filter state
	let searchQuery = $state('');
	let filterCategory = $state([]);
	let filterStatus = $state([]);
	let filterTags = $state([]);
	let filteredData = $state([]);

	function downloadToCSV() {
		// Customize CSV export based on your data structure
		const csvColumns = columns.map(col => ({
			name: col,
			key: col.toLowerCase().replace(/\s+/g, '_')
		}));

		const header = csvColumns.map(col => col.name).join(',');
		const rows = filteredData.map(row => {
			return csvColumns.map(col => {
				let value = row[col.key];
				if (Array.isArray(value)) {
					value = value.filter(v => v && String(v).trim()).join('; ');
				}
				const stringValue = value != null ? String(value) : '';
				const escaped = stringValue.replace(/"/g, '""');
				return `"${escaped}"`;
			}).join(',');
		});

		const csv = [header, ...rows].join('\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const link = document.createElement('a');
		const url = URL.createObjectURL(blob);
		link.setAttribute('href', url);
		link.setAttribute('download', 'tracker-data.csv');
		link.style.visibility = 'hidden';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
	}
</script>

<Head />
<Header />
<Article>
	<Headline
		brand="Your Brand"
		hed={title}
	/>

	<Body>
		<BodyText text={bodyText} />
		<div class="update-date-divider">
			<div class="divider-line"></div>
			<div class="update-date">
				<em>Last updated on</em> <strong>{latestDate}</strong>
			</div>
		</div>
	</Body>

	<Filters 
		data={normalizedData}
		columns={columns}
		bind:searchQuery
		bind:filterCategory
		bind:filterStatus
		bind:filterTags
		filteredRowCount={filteredData.length}
		onDownloadCSV={downloadToCSV}
	/>

	<CardView 
		data={normalizedData}
		columns={columns}
		{searchQuery}
		filterInteraction={[]}
		filterType={filterCategory}
		filterPlatform={[]}
		filterPublishers={filterStatus}
		onFilteredDataChange={(data) => { filteredData = data; }}
	/>
</Article>
<Footer />

<style>
	.update-date-divider {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin: 2rem 0;
	}

	.divider-line {
		flex: 1;
		height: 1px;
		background-color: #e0e0e0;
	}

	.update-date {
		font-size: 0.9rem;
		color: #666;
		white-space: nowrap;
	}

	.update-date em {
		font-style: italic;
		margin-right: 0.5rem;
	}

	.update-date strong {
		font-weight: 600;
		color: #333;
	}
</style>
