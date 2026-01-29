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
		subhed="Comprehensive tracking of institutional responses to campus protests and federal actions across major universities nationwide."
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
