<script>
	import { page } from '$app/stores';

	/**
	 * @typedef {Object} NavItem
	 * @property {string} href - Link anchor
	 * @property {string} label - Link text
	 */

	/**
	 * @typedef {Object} Props
	 * @property {import('svelte').Snippet} children - Content to render
	 * @property {NavItem[]} [navItems=[]] - Navigation items for left sidebar
	 * @property {boolean} [showLeftNav=true] - Whether to show the left sidebar navigation
	 */

	/** @type {Props} */
    let {
		children,
		navItems = [
			{ href: 'https://towcenter.columbia.edu', label: 'Page 1' },
			{ href: 'https://towcenter.columbia.edu', label: 'Page 2' },
			{ href: 'https://towcenter.columbia.edu', label: 'Page 3' }
		],
		showLeftNav = true
	} = $props();

	// Get current path to highlight active link
	const currentPath = $derived($page.url.pathname);

	// Check if a nav item is the current page
	function isActive(href) {
		const itemPath = href.replace(/\/$/, '') || '/';
		const current = currentPath.replace(/\/$/, '') || '/';
		return itemPath === current;
	}
</script>

<!-- Tab Navigation -->
{#if navItems && navItems.length > 0}
	<nav class="tab-navigation" aria-label="Main navigation tabs">
		<ul class="tab-list">
			{#each navItems as item}
				<li>
					<a
						href={item.href}
						class:active={isActive(item.href)}
						class="tab-link"
					>
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

<div class="container-lg">
    <div class="row">
        {#if navItems && navItems.length > 0 && showLeftNav}
            <div class="col-sm-2">
                <nav class="left-nav" aria-label="Page navigation">
                    <ul>
                        {#each navItems as item}
                            <li>
                                <a href={item.href} class:active={isActive(item.href)}>{item.label}</a>
                            </li>
                        {/each}
                    </ul>
                </nav>
            </div>
            <div class="col-sm-10 entry-content">
                {@render children()}
            </div>
        {:else if showLeftNav === false}
            <div class="col-full entry-content">
                {@render children()}
            </div>
        {:else}
            <div class="col-sm-10 entry-content">
                {@render children()}
            </div>
        {/if}
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
            width: 21.5%;
            padding-right: 25px;
            padding-left: 15px;
        }
        .col-sm-10 {
            flex: 0 0 auto;
            width: 78.5%;
            padding-right: 15px;
            padding-left: 15px;
        }
        .col-full {
            flex: 0 0 auto;
            width: 100%;
            padding-right: 15px;
            padding-left: 15px;
        }
        .container-lg {
            width: 100%;
            padding-right: 15px;
            padding-left: 15px;
            margin-right: auto;
            margin-left: auto;
            max-width: 900px;
        }
        @media (max-width: 767.98px) {
            .col-sm-2,
            .col-sm-10,
            .col-full {
                flex: 0 0 100%;
                max-width: 100%;
                padding-left: 0 !important;
                padding-right: 0 !important;
            }
        }
    </style>
</svelte:head>

<style>
    /* Tab Navigation */
    .tab-navigation {
        background: white;
        border-bottom: 2px solid #e0e0e0;
        margin-bottom: 2rem;
    }

    .tab-list {
        display: flex;
        list-style: none;
        padding: 0;
        margin: 0;
        max-width: 900px;
        margin-left: auto;
        margin-right: auto;
        padding: 0 15px;
    }

    .tab-list li {
        margin: 0;
    }

    .tab-link {
        display: inline-block;
        padding: 1rem 1.5rem;
        color: #254c6f;
        text-decoration: none;
        font-weight: 500;
        font-size: 0.95rem;
        border-bottom: 3px solid transparent;
        transition: all 0.2s ease;
        margin-bottom: -2px;
    }

    .tab-link:hover {
        color: #1a3a52;
        border-bottom-color: #e0e0e0;
    }

    .tab-link.active {
        color: #1a1a1a;
        border-bottom-color: #254c6f;
        font-weight: 600;
    }

    .left-nav {
        position: static;
    }

    .left-nav ul {
        list-style: none;
        padding: 0;
        margin: 0;
        border-left: 2px solid #ccc;
        padding-left: 1.5rem;
    }

    .left-nav li {
        margin-bottom: 1.25rem;
        line-height: 1.5;
    }

    .left-nav a {
        color: #254c6f;
        text-decoration: none;
        font-size: 0.95rem;
        transition: color 0.2s;
        line-height: 1.6;
        display: block;
    }

    .left-nav a:hover {
        color: #1a3454;
        text-decoration: underline;
    }

    .left-nav a.active {
        color: #254c6f;
        font-weight: 600;
    }

    @media screen and (max-width: 768px) {
        .tab-list {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding: 0 1rem;
        }

        .tab-link {
            padding: 0.75rem 1rem;
            font-size: 0.85rem;
            white-space: nowrap;
        }

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
            padding-left: 1rem !important;
            padding-right: 1rem !important;
        }

        .entry-content {
            padding-left: 0;
            padding-right: 0;
        }
    }

    .update-date-divider {
        margin-top: 2rem;
        margin-bottom: 1.5rem;
        margin-left: 0;
    }

    .divider-line {
        height: 1px;
        background-color: #e0e0e0;
        margin-top: 0;
        margin-bottom: 1.25rem;
        margin-left: 0;
        margin-right: 0;
        width: 100%;
        display: block;
    }

    .update-date {
        font-family: 'Lyon Text Web', 'Georgia', serif;
        font-size: 20px;
        line-height: 28px;
        font-weight: normal;
        color: #222222;
        text-transform: none;
        display: block;
        margin-top: 0;
        margin-left: 0;
        letter-spacing: 0;
    }

    .update-date em {
        font-style: italic;
    }

    .update-date strong {
        font-weight: bold;
    }

    @media screen and (max-width: 768px) {
        .update-date-divider {
            margin-top: 1.5rem;
            margin-bottom: 1rem;
            margin-left: 0;
        }

        .divider-line {
            margin-bottom: 1rem;
        }

        .update-date {
            font-size: 18px;
            line-height: 1.6;
        }
    }
</style>