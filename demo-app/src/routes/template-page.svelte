<script>
	import Head from "../../../src/lib/Head.svelte";
	import Article from "../../../src/lib/Article.svelte";
	import Header from "../../../src/lib/Header.svelte";
	import Headline from "../../../src/lib/Headline.svelte";
	import Footer from "../../../src/lib/Footer.svelte";
	import BodyText from "../../../src/lib/BodyText.svelte";
	import Body from "../../../src/lib/Body.svelte";
	import Filters from "../../../src/lib/Filters.svelte";
	import CardView from "../../../src/lib/CardView.svelte";
	import templateData from "../../../src/lib/data/template-data.json";
	import { normalizeData, getLatestDate } from "../../../src/lib/data-utils.js";

	// Normalize your data
	const normalizedData = normalizeData(templateData);

	// Define your column names (for display and filtering)
	const tableColumns = [
		"Date",
		"Category",
		"Status",
		"Title"
	];

	// Filter state - customize based on your needs
	let searchQuery = $state('');
	let filterCategory = $state([]);
	let filterStatus = $state([]);
	let filterTags = $state([]);
	let filteredData = $state([]);

	// CSV Export function - customize columns based on your data
	function downloadToCSV() {
		const csvColumns = [
			{ name: 'Date', key: 'date' },
			{ name: 'Category', key: 'category' },
			{ name: 'Status', key: 'status' },
			{ name: 'Title', key: 'title' },
			{ name: 'Description', key: 'description' },
			{ name: 'Tags', key: 'tags' },
			{ name: 'Sources', key: 'sources' }
		];
		
		const header = csvColumns.map(col => col.name).join(',');
		
		const rows = filteredData.map(row => {
			return csvColumns.map(col => {
				let value = row[col.key];
				
				// Handle arrays by joining with semicolon
				if (Array.isArray(value)) {
					value = value.filter(v => v && String(v).trim()).join('; ');
				}
				
				// Convert to string and handle null/undefined
				const stringValue = value != null ? String(value) : '';
				
				// Escape quotes and wrap in quotes
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

	const latestDate = getLatestDate(templateData);
</script>

<Head />
<Header />
<Article>
	<Headline
		brand="Your Brand Name"
		hed="Your Tracker Title"
	/>

	<Body>
		<BodyText
			text="This is a template tracker. Replace this text with your own description.
			
			<br><br>You can include <strong>HTML</strong> formatting, <a href='#'>links</a>, and other content.
			
			<br><br>Customize the data structure, filters, and display to match your needs."
		/>
		<div class="update-date-divider">
			<div class="divider-line"></div>
			<div class="update-date">
				<em>Last updated on</em> <strong>{latestDate}</strong>
			</div>
		</div>
	</Body>

	<!-- Filters Component -->
	<Filters 
		data={normalizedData}
		columns={tableColumns}
		bind:searchQuery
		bind:filterInteraction={filterCategory}
		bind:filterType={filterStatus}
		bind:filterPlatform={filterTags}
		bind:filterPublishers={[]}
		filteredRowCount={filteredData.length}
		onDownloadCSV={downloadToCSV}
	/>

	<!-- Card View -->
	<CardView 
		data={normalizedData}
		columns={tableColumns}
		{searchQuery}
		filterInteraction={filterCategory}
		filterType={filterStatus}
		filterPlatform={filterTags}
		filterPublishers={[]}
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

