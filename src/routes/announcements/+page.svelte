<script>
	import Header from '../../lib/Header.svelte';
	import Article from '../../lib/Article.svelte';
	import Headline from '../../lib/Headline.svelte';
	import Body from '../../lib/Body.svelte';
	import Data from '../../lib/Data.svelte';
	import DataTableRow from '../../lib/DataTableRow.svelte';
	import Footer from '../../lib/Footer.svelte';
	import { getLatestDate } from '../../lib/data-utils.js';
	import { config } from '../../config.js';
	import '../../lib/cjr.css';

	// Get last updated date from data
	const lastUpdatedDate = getLatestDate(config.data, config.lastUpdatedField, config.dateField);

	// Ensure categoryDefinitions is the right type
	/** @type {Record<string, string>} */
	const categoryDefinitions = config.categoryDefinitions || {};
</script>

<Header />
<Article>
	<Headline
		hed={config.headline}
		subhed="Browse all announcements with filters. Use the filters to narrow down by school, date range, or search terms."
		brand={config.brand}
		date={lastUpdatedDate}
		dateLabel={config.dateLabel}
		byline={config.byline}
		byline_url={config.bylineUrl}
		maintainedBy={config.maintainedBy}
		designDevelopment={config.designDevelopment}
		acknowledgements={config.acknowledgements}
	>
	</Headline>

	<Body navItems={config.navItems} showLeftNav={false}>
		<Data
			data={config.data}
			filterConfig={config.filterConfig}
			dateField={config.dateField}
			initialVisibleCount={config.initialVisibleCount}
			showTimeline={false}
			showYearNavigation={false}
			{categoryDefinitions}
			itemComponent={DataTableRow}
			displayMode="table"
		/>
	</Body>
</Article>
<Footer />
