<script>
	import Header from '../lib/Header.svelte';
	import Article from '../lib/Article.svelte';
	import Headline from '../lib/Headline.svelte';
	import Body from '../lib/Body.svelte';
	import BodyText from '../lib/BodyText.svelte';
	import Credits from '../lib/Credits.svelte';
	import Footer from '../lib/Footer.svelte';
	import { getLatestDate } from '../lib/data-utils.js';
	import { config } from '../config.js';
	import '../lib/cjr.css';

	// Get last updated date from data
	const lastUpdatedDate = getLatestDate(config.data, config.lastUpdatedField, config.dateField);
</script>

<Header />
<Article>
	<Headline
		hed={config.headline}
		subhed={config.subheadline}
		brand={config.brand}
		date={lastUpdatedDate}
		dateLabel={config.dateLabel}
		byline={config.byline}
		byline_url={config.bylineUrl}
	>
	</Headline>

	<Body navItems={config.navItems}>
		{#if config.bodyText}
			<BodyText text={config.bodyText} />
		{/if}

		<Credits
			maintainedBy={config.maintainedBy}
			designDevelopment={config.designDevelopment}
			acknowledgements={config.acknowledgements}
		/>
	</Body>
</Article>
<Footer />
