<script>
  import { onMount } from 'svelte';
  import Methodology from './Methodology.svelte';
  import Database from './Database.svelte';
  
  let currentPage = 'database';
  
  onMount(() => {
    // Handle browser navigation
    const path = window.location.pathname;
    if (path.includes('methodology')) {
      currentPage = 'methodology';
    }
  });
  
  function navigateTo(page) {
    currentPage = page;
    const routes = {
      database: '/',
      methodology: '/methodology'
    };
    window.history.pushState({}, '', routes[page]);
  }
</script>

<main>
  <header>
    <div class="container">
      <div class="header-top">
        <a href="https://towcenter.columbia.edu/" target="_blank" rel="noopener noreferrer" class="logo-link">
          <img src="/tow-logo.svg" alt="Tow Center for Digital Journalism" class="logo" />
        </a>
      </div>
      <div class="header-content">
        <h1>University Response Tracker</h1>
        <p class="tagline">Monitoring institutional responses to campus protests and federal actions</p>
      </div>
      <nav>
        <button 
          class:active={currentPage === 'database'} 
          on:click={() => navigateTo('database')}
        >
          Database
        </button>
        <button 
          class:active={currentPage === 'methodology'} 
          on:click={() => navigateTo('methodology')}
        >
          Methodology
        </button>
      </nav>
    </div>
  </header>

  <div class="page-content">
    {#if currentPage === 'methodology'}
      <Methodology />
    {:else}
      <Database />
    {/if}
  </div>

  <footer>
    <div class="container">
      <p>A project by the Tow Center for Digital Journalism at Columbia University</p>
      <p class="footer-links">
        <a href="https://www.cjr.org/" target="_blank" rel="noopener noreferrer">Columbia Journalism Review</a> • 
        <a href="https://towcenter.columbia.edu/" target="_blank" rel="noopener noreferrer">Tow Center</a>
      </p>
    </div>
  </footer>
</main>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: "EB Garamond", serif;
    line-height: 1.7;
    color: #222;
    background: #ffffff;
  }

  :global(*) {
    box-sizing: border-box;
  }

  main {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  header {
    background: #ffffff;
    border-bottom: 1px solid #e0e0e0;
    padding: 1.5rem 0 0;
  }

  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 3rem;
  }

  .header-top {
    margin-bottom: 2rem;
  }

  .logo-link {
    display: inline-block;
    transition: opacity 0.2s;
  }

  .logo-link:hover {
    opacity: 0.8;
  }

  .logo {
    height: 50px;
    width: auto;
    display: block;
  }

  .header-content {
    margin-bottom: 1.5rem;
  }

  h1 {
    margin: 0 0 0.5rem;
    font-size: 2.8rem;
    font-weight: 400;
    color: #D6613A;
    letter-spacing: -0.02em;
    font-family: "EB Garamond", serif;
  }

  .tagline {
    margin: 0;
    font-size: 1.1rem;
    color: #666;
    font-weight: 400;
    font-family: "Helvetica Neue", sans-serif;
  }

  nav {
    display: flex;
    gap: 0;
    border-bottom: 2px solid #e0e0e0;
  }

  nav button {
    background: none;
    border: none;
    color: #666;
    padding: 0.75rem 1.5rem;
    font-size: 0.95rem;
    font-weight: 500;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.2s;
    position: relative;
    bottom: -2px;
    font-family: "Helvetica Neue", sans-serif;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }



  nav button:hover {
    color: #D6613A;
  }

  nav button.active {
    color: #D6613A;
    border-bottom-color: #D6613A;
  }

  .page-content {
    flex: 1;
    padding: 2rem 0;
    background: #ffffff;
  }

  footer {
    background: #ffffff;
    color: #666;
    padding: 2rem 0;
    margin-top: 4rem;
    text-align: center;
    border-top: 1px solid #e0e0e0;
    font-family: "Helvetica Neue", sans-serif;
  }

  footer p {
    margin: 0.5rem 0;
    font-size: 0.9rem;
  }

  .footer-links a {
    color: #D6613A;
    text-decoration: none;
  }

  .footer-links a:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .logo {
      height: 40px;
    }

    h1 {
      font-size: 2rem;
    }

    .tagline {
      font-size: 1rem;
    }

    nav button {
      padding: 0.6rem 1rem;
      font-size: 0.9rem;
    }

    .container {
      padding: 0 1.5rem;
    }
  }
</style>