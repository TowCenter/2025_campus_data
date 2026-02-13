<script>
	import Header from '../../lib/Header.svelte';
	import Article from '../../lib/Article.svelte';
	import Headline from '../../lib/Headline.svelte';
	import Body from '../../lib/Body.svelte';
	import Footer from '../../lib/Footer.svelte';
	import Methodology from '../../lib/Methodology.svelte';
	import { getLatestDate } from '../../lib/data-utils.js';
	import { config } from '../../config.js';
	import '../../lib/cjr.css';

	export let data;

	// Get last updated date from metadata
	const lastUpdatedDate = getLatestDate(data?.metadata, config.lastUpdatedField);
</script>

<Header />
<Article>
	<Headline
		hed={config.headline}
		subhed=""
		bodyText="This research database catalogs public communications from more than <b>110 colleges and universities</b> that have been named in federal investigations by the Department of Education under the Trump administration. The database is intended to help researchers and reporters better understand how universities have been responding to federal requests. It includes universities' public announcements, statements, and news releases from January 1, 2025. The dataset is updated weekly."
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
		<Methodology />
	</Body>
</Article>
<Footer />
