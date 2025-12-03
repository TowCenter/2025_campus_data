<script>
	/**
	 * @typedef {Object} NavItem
	 * @property {string} href - Link anchor
	 * @property {string} label - Link text
	 */

	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} children - Content to render
	 * @property {NavItem[]} [navItems=[]] - Navigation items for left sidebar
	 */

	/** @type {Props} */
    let { 
		children,
		navItems = [
			{ href: 'https://towcenter.columbia.edu/news/platforms-and-publishers', label: 'Partners and Publishers' },
			{ href: 'https://tow.cjr.org/platform-timeline/', label: 'Timeline' },
			{ href: 'https://www.cjr.org/tow-center', label: 'Other Reports' }
		]
	} = $props();
</script>

<div class="container-lg">
    <div class="row">
        {#if navItems && navItems.length > 0}
            <div class="col-sm-2">
                <nav class="left-nav" aria-label="Page navigation">
                    <ul>
                        {#each navItems as item}
                            <li>
                                <a href={item.href}>{item.label}</a>
                            </li>
                        {/each}
                    </ul>
                </nav>
            </div>
        {/if}
        <div class="col-sm-10 entry-content">
            {@render children()}
        </div>
    </div>
</div>

<svelte:head>
    <style>
        /* Prevent FOUC by ensuring Bootstrap grid classes have fallback styles */
        .row {
            display: flex;
            flex-wrap: wrap;
            margin-right: -15px;
            margin-left: -15px;
        }
        .col-sm-2 {
            flex: 0 0 auto;
            width: 16.66666667%;
            padding-right: 15px;
            padding-left: 15px;
        }
        .col-sm-10 {
            flex: 0 0 auto;
            width: 83.33333333%;
            padding-right: 15px;
            padding-left: 15px;
        }
        .container-lg {
            width: 100%;
            padding-right: 15px;
            padding-left: 15px;
            margin-right: auto;
            margin-left: auto;
            max-width: 1140px;
        }
        @media (max-width: 767.98px) {
            .col-sm-2,
            .col-sm-10 {
                flex: 0 0 100%;
                max-width: 100%;
            }
        }
    </style>
</svelte:head>

<style>
    .left-nav {
        position: static;
    }

    .left-nav ul {
        list-style: none;
        padding: 0;
        margin: 0;
        border-left: 2px solid #ccc;
        padding-left: 1rem;
    }

    .left-nav li {
        margin-bottom: 0.75rem;
    }

    .left-nav a {
        color: #254c6f;
        text-decoration: none;
        font-size: 0.95rem;
        transition: color 0.2s;
    }

    .left-nav a:hover {
        color: #1a3454;
        text-decoration: underline;
    }

    @media screen and (max-width: 768px) {
        .left-nav {
            display: none;
        }

        .col-sm-2 {
            display: none;
        }

        .col-sm-10 {
            width: 100%;
            flex: 0 0 100%;
            max-width: 100%;
        }

        .entry-content {
            padding-left: 1rem;
            padding-right: 1rem;
        }
    }
</style>