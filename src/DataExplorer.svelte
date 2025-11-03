<script>
  import { onMount } from 'svelte';
  
  // AWS S3 configuration - UPDATE THESE VALUES
  const S3_BUCKET_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/data.json';
  const S3_LIST_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/list.json';
  
  let allData = [];
  let schoolsList = [];
  let schools = [];
  let selectedSchools = new Set();
  let searchTerm = '';
  let loading = true;
  let downloading = false;
  let error = null;
  let lastUpdated = null;
  let selectAll = false;
  let dataLoaded = false;
  
  // Download format selection
  let selectedFormatSelected = 'csv';
  let allFormatSelected = 'csv';
  
  // Pagination
  let currentPage = 1;
  let itemsPerPage = 50;
  let totalPages = 1;
  
  // Sorting
  let sortColumn = 'org';
  let sortDirection = 'asc';
  
  onMount(async () => {
    await loadData();
  });
  
  async function loadData() {
    try {
      loading = true;
      error = null;
      
      const listResponse = await fetch(S3_LIST_URL);
      
      if (!listResponse.ok) {
        throw new Error(`Failed to load school list: ${listResponse.status}`);
      }
      
      schoolsList = await listResponse.json();
      
      const schoolSet = new Set();
      schoolsList.forEach(item => {
        if (item.name) {
          schoolSet.add(item.name);
        }
      });
      schools = Array.from(schoolSet).sort();
      
      const dates = schoolsList
        .map(item => item.last_run?.$date)
        .filter(Boolean)
        .map(date => new Date(date));
      
      if (dates.length > 0) {
        lastUpdated = new Date(Math.max(...dates));
      }
      
      updatePagination();
      loading = false;
    } catch (err) {
      console.error('Error loading school list:', err);
      error = err.message;
      loading = false;
    }
  }
  
  async function loadFullData() {
    if (dataLoaded) return allData;
    
    try {
      downloading = true;
      const response = await fetch(S3_BUCKET_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status}`);
      }
      
      allData = await response.json();
      dataLoaded = true;
      downloading = false;
      
      return allData;
    } catch (err) {
      downloading = false;
      console.error('Error loading full data:', err);
      throw err;
    }
  }
  
  function toggleSchool(school) {
    if (selectedSchools.has(school)) {
      selectedSchools.delete(school);
    } else {
      selectedSchools.add(school);
    }
    selectedSchools = selectedSchools;
    selectAll = selectedSchools.size === schools.length;
  }
  
  function toggleSelectAll() {
    if (selectAll) {
      selectedSchools = new Set(schools);
    } else {
      selectedSchools = new Set();
    }
  }
  
  function handleSearch() {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
      const schoolSet = new Set();
      schoolsList.forEach(item => {
        if (item.name) {
          schoolSet.add(item.name);
        }
      });
      schools = Array.from(schoolSet).sort();
    } else {
      schools = schoolsList
        .filter(item => item.name?.toLowerCase().includes(term))
        .map(item => item.name)
        .sort();
    }
    
    currentPage = 1;
    updatePagination();
  }
  
  function sortTable(column) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
    
    schools.sort((a, b) => {
      const comparison = a.localeCompare(b);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }
  
  function updatePagination() {
    totalPages = Math.ceil(schools.length / itemsPerPage);
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
  
  async function getSelectedData() {
    await loadFullData();
    
    let selectedData;
    if (selectedSchools.size === 0) {
      selectedData = allData;
    } else {
      selectedData = allData.filter(item => 
        selectedSchools.has(item.org)
      );
    }
    return cleanDataForExport(selectedData);
  }
  
  async function downloadSelected() {
    if (selectedSchools.size === 0) {
      alert('Please select at least one institution');
      return;
    }
    
    downloading = true;
    
    try {
      if (selectedFormatSelected === 'csv') {
        await downloadCSV(await getSelectedData());
      } else {
        await downloadJSON(await getSelectedData());
      }
    } catch (err) {
      alert('Error downloading data: ' + err.message);
    } finally {
      downloading = false;
    }
  }
  
  async function downloadAll() {
    downloading = true;
    
    try {
      selectedSchools = new Set(schools);
      const data = await getSelectedData();
      
      if (allFormatSelected === 'csv') {
        await downloadCSV(data);
      } else {
        await downloadJSON(data);
      }
    } catch (err) {
      alert('Error downloading data: ' + err.message);
    } finally {
      downloading = false;
    }
  }
  
  async function downloadCSV(data) {
    if (data.length === 0) {
      alert('No data to download');
      return;
    }
    
    const allKeys = new Set();
    data.forEach(item => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });
    
    const headers = Array.from(allKeys);
    
    function flattenValue(value) {
      if (value === null || value === undefined) {
        return '';
      }
      if (typeof value === 'object') {
        if (value.$oid) return value.$oid;
        if (value.$date) return new Date(value.$date).toISOString();
        return JSON.stringify(value).replace(/"/g, '""');
      }
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }
    
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => flattenValue(row[header])).join(',')
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `university_responses_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  async function downloadJSON(data) {
    if (data.length === 0) {
      alert('No data to download');
      return;
    }
    
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `university_responses_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
  
  $: paginatedSchools = schools.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  $: selectedCount = selectedSchools.size;
</script>

<div class="data-explorer-container">
  <div class="container">
    <div class="content-wrapper">
      <h2>Data & Downloads</h2>
      
      <section class="intro">
        <p class="lead">
          Download the complete dataset of university responses to campus protests and federal actions. 
          Select specific institutions below, or download the entire dataset.
        </p>
        
        {#if lastUpdated}
          <div class="last-updated">
            <strong>Last Updated:</strong> {lastUpdated.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric'
            })}
          </div>
        {/if}
      </section>

      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading schools...</p>
        </div>
      {:else if error}
        <div class="error">
          <p><strong>Error loading data:</strong> {error}</p>
          <button on:click={loadData} class="retry-btn">Retry</button>
        </div>
      {:else}
        <!-- Download All Section -->
        <section class="download-card">
          <h3>Download All Data</h3>
          <p>Download the complete dataset for all {schools.length} institutions</p>
          
          <div class="format-selector">
            <label class="radio-label">
              <input type="radio" bind:group={allFormatSelected} value="csv" />
              <span>CSV</span>
            </label>
            <label class="radio-label">
              <input type="radio" bind:group={allFormatSelected} value="json" />
              <span>JSON</span>
            </label>
          </div>
          
          <button on:click={downloadAll} class="btn-download" disabled={downloading}>
            {#if downloading}
              <span class="btn-spinner"></span>
              Downloading...
            {:else}
              Download All
            {/if}
          </button>
        </section>

        <!-- Download by School Section -->
        <section class="download-card">
          <h3>Download by Institution</h3>
          <p>Select specific institutions from the table below ({selectedCount} selected)</p>
          
          <div class="format-selector">
            <label class="radio-label">
              <input type="radio" bind:group={selectedFormatSelected} value="csv" />
              <span>CSV</span>
            </label>
            <label class="radio-label">
              <input type="radio" bind:group={selectedFormatSelected} value="json" />
              <span>JSON</span>
            </label>
          </div>
          
          <button on:click={downloadSelected} class="btn-download" disabled={downloading || selectedCount === 0}>
            {#if downloading}
              <span class="btn-spinner"></span>
              Downloading...
            {:else}
              Download Selected
            {/if}
          </button>
        </section>

        <!-- Schools Table -->
        <section class="table-section">
          <div class="table-header">
            <div class="search-box">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2"/>
                <path d="M12 12l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
              <input 
                type="text" 
                bind:value={searchTerm}
                on:input={handleSearch}
                placeholder="Search institutions..."
              />
              {#if searchTerm}
                <button class="clear-btn" on:click={() => { searchTerm = ''; handleSearch(); }}>
                  ×
                </button>
              {/if}
            </div>
            
            <div class="showing">
              {schools.length.toLocaleString()} institution{schools.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th class="checkbox-col">
                    <input 
                      type="checkbox" 
                      bind:checked={selectAll}
                      on:change={toggleSelectAll}
                    />
                  </th>
                  <th class="sortable" on:click={() => sortTable('org')}>
                    Institution
                    {#if sortColumn === 'org'}
                      <span class="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    {/if}
                  </th>
                </tr>
              </thead>
              <tbody>
                {#each paginatedSchools as school, index}
                  <tr class:striped={index % 2 === 1} class:selected={selectedSchools.has(school)}>
                    <td class="checkbox-col">
                      <input 
                        type="checkbox" 
                        checked={selectedSchools.has(school)}
                        on:change={() => toggleSchool(school)}
                      />
                    </td>
                    <td class="school-name">{school}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
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

        <section class="data-info">
          <h3>About This Dataset</h3>
          <p>
            The dataset includes institutional responses with URLs, titles, content, dates, and classifications. 
            Internal processing fields are excluded from downloads.
          </p>
        </section>
      {/if}
    </div>
  </div>
</div>

<style>
  .data-explorer-container {
    background: white;
    min-height: 60vh;
  }

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 0 2rem;
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

  h3 {
    font-size: 1.4rem;
    margin: 0 0 0.5rem;
    color: #222;
    font-weight: 500;
    font-family: "Helvetica Neue", sans-serif;
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
    margin-bottom: 1.5rem;
  }

  .last-updated {
    background: #E4F3F1;
    border-left: 4px solid #66C2C2;
    padding: 0.75rem 1.25rem;
    border-radius: 4px;
    display: inline-block;
    font-size: 0.95rem;
  }

  .last-updated strong {
    color: #222;
    font-family: "Helvetica Neue", sans-serif;
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
    background: #D6613A;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    font-family: "Helvetica Neue", sans-serif;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
  }

  .retry-btn:hover {
    background: #c55532;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .retry-btn:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  /* Download Cards */
  .download-card {
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  .download-card p {
    color: #666;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
  }

  .format-selector {
    display: flex;
    gap: 1.5rem;
    justify-content: center;
    margin-bottom: 1.5rem;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 1rem;
    font-family: "Helvetica Neue", sans-serif;
    color: #444;
  }

  .radio-label input[type="radio"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #D6613A;
  }

  .btn-download {
    background: #D6613A;
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.75rem 2.5rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: "Helvetica Neue", sans-serif;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 180px;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .btn-download:hover:not(:disabled) {
    background: #c55532;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }

  .btn-download:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .btn-download:disabled {
    background: #ccc;
    cursor: not-allowed;
    opacity: 0.6;
    box-shadow: none;
  }

  .btn-spinner {
    border: 2px solid #ffffff;
    border-top: 2px solid transparent;
    border-radius: 50%;
    width: 16px;
    height: 16px;
    animation: spin 0.8s linear infinite;
    display: inline-block;
  }

  /* Table Section */
  .table-section {
    margin: 3rem 0;
  }

  .table-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .search-box {
    position: relative;
    flex: 1;
    min-width: 250px;
    max-width: 400px;
  }

  .search-box svg {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: #999;
  }

  .search-box input {
    width: 100%;
    padding: 0.75rem 1rem 0.75rem 3rem;
    border: 1px solid #dee2e6;
    border-radius: 6px;
    font-size: 1rem;
    font-family: "Helvetica Neue", sans-serif;
  }

  .search-box input:focus {
    outline: none;
    border-color: #D6613A;
    box-shadow: 0 0 0 3px rgba(214, 97, 58, 0.1);
  }

  .clear-btn {
    position: absolute;
    right: 0.5rem;
    top: 50%;
    transform: translateY(-50%);
    background: #dee2e6;
    border: none;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.2rem;
    color: #666;
  }

  .clear-btn:hover {
    background: #ccc;
  }

  .showing {
    color: #666;
    font-size: 0.95rem;
    font-family: "Helvetica Neue", sans-serif;
  }

  .table-wrapper {
    border: 1px solid #dee2e6;
    border-radius: 8px;
    overflow: hidden;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
  }

  thead {
    background: #ffffff;
    border-bottom: 2px solid #dee2e6;
  }

  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: #222;
    font-size: 0.9rem;
    font-family: "Helvetica Neue", sans-serif;
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
  }

  th.sortable:hover {
    background: #f8f8f8;
  }

  .sort-icon {
    margin-left: 0.5rem;
    font-size: 0.8rem;
  }

  td {
    padding: 0.9rem 1rem;
    border-bottom: 1px solid #f0f0f0;
  }

  tbody tr:hover {
    background: #fef4f1;
  }

  tbody tr.striped {
    background: #fafafa;
  }

  tbody tr.striped:hover {
    background: #fef4f1;
  }

  tbody tr.selected {
    background: #fef4f1 !important;
  }

  .checkbox-col {
    width: 50px;
    text-align: center;
  }

  .checkbox-col input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #D6613A;
  }

  .school-name {
    font-weight: 400;
    color: #222;
    font-size: 0.95rem;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin-top: 2rem;
    padding: 1rem 0;
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

  .page-btn:active:not(:disabled) {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
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

  /* Data Info Section */
  .data-info {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid #e0e0e0;
    text-align: center;
  }

  .data-info p {
    color: #666;
    line-height: 1.7;
    max-width: 700px;
    margin: 1rem auto;
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 1rem;
    }

    h2 {
      font-size: 2rem;
    }

    .download-card {
      padding: 1.5rem;
    }

    .format-selector {
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .table-header {
      flex-direction: column;
      align-items: stretch;
    }

    .search-box {
      max-width: none;
    }

    table {
      font-size: 0.9rem;
    }

    th, td {
      padding: 0.75rem 0.5rem;
    }
  }
</style>
