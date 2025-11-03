<script>
    import { onMount } from 'svelte';
    
    const S3_BUCKET_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/data.json';
    
    let allData = [];
    let filteredData = [];
    let loading = true;
    let error = null;
    let downloading = false;
    
    // Filters
    let selectedSchool = 'all';
    let selectedMonth = 'all';
    let searchTerm = '';
    let schools = [];
    let months = [];
    
    // Pagination
    let currentPage = 1;
    let itemsPerPage = 50;
    let totalPages = 1;
    
    onMount(async () => {
      await loadData();
    });
    
    async function loadData() {
      try {
        loading = true;
        error = null;
        
        const response = await fetch(S3_BUCKET_URL);
        
        if (!response.ok) {
          throw new Error(`Failed to load data: ${response.status}`);
        }
        
        allData = await response.json();
        
        // Extract unique schools
        const schoolSet = new Set();
        allData.forEach(item => {
          if (item.org) {
            schoolSet.add(item.org);
          }
        });
        schools = ['all', ...Array.from(schoolSet).sort()];
        
        // Extract unique months
        const monthSet = new Set();
        allData.forEach(item => {
          if (item.date?.$date) {
            const date = new Date(item.date.$date);
            const monthYear = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            monthSet.add(monthYear);
          }
        });
        months = ['all', ...Array.from(monthSet).sort()];
        
        filteredData = [...allData];
        updatePagination();
        loading = false;
      } catch (err) {
        console.error('Error loading data:', err);
        error = err.message;
        loading = false;
      }
    }
    
    function applyFilters() {
      filteredData = allData.filter(item => {
        // School filter
        if (selectedSchool !== 'all' && item.org !== selectedSchool) {
          return false;
        }
        
        // Month filter
        if (selectedMonth !== 'all' && item.date?.$date) {
          const date = new Date(item.date.$date);
          const monthYear = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
          if (monthYear !== selectedMonth) {
            return false;
          }
        }
        
        // Search filter
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const searchableText = [
            item.title,
            item.org,
            item.content
          ].filter(Boolean).join(' ').toLowerCase();
          
          if (!searchableText.includes(term)) {
            return false;
          }
        }
        
        return true;
      });
      
      currentPage = 1;
      updatePagination();
    }
    
    function updatePagination() {
      totalPages = Math.ceil(filteredData.length / itemsPerPage);
      if (currentPage > totalPages) {
        currentPage = totalPages || 1;
      }
    }
    
    function changePage(newPage) {
      if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
      }
    }
    
    function cleanDataForExport(data) {
      return data.map(item => {
        const { llm_response, scraper, ...cleanItem } = item;
        return cleanItem;
      });
    }
    
    async function exportResults() {
      downloading = true;
      
      try {
        const cleanData = cleanDataForExport(filteredData);
        const jsonContent = JSON.stringify(cleanData, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `university_responses_filtered_${new Date().toISOString().split('T')[0]}.json`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        alert('Error exporting data: ' + err.message);
      } finally {
        downloading = false;
      }
    }
    
    $: paginatedData = filteredData.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
    
    $: {
      // Auto-apply filters when any filter changes
      if (!loading) {
        applyFilters();
      }
    }
  </script>
  
  <div class="database-container">
    <div class="container">
      <div class="content-wrapper">
        <h2>Database Search</h2>
        
        <section class="intro">
          <p class="lead">
            Search and filter through all institutional responses. Use the filters below to narrow results by institution, 
            date, or keyword.
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
            <button on:click={loadData} class="retry-btn">Retry</button>
          </div>
        {:else}
          <!-- Filters -->
          <section class="filters-section">
            <div class="filters-grid">
              <div class="filter-group">
                <label for="school-filter">Filter by Institution</label>
                <select id="school-filter" bind:value={selectedSchool}>
                  {#each schools as school}
                    <option value={school}>{school === 'all' ? 'All Institutions' : school}</option>
                  {/each}
                </select>
              </div>
              
              <div class="filter-group">
                <label for="month-filter">Filter by Month</label>
                <select id="month-filter" bind:value={selectedMonth}>
                  {#each months as month}
                    <option value={month}>{month === 'all' ? 'All Months' : month}</option>
                  {/each}
                </select>
              </div>
            </div>
            
            <div class="search-export-row">
              <div class="search-wrapper">
                <input 
                  type="text" 
                  bind:value={searchTerm}
                  placeholder="Search by keyword..."
                  class="search-input"
                />
              </div>
              
              <button on:click={exportResults} class="export-btn" disabled={downloading || filteredData.length === 0}>
                {#if downloading}
                  <span class="btn-spinner"></span>
                  Exporting...
                {:else}
                  Export {filteredData.length} items to JSON
                {/if}
              </button>
            </div>
          </section>
  
          <!-- Results -->
          <section class="results-section">
            <div class="results-header">
              <p class="results-count">
                Showing {filteredData.length.toLocaleString()} result{filteredData.length !== 1 ? 's' : ''}
              </p>
            </div>
  
            <div class="results-list">
              {#each paginatedData as item}
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
                  
                  {#if item.date?.$date}
                    <p class="result-date">
                      {new Date(item.date.$date).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </p>
                  {/if}
                  
                  {#if item.content}
                    <p class="result-excerpt">
                      {item.content.substring(0, 250)}{item.content.length > 250 ? '...' : ''}
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
  
    .filter-group select {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 0.95rem;
      font-family: "Helvetica Neue", sans-serif;
      background: white;
      cursor: pointer;
    }
  
    .filter-group select:focus {
      outline: none;
      border-color: #D6613A;
      box-shadow: 0 0 0 3px rgba(214, 97, 58, 0.1);
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