<script>
  import { onMount } from 'svelte';
  
  // AWS S3 configuration - UPDATE THESE VALUES
  const S3_BUCKET_URL = 'https://tow-campus-data.s3.us-east-2.amazonaws.com/20251102.json';
  
  let allData = [];
  let filteredData = [];
  let schools = [];
  let selectedSchools = new Set();
  let searchTerm = '';
  let loading = true;
  let error = null;
  let lastUpdated = null;
  let selectAll = false;
  
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
      
      // Fetch data from AWS S3
      const response = await fetch(S3_BUCKET_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to load data: ${response.status}`);
      }
      
      allData = await response.json();
      
      // Extract unique schools and sort them
      const schoolSet = new Set();
      allData.forEach(item => {
        if (item.org) {
          schoolSet.add(item.org);
        }
      });
      schools = Array.from(schoolSet).sort();
      
      // Find the most recent last_updated_at date
      const dates = allData
        .map(item => item.last_updated_at?.$date)
        .filter(Boolean)
        .map(date => new Date(date));
      
      if (dates.length > 0) {
        lastUpdated = new Date(Math.max(...dates));
      }
      
      filteredData = [...allData];
      updatePagination();
      loading = false;
    } catch (err) {
      console.error('Error loading data:', err);
      error = err.message;
      loading = false;
    }
  }
  
  function toggleSchool(school) {
    if (selectedSchools.has(school)) {
      selectedSchools.delete(school);
    } else {
      selectedSchools.add(school);
    }
    selectedSchools = selectedSchools; // Trigger reactivity
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
      filteredData = [...allData];
    } else {
      filteredData = allData.filter(item => 
        item.org?.toLowerCase().includes(term)
      );
      
      // Update schools list based on filtered data
      const schoolSet = new Set();
      filteredData.forEach(item => {
        if (item.org) {
          schoolSet.add(item.org);
        }
      });
      schools = Array.from(schoolSet).sort();
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
  
  // Filter out llm_response and scraper columns before export
  function cleanDataForExport(data) {
    return data.map(item => {
      const { llm_response, scraper, ...cleanItem } = item;
      return cleanItem;
    });
  }
  
  function getSelectedData() {
    if (selectedSchools.size === 0) {
      return cleanDataForExport(filteredData);
    }
    
    const selectedData = filteredData.filter(item => 
      selectedSchools.has(item.org)
    );
    return cleanDataForExport(selectedData);
  }
  
  function downloadCSV() {
    const data = getSelectedData();
    
    if (data.length === 0) {
      alert('No data selected for download');
      return;
    }
    
    // Get all unique keys from the data
    const allKeys = new Set();
    data.forEach(item => {
      Object.keys(item).forEach(key => allKeys.add(key));
    });
    
    const headers = Array.from(allKeys);
    
    // Helper function to flatten nested objects
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
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => flattenValue(row[header])).join(',')
      )
    ].join('\n');
    
    // Download
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
  
  function downloadJSON() {
    const data = getSelectedData();
    
    if (data.length === 0) {
      alert('No data selected for download');
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
  
  function downloadAll(format) {
    selectedSchools = new Set(schools);
    if (format === 'csv') {
      downloadCSV();
    } else {
      downloadJSON();
    }
  }
  
  $: paginatedSchools = schools.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  $: selectedCount = selectedSchools.size;
  $: totalRecords = filteredData.filter(item => 
    selectedSchools.size === 0 || selectedSchools.has(item.org)
  ).length;
</script>

<div class="data-explorer-container">
  <div class="container">
    <div class="content-wrapper">
      <h2>Data & Downloads</h2>
      
      <section class="intro">
        <p class="lead">
          Download the complete dataset of university responses to campus protests and federal actions. 
          Select specific institutions below, or download the entire dataset. The data is updated weekly 
          and includes institutional statements, press releases, and official communications from 
          October 2023 to present.
        </p>
        
        {#if lastUpdated}
          <div class="last-updated">
            <strong>Last Updated:</strong> {lastUpdated.toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        {/if}
      </section>

      {#if loading}
        <div class="loading">
          <div class="spinner"></div>
          <p>Loading data...</p>
        </div>
      {:else if error}
        <div class="error">
          <p><strong>Error loading data:</strong> {error}</p>
          <button on:click={loadData} class="retry-btn">Retry</button>
        </div>
      {:else}
        <section class="download-section">
          <div class="download-header">
            <div class="download-info">
              <h3>Download Options</h3>
              <p class="stats">
                {selectedCount > 0 ? `${selectedCount} institution${selectedCount !== 1 ? 's' : ''} selected` : 'No institutions selected'} • 
                {totalRecords.toLocaleString()} total record{totalRecords !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div class="download-buttons">
              <div class="button-group">
                <button 
                  on:click={downloadCSV} 
                  class="btn btn-primary"
                  disabled={selectedCount === 0}
                  title={selectedCount === 0 ? 'Select institutions to download' : 'Download selected as CSV'}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 11L4 7h2.5V2h3v5H12L8 11z" fill="currentColor"/>
                    <path d="M14 14H2v-2h12v2z" fill="currentColor"/>
                  </svg>
                  Download Selected CSV
                </button>
                <button 
                  on:click={downloadJSON} 
                  class="btn btn-primary"
                  disabled={selectedCount === 0}
                  title={selectedCount === 0 ? 'Select institutions to download' : 'Download selected as JSON'}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 11L4 7h2.5V2h3v5H12L8 11z" fill="currentColor"/>
                    <path d="M14 14H2v-2h12v2z" fill="currentColor"/>
                  </svg>
                  Download Selected JSON
                </button>
              </div>
              
              <div class="divider">or</div>
              
              <div class="button-group">
                <button on:click={() => downloadAll('csv')} class="btn btn-secondary">
                  Download All CSV
                </button>
                <button on:click={() => downloadAll('json')} class="btn btn-secondary">
                  Download All JSON
                </button>
              </div>
            </div>
          </div>
        </section>

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
              Showing {schools.length.toLocaleString()} institution{schools.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th class="checkbox-col">
                    <label class="checkbox-container">
                      <input 
                        type="checkbox" 
                        bind:checked={selectAll}
                        on:change={toggleSelectAll}
                      />
                      <span class="checkmark"></span>
                    </label>
                  </th>
                  <th class="sortable" on:click={() => sortTable('org')}>
                    Institution
                    {#if sortColumn === 'org'}
                      <span class="sort-icon">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                    {/if}
                  </th>
                  <th class="records-col">Records</th>
                </tr>
              </thead>
              <tbody>
                {#each paginatedSchools as school}
                  {@const recordCount = allData.filter(item => item.org === school).length}
                  <tr class:selected={selectedSchools.has(school)}>
                    <td class="checkbox-col">
                      <label class="checkbox-container">
                        <input 
                          type="checkbox" 
                          checked={selectedSchools.has(school)}
                          on:change={() => toggleSchool(school)}
                        />
                        <span class="checkmark"></span>
                      </label>
                    </td>
                    <td class="school-name">{school}</td>
                    <td class="records-col">{recordCount.toLocaleString()}</td>
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
            The dataset includes the following fields for each institutional response:
          </p>
          <ul>
            <li><strong>URL:</strong> Link to the original statement or announcement</li>
            <li><strong>Title:</strong> Title of the document or statement</li>
            <li><strong>Organization:</strong> Name of the institution</li>
            <li><strong>Content:</strong> Full text of the statement</li>
            <li><strong>Date:</strong> Publication date of the statement</li>
            <li><strong>Last Updated:</strong> When this record was last updated in our database</li>
          </ul>
          <p>
            <strong>Note:</strong> Internal processing fields (<code>llm_response</code> and <code>scraper</code>) 
            are excluded from downloads. For methodology details, see the Methodology page.
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
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
  }

  .content-wrapper {
    padding: 2rem 0;
  }

  h2 {
    font-size: 2.5rem;
    margin: 0 0 2rem;
    color: #1a1a1a;
    font-weight: 700;
  }

  h3 {
    font-size: 1.5rem;
    margin: 2rem 0 1rem;
    color: #1a1a1a;
    font-weight: 600;
  }

  .intro {
    margin-bottom: 3rem;
  }

  .lead {
    font-size: 1.2rem;
    line-height: 1.8;
    color: #333;
    margin-bottom: 1rem;
  }

  .last-updated {
    background: #E4F3F1;
    border-left: 4px solid #66C2C2;
    padding: 1rem 1.5rem;
    margin-top: 1.5rem;
    border-radius: 4px;
  }

  .last-updated strong {
    color: #1a1a1a;
  }

  /* Loading and Error States */
  .loading, .error {
    text-align: center;
    padding: 4rem 2rem;
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
  }

  .retry-btn:hover {
    background: #c55532;
  }

  /* Download Section */
  .download-section {
    background: #ffffff;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 2rem;
    margin-bottom: 2rem;
  }

  .download-header {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .download-info h3 {
    margin-top: 0;
  }

  .stats {
    color: #666;
    font-size: 0.95rem;
    margin: 0.5rem 0 0;
  }

  .download-buttons {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }

  .button-group {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .divider {
    color: #999;
    font-size: 0.9rem;
    text-align: center;
    width: 100%;
  }

  .btn {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .btn-primary {
    background: #D6613A;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: #c55532;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(214, 97, 58, 0.3);
  }

  .btn-primary:disabled {
    background: #ccc;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .btn-secondary {
    background: white;
    color: #D6613A;
    border: 2px solid #D6613A;
  }

  .btn-secondary:hover {
    background: #D6613A;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(214, 97, 58, 0.2);
  }

  /* Table Section */
  .table-section {
    margin: 2rem 0;
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
    color: #1a1a1a;
    font-size: 0.95rem;
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
  }

  th.sortable:hover {
    background: #e9ecef;
  }

  .sort-icon {
    margin-left: 0.5rem;
    font-size: 0.8rem;
  }

  td {
    padding: 1rem;
    border-bottom: 1px solid #f0f0f0;
  }

  tbody tr:hover {
    background: #f8f9fa;
  }

  tbody tr.selected {
    background: #fef4f1;
  }

  .checkbox-col {
    width: 50px;
    text-align: center;
  }

  .records-col {
    width: 120px;
    text-align: right;
    color: #666;
  }

  .school-name {
    font-weight: 500;
    color: #1a1a1a;
  }

  /* Custom Checkbox */
  .checkbox-container {
    display: inline-block;
    position: relative;
    cursor: pointer;
    user-select: none;
  }

  .checkbox-container input {
    position: absolute;
    opacity: 0;
    cursor: pointer;
  }

  .checkmark {
    display: inline-block;
    width: 20px;
    height: 20px;
    border: 2px solid #dee2e6;
    border-radius: 4px;
    background: white;
    transition: all 0.2s;
  }

  .checkbox-container:hover .checkmark {
    border-color: #D6613A;
  }

  .checkbox-container input:checked ~ .checkmark {
    background: #D6613A;
    border-color: #D6613A;
  }

  .checkbox-container input:checked ~ .checkmark::after {
    content: '';
    position: absolute;
    left: 6px;
    top: 2px;
    width: 5px;
    height: 10px;
    border: solid white;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
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
    font-size: 0.95rem;
    transition: all 0.2s;
  }

  .page-btn:hover:not(:disabled) {
    background: #f8f9fa;
    border-color: #D6613A;
  }

  .page-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-info {
    padding: 0 1rem;
    font-weight: 500;
  }

  /* Data Info Section */
  .data-info {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid #dee2e6;
  }

  .data-info ul {
    margin: 1rem 0;
    padding-left: 2rem;
  }

  .data-info li {
    margin: 0.5rem 0;
    line-height: 1.6;
  }

  .data-info code {
    background: #f8f9fa;
    padding: 0.2rem 0.4rem;
    border-radius: 3px;
    font-size: 0.9em;
    color: #e83e8c;
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 1rem;
    }

    h2 {
      font-size: 2rem;
    }

    .download-header {
      flex-direction: column;
    }

    .download-buttons {
      width: 100%;
    }

    .button-group {
      flex-direction: column;
      width: 100%;
    }

    .btn {
      width: 100%;
      justify-content: center;
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

    .records-col {
      width: 80px;
    }
  }
</style>