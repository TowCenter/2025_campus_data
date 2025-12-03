<script>
    import '../../../src/lib/cjr.css';
    import Head from "../../../src/lib/Head.svelte";
    import Article from "../../../src/lib/Article.svelte";
    import Header from "../../../src/lib/Header.svelte";
    import Headline from "../../../src/lib/Headline.svelte";
    import Footer from "../../../src/lib/Footer.svelte";
    import BodyText from "../../../src/lib/BodyText.svelte";
    import Body from "../../../src/lib/Body.svelte";
    import Filters from "../../../src/lib/Filters.svelte";
    import CardView from "../../../src/lib/CardView.svelte";
    import rawData from "../../../src/lib/data2.json";

    // Helper function to check if value is NaN or empty
    function isValidValue(value) {
        if (value === null || value === undefined) return false;
        // Handle NaN (can be literal NaN or string "NaN")
        if (typeof value === 'number' && isNaN(value)) return false;
        if (value === 'NaN' || value === 'nan' || (typeof value === 'string' && value.toLowerCase() === 'nan')) return false;
        // Handle Infinity
        if (value === Infinity || value === -Infinity) return false;
        if (typeof value === 'string' && value.trim() === '') return false;
        if (Array.isArray(value) && value.length === 0) return false;
        return true;
    }

    // Helper function to normalize array fields
    function normalizeArray(value) {
        if (!isValidValue(value)) return [];
        if (Array.isArray(value)) return value.filter(v => isValidValue(v));
        return [value].filter(v => isValidValue(v));
    }

    // Parse JSON format and normalize field names for data2.json
    function normalizeData(rawDataArray) {
        if (!Array.isArray(rawDataArray)) {
            console.error('rawDataArray is not an array:', rawDataArray);
            return [];
        }
        
        return rawDataArray.map((row, index) => {
            try {
                return {
                    date: row?.Date || null,
                    interaction: row?.Interaction || null,
                    platform: normalizeArray(row?.['AI Company']),
                    publishers: normalizeArray(row?.['News Org(s)']),
                    type: normalizeArray(row?.Type),
                    reported_details: row?.['Reported Details'] || '',
                    organization_publisher_named_in_deal_suit: normalizeArray(row?.['News Org(s)']),
                    affected_publications: normalizeArray(row?.['Affected Publications']),
                    parent_child_matches: Array.isArray(row?.['parent_child_matches']) ? row['parent_child_matches'] : [],
                    sources: normalizeArray(row?.Sources),
                    // Lawsuit-specific fields
                    status: isValidValue(row?.Status) ? String(row.Status) : null,
                    case_number: isValidValue(row?.['Case Number']) ? String(row['Case Number']) : null,
                    defendant: normalizeArray(row?.Defendant),
                    plaintiff: normalizeArray(row?.Plaintiff),
                    case_filing: isValidValue(row?.['Case Filing']) ? String(row['Case Filing']) : null,
                    location: isValidValue(row?.Location) ? String(row.Location) : null,
                };
            } catch (error) {
                console.error(`Error processing row ${index}:`, error, row);
                return null;
            }
        }).filter(row => row !== null);
    }

    const partnerships = normalizeData(rawData);

    // import tow css from src/lib/tow.css
    import '../../../src/lib/tow.css';

    const tableColumns = [
        "Date",
        "Interaction",
        "AI Company",
        "News Org",
        "Type",
        "Reported Details"
    ];

    // Filter state
    let searchQuery = $state('');
    let filterInteraction = $state([]);
    let filterType = $state([]);
    let filterPlatform = $state([]);
    let filterPublishers = $state([]);
    let filteredData = $state([]);

    function downloadToCSV() {
        // Define all columns with their display names and data keys
        const csvColumns = [
            { name: 'Date', key: 'date' },
            { name: 'Interaction', key: 'interaction' },
            { name: 'AI Company', key: 'platform' },
            { name: 'News Org(s)', key: 'organization_publisher_named_in_deal_suit' },
            { name: 'Type', key: 'type' },
            { name: 'Reported Details', key: 'reported_details' },
            { name: 'Affected Publications', key: 'affected_publications' },
            { name: 'Sources', key: 'sources' },
            { name: 'Defendant', key: 'defendant' },
            { name: 'Plaintiff', key: 'plaintiff' },
            { name: 'Status', key: 'status' },
            { name: 'Case Number', key: 'case_number' },
            { name: 'Case Filing', key: 'case_filing' },
            { name: 'Location', key: 'location' },
        ];
        
        const header = csvColumns.map(col => col.name).join(',');
        
        const rows = filteredData.map(row => {
            return csvColumns.map(col => {
                let value = row[col.key];
                
                // Handle arrays by joining with semicolon
                if (Array.isArray(value)) {
                    value = value.filter(v => v && String(v).trim()).join('; ');
                }
                
                // Handle parent_child_matches if needed (convert to JSON string)
                if (col.key === 'parent_child_matches' && Array.isArray(value)) {
                    value = JSON.stringify(value);
                }
                
                // Convert to string and handle null/undefined
                const stringValue = value != null ? String(value) : '';
                
                // Escape quotes and wrap in quotes
                const escaped = stringValue.replace(/"/g, '""');
                return `"${escaped}"`;
            }).join(',');
        });
        
        const csv = [header, ...rows].join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'partnerships-data.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // import content from '$locales/en/content.json';
</script>

<Head />
<Header />
<Article>
    <Headline
        hed="AI Deals and Lawsuits"
        subhed="Subheadline text goes here"
        date="September 16, 2025"
        byline_url="https://towcenter.columbia.edu/content/klaudia-jazwinska"
        byline="Klaudia Jaźwińska"
    />

    <Body>
        <!-- 
        {#each content.blocks as block}
        {#if block.type === 'text'}
            <BodyText text={block.text} />
        {/if}
        {/each} -->
        <BodyText
            text="Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
        />
    </Body>


    
    <Filters 
        data={partnerships}
        columns={tableColumns}
        bind:searchQuery
        bind:filterInteraction
        bind:filterType
        bind:filterPlatform
        bind:filterPublishers
        filteredRowCount={filteredData.length}
        onDownloadCSV={downloadToCSV}
    />

    <!-- Card View -->
    <CardView 
        data={partnerships}
        columns={tableColumns}
        {searchQuery}
        {filterInteraction}
        {filterType}
        {filterPlatform}
        {filterPublishers}
        onFilteredDataChange={(data) => { filteredData = data; }}
    />
</Article>
<Footer />
