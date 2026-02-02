<script>
  import { base } from '$app/paths';

  /**
   * @typedef {Object} Props
   * @property {string} [activePage=''] - The current active page
   */

  /** @type {Props} */
  let { activePage = '' } = $props();

  const navItems = [
    { href: `${base}/`, label: 'Home' },
    { href: `${base}/announcements`, label: 'Search' },
    { href: `${base}/methodology`, label: 'Methodology' }
  ];
</script>

<nav class="page-nav">
  {#each navItems as item}
    <a
      href={item.href}
      class:active={activePage === item.label.toLowerCase() ||
                    (activePage === 'search' && item.href === `${base}/announcements`) ||
                    (activePage === 'home' && item.href === `${base}/`)}
    >
      {item.label}
    </a>
  {/each}
</nav>

<style>
  .page-nav {
    display: flex;
    gap: 2rem;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #e0e0e0;
    max-width: 900px;
    margin-left: auto;
    margin-right: auto;
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }

  .page-nav a {
    color: #666;
    text-decoration: none;
    font-size: 0.95rem;
    font-weight: 500;
    transition: color 0.2s ease;
  }

  .page-nav a:hover {
    color: #254c6f;
  }

  .page-nav a.active {
    color: #254c6f;
    border-bottom: 2px solid #254c6f;
    padding-bottom: 0.25rem;
  }
</style>
