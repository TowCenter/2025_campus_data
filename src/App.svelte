<script>
  /**
   * Main Application Component
   *
   * This component serves as the root of the University Response Tracker application.
   * It manages client-side routing between Database and Methodology pages, implements
   * a single-page application (SPA) pattern, and integrates with Umami analytics.
   *
   * Key features:
   * - Client-side routing with browser history API
   * - Lazy component mounting for performance
   * - Mobile-responsive navigation
   * - Analytics tracking integration
   *
   * Svelte 5 Migration Notes:
   * - All event handlers use the new onclick syntax (not on:click)
   * - Event modifiers like preventDefault are now explicit function calls
   */

  import { onMount } from 'svelte';
  import Methodology from './Methodology.svelte';
  import Database from './Database.svelte';

  // Logo configuration for Tow Center branding
  const logoDesktopUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
  const logoMobileUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
  const logoAlt = 'Columbia Journalism School and Tow Center for Digital Journalism';
  const logoLink = 'https://towcenter.columbia.edu/';

  // Base path configuration for GitHub Pages deployment
  // The BASE_URL is set in vite.config.js and typically points to '/2025_campus_data/'
  const base = import.meta.env.BASE_URL || '/';
  const basePath = base.endsWith('/') ? base.slice(0, -1) : base;
  const routes = {
    database: base,
    methodology: `${basePath}/methodology`
  };

  // Metadata configuration for dynamic "Last updated" date
  const metadataUrl = 'https://2025-campus-data.s3.amazonaws.com/metadata.json';
  let lastUpdatedDisplay = null;

  /**
   * Normalize pathname by removing the base path prefix
   * This ensures consistent routing regardless of deployment context
   */
  function normalizePath(pathname) {
    if (basePath && pathname.startsWith(basePath)) {
      return pathname.slice(basePath.length) || '/';
    }
    return pathname;
  }

  /**
   * Determine which page to display based on the current pathname
   * Returns 'methodology' if the path includes that keyword, otherwise 'database'
   */
  function getPageFromPath(pathname) {
    const normalizedPath = normalizePath(pathname);
    return normalizedPath.includes('methodology') ? 'methodology' : 'database';
  }

  // Initialize page state based on current URL
  const initialPath = typeof window !== 'undefined' ? window.location.pathname : '/';
  let currentPage = getPageFromPath(initialPath);

  // Track which components have been mounted for lazy loading optimization
  let databaseMounted = currentPage === 'database';
  let methodologyMounted = currentPage === 'methodology';
  let mobileNavOpen = false;

  /**
   * Ensure a component is mounted before displaying it
   * Components are mounted once and kept in memory for fast switching
   */
  function ensureMounted(page) {
    if (page === 'database') databaseMounted = true;
    if (page === 'methodology') methodologyMounted = true;
  }

  /**
   * Update the current page based on pathname
   * Used for both initial load and browser back/forward navigation
   */
  const setPageFromPath = (pathname) => {
    currentPage = getPageFromPath(pathname);
    ensureMounted(currentPage);
    mobileNavOpen = false;
  };

  /**
   * Format ISO date strings into "Month D, YYYY"
   */
  const formatDate = (isoString) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(new Date(isoString));

  /**
   * Fetch latest metadata from S3 to populate the "Last updated" label
   */
  const fetchLastUpdated = async () => {
    const response = await fetch(metadataUrl, { cache: 'no-cache' });
    const metadataText = await response.text();
    const metadata = JSON.parse(metadataText.replace(/,\s*([}\]])/g, '$1'));

    const completedAt = metadata?.completed_at;
    lastUpdatedDisplay = completedAt ? formatDate(completedAt) : null;
  };

  /**
   * Initialize routing and analytics on component mount
   * Sets up popstate listener for browser back/forward buttons
   */
  onMount(() => {
    setPageFromPath(window.location.pathname);
    fetchLastUpdated();

    const handlePopState = () => setPageFromPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);

    // Track initial page view with Umami analytics
    if (window.umami) {
      window.umami.track();
    }

    // Cleanup function removes event listener when component unmounts
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  });

  /**
   * Navigate to a specific page programmatically
   * Updates browser history and triggers analytics tracking
   *
   * Note: Uses Svelte 5 syntax - no event modifiers, explicit handling required
   */
  function navigateTo(page) {
    currentPage = page;
    ensureMounted(page);
    window.history.pushState({}, '', routes[page]);
    mobileNavOpen = false;

    // Track page view in Umami for SPA navigation
    if (window.umami) {
      window.umami.track(props => ({
        ...props,
        url: routes[page],
        title: page === 'database' ? 'Database' : 'Methodology'
      }));
    }
  }
</script>

<!-- Header matching template -->
<div class="container-fluid top-nav-box">
  <div class="container-lg top-nav-1">
    <header class="cjr-header">
      <a class="cjr-header__logo-link" href={logoLink} rel="home">
        <img
          src={logoDesktopUrl}
          alt={logoAlt}
          class="cjr-header__logo"
        />
        <img
          src={logoMobileUrl}
          alt={logoAlt}
          class="cjr-logo-mobile"
        />
      </a>
      <a href="https://towcenter.columbia.edu/newsletter" class="stay-updated-btn" target="_blank" rel="noopener noreferrer">
        Stay Updated
      </a>
    </header>
  </div>
</div>

<!-- Article wrapper -->
<div class="container-xl mx-auto main-content-1">
  <!-- Headline matching template -->
  <div class="container-lg title-image-lg">
    <header class="headline-header">
      <p class="headline-category">TOW CENTER FOR DIGITAL JOURNALISM</p>
      <h1 class="main-title">University Response Tracker</h1>
      <p class="last-updated">
        <em>Last updated on</em> {lastUpdatedDisplay}
      </p>

      <!-- Credits and Acknowledgements Section -->
      <details class="credits-section">
        <summary class="credits-heading">
          <em>Credit and Acknowledgements</em>
        </summary>
        <div class="credits-box">
          <div class="credits-inner">
            <div class="credits-item">
              <span class="credits-label">Compiled and Maintained By:</span>
              <a href="#">[Name]</a>
            </div>
            <div class="credits-item">
              <span class="credits-label">Design and Development:</span>
              <a href="#">[Name]</a>
            </div>
            <div class="credits-acknowledgement">
              <span class="credits-label">Acknowledgements:</span>
              <p>
                <!-- Add acknowledgement text here -->
              </p>
            </div>
          </div>
        </div>
      </details>
    </header>
  </div>

  <!-- Body with sidebar nav matching template -->
  <div class="container-lg">
    <div class="row">
      <div class="col-12 mobile-nav" aria-label="Page navigation">
        <button
          class="mobile-nav-toggle"
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-nav-menu"
          onclick={() => (mobileNavOpen = !mobileNavOpen)}
          type="button"
        >
          <span class="hamburger" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </span>
          <span class="mobile-nav-label">
            {currentPage === 'database' ? 'Database' : 'Methodology'}
          </span>
        </button>
        {#if mobileNavOpen}
          <div id="mobile-nav-menu" class="mobile-nav-menu">
            <button
              class="mobile-nav-link"
              aria-current={currentPage === 'database' ? 'page' : undefined}
              onclick={() => navigateTo('database')}
              type="button"
            >
              Database
            </button>
            <button
              class="mobile-nav-link"
              aria-current={currentPage === 'methodology' ? 'page' : undefined}
              onclick={() => navigateTo('methodology')}
              type="button"
            >
              Methodology
            </button>
          </div>
        {/if}
      </div>
      <div class="col-md-2 col-lg-2">
        <nav class="left-nav" aria-label="Page navigation">
          <ul>
            <li>
              <a
                href="#database"
                class:active={currentPage === 'database'}
                onclick={(e) => { e.preventDefault(); navigateTo('database'); }}
              >
                Database
              </a>
            </li>
            <li>
              <a
                href="#methodology"
                class:active={currentPage === 'methodology'}
                onclick={(e) => { e.preventDefault(); navigateTo('methodology'); }}
              >
                Methodology
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div class="col-md-10 col-lg-10 entry-content">
        {#if databaseMounted}
          <div class="tab-panel" hidden={currentPage !== 'database'} aria-hidden={currentPage !== 'database'}>
            <Database />
          </div>
        {/if}
        {#if methodologyMounted}
          <div class="tab-panel" hidden={currentPage !== 'methodology'} aria-hidden={currentPage !== 'methodology'}>
            <Methodology />
          </div>
        {/if}
      </div>
    </div>
  </div>
</div>

<!-- Footer matching template -->
<div id="footer">
  <div id="footer-inner">
    <div class="logo">
      <img src="https://www.cjr.org/wp-content/themes/cjr2017/_resources2017/images/cjr-logo-horizontal-footer-1100.png" width="440" height="25" alt="Columbia Journalism Review">
      <p>The voice of journalism, since 1961</p>
    </div>
    <div class="lists">
      <div class="list">
        <h3>About</h3>
        <ul>
          <li><a href="https://www.cjr.org/about_us/mission_statement.php">Mission</a></li>
          <li><a href="https://www.cjr.org/about_us/masthead.php">Masthead</a></li>
          <li><a href="https://www.cjr.org/about_us/privacy_policy.php">Privacy Policy</a></li>
          <li><a href="https://www.cjr.org/about_us/contact.php">Contact</a></li>
        </ul>
      </div>
      <div class="list">
        <h3>Support CJR</h3>
        <ul>
          <li><a href="https://members.cjr.org/member/?a=nav-foot-mem&utm_source=cjr-org&utm_medium=cjr-nav&utm_campaign=m-land">Become a Member</a></li>
          <li><a href="https://www.cjr.org/about_us/donate.php">Donate</a></li>
        </ul>
      </div>
      <div class="list">
        <h3>Advertise</h3>
        <ul>
          <li><a href="https://www.cjr.org/about_us/advertise.php">Contact Us</a></li>
        </ul>
      </div>
    </div>

    <div class="copyright"><span class="copyright-mobile">Copyright 2025,</span> Columbia Journalism Review</div>
  </div>
</div>

<style>
  /* Global body styles */
  :global(body) {
    margin: 0;
    padding: 0;
  }

  /* Widen the headline and main content */
  .headline-header {
    max-width: 100%;
    margin-top: 3rem;
    margin-bottom: 3rem;
  }

  .headline-category {
    font-family: "Graphik Web", 'Helvetica', sans-serif;
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.1em;
    color: #999;
    text-transform: uppercase;
    margin-bottom: 0.5rem;
    margin-top: 0;
  }

  .main-title {
    font-family: "Lyon Display Web", 'Georgia', serif;
    font-size: 3.5rem;
    font-weight: 700;
    color: #254c6f;
    line-height: 1.1;
    margin-top: 0;
    margin-bottom: 1rem;
  }

  .last-updated {
    font-family: "Lyon Text Web", 'Georgia', serif;
    font-size: 1.125rem;
    color: #333;
    margin-top: 0;
    margin-bottom: 0.5rem;
  }

  .last-updated em {
    font-style: italic;
  }

  .byline {
    font-family: "Graphik Web", 'Helvetica', sans-serif;
    font-size: 0.875rem;
    color: #666;
    margin-top: 0.5rem;
    margin-bottom: 2rem;
  }

  @media screen and (max-width: 768px) {
    .main-title {
      font-size: 2.25rem;
    }

    .last-updated {
      font-size: 1rem;
    }

    .byline {
      font-size: 0.8rem;
    }
  }

  .entry-content {
    max-width: 100%;
  }

  .tab-panel[hidden] {
    display: none;
  }

  /* Template header styles */
  .cjr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  .cjr-header__logo-link {
    display: flex;
    align-items: center;
    text-decoration: none;
    line-height: 0;
    width: auto;
    height: 100%;
  }

  .stay-updated-btn {
    background-color: #999;
    color: white;
    font-family: "Graphik Web", 'Helvetica', sans-serif;
    font-size: 0.9rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    text-decoration: none;
    border: none;
    cursor: pointer;
    transition: background-color 0.2s;
    white-space: nowrap;
  }

  .stay-updated-btn:hover {
    background-color: #777;
    color: white;
    text-decoration: none;
  }

  .cjr-header__logo-link img.cjr-header__logo {
    max-width: 500px;
    width: auto !important;
    height: auto;
    max-height: 70px;
    object-fit: contain;
    display: block;
  }

  .cjr-header__logo-link img.cjr-logo-mobile {
    max-width: 100%;
    width: auto !important;
    height: auto;
    object-fit: contain;
    display: none;
  }

  @media screen and (max-width: 768px) {
    .cjr-header__logo-link img.cjr-header__logo {
      display: none;
    }

    .cjr-header__logo-link img.cjr-logo-mobile {
      display: block !important;
      max-height: 60px;
      width: auto !important;
      max-width: 100%;
    }
  }

  /* Mobile nav for tabs */
  .mobile-nav {
    display: none;
    margin-bottom: 1.25rem;
  }
  .mobile-nav-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.9rem 1rem;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    background: #f8f8f8;
    font-family: "Graphik Web", 'Helvetica', sans-serif;
    font-weight: 600;
    color: #254c6f;
    cursor: pointer;
    justify-content: center;
  }
  .mobile-nav-toggle:focus {
    outline: 2px solid #254c6f;
    outline-offset: 2px;
  }
  .hamburger {
    display: inline-flex;
    flex-direction: column;
    gap: 4px;
  }
  .hamburger span {
    display: block;
    width: 18px;
    height: 2px;
    background: #254c6f;
  }
  .mobile-nav-menu {
    margin-top: 0.75rem;
    background: #f8f8f8;
    border: 1px solid #e0e0e0;
    border-radius: 6px;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .mobile-nav-link {
    width: 100%;
    text-align: left;
    padding: 0.65rem 0.85rem;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    background: white;
    font-family: "Graphik Web", 'Helvetica', sans-serif;
    font-size: 0.95rem;
    color: #254c6f;
    cursor: pointer;
    transition: background 0.2s, border-color 0.2s;
  }
  .mobile-nav-link:hover,
  .mobile-nav-link[aria-current='page'] {
    background: #e9eef4;
    border-color: #254c6f;
  }

  /* Left sidebar navigation matching template */
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
    font-family: "Lyon Text Web", 'Georgia', serif;
  }

  .left-nav a:hover {
    color: #1a3454;
    text-decoration: underline;
  }

  .left-nav a.active {
    font-weight: 700;
    color: #1a3454;
  }

  @media screen and (max-width: 768px) {
    .mobile-nav {
      display: block;
    }
    .left-nav {
      display: none;
    }

    .col-md-2 {
      display: none;
    }

    .col-md-10 {
      width: 100%;
      flex: 0 0 100%;
      max-width: 100%;
    }

    .entry-content {
      padding-left: 1rem;
      padding-right: 1rem;
    }

    .headline-header {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  }

  /* Credits and Acknowledgements Section */
  .credits-section {
    margin-top: 2rem;
    margin-bottom: 1.5rem;
  }

  .credits-heading {
    cursor: pointer;
    list-style: none;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0;
    padding: 0;
  }

  .credits-heading::-webkit-details-marker {
    display: none;
  }

  .credits-heading::marker {
    display: none;
  }

  .credits-heading::before {
    content: '+';
    font-family: "Graphik Web", 'Helvetica', sans-serif;
    font-size: 1.25rem;
    font-weight: 400;
    color: #254c6f;
    display: inline-block;
    width: 1.25rem;
    text-align: center;
    transition: transform 0.2s;
  }

  .credits-section[open] .credits-heading::before {
    content: '−';
  }

  .credits-heading em {
    font-family: "Lyon Text Web", 'Georgia', serif;
    font-size: 1.125rem;
    font-style: italic;
    color: #333;
  }

  .credits-box {
    background-color: #f8f8f8;
    border-left: 3px solid #254c6f;
    padding: 1.5rem;
    margin-top: 1rem;
  }

  .credits-section:not([open]) .credits-box {
    display: none;
  }

  .credits-inner {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .credits-item {
    font-family: "Graphik Web", 'Helvetica', sans-serif;
    font-size: 0.9rem;
    line-height: 1.5;
  }

  .credits-label {
    font-weight: 600;
    color: #254c6f;
    margin-right: 0.5rem;
  }

  .credits-item a,
  .credits-acknowledgement a {
    color: #254c6f;
    text-decoration: none;
    transition: color 0.2s;
  }

  .credits-item a:hover,
  .credits-acknowledgement a:hover {
    color: #1a3547;
    text-decoration: underline;
  }

  .credits-acknowledgement {
    font-family: "Graphik Web", 'Helvetica', sans-serif;
    font-size: 0.9rem;
    line-height: 1.6;
  }

  .credits-acknowledgement p {
    margin: 0.5rem 0 0 0;
    color: #555;
  }

  @media screen and (max-width: 768px) {
    .credits-section {
      margin-top: 1.5rem;
    }

    .credits-heading {
      font-size: 1rem;
    }

    .credits-box {
      padding: 1rem;
    }

    .credits-item,
    .credits-acknowledgement {
      font-size: 0.85rem;
    }
  }
</style>
