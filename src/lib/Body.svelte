<script>
	import { page } from '$app/stores';
	import { goto, beforeNavigate, afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';

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
		if (!href) return false;
		
		// Normalize paths - remove trailing slashes
		const itemPath = href.replace(/\/$/, '') || '/';
		let current = currentPath.replace(/\/$/, '') || '/';
		
		// Handle root path redirect to /announcements
		if (itemPath.endsWith('/announcements') || itemPath === '/' || (itemPath === '' && current === '/announcements')) {
			return current === '/' || current === '/announcements' || current.endsWith('/announcements');
		}
		
		// For other paths, do exact match or check if current ends with the item path
		return itemPath === current || current === itemPath || current.endsWith(itemPath);
	}

	// Store scroll position
	let savedScrollPosition = 0;

	// Save scroll position before navigation
	beforeNavigate(({ to }) => {
		if (to && typeof window !== 'undefined') {
			savedScrollPosition = window.scrollY || window.pageYOffset;
			sessionStorage.setItem('tabScrollPosition', String(savedScrollPosition));
		}
	});

	// Restore scroll position after navigation
	afterNavigate(({ to }) => {
		if (to && typeof window !== 'undefined') {
			const savedScroll = sessionStorage.getItem('tabScrollPosition');
			if (savedScroll) {
				const scrollPos = parseInt(savedScroll, 10);
				// Use multiple attempts to ensure scroll is restored
				setTimeout(() => {
					window.scrollTo(0, scrollPos);
					requestAnimationFrame(() => {
						window.scrollTo(0, scrollPos);
					});
				}, 0);
				sessionStorage.removeItem('tabScrollPosition');
			}
		}
	});

	// Handle tab click with scroll preservation
	async function handleTabClick(event, href) {
		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();
		
		// Don't navigate if we're already on this page
		if (isActive(href)) {
			return false;
		}
		
		// Save current scroll position
		if (typeof window !== 'undefined') {
			savedScrollPosition = window.scrollY || window.pageYOffset;
			sessionStorage.setItem('tabScrollPosition', String(savedScrollPosition));
		}
		
		// Navigate using SvelteKit's goto - this should prevent full page reload
		try {
			await goto(href, {
				noScroll: true,
				replaceState: false,
				keepFocus: false,
				invalidateAll: false
			});
		} catch (error) {
			console.warn('Navigation error:', error);
			// Don't fallback to window.location - that causes full reload
			// Instead, try again with a slight delay
			setTimeout(() => {
				goto(href, {
					noScroll: true,
					replaceState: false,
					keepFocus: false,
					invalidateAll: false
				}).catch(err => {
					console.error('Navigation failed after retry:', err);
				});
			}, 10);
		}
		
		return false;
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
						onclick={(e) => handleTabClick(e, item.href)}
						onkeydown={(e) => e.key === 'Enter' && handleTabClick(e, item.href)}
						class:active={isActive(item.href)}
						class="tab-link"
						data-sveltekit-preload-data="hover"
						data-sveltekit-noscroll
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
            width: auto;
            max-width: 100%;
            padding-right: 0;
            padding-left: 0;
        }
        .col-full {
            flex: 0 0 auto;
            width: 100%;
            max-width: 100%;
            padding-right: 0;
            padding-left: 0;
        }
        .container-lg {
            width: 100%;
            padding-right: 0;
            padding-left: 0;
            margin-right: auto;
            margin-left: auto;
            max-width: 900px;
        }
        @media (max-width: 767px) {
            .col-sm-2,
            .col-sm-10,
            .col-full {
                flex: 0 0 100%;
                max-width: 100%;
                padding-left: 1rem !important;
                padding-right: 1rem !important;
            }
            .container-lg {
                padding-left: 0;
                padding-right: 0;
            }
        }
        @media (min-width: 768px) and (max-width: 1024px) {
            .col-sm-2,
            .col-sm-10,
            .col-full {
                padding-left: 1.5rem !important;
                padding-right: 1.5rem !important;
            }
            .container-lg {
                padding-left: 0;
                padding-right: 0;
            }
        }
    </style>
</svelte:head>

<style>
    /* Tab Navigation - Folder Tab Style */
    .tab-navigation {
        background: white;
        border-bottom: 1px solid #e0e0e0;
        margin-bottom: 2.5rem;
        margin-top: 1rem;
        position: relative;
    }

    .tab-list {
        display: flex;
        list-style: none;
        padding: 0;
        margin: 0;
        max-width: 900px;
        margin-left: auto;
        margin-right: auto;
        gap: 0.5rem;
    }

    .tab-list li {
        margin: 0;
    }

    .tab-link {
        display: inline-block;
        padding: 0.875rem 1.75rem 1rem 1.75rem;
        color: #666;
        text-decoration: none;
        font-weight: 500;
        font-size: 1rem;
        font-family: 'Graphik Web', 'Helvetica', sans-serif;
        background: #f5f5f5;
        border: 1px solid #e0e0e0;
        border-bottom: none;
        border-radius: 8px 8px 0 0;
        transition: all 0.2s ease;
        position: relative;
        top: 1px;
        text-transform: none;
        letter-spacing: 0;
        cursor: pointer;
    }

    .tab-link:hover {
        color: #254c6f;
        background: #fafafa;
        border-color: #d0d0d0;
    }

    .tab-link.active {
        color: #1a1a1a;
        background: white;
        border-color: #e0e0e0;
        border-bottom-color: white;
        font-weight: 600;
        z-index: 1;
        box-shadow: 0 -2px 4px rgba(0, 0, 0, 0.05);
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

    @media screen and (max-width: 767px) {
        .tab-navigation {
            margin-top: 0.5rem;
            margin-bottom: 1.5rem;
        }
        
        .tab-list {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding: 0 1rem;
            gap: 0.35rem;
        }

        .tab-link {
            padding: 0.75rem 1.25rem 0.875rem 1.25rem;
            font-size: 0.95rem;
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

        .col-full {
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
    @media screen and (min-width: 768px) and (max-width: 1024px) {
        .tab-list {
            padding: 0 1.5rem;
        }
        .col-sm-10,
        .col-full {
            padding-left: 1.5rem !important;
            padding-right: 1.5rem !important;
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