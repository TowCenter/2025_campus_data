<script>
  import { onMount } from 'svelte';
  import Methodology from './Methodology.svelte';
  import Database from './Database.svelte';

  let currentPage = 'database';

  // Logo configuration
  const logoDesktopUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
  const logoMobileUrl = 'https://miro.medium.com/v2/resize:fit:1070/1*Bdt1nEsNDbLfk-w0b3dnqA.jpeg';
  const logoAlt = 'Columbia Journalism School and Tow Center for Digital Journalism';
  const logoLink = 'https://towcenter.columbia.edu/';

  onMount(() => {
    // Handle browser navigation
    const path = window.location.pathname;
    if (path.includes('methodology')) {
      currentPage = 'methodology';
    }

    // Track initial page view with Umami
    if (window.umami) {
      window.umami.track();
    }
  });

  function navigateTo(page) {
    currentPage = page;
    const routes = {
      database: '/',
      methodology: '/methodology'
    };
    window.history.pushState({}, '', routes[page]);

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
      <p class="last-updated"><em>Last updated on</em> December 6, 2025</p>
      <p class="byline">By [Byline Name]</p>
    </header>
  </div>

  <!-- Body with sidebar nav matching template -->
  <div class="container-lg">
    <div class="row">
      <div class="col-md-2 col-lg-2">
        <nav class="left-nav" aria-label="Page navigation">
          <ul>
            <li>
              <a
                href="#database"
                class:active={currentPage === 'database'}
                on:click|preventDefault={() => navigateTo('database')}
              >
                Database
              </a>
            </li>
            <li>
              <a
                href="#methodology"
                class:active={currentPage === 'methodology'}
                on:click|preventDefault={() => navigateTo('methodology')}
              >
                Methodology
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div class="col-md-10 col-lg-10 entry-content">
        {#if currentPage === 'methodology'}
          <Methodology />
        {:else}
          <Database />
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
</style>
