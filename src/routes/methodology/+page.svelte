<script>
	import Header from '../../lib/Header.svelte';
	import Article from '../../lib/Article.svelte';
	import Headline from '../../lib/Headline.svelte';
	import Body from '../../lib/Body.svelte';
	import BodyText from '../../lib/BodyText.svelte';
	import Footer from '../../lib/Footer.svelte';
	import { getLatestDate } from '../../lib/data-utils.js';
	import { config } from '../../config.js';
	import '../../lib/cjr.css';

	// Get last updated date from data
	const lastUpdatedDate = getLatestDate(config.data, config.lastUpdatedField, config.dateField);
</script>

<Header />
<Article>
	<Headline
		hed="Dataset Methodology"
		subhed={config.subheadline}
		brand={config.brand}
		date={lastUpdatedDate}
		dateLabel={config.dateLabel}
		byline={config.byline}
		byline_url={config.bylineUrl}
	>
	</Headline>

	<Body navItems={config.navItems}>
		<BodyText text={`
			<h2>Overview</h2>
			<p>This database tracks public communications from 100+ universities during a period of heightened federal oversight. The data contains official announcements and statements from universities starting from January 2025 and can provide insights into how institutions of higher education respond to regulatory pressure.</p>

			<h2>Collection</h2>
			<p>The database includes announcements from universities that the Department of Education and other agencies have announced investigations into since President Donald Trump came into office. We rely on the Hechinger Report's investigation tracker to keep the list of universities updated.</p>
			<p>We collect official announcements and statements from each institution's main announcement webpage, as well as from the websites for the president or chancellor's office, the provost's office, and the board of trustees or equivalent administrative offices.</p>

			<h2>Limitations</h2>
			<p>The data does not include private or internal communications, information published in non-latin characters, social media posts, individual department or faculty pages or any page that requires a login or password to access.</p>

			<h2>Privacy & Ethics</h2>
			<p>All data collection focuses exclusively on publicly available content that universities have chosen to share openly. No private communications or restricted-access materials are included in the database.</p>

			<h2>Access & Updates</h2>
			<p>This dataset is open-source and updated weekly as new university communications are published. For technical questions about data collection methods or to report data quality issues, please contact our team.</p>

			<h2>Frequently Asked Questions</h2>
			<div class="faq-section">
				<div class="faq-item">
					<h3>What is available for any given school?</h3>
					<p class="faq-placeholder">[FAQ content to be added]</p>
				</div>
				<div class="faq-item">
					<h3>What types of schools are included?</h3>
					<p class="faq-placeholder">[FAQ content to be added]</p>
				</div>
				<div class="faq-item">
					<h3>Do you have data from before January 2025?</h3>
					<p class="faq-placeholder">[FAQ content to be added]</p>
				</div>
				<div class="faq-item">
					<h3>How often does the data update?</h3>
					<p class="faq-placeholder">[FAQ content to be added]</p>
				</div>
				<div class="faq-item">
					<h3>I noticed an issue with the data.</h3>
					<p class="faq-placeholder">[FAQ content to be added]</p>
				</div>
			</div>
		`} />
	</Body>
</Article>
<Footer />

<style>
	:global(.faq-section) {
		margin-top: 2rem;
	}

	:global(.faq-item) {
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid #e0e0e0;
	}

	:global(.faq-item:last-child) {
		border-bottom: none;
		margin-bottom: 0;
		padding-bottom: 0;
	}

	:global(.faq-item h3) {
		font-size: 1.125rem;
		font-weight: 600;
		color: #1a1a1a;
		margin-bottom: 0.75rem;
		margin-top: 0;
	}

	:global(.faq-placeholder) {
		color: #666;
		font-style: italic;
		margin: 0;
	}
</style>
