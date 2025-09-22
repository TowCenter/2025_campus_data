<script>
    import Head from "../../../src/lib/Head.svelte";
    import Article from "../../../src/lib/Article.svelte";
    import Header from "../../../src/lib/Header.svelte";
    import Headline from "../../../src/lib/Headline.svelte";
    import Footer from "../../../src/lib/Footer.svelte";
    import TowPartnerLogo from "../../../src/lib/TowPartnerLogo.svelte";
    import BodyText from "../../../src/lib/BodyText.svelte";
    import Body from "../../../src/lib/Body.svelte";

    // import tow css from src/lib/tow.css
    import '../../../src/lib/tow.css';

    // import content from '$locales/en/content.json';
</script>

<Head />
<Header />
<Article>
    <Headline
        hed="Headline text goes here"
        subhed="Subheadline text goes here"
        date="September 16, 2025"
        byline_url="https://www.cjr.org/author/cj-robinson"
        byline="C.J. Robinson"
    >
        <TowPartnerLogo />
    </Headline>

    <Body>
        <!-- 
        {#each content.blocks as block}
        {#if block.type === 'text'}
            <BodyText text={block.text} />
        {/if}
        {/each} -->
        <BodyText
            text="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
        />
        <BodyText
            text="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
        />
    </Body>
</Article>
<Footer />
