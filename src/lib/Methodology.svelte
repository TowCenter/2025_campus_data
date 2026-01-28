<script>
  import { onMount } from 'svelte';
  import * as topojson from 'topojson-client';
  import * as d3 from 'd3-geo';

  let mapContainer;
  let hoveredSchool = null;
  let tooltipX = 0;
  let tooltipY = 0;
  let showTooltip = false;
  let statesGeoJSON = null;

  // Calendar tooltip
  let calendarTooltip = null;
  let calendarTooltipX = 0;
  let calendarTooltipY = 0;
  let showCalendarTooltip = false;
  let calendarContainer;

  // FAQ accordion
  let openFaqIndex = null;

  function toggleFaq(index) {
    const wasOpen = openFaqIndex === index;
    openFaqIndex = openFaqIndex === index ? null : index;

    // Track FAQ interactions
    if (window.umami && !wasOpen) {
      window.umami.track('faq-opened', {
        faq_index: index
      });
    }
  }

  // AWS S3 configuration
  const LOCATION_DATA_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/location.json';
  const S3_BUCKET_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/data.json';
  const MONTH_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/month_index';
  const MONTH_INDEX_MANIFEST_URL = `${MONTH_INDEX_BASE_URL}/manifest.json`; // { "2025": { "2025-12": count, ... }, ... }
  const INSTITUTION_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/institution_index';
  const INSTITUTION_INDEX_MANIFEST_URL = `${INSTITUTION_INDEX_BASE_URL}/manifest.json`; // { "a": { "American University": 503, ... }, ... }
  let schoolData = [];
  let allArticles = [];
  let articlesByDate = {};
  let loadingArticles = false;
  let indexTotalRecords = null;
  let institutionIndex = {};
  let institutionNames = [];
  let institutionIndexLoaded = false;
  let institutionIndexLoadFailed = false;
  let monthManifest = null;
  let monthManifestLoaded = false;
  let monthManifestLoadFailed = false;
  let monthlyBarData = [];
  let locationDataLoaded = false;
  let locationDataLoadFailed = false;

  // Filter school locations to only those in our dataset (institution index)
  $: institutionNameSet = new Set(
    (institutionNames || []).map(name => name.toLowerCase().trim())
  );

  $: locationNameSet = new Set(
    (schoolData || [])
      .map(school => school?.name?.toLowerCase().trim())
      .filter(Boolean)
  );

  $: visibleSchools = (() => {
    if (institutionNameSet.size > 0) {
      return schoolData.filter((school) => {
        const name = school?.name;
        if (!name) return false;
        return institutionNameSet.has(name.toLowerCase().trim());
      });
    }
    if (institutionIndexLoaded && institutionIndexLoadFailed) {
      return schoolData; // fallback if we could not load the index
    }
    return []; // wait for index before showing anything
  })();

  $: missingLocations = (() => {
    if (!institutionIndexLoaded) return [];
    if (!locationDataLoaded && !locationDataLoadFailed) return [];
    if (!institutionNames.length) return [];
    return institutionNames.filter(name => {
      const normalized = name?.toLowerCase().trim();
      return normalized && !locationNameSet.has(normalized);
    });
  })();

  $: if (missingLocations.length > 0) {
    console.warn('Institutions missing location data:', missingLocations);
  }

  // Calculate statistics
  $: totalSchools = (() => {
    if (!institutionIndexLoaded && !institutionIndexLoadFailed) {
      return 0;
    }
    if (institutionNames.length) return institutionNames.length;
    return 0;
  })();
  $: stateGroups = visibleSchools.reduce((acc, school) => {
    if (school.state) {
      acc[school.state] = (acc[school.state] || 0) + 1;
    }
    return acc;
  }, {});
  $: totalStates = Object.keys(stateGroups).length;
  $: totalRecords = indexTotalRecords ?? allArticles.length;

  // Group schools by proximity and calculate offset positions to prevent overlap
  function getSchoolPositions(schools) {
    const positions = new Map();
    const dotRadius = 6; // radius of each dot including stroke
    const proximityThreshold = dotRadius * 2.5; // pixels - schools within this distance are considered overlapping

    schools.forEach(school => {
      const coords = projectCoordinates(school.lat, school.lng);
      if (coords.x === 0 && coords.y === 0) return; // Skip invalid coordinates

      // Find if there's already a school at roughly this location
      let cluster = null;
      for (const [key, group] of positions.entries()) {
        const [cx, cy] = key.split(',').map(Number);
        const distance = Math.sqrt(Math.pow(coords.x - cx, 2) + Math.pow(coords.y - cy, 2));
        if (distance < proximityThreshold) {
          cluster = key;
          break;
        }
      }

      if (cluster) {
        positions.get(cluster).push({ ...school, baseCoords: coords });
      } else {
        const key = `${coords.x},${coords.y}`;
        positions.set(key, [{ ...school, baseCoords: coords }]);
      }
    });

    // Calculate offset positions for clustered schools
    const result = [];
    for (const group of positions.values()) {
      if (group.length === 1) {
        result.push({ ...group[0], displayCoords: group[0].baseCoords });
      } else {
        // Arrange schools in a spiral pattern to prevent overlap
        const baseRadius = dotRadius * 2; // Start radius for spiral
        group.forEach((school, i) => {
          if (i === 0) {
            // First school stays at center
            result.push({ ...school, displayCoords: school.baseCoords });
          } else {
            // Arrange remaining schools in expanding rings
            const ring = Math.ceil(Math.sqrt(i)); // Which ring (1, 2, 3...)
            const posInRing = i - (ring - 1) * (ring - 1); // Position within ring
            const ringSize = ring * 4; // Approximate number of positions in this ring
            const angle = (posInRing / ringSize) * 2 * Math.PI + ring * 0.5;
            const radius = baseRadius * ring;
            const offsetX = Math.cos(angle) * radius;
            const offsetY = Math.sin(angle) * radius;
            result.push({
              ...school,
              displayCoords: {
                x: school.baseCoords.x + offsetX,
                y: school.baseCoords.y + offsetY
              }
            });
          }
        });
      }
    }

    return result;
  }

  $: schoolPositions = getSchoolPositions(visibleSchools);

  // Create Albers USA projection for proper US map rendering
  const projection = d3.geoAlbersUsa()
    .scale(1300)
    .translate([480, 300]);

  // Convert lat/lng to SVG coordinates using Albers USA projection
  function projectCoordinates(lat, lng) {
    const coords = projection([lng, lat]);
    if (!coords) {
      // Return a default position if projection fails (e.g., for territories outside the US)
      return { x: 0, y: 0 };
    }
    return { x: coords[0], y: coords[1] };
  }

  function handleDotHover(school, event) {
    hoveredSchool = school;
    showTooltip = true;
    updateTooltipPosition(event);

    // Track map interaction in Umami
    if (window.umami) {
      window.umami.track('map-school-hover', {
        school: school.name,
        state: school.state
      });
    }
  }

  function handleDotLeave() {
    hoveredSchool = null;
    showTooltip = false;
  }

  function updateTooltipPosition(event) {
    if (mapContainer) {
      const rect = mapContainer.getBoundingClientRect();
      tooltipX = event.clientX - rect.left;
      tooltipY = event.clientY - rect.top;

      if (tooltipX > rect.width - 200) {
        tooltipX = tooltipX - 200;
      }

      if (tooltipY < 60) {
        tooltipY = tooltipY + 20;
      } else {
        tooltipY = tooltipY - 60;
      }
    }
  }

  function handleMouseMove(event) {
    if (showTooltip) {
      updateTooltipPosition(event);
    }
  }

  // Calendar tooltip handlers
  function handleCalendarDayHover(dayInfo, event) {
    calendarTooltip = dayInfo;
    showCalendarTooltip = true;
    updateCalendarTooltipPosition(event);
  }

  function handleCalendarDayLeave() {
    calendarTooltip = null;
    showCalendarTooltip = false;
  }

  function updateCalendarTooltipPosition(event) {
    if (calendarContainer) {
      const rect = calendarContainer.getBoundingClientRect();
      calendarTooltipX = event.clientX - rect.left;
      calendarTooltipY = event.clientY - rect.top;

      if (calendarTooltipX > rect.width - 200) {
        calendarTooltipX = calendarTooltipX - 200;
      }

      if (calendarTooltipY < 60) {
        calendarTooltipY = calendarTooltipY + 20;
      } else {
        calendarTooltipY = calendarTooltipY - 60;
      }
    }
  }

  function handleCalendarMouseMove(event) {
    if (showCalendarTooltip) {
      updateCalendarTooltipPosition(event);
    }
  }

  // Create a path generator using the Albers USA projection
  const pathGenerator = d3.geoPath().projection(projection);

  // Convert GeoJSON to SVG path data using Albers USA projection
  function geoJSONToPath(feature) {
    if (!feature || !feature.geometry) return '';
    return pathGenerator(feature) || '';
  }

  // Process articles data for charts
  function processArticleData(articles) {
    const dateMap = {};

    articles.forEach(item => {
      let dateStr = null;

      // Use the 'date' field for article publish date (NOT last_updated_at which is scraping date)
      if (typeof item.date === 'string' && item.date) {
        // Direct string format: "2025-03-31T00:00:00" or "2025-03-31"
        dateStr = item.date.split('T')[0];
      } else if (item.date?.$date) {
        // MongoDB date format: { $date: "2025-03-31T00:00:00.000Z" }
        dateStr = item.date.$date.split('T')[0];
      } else if (item.date instanceof Date) {
        // JavaScript Date object
        dateStr = item.date.toISOString().split('T')[0];
      }

      if (dateStr) {
        dateMap[dateStr] = (dateMap[dateStr] || 0) + 1;
      }
    });

    return dateMap;
  }

  // Build monthly chart data from manifest
  function buildMonthlyBarData(manifest) {
    if (!manifest || typeof manifest !== 'object') return [];

    const entries = [];
    const MIN_MONTH = '2025-01';

    Object.entries(manifest).forEach(([yearKey, yearData]) => {
      if (!/^\d{4}$/.test(yearKey)) return;
      if (!yearData || typeof yearData !== 'object') return;
      Object.entries(yearData).forEach(([monthKey, count]) => {
        if (!/^\d{4}-\d{2}$/.test(monthKey)) return;
        if (monthKey < MIN_MONTH) return;
        const num = Number(count);
        if (!Number.isFinite(num)) return;
        // Use day 01 to keep date math simple downstream
        entries.push([`${monthKey}-01`, { count: num, month: monthKey }]);
      });
    });

    return entries.sort((a, b) => a[0].localeCompare(b[0]));
  }

  // Organize dates by month for calendar view with week grids
  function organizeByMonth(dateMap) {
    const months = {};

    Object.keys(dateMap).sort().forEach(dateStr => {
      const date = new Date(dateStr);

      // Only include dates from January 1, 2025 onwards
      if (date.getFullYear() < 2025) return;

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!months[monthKey]) {
        months[monthKey] = {
          label: date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
          year: date.getFullYear(),
          month: date.getMonth(),
          days: {}
        };
      }

      months[monthKey].days[date.getDate()] = {
        dateStr,
        date: date,
        count: dateMap[dateStr]
      };
    });

    return months;
  }

  // Generate calendar grid for a month (with empty cells for proper alignment)
  function getMonthGrid(year, month, daysData) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0 = Sunday, 6 = Saturday
    const daysInMonth = lastDay.getDate();

    const grid = [];
    let week = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startOffset; i++) {
      week.push(null);
    }

    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      week.push({
        day,
        data: daysData[day] || null
      });

      if (week.length === 7) {
        grid.push(week);
        week = [];
      }
    }

    // Add empty cells to complete last week
    while (week.length > 0 && week.length < 7) {
      week.push(null);
    }
    if (week.length > 0) {
      grid.push(week);
    }

    return grid;
  }

  $: monthlyData = organizeByMonth(articlesByDate);

  // Track time spent on Methodology page
  let pageStartTime;

  // Load pre-geocoded school locations from S3
  async function loadSchoolLocations() {
    try {
      const res = await fetch(LOCATION_DATA_URL);
      if (!res.ok) throw new Error('Failed to load school locations');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Unexpected school locations format');

      schoolData = data
        .filter(item => item && typeof item.lat === 'number' && typeof item.lng === 'number' && item.name)
        .map(item => ({
          name: item.name,
          lat: item.lat,
          lng: item.lng,
          state: item.state || 'Unknown'
        }));
    } catch (err) {
      console.warn('Could not load school locations:', err);
      locationDataLoadFailed = true;
    } finally {
      locationDataLoaded = true;
    }
  }

  async function loadMonthIndex() {
    try {
      const res = await fetch(MONTH_INDEX_MANIFEST_URL);
      if (!res.ok) throw new Error('Failed to load month index manifest');
      const manifest = await res.json();

      let total = 0;
      Object.values(manifest || {}).forEach((yearData) => {
        if (yearData && typeof yearData === 'object') {
          Object.values(yearData).forEach((count) => {
            const num = Number(count);
            if (Number.isFinite(num)) {
              total += num;
            }
          });
        }
      });

      indexTotalRecords = total;
      monthManifest = manifest;
      monthlyBarData = buildMonthlyBarData(manifest);
      monthManifestLoadFailed = false;
      return manifest;
    } catch (err) {
      console.warn('Could not load month index manifest:', err);
      monthManifestLoadFailed = true;
      return null;
    } finally {
      monthManifestLoaded = true;
    }
  }

  async function loadInstitutionIndex() {
    try {
      const res = await fetch(INSTITUTION_INDEX_MANIFEST_URL);
      if (!res.ok) throw new Error('Failed to load institution manifest');
      const manifest = await res.json();

      const mergedInstitutions = {};
      Object.values(manifest || {}).forEach((shard) => {
        if (shard && typeof shard === 'object') {
          Object.assign(mergedInstitutions, shard);
        }
      });

      institutionIndex = mergedInstitutions;
      institutionNames = Object.keys(mergedInstitutions).filter((k) => k !== '_no_org');
      return manifest;
    } catch (err) {
      console.warn('Could not load institution index:', err);
      institutionIndexLoadFailed = true;
      return null;
    } finally {
      institutionIndexLoaded = true;
    }
  }

  // Load S3 data for record count and US states map
  onMount(async () => {
    pageStartTime = Date.now();

    try {
      // Kick off lightweight index loads first for fast counts
      const indexPromise = Promise.all([loadMonthIndex(), loadInstitutionIndex()]);
      const locationsPromise = loadSchoolLocations();

      // Load US states TopoJSON data
      const topoResponse = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
      if (topoResponse.ok) {
        const topology = await topoResponse.json();
        statesGeoJSON = topojson.feature(topology, topology.objects.states);
      }

      // Wait for indexes and school locations to finish
      await Promise.all([indexPromise, locationsPromise]);

      // Load article data for charts (heavier)
      loadingArticles = true;
      const articlesResponse = await fetch(S3_BUCKET_URL);
      if (articlesResponse.ok) {
        allArticles = await articlesResponse.json();
        articlesByDate = processArticleData(allArticles);
        // If indexTotalRecords failed, fall back to full count
        if (indexTotalRecords === null) {
          indexTotalRecords = allArticles.length;
        }
      }
      loadingArticles = false;
    } catch (err) {
      console.warn('Could not load data:', err);
      loadingArticles = false;
    }

    // Track time on page when user leaves
    return () => {
      if (window.umami && pageStartTime) {
        const timeSpent = Math.round((Date.now() - pageStartTime) / 1000); // seconds
        window.umami.track('methodology-time-spent', {
          seconds: timeSpent,
          minutes: Math.round(timeSpent / 60)
        });
      }
    };
  });
</script>

<div class="methodology-wrapper">
      <!-- Methodology Content -->
      <section class="methodology-content">
        <h3>Methodology</h3>

        <p>
          This database includes public announcements from higher education institutions that the U.S. Department of Education has publicly said are under federal investigation since President Donald Trump took office. If an investigation ends, the database will continue to collect and display public communications from that institution.
        </p>

        <p>
          Institutions are identified by tracking public announcements from the Department of Education and verifying them against multiple independent sources. We also cross-check institutions using <a href="https://hechingerreport.org/which-schools-and-colleges-are-being-investigated-by-the-trump-administration/" target="_blank" rel="noopener noreferrer">The Hechinger Report's investigation tracker</a> as an additional verification step to help keep the list of universities current.
        </p>

        <!-- Interactive Map embedded in text -->
        <div class="map-embed">
          <div
            class="map-container"
            bind:this={mapContainer}
            onmousemove={handleMouseMove}
            role="img"
            aria-label="Interactive map of universities"
          >
            <svg viewBox="0 0 960 600" class="map-svg">
              {#if statesGeoJSON}
                <g id="us-states">
                  {#each statesGeoJSON.features as state}
                    <path
                      class="state-path"
                      d={geoJSONToPath(state)}
                      fill="#D9D9D9"
                      stroke="#FFFFFF"
                      stroke-width="1"
                    />
                  {/each}
                </g>
              {:else}
                <text x="480" y="300" text-anchor="middle" fill="#ccc" font-size="14">Loading map...</text>
              {/if}

              {#each schoolPositions as school, i}
                <circle
                  cx={school.displayCoords.x}
                  cy={school.displayCoords.y}
                  r="4"
                  class="school-dot"
                  class:hovered={hoveredSchool === school}
                  onmouseenter={(event) => handleDotHover(school, event)}
                  onmouseleave={handleDotLeave}
                  style="--delay: {i * 0.01}s"
                  role="button"
                  tabindex="0"
                  aria-label="View details for {school.name}"
                />
              {/each}
            </svg>

            {#if showTooltip && hoveredSchool}
              <div class="tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
                <div class="tooltip-content">
                  <div class="tooltip-title">{hoveredSchool.name}</div>
                  <div class="tooltip-state">{hoveredSchool.state}</div>
                </div>
              </div>
            {/if}
          </div>
          <div class="map-caption">Each dot represents a university</div>
        </div>

        {#if missingLocations.length > 0}
          <div class="data-warning" role="status">
            <div class="warning-title">Missing location data</div>
            <div class="warning-text">
              {missingLocations.length} institution(s) are in the dataset but missing coordinates.
            </div>
          </div>
        {/if}

        <p>
          We collect official announcements and statements from each institution's primary announcements or news page, as well as from the websites of the president or chancellor, the provost, the board of trustees (or equivalent governing body), and offices related to student affairs or international students. When substantively identical statements are published across multiple pages, duplicates are removed before the data is published. Each institution has at least three official webpages monitored and included in the database.
        </p>

        <p>
          Data is collected using the Tow Center's Scraper Factory infrastructure, an AI-assisted system used to identify and collect relevant public-facing university webpages. To learn more about this infrastructure or our data collection methods, please contact us.
        </p>

        <p>
          The database does not include private or internal communications, content published in non-Latin characters, social media posts, individual department or faculty webpages, or any content that requires a login or password to access.
        </p>

        <p>
          In the case of blank entries with titles, there will be a reasoning in the data as to why. These are most often due to the link being primarily a video or filled with non-text elements.
        </p>

        <p>
          Each entry includes the date the statement was published and the date it was collected. The database reflects information available as of the most recent weekly update and may not capture statements that were modified or removed prior to collection.
        </p>

        <p>
          This dataset is open source and updated weekly as new university communications are published. Users are free to download and analyze the data. If you publish findings based on this dataset, you must credit the Tow Center.
        </p>

        <p>
          The purpose of this database is to help journalists, researchers, and the public examine how universities communicate during periods of federal scrutiny and how those communications change over time. For technical questions about data collection methods or to report potential data quality issues, please <a href="mailto:tktk@columbia.edu">contact us</a>.
        </p>
      </section>

      <!-- Ethical Considerations Section -->
      <section class="methodology-content">
        <h3>Ethical Considerations</h3>

        <p>
          This database is produced in line with established journalistic and research ethics standards and is compiled in the public interest to support transparency and accountability in higher education and government oversight.
        </p>

        <p>
          Inclusion in this database does not imply wrongdoing by any institution, nor does it reflect a determination about the merits, status, or outcome of any federal investigation. The database documents publicly available institutional communications and does not make claims beyond the content of those materials.
        </p>

        <p>
          To minimize harm, we collect only information that institutions have chosen to publish publicly on their official websites. We do not collect private or internal communications, and we intentionally exclude social media posts, individual faculty pages, and other content that could reasonably be interpreted as personal expression rather than official institutional communication.
        </p>

        <p>
          We take steps to promote accuracy and fairness by verifying institutions' inclusion using multiple sources and routinely reviewing collected materials for errors or duplication. When inaccuracies or omissions are identified, we work to correct them in a timely manner and note corrections where appropriate.
        </p>

        <p>
          The database is intended to support reporting and research, not to speculate about motives, assign blame, or characterize institutional conduct. We welcome feedback from institutions, journalists, and researchers and provide a clear mechanism for reporting potential inaccuracies or data quality concerns.
        </p>
      </section>

      <!-- FAQ Section -->
      <section class="faq-section">
        <h3>Frequently Asked Questions</h3>

        <div class="faq-item">
          <button class="faq-question" onclick={() => toggleFaq(0)}>
            <span>What information is available for each school?</span>
            <span class="faq-icon">{openFaqIndex === 0 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 0}
            <div class="faq-answer">
              <p>For each institution, the database includes the headline, publication date, full text, and a link to each public announcement or statement.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" onclick={() => toggleFaq(1)}>
            <span>What types of schools are included?</span>
            <span class="faq-icon">{openFaqIndex === 1 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 1}
            <div class="faq-answer">
              <p>The database includes postsecondary education institutions with degree-granting programs beyond the high school level. This includes community colleges, technical and trade schools, vocational schools, universities, and graduate programs.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" onclick={() => toggleFaq(2)}>
            <span>Do you have data from before January 2025?</span>
            <span class="faq-icon">{openFaqIndex === 2 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 2}
            <div class="faq-answer">
              <p>The project does not include data before January 1, 2025, yet. We plan on publishing this in the near future.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" onclick={() => toggleFaq(3)}>
            <span>How often is the data updated?</span>
            <span class="faq-icon">{openFaqIndex === 3 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 3}
            <div class="faq-answer">
              <p>We aim to update the database every Tuesday. In some cases, updates may occur more frequently to ensure timely coverage of significant developments. Please refer to the "last updated" date at the top of the page for the most recent update.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" onclick={() => toggleFaq(4)}>
            <span>Do you have an API?</span>
            <span class="faq-icon">{openFaqIndex === 4 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 4}
            <div class="faq-answer">
              <p>Not at this time.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" onclick={() => toggleFaq(5)}>
            <span>Are social media posts included?</span>
            <span class="faq-icon">{openFaqIndex === 5 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 5}
            <div class="faq-answer">
              <p>No. Only public announcements and statements posted on official institutional websites are collected. Social media, individual faculty pages, or internal communications are excluded.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" onclick={() => toggleFaq(6)}>
            <span>I noticed an issue with the data. What should I do?</span>
            <span class="faq-icon">{openFaqIndex === 6 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 6}
            <div class="faq-answer">
              <p>We welcome feedback and corrections. If you notice a potential error or omission, please contact us at <a href="mailto:tktk@columbia.edu">tktk@columbia.edu</a> with details about the issue.</p>
            </div>
          {/if}
        </div>
      </section>
</div>

<style>
  .methodology-wrapper {
    width: 100%;
  }

  /* Inline Statistics */
  .stats-inline {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 1.5rem;
  }

  .stat-inline strong {
    color: #254c6f;
    font-weight: 600;
  }

  .stat-separator {
    color: #ccc;
  }

  /* Embedded Map */
  .map-embed {
    margin: 2rem 0;
  }

  .map-embed .map-container {
    position: relative;
    width: 100%;
    max-width: 100%;
    height: 450px;
    background: #FFFFFF;
    border: 0px solid #e0e0e0;
    overflow: visible;
  }

  .map-embed .map-svg {
    width: 100%;
    height: 100%;
  }

  .map-caption {
    font-size: 0.85rem;
    color: #666;
    font-style: italic;
    margin-top: 0.5rem;
    text-align: center;
  }

  /* Statistics Header - keeping for reference */
  .stats-header {
    margin-bottom: 1.5rem;
  }

  .stats-grid {
    display: flex;
    justify-content: center;
    gap: 3rem;
    margin-bottom: 2rem;
  }

  .stat-card {
    text-align: center;
    padding: 1rem 1.5rem;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    min-width: 120px;
  }

  .stat-number {
    font-size: 2rem;
    font-weight: 700;
    color: #254c6f;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.85rem;
    color: #666;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .header-text {
    text-align: center;
    max-width: 700px;
    margin: 0 auto;
  }

  .header-text h2 {
    font-size: 2.5rem;
    margin: 0 0 1rem;
    color: #254c6f;
    font-weight: 700;
  }

  .subhead {
    font-size: 1.1rem;
    line-height: 1.7;
    color: #444;
    margin: 0;
  }

  /* Map Section */
  .map-section {
    margin: 1.5rem 0 2rem;
    background: white;
  }

  .map-container {
    position: relative;
    width: 100%;
    height: 450px;
    background: white;
    overflow: visible;
  }

  .map-svg {
    width: 100%;
    height: 100%;
  }

  .state-path {
    pointer-events: none;
  }

  .school-dot {
    fill: #254c6f;
    stroke: white;
    stroke-width: 1.5;
    cursor: pointer;
    opacity: 0.9;
    transition: all 0.2s ease;
  }

  .school-dot:hover,
  .school-dot.hovered {
    fill: #1e3d57;
    stroke: white;
    stroke-width: 2;
    opacity: 1;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }

  /* Tooltip */
  .tooltip {
    position: absolute;
    z-index: 1000;
    pointer-events: none;
  }

  .tooltip-content {
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    min-width: 200px;
    animation: tooltipAppear 0.2s ease;
  }

  @keyframes tooltipAppear {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .tooltip-title {
    font-weight: 600;
    color: #222;
    font-size: 1rem;
    margin-bottom: 0.25rem;
  }

  .tooltip-state {
    color: #666;
    font-size: 0.9rem;
  }

  /* Map Legend */
  .map-legend {
    display: flex;
    justify-content: center;
    gap: 2rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #f5f5f5;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
    color: #666;
  }

  .legend-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .legend-dot.single {
    background: #254c6f;
    border: 2px solid white;
    box-shadow: 0 0 0 1px #254c6f;
  }

  .data-warning {
    margin-top: 1.5rem;
    padding: 1rem 1.25rem;
    border: 1px solid #f0c36d;
    background: #fff8e6;
    border-radius: 10px;
    color: #5c3b0a;
  }

  .warning-title {
    font-weight: 600;
    margin-bottom: 0.35rem;
    color: #8a5a0a;
  }

  .warning-text {
    margin-bottom: 0.25rem;
    font-size: 0.95rem;
  }

  .warning-list {
    font-size: 0.9rem;
    color: #7a4f06;
  }

  /* Charts Section */
  .charts-section {
    margin: 1.5rem 0;
    padding: 0;
    background: transparent;
  }

  .charts-section h3 {
    font-size: 2rem;
    color: #254c6f;
    margin-bottom: 2rem;
    font-weight: 700;
    text-align: center;
  }

  .charts-grid {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .chart-container {
    background: transparent;
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .chart-container h4 {
    font-size: 1.1rem;
    color: #254c6f;
    margin-bottom: 0.5rem;
    font-weight: 700;
  }

  .chart-dek {
    font-size: 0.95rem;
    color: #666;
    margin-bottom: 1.5rem;
    font-weight: 400;
    line-height: 1.5;
  }

  /* Bar Chart */
  .bar-chart-wrapper {
    position: relative;
    width: 100%;
    padding: 0;
    background: transparent;
  }

  .bar-chart-container {
    display: flex;
    gap: 0.5rem;
    align-items: stretch;
  }

  .y-axis-labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-top: 5px;
    padding-bottom: 15px;
    min-width: 40px;
  }

  .y-axis-label {
    font-size: 11px;
    fill: #FFFFFF;
  }

  .bar-chart-svg-container {
    flex: 1;
    position: relative;
  }

  .bar-chart-svg {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .bar {
    transition: opacity 0.2s ease;
  }

  .bar:hover {
    opacity: 1 !important;
  }

  .bar-chart-labels {
    position: relative;
    width: 100%;
    height: 30px;
    margin-top: 0.5rem;
  }

  .bar-label {
    font-size: 11px;
    fill: #FFFFFF;
  }

  /* Calendar Heatmap */
  .calendar-grid-container {
    position: relative;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.75rem;
    padding: 0.75rem 0;
    background: transparent;
  }

  .month-calendar {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .month-label {
    font-size: 0.7rem;
    font-weight: 600;
    color: #254c6f;
    text-align: center;
  }

  .month-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1.5px;
  }

  .calendar-day {
    aspect-ratio: 1;
    border-radius: 2px;
    border: 1px solid rgba(214, 97, 58, 0.2);
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .calendar-day.empty {
    background: transparent;
    border: none;
    cursor: default;
  }

  .calendar-day.no-data {
    background: #f5f5f5;
    border-color: #e0e0e0;
  }

  .calendar-day:not(.empty):not(.no-data):hover {
    transform: scale(1.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border-color: #254c6f;
    z-index: 10;
    border-width: 2px;
  }

  .heatmap-legend {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-top: 1rem;
    font-size: 0.75rem;
    color: #888;
  }

  .legend-scale {
    display: flex;
    gap: 3px;
  }

  .legend-scale div {
    width: 16px;
    height: 16px;
    border-radius: 2px;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }

  .loading-text {
    text-align: center;
    color: #666;
    font-style: italic;
    padding: 2rem;
  }

  /* Methodology Content */
  .methodology-content {
    margin-top: 2rem;
    padding: 0;
    background: transparent;
  }

  .methodology-content h3 {
    font-size: 1.8rem;
    color: #254c6f;
    margin-bottom: 1.5rem;
    margin-top: 0;
    font-weight: 700;
  }

  .methodology-content h4 {
    font-size: 1.3rem;
    color: #254c6f;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    font-weight: 700;
  }

  .methodology-content h5 {
    font-size: 1.1rem;
    color: #444;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .methodology-content p {
    color: #444;
    line-height: 1.7;
    margin-bottom: 1rem;
  }

  .methodology-content ul {
    margin: 0.75rem 0 1.5rem 1.5rem;
    line-height: 1.7;
  }

  .methodology-content li {
    color: #444;
    margin-bottom: 0.5rem;
  }

  .methodology-content a {
    color: #254c6f;
    text-decoration: none;
    border-bottom: 1px solid rgba(214, 97, 58, 0.3);
    transition: border-color 0.2s;
  }

  .methodology-content a:hover {
    border-bottom-color: #254c6f;
  }

  .last-updated {
    margin-top: 2rem;
    padding-top: 1.5rem;
    border-top: 1px solid #e0e0e0;
    color: #666;
    font-size: 0.9rem;
  }

  .placeholder-text {
    color: #666;
    font-style: italic;
    line-height: 1.7;
  }

  @media (max-width: 768px) {
    .container {
      padding: 0 1rem;
    }

    .content-wrapper {
      flex-direction: column;
    }

    .left-nav {
      display: none;
    }

    .main-content {
      width: 100%;
    }

    .stats-grid {
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .stat-card {
      padding: 0.75rem 1rem;
      min-width: 100px;
    }

    .stat-number {
      font-size: 1.5rem;
    }

    .stat-label {
      font-size: 0.8rem;
    }

    .header-text h2 {
      font-size: 2rem;
    }

    .subhead {
      font-size: 1rem;
    }

    .map-section {
      padding: 1rem;
    }

    .map-container {
      height: 400px;
    }

    .map-legend {
      flex-direction: column;
      align-items: center;
      gap: 1rem;
    }

    .charts-section h3 {
      font-size: 1.3rem;
    }

    .charts-grid {
      grid-template-columns: 1fr;
      gap: 1rem;
    }

    .chart-container h4 {
      font-size: 0.95rem;
    }

    .bar-chart-svg {
      height: 180px;
    }

    .bar-label {
      font-size: 0.6rem;
    }

    .calendar-grid-container {
      grid-template-columns: repeat(2, 1fr);
      gap: 0.5rem;
      padding: 0.5rem 0;
    }

    .month-label {
      font-size: 0.65rem;
    }

    .month-grid {
      gap: 1px;
    }
  }

  /* FAQ Section */
  .faq-section {
    margin-top: 2rem;
    padding: 2rem;
    background: #fafafa;
    border-radius: 8px;
  }

  .faq-section h3 {
    font-size: 1.8rem;
    color: #254c6f;
    margin-bottom: 1.5rem;
    margin-top: 0;
    font-weight: 700;
  }

  .faq-item {
    margin-bottom: 1rem;
    border-bottom: 1px solid #e0e0e0;
    padding-bottom: 0.5rem;
  }

  .faq-item:last-child {
    border-bottom: none;
  }

  .faq-question {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 0;
    background: transparent;
    border: none;
    cursor: pointer;
    text-align: left;
    font-size: 1.1rem;
    font-weight: 600;
    color: #444;
    transition: color 0.2s ease;
  }

  .faq-question:hover {
    color: #254c6f;
  }

  .faq-icon {
    font-size: 1.25rem;
    color: #254c6f;
    font-weight: 400;
    line-height: 1;
    margin-left: 1rem;
  }

  .faq-answer {
    padding: 0.5rem 0 1rem 0;
    animation: slideDown 0.3s ease-out;
  }

  .faq-answer p {
    margin: 0;
    color: #444;
    line-height: 1.7;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-5px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
