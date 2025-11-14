<script>
    import { onMount } from 'svelte';
    
    // API Configuration
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    
    let allData = [];
    let filteredData = [];
    let loading = true;
    let error = null;
    let downloading = false;
    
    // Filters
    let selectedSchools = [];
    let selectedMonths = [];
    let searchTerm = '';
    let schools = [];
    let months = [];
    
    // Dropdown state
    let schoolDropdownOpen = false;
    let monthDropdownOpen = false;
    let schoolSearchTerm = '';
    let monthSearchTerm = '';
    
    // Pagination
    let currentPage = 1;
    let itemsPerPage = 50;
    let totalPages = 1;
    let totalResults = 0;
    
    // Cache for API responses
    const cache = new Map();
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    onMount(async () => {
      await loadInitialData();
    });
    
    // Fetch with caching
    async function fetchWithCache(url, cacheDuration = CACHE_DURATION) {
      const cached = cache.get(url);
      if (cached && Date.now() - cached.timestamp < cacheDuration) {
        return cached.data;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      cache.set(url, { data, timestamp: Date.now() });
      return data;
    }
    
    async function loadInitialData() {
      try {
        loading = true;
        error = null;
        
        // Load schools and months in parallel
        const [schoolsData, monthsData] = await Promise.all([
          fetchWithCache(`${API_BASE_URL}/schools`, 60 * 60 * 1000), // 1 hour cache
          fetchWithCache(`${API_BASE_URL}/months`, 60 * 60 * 1000)  // 1 hour cache
        ]);
        
        schools = schoolsData.map(school => school.name).sort();
        months = monthsData;
        
        // Load initial page of responses
        await loadResponses();
        
        loading = false;
      } catch (err) {
        console.error('Error loading initial data:', err);
        error = err.message;
        loading = false;
      }
    }
    
    async function loadResponses() {
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: itemsPerPage.toString()
        });
        
        if (selectedSchools.length > 0) {
          params.append('schools', selectedSchools.join(','));
        }
        
        if (selectedMonths.length > 0) {
          params.append('months', selectedMonths.join(','));
        }
        
        if (searchTerm.trim()) {
          params.append('search', searchTerm.trim());
        }
        
        const url = `${API_BASE_URL}/responses?${params}`;
        const data = await fetchWithCache(url);
        
        filteredData = data.data;
        totalResults = data.pagination.total;
        totalPages = data.pagination.totalPages;
        currentPage = data.pagination.page;
        
      } catch (err) {
        console.error('Error loading responses:', err);
        error = err.message;
      }
    }
    
    function toggleSchool(school, checked) {
      if (checked) {
        selectedSchools = [...selectedSchools, school];
      } else {
        selectedSchools = selectedSchools.filter(s => s !== school);
      }
      applyFilters();
    }
    
    function toggleMonth(month, checked) {
      if (checked) {
        selectedMonths = [...selectedMonths, month];
      } else {
        selectedMonths = selectedMonths.filter(m => m !== month);
      }
      applyFilters();
    }
    
    function clearSchools() {
      selectedSchools = [];
      applyFilters();
    }
    
    function clearMonths() {
      selectedMonths = [];
      applyFilters();
    }
    
    function applyFilters() {
      currentPage = 1;
      loadResponses();
    }
    
    function handleSearchInput() {
      // Debounce search to avoid too many API calls
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        applyFilters();
      }, 300);
    }
    
    let searchTimeout;
    
    $: filteredSchools = schoolSearchTerm 
      ? schools.filter(s => s.toLowerCase().includes(schoolSearchTerm.toLowerCase()))
      : schools;
      
    $: filteredMonths = monthSearchTerm 
      ? months.filter(m => m.toLowerCase().includes(monthSearchTerm.toLowerCase()))
      : months;
    
    function changePage(newPage) {
      if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        loadResponses();
        // Scroll to top of results
        document.querySelector('.results-section')?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    
    async function exportResults() {
      downloading = true;
      
      try {
        const params = new URLSearchParams();
        
        if (selectedSchools.length > 0) {
          params.append('schools', selectedSchools.join(','));
        }
        
        if (selectedMonths.length > 0) {
          params.append('months', selectedMonths.join(','));
        }
        
        if (searchTerm.trim()) {
          params.append('search', searchTerm.trim());
        }
        
        params.append('format', 'json');
        
        const url = `${API_BASE_URL}/export?${params}`;
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`Export failed: ${response.status}`);
        }
        
        const blob = await response.blob();
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `university_responses_filtered_${new Date().toISOString().split('T')[0]}.json`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        
      } catch (err) {
        alert('Error exporting data: ' + err.message);
      } finally {
        downloading = false;
      }
    }
    
    // Close dropdowns when clicking outside
    function handleClickOutside(event) {
      if (!event.target.closest('.multi-select-dropdown')) {
        schoolDropdownOpen = false;
        monthDropdownOpen = false;
      }
    }
    
    onMount(() => {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    });
  </script>
  
  <div class="database-container">
    <div class="container">
      <div class="content-wrapper">
        <h2>Database Search</h2>
        
        <section class="intro">
          <p class="lead">
            Search and filter through all institutional responses. Use the filters below to narrow results by institution, 
            date, or keyword, then download your filtered results.
          </p>
        </section>
  
        {#if loading}
          <div class="loading">
            <div class="spinner"></div>
            <p>Loading database...</p>
          </div>
        {:else if error}
          <div class="error">
            <p><strong>Error loading data:</strong> {error}</p>
            <button on:click={loadInitialData} class="retry-btn">Retry</button>
          </div>
        {:else}
          <!-- Filters -->
          <section class="filters-section">
            <div class="filters-grid">
              <div class="filter-group">
                <label for="institution-dropdown">Filter by Institution</label>
                <div class="multi-select-dropdown">
                  <button 
                    id="institution-dropdown"
                    class="dropdown-toggle" 
                    on:click|stopPropagation={() => { schoolDropdownOpen = !schoolDropdownOpen; monthDropdownOpen = false; }}
                    type="button"
                  >
                    {selectedSchools.length === 0 
                      ? 'All Institutions' 
                      : `${selectedSchools.length} selected`}
                    <span class="dropdown-arrow">{schoolDropdownOpen ? '▲' : '▼'}</span>
                  </button>
                  
                  {#if schoolDropdownOpen}
                    <div class="dropdown-menu">
                      <div class="dropdown-search">
                        <input 
                          type="text" 
                          bind:value={schoolSearchTerm}
                          placeholder="Search institutions..."
                          on:click|stopPropagation
                        />
                      </div>
                      <div class="dropdown-options">
                        {#each filteredSchools as school}
                          <label class="dropdown-option">
                            <input 
                              type="checkbox" 
                              value={school}
                              checked={selectedSchools.includes(school)}
                              on:change={(e) => toggleSchool(school, e.target.checked)}
                            />
                            <span>{school}</span>
                          </label>
                        {/each}
                      </div>
                      {#if selectedSchools.length > 0}
                        <button class="clear-selection" on:click={clearSchools} type="button">
                          Clear Selection
                        </button>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
              
              <div class="filter-group">
                <label for="month-dropdown">Filter by Month</label>
                <div class="multi-select-dropdown">
                  <button 
                    id="month-dropdown"
                    class="dropdown-toggle" 
                    on:click|stopPropagation={() => { monthDropdownOpen = !monthDropdownOpen; schoolDropdownOpen = false; }}
                    type="button"
                  >
                    {selectedMonths.length === 0 
                      ? 'All Months' 
                      : `${selectedMonths.length} selected`}
                    <span class="dropdown-arrow">{monthDropdownOpen ? '▲' : '▼'}</span>
                  </button>
                  
                  {#if monthDropdownOpen}
                    <div class="dropdown-menu">
                      <div class="dropdown-search">
                        <input 
                          type="text" 
                          bind:value={monthSearchTerm}
                          placeholder="Search months..."
                          on:click|stopPropagation
                        />
                      </div>
                      <div class="dropdown-options">
                        {#each filteredMonths as month}
                          <label class="dropdown-option">
                            <input 
                              type="checkbox" 
                              value={month}
                              checked={selectedMonths.includes(month)}
                              on:change={(e) => toggleMonth(month, e.target.checked)}
                            />
                            <span>{month}</span>
                          </label>
                        {/each}
                      </div>
                      {#if selectedMonths.length > 0}
                        <button class="clear-selection" on:click={clearMonths} type="button">
                          Clear Selection
                        </button>
                      {/if}
                    </div>
                  {/if}
                </div>
              </div>
            </div>
            
            <div class="search-export-row">
              <div class="search-wrapper">
                <input 
                  type="text" 
                  bind:value={searchTerm}
                  on:input={handleSearchInput}
                  placeholder="Search by keyword..."
                  class="search-input"
                />
              </div>
              
              <button on:click={exportResults} class="export-btn" disabled={downloading || totalResults === 0}>
                {#if downloading}
                  <span class="btn-spinner"></span>
                  Exporting...
                {:else}
                  Export {totalResults.toLocaleString()} items to JSON
                {/if}
              </button>
            </div>
          </section>
  
          <!-- Results -->
          <section class="results-section">
            <div class="results-header">
              <p class="results-count">
                Showing {totalResults.toLocaleString()} result{totalResults !== 1 ? 's' : ''}
                {#if selectedSchools.length > 0 || selectedMonths.length > 0 || searchTerm}
                  <span class="filter-indicator">(filtered)</span>
                {/if}
              </p>
            </div>
  
            <div class="results-list">
              {#each filteredData as item}
                <div class="result-card">
                  <div class="result-header">
                    <h3 class="result-title">
                      {#if item.url}
                        <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title || 'Untitled'}</a>
                      {:else}
                        {item.title || 'Untitled'}
                      {/if}
                    </h3>
                    <span class="result-school">{item.org}</span>
                  </div>
                  
                  {#if item.date}
                    <p class="result-date">
                      {new Date(item.date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  {/if}
                  
                  {#if item.content || item.excerpt}
                    <p class="result-excerpt">
                      {item.excerpt || item.content}
                    </p>
                  {/if}
                </div>
              {/each}
            </div>
  
            {#if totalPages > 1}
              <div class="pagination">
                <button 
                  class="page-btn" 
                  on:click={() => changePage(1)}
                  disabled={currentPage === 1}
                >
                  First
                </button>
                <button 
                  class="page-btn" 
                  on:click={() => changePage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                
                <span class="page-info">
                  Page {currentPage} of {totalPages}
                </span>
                
                <button 
                  class="page-btn" 
                  on:click={() => changePage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
                <button 
                  class="page-btn" 
                  on:click={() => changePage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  Last
                </button>
              </div>
            {/if}
          </section>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- Same CSS as before - keeping it identical -->
  <style>
    .database-container {
      background: white;
      min-height: 60vh;
    }
  
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 0 3rem;
    }
  
    .content-wrapper {
      padding: 2rem 0 4rem;
    }
  
    h2 {
      font-size: 2.5rem;
      margin: 0 0 1.5rem;
      color: #D6613A;
      font-weight: 400;
      font-family: "EB Garamond", serif;
      text-align: center;
    }
  
    .intro {
      text-align: center;
      margin-bottom: 3rem;
      max-width: 700px;
      margin-left: auto;
      margin-right: auto;
    }
  
    .lead {
      font-size: 1.1rem;
      line-height: 1.7;
      color: #444;
    }
  
    /* Loading States */
    .loading, .error {
      text-align: center;
      padding: 3rem 2rem;
    }
  
    .spinner {
      border: 4px solid #f3f3f3;
      border-top: 4px solid #D6613A;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
  
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  
    .error {
      color: #dc3545;
    }
  
    .retry-btn {
      margin-top: 1rem;
      padding: 0.5rem 1.5rem;
      background: white;
      color: #D6613A;
      border: 2px solid #D6613A;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      font-family: "Helvetica Neue", sans-serif;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transition: all 0.2s ease;
    }
  
    .retry-btn:hover {
      background: #D6613A;
      color: white;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }
  
    /* Filters Section */
    .filters-section {
      background: #f8f8f8;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 2rem;
      margin-bottom: 2rem;
    }
  
    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 1.5rem;
    }
  
    .filter-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #222;
      font-family: "Helvetica Neue", sans-serif;
      font-size: 0.9rem;
    }
  
    /* Multi-select dropdown */
    .multi-select-dropdown {
      position: relative;
    }
  
    .dropdown-toggle {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 0.95rem;
      font-family: "Helvetica Neue", sans-serif;
      background: white;
      cursor: pointer;
      text-align: left;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: border-color 0.2s;
    }
  
    .dropdown-toggle:hover {
      border-color: #D6613A;
    }
  
    .dropdown-arrow {
      font-size: 0.8rem;
      color: #666;
    }
  
    .dropdown-menu {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      margin-top: 0.25rem;
      background: white;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      max-height: 300px;
      display: flex;
      flex-direction: column;
    }
  
    .dropdown-search {
      padding: 0.75rem;
      border-bottom: 1px solid #e0e0e0;
    }
  
    .dropdown-search input {
      width: 100%;
      padding: 0.5rem;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 0.9rem;
      font-family: "Helvetica Neue", sans-serif;
    }
  
    .dropdown-search input:focus {
      outline: none;
      border-color: #D6613A;
    }
  
    .dropdown-options {
      overflow-y: auto;
      max-height: 200px;
    }
  
    .dropdown-option {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      cursor: pointer;
      transition: background 0.15s;
      font-size: 0.9rem;
      font-family: "Helvetica Neue", sans-serif;
    }
  
    .dropdown-option:hover {
      background: #f8f8f8;
    }
  
    .dropdown-option input[type="checkbox"] {
      cursor: pointer;
      accent-color: #D6613A;
    }
  
    .clear-selection {
      padding: 0.5rem 0.75rem;
      margin: 0.5rem;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      background: white;
      color: #666;
      font-size: 0.85rem;
      cursor: pointer;
      font-family: "Helvetica Neue", sans-serif;
      transition: all 0.2s;
    }
  
    .clear-selection:hover {
      background: #f8f8f8;
      border-color: #D6613A;
    }
  
    .search-export-row {
      display: flex;
      gap: 1rem;
      align-items: center;
      flex-wrap: wrap;
    }
  
    .search-wrapper {
      flex: 1;
      min-width: 250px;
    }
  
    .search-input {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 0.95rem;
      font-family: "Helvetica Neue", sans-serif;
    }
  
    .search-input:focus {
      outline: none;
      border-color: #D6613A;
      box-shadow: 0 0 0 3px rgba(214, 97, 58, 0.1);
    }
  
    .export-btn {
      background: white;
      color: #D6613A;
      border: 2px solid #D6613A;
      border-radius: 4px;
      padding: 0.7rem 1.5rem;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: "Helvetica Neue", sans-serif;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      white-space: nowrap;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
  
    .export-btn:hover:not(:disabled) {
      background: #D6613A;
      color: white;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
      transform: translateY(-1px);
    }
  
    .export-btn:disabled {
      background: white;
      border-color: #ccc;
      color: #ccc;
      cursor: not-allowed;
      box-shadow: none;
    }
  
    .btn-spinner {
      border: 2px solid #D6613A;
      border-top: 2px solid transparent;
      border-radius: 50%;
      width: 16px;
      height: 16px;
      animation: spin 0.8s linear infinite;
      display: inline-block;
    }
  
    /* Results Section */
    .results-section {
      margin-top: 2rem;
    }
  
    .results-header {
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
      border-bottom: 2px solid #e0e0e0;
    }
  
    .results-count {
      font-family: "Helvetica Neue", sans-serif;
      font-weight: 500;
      color: #666;
      font-size: 0.95rem;
    }
  
    .filter-indicator {
      color: #888;
      font-weight: 400;
    }
  
    .results-list {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
  
    .result-card {
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 1.5rem;
      transition: all 0.2s ease;
    }
  
    .result-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border-color: #D6613A;
    }
  
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 0.5rem;
    }
  
    .result-title {
      font-size: 1.25rem;
      font-weight: 500;
      color: #222;
      margin: 0;
      font-family: "EB Garamond", serif;
      flex: 1;
    }
  
    .result-title a {
      color: #D6613A;
      text-decoration: none;
    }
  
    .result-title a:hover {
      text-decoration: underline;
    }
  
    .result-school {
      background: #f0f0f0;
      padding: 0.25rem 0.75rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-family: "Helvetica Neue", sans-serif;
      color: #666;
      white-space: nowrap;
    }
  
    .result-date {
      font-size: 0.9rem;
      color: #888;
      margin: 0.5rem 0;
      font-family: "Helvetica Neue", sans-serif;
    }
  
    .result-excerpt {
      font-size: 0.95rem;
      line-height: 1.6;
      color: #555;
      margin: 1rem 0 0;
    }
  
    /* Pagination */
    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 0.5rem;
      margin-top: 3rem;
      padding: 1.5rem 0;
    }
  
    .page-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #dee2e6;
      background: white;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      font-family: "Helvetica Neue", sans-serif;
      transition: all 0.2s ease;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
  
    .page-btn:hover:not(:disabled) {
      background: #f8f9fa;
      border-color: #D6613A;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }
  
    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      box-shadow: none;
    }
  
    .page-info {
      padding: 0 1rem;
      font-weight: 500;
      font-family: "Helvetica Neue", sans-serif;
      font-size: 0.95rem;
    }
  
    @media (max-width: 768px) {
      .container {
        padding: 0 1.5rem;
      }
  
      h2 {
        font-size: 2rem;
      }
  
      .filters-grid {
        grid-template-columns: 1fr;
      }
  
      .search-export-row {
        flex-direction: column;
        align-items: stretch;
      }
  
      .export-btn {
        width: 100%;
        justify-content: center;
      }
  
      .result-header {
        flex-direction: column;
        align-items: flex-start;
      }
  
      .result-school {
        align-self: flex-start;
      }
    }
  </style>