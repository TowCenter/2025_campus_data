<script>
  import { onMount } from 'svelte';
  import * as topojson from 'topojson-client';
  import * as d3 from 'd3-geo';

  let mapContainer;
  let mapSvg;
  let mapGroup;
  let hoveredSchool = null;
  let tooltipX = 0;
  let tooltipY = 0;
  let tooltipTransform = 'translate(-50%, -100%)';
  let showTooltip = false;
  let statesGeoJSON = null;
  
  // Zoom and pan state
  let zoomLevel = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragStartPanX = 0;
  let dragStartPanY = 0;
  
  // Touch state for mobile
  let touchStartDistance = 0;
  let touchStartZoom = 1;
  let touchStartPanX = 0;
  let touchStartPanY = 0;
  let lastTouchCenterX = 0;
  let lastTouchCenterY = 0;
  
  const MIN_ZOOM = 1;
  const MAX_ZOOM = 4;
  const ZOOM_STEP = 0.2;
  
  // Derived transform string for SVG
  $: mapTransform = `translate(${panX}, ${panY}) scale(${zoomLevel})`;

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
  const INSTITUTION_INDEX_BASE_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/institution_index';
  const INSTITUTION_INDEX_MANIFEST_URL = `${INSTITUTION_INDEX_BASE_URL}/manifest.json`; // { "a": { "American University": 503, ... }, ... }
  const SOURCES_CSV_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/sources.csv';
  let schoolData = [];
  let institutionIndex = {};
  let institutionNames = [];
  let institutionIndexLoaded = false;
  let institutionIndexLoadFailed = false;
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

  // Group schools by proximity and calculate offset positions to prevent overlap
  function getSchoolPositions(schools) {
    const positions = new Map();
    const dotRadius = 4; // radius of each dot
    const proximityThreshold = dotRadius * 2; // pixels - schools within this distance are considered overlapping

    schools.forEach(school => {
      const coords = projectCoordinates(school.lat, school.lng);
      if (coords.x === 0 && coords.y === 0) return; // Skip invalid coordinates (includes territories that don't project)

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
        // Arrange schools in a tight spiral to prevent overlap without drifting into ocean
        const baseRadius = dotRadius * 1.5; // Tighter spiral
        group.forEach((school, i) => {
          if (i === 0) {
            result.push({ ...school, displayCoords: school.baseCoords });
          } else {
            const ring = Math.ceil(Math.sqrt(i));
            const posInRing = i - (ring - 1) * (ring - 1);
            const ringSize = ring * 6; // More positions per ring = tighter packing
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
  $: console.log('Map debug:', { schoolDataCount: schoolData.length, institutionNamesCount: institutionNames.length, visibleSchoolsCount: visibleSchools.length, schoolPositionsCount: schoolPositions.length });

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
  
  function handleDotTouchStart(event) {
    // Prevent panning when touching a school dot
    event.stopPropagation();
  }

  function updateTooltipPosition(event) {
    if (mapContainer) {
      const rect = mapContainer.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      
      // Estimate tooltip dimensions (approximate)
      const tooltipWidth = 150; // Approximate width
      const tooltipHeight = 60; // Approximate height
      const padding = 10; // Padding from edges
      
      // Calculate boundaries
      const leftBound = padding;
      const rightBound = rect.width - padding;
      const topBound = padding;
      const bottomBound = rect.height - padding;
      
      // Default: center horizontally, above cursor
      let translateX = -50; // -50% centers horizontally
      let translateY = -100; // -100% positions above
      let offsetX = 0;
      let offsetY = -10;
      
      // Check if tooltip would overflow on the right
      if (x + (tooltipWidth / 2) > rightBound) {
        translateX = -100; // Align to right edge
        offsetX = -(rect.width - x - padding);
      }
      // Check if tooltip would overflow on the left
      else if (x - (tooltipWidth / 2) < leftBound) {
        translateX = 0; // Align to left edge
        offsetX = padding - x;
      }
      
      // Check if tooltip would overflow on the top
      if (y - tooltipHeight - 10 < topBound) {
        translateY = 0; // Position below cursor instead
        offsetY = 10;
      }
      // Check if tooltip would overflow on the bottom
      else if (y + tooltipHeight + 10 > bottomBound && y - tooltipHeight - 10 >= topBound) {
        // Keep above, but adjust if needed
        translateY = -100;
        offsetY = -10;
      }
      
      tooltipX = x + offsetX;
      tooltipY = y + offsetY;
      tooltipTransform = `translate(${translateX}%, ${translateY}%)`;
    }
  }

  function handleMouseMove(event) {
    if (showTooltip) {
      updateTooltipPosition(event);
    }
    
    // Handle panning
    if (isDragging) {
      const deltaX = event.clientX - dragStartX;
      const deltaY = event.clientY - dragStartY;
      panX = dragStartPanX + deltaX;
      panY = dragStartPanY + deltaY;
    }
  }
  
  function handleMouseDown(event) {
    if (event.button === 0) { // Left mouse button
      isDragging = true;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragStartPanX = panX;
      dragStartPanY = panY;
      if (mapContainer) {
        mapContainer.style.cursor = 'grabbing';
      }
    }
  }
  
  function handleMouseUp(event) {
    if (event.button === 0) {
      isDragging = false;
      if (mapContainer) {
        mapContainer.style.cursor = 'grab';
      }
    }
  }
  
  function handleWheel(event) {
    event.preventDefault();
    
    if (!mapContainer) return;
    
    const rect = mapContainer.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Calculate zoom factor
    const zoomFactor = event.deltaY > 0 ? 1 - ZOOM_STEP : 1 + ZOOM_STEP;
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * zoomFactor));
    
    if (newZoom !== zoomLevel) {
      // Zoom towards mouse position
      const zoomChange = newZoom / zoomLevel;
      const svgX = (mouseX - panX) / zoomLevel;
      const svgY = (mouseY - panY) / zoomLevel;
      
      panX = mouseX - svgX * newZoom;
      panY = mouseY - svgY * newZoom;
      zoomLevel = newZoom;
    }
  }
  
  function handleZoomIn() {
    const newZoom = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);
    if (newZoom !== zoomLevel) {
      // Zoom towards center
      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const zoomChange = newZoom / zoomLevel;
        const svgX = (centerX - panX) / zoomLevel;
        const svgY = (centerY - panY) / zoomLevel;
        
        panX = centerX - svgX * newZoom;
        panY = centerY - svgY * newZoom;
        zoomLevel = newZoom;
      }
    }
  }
  
  function handleZoomOut() {
    const newZoom = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
    if (newZoom !== zoomLevel) {
      // Zoom towards center
      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        const zoomChange = newZoom / zoomLevel;
        const svgX = (centerX - panX) / zoomLevel;
        const svgY = (centerY - panY) / zoomLevel;
        
        panX = centerX - svgX * newZoom;
        panY = centerY - svgY * newZoom;
        zoomLevel = newZoom;
      }
    }
  }
  
  function handleReset() {
    zoomLevel = 1;
    panX = 0;
    panY = 0;
  }
  
  // Touch event handlers for mobile
  function getTouchDistance(touches) {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  function getTouchCenter(touches) {
    if (touches.length === 0) return { x: 0, y: 0 };
    if (touches.length === 1) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  }
  
  function handleTouchStart(event) {
    if (event.touches.length === 1) {
      // Single touch - start panning
      isDragging = true;
      const touch = event.touches[0];
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      dragStartPanX = panX;
      dragStartPanY = panY;
    } else if (event.touches.length === 2) {
      // Two touches - prepare for pinch zoom
      isDragging = false;
      touchStartDistance = getTouchDistance(event.touches);
      touchStartZoom = zoomLevel;
      touchStartPanX = panX;
      touchStartPanY = panY;
      const center = getTouchCenter(event.touches);
      if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        lastTouchCenterX = center.x - rect.left;
        lastTouchCenterY = center.y - rect.top;
      }
    }
    event.preventDefault();
  }
  
  function handleTouchMove(event) {
    if (event.touches.length === 1 && isDragging) {
      // Single touch - panning
      const touch = event.touches[0];
      const deltaX = touch.clientX - dragStartX;
      const deltaY = touch.clientY - dragStartY;
      panX = dragStartPanX + deltaX;
      panY = dragStartPanY + deltaY;
      event.preventDefault();
    } else if (event.touches.length === 2) {
      // Two touches - pinch zoom
      isDragging = false;
      const currentDistance = getTouchDistance(event.touches);
      if (touchStartDistance > 0 && currentDistance > 0) {
        const scale = currentDistance / touchStartDistance;
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchStartZoom * scale));
        
        if (mapContainer) {
          const rect = mapContainer.getBoundingClientRect();
          const center = getTouchCenter(event.touches);
          const centerX = center.x - rect.left;
          const centerY = center.y - rect.top;
          
          // Calculate pan adjustment for pinch zoom
          const zoomChange = newZoom / touchStartZoom;
          const svgX = (lastTouchCenterX - touchStartPanX) / touchStartZoom;
          const svgY = (lastTouchCenterY - touchStartPanY) / touchStartZoom;
          
          panX = centerX - svgX * newZoom;
          panY = centerY - svgY * newZoom;
          zoomLevel = newZoom;
        }
      }
      event.preventDefault();
    }
  }
  
  function handleTouchEnd(event) {
    if (event.touches.length === 0) {
      isDragging = false;
      touchStartDistance = 0;
    } else if (event.touches.length === 1) {
      // Switch from pinch to pan
      const touch = event.touches[0];
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      dragStartPanX = panX;
      dragStartPanY = panY;
      isDragging = true;
    }
  }

  // Create a path generator using the Albers USA projection
  const pathGenerator = d3.geoPath().projection(projection);

  // Convert GeoJSON to SVG path data using Albers USA projection
  function geoJSONToPath(feature) {
    if (!feature || !feature.geometry) return '';
    return pathGenerator(feature) || '';
  }

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

  // Load S3 data for map and institution filtering
  onMount(async () => {
    pageStartTime = Date.now();

    try {
      // Kick off lightweight index load first for fast counts
      const indexPromise = loadInstitutionIndex();
      const locationsPromise = loadSchoolLocations();

      // Load US states TopoJSON data
      const topoResponse = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
      if (topoResponse.ok) {
        const topology = await topoResponse.json();
        statesGeoJSON = topojson.feature(topology, topology.objects.states);
      }

      // Wait for index and school locations to finish
      await Promise.all([indexPromise, locationsPromise]);
    } catch (err) {
      console.warn('Could not load data:', err);
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
        <p>
          This database includes public announcements from higher education institutions that have been under federal investigation since President Donald Trump took office.
        </p>

        <p>
          Institutions are identified by cross-referencing <a href="https://hechingerreport.org/which-schools-and-colleges-are-being-investigated-by-the-trump-administration/" target="_blank" rel="noopener noreferrer" data-umami-event="external-link-hechinger">The Hechinger Report's investigation tracker</a> with public announcements from the Department of Education and other independent sources to help keep the list of universities current.
        </p>

        <!-- Interactive Map embedded in text -->
        <div class="map-embed">
          <div
            class="map-container"
            bind:this={mapContainer}
            onmousemove={handleMouseMove}
            onmousedown={handleMouseDown}
            onmouseup={handleMouseUp}
            onmouseleave={handleMouseUp}
            onwheel={handleWheel}
            ontouchstart={handleTouchStart}
            ontouchmove={handleTouchMove}
            ontouchend={handleTouchEnd}
            ontouchcancel={handleTouchEnd}
            role="img"
            aria-label="Interactive map of universities"
            style="cursor: {isDragging ? 'grabbing' : 'grab'}; touch-action: none;"
          >
            <svg viewBox="0 0 960 600" class="map-svg" preserveAspectRatio="xMidYMid meet" bind:this={mapSvg}>
              <g bind:this={mapGroup} transform={mapTransform}>
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
                  <g
                    class="school-dot-group"
                    onpointerenter={(event) => handleDotHover(school, event)}
                    onpointerleave={handleDotLeave}
                    ontouchstart={handleDotTouchStart}
                    role="button"
                    tabindex="0"
                    aria-label="View details for {school.name}"
                    style="cursor: pointer; pointer-events: all;"
                  >
                    <!-- Invisible larger hit area -->
                    <circle
                      cx={school.displayCoords.x}
                      cy={school.displayCoords.y}
                      r="12"
                      fill="transparent"
                      stroke="none"
                    />
                    <!-- Visible dot -->
                    <circle
                      cx={school.displayCoords.x}
                      cy={school.displayCoords.y}
                      r="5"
                      fill="#254c6f"
                      stroke="white"
                      stroke-width="1.5"
                      class="school-dot"
                      class:hovered={hoveredSchool?.name === school.name}
                      style="opacity: 0.9;"
                    />
                  </g>
                {/each}
              </g>
            </svg>
            
            <!-- Zoom Controls -->
            <div class="zoom-controls">
              <button 
                class="zoom-btn zoom-in" 
                onclick={handleZoomIn}
                aria-label="Zoom in"
                type="button"
              >
                +
              </button>
              <button 
                class="zoom-btn zoom-out" 
                onclick={handleZoomOut}
                aria-label="Zoom out"
                type="button"
              >
                −
              </button>
              <button 
                class="zoom-btn zoom-reset" 
                onclick={handleReset}
                aria-label="Reset zoom"
                type="button"
              >
                ↻
              </button>
            </div>

            {#if showTooltip && hoveredSchool}
              <div class="map-tooltip" style="left: {tooltipX}px; top: {tooltipY}px; transform: {tooltipTransform};">
                <div class="map-tooltip-content">
                  <div class="map-tooltip-title">{hoveredSchool.name}</div>
                  <div class="map-tooltip-state">{hoveredSchool.state}</div>
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
            <div class="warning-list">
              Missing: {missingLocations.join(', ')}
            </div>
          </div>
        {/if}

        <p>
          We collect official announcements and statements from each institution's primary announcements or news page, as well as from the websites of the president or chancellor, the provost, the board of trustees (or equivalent governing body), and offices related to student affairs or international students. A complete list of webpages we pull data from can be found here.
        </p>

        <p>
          Data is collected using the Tow Center's Scraper Factory, a system we built that allows us to use AI to analyze webpages and write Python code to extract information from them. Learn more about this infrastructure and our data collection methods, here.
        </p>

        <p>
          The database does not include private or internal communications, content published in non-Latin characters, social media posts, individual department or faculty webpages, or any content that requires a login or password to access.
        </p>

        <p>
          Occasionally, a press release will not have any text. These are most often due to the link being primarily a video or filled with non-text elements, however if you notice an error, please let us know.
        </p>

        <p>
          The database reflects information available as of the most recent weekly update and may not capture statements that were modified or removed prior to collection.
        </p>

        <p>
          This dataset is updated weekly as new university communications are published. Users are free to download and analyze the data. If you publish findings based on this dataset, please credit University Public Communication Tracker / Tow Center.
        </p>

        <p>
          The purpose of this database is to help journalists, researchers, and the public examine how universities communicate during periods of federal scrutiny and how those communications change over time. For technical questions about data collection methods or to report potential data quality issues, please contact <a href="mailto:towcenter@columbia.edu">towcenter@columbia.edu</a>.
        </p>
      </section>

      <!-- FAQ Section -->
      <section class="faq-section">
        <h3>Frequently Asked Questions</h3>

        <div class="faq-item">
          <button class="faq-question" data-umami-event="faq-toggle" onclick={() => toggleFaq(0)}>
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
          <button class="faq-question" data-umami-event="faq-toggle" onclick={() => toggleFaq(1)}>
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
          <button class="faq-question" data-umami-event="faq-toggle" onclick={() => toggleFaq(2)}>
            <span>Do you have data from before January 2025?</span>
            <span class="faq-icon">{openFaqIndex === 2 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 2}
            <div class="faq-answer">
              <p>We have not published data before January 1, 2025. If you are interested in data prior to this date, please reach out..</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" data-umami-event="faq-toggle" onclick={() => toggleFaq(3)}>
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
          <button class="faq-question" data-umami-event="faq-toggle" onclick={() => toggleFaq(4)}>
            <span>Do you have an API?</span>
            <span class="faq-icon">{openFaqIndex === 4 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 4}
            <div class="faq-answer">
              <p>Not at this time. However, you can click "Export" to get a CSV file of all the data.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" data-umami-event="faq-toggle" onclick={() => toggleFaq(5)}>
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
          <button class="faq-question" data-umami-event="faq-toggle" onclick={() => toggleFaq(6)}>
            <span>I noticed an issue with the data. What should I do?</span>
            <span class="faq-icon">{openFaqIndex === 6 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 6}
            <div class="faq-answer">
              <p>We welcome feedback and corrections. If you notice a potential error or omission, please contact us at <a href="mailto:towcenter@columbia.edu">towcenter@columbia.edu</a> with details about the issue.</p>
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

  @media (max-width: 767px) {
    .map-embed {
      margin: 1.5rem 0;
    }
  }

  .map-embed .map-container {
    position: relative;
    width: 100%;
    max-width: 100%;
    height: 0;
    padding-bottom: 62.5%; /* 600/960 = 0.625 = 62.5% */
    background: #FFFFFF;
    border: 0px solid #e0e0e0;
    overflow: visible;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
  }
  
  @media (max-width: 767px) {
    .map-embed .map-container {
      /* Improve touch interaction on mobile */
      -webkit-overflow-scrolling: touch;
    }
  }

  .map-embed .map-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: block;
  }

  .map-caption {
    font-size: 0.85rem;
    color: #666;
    font-style: italic;
    margin-top: 0.5rem;
    text-align: center;
  }
  
  /* Zoom Controls */
  .zoom-controls {
    position: absolute;
    bottom: 1rem;
    left: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    z-index: 100;
  }
  
  .zoom-btn {
    width: 36px;
    height: 36px;
    background: white;
    border: 1px solid #e0e0e0;
    border-radius: 4px;
    font-size: 1.2rem;
    font-weight: 600;
    color: #254c6f;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }
  
  .zoom-btn:hover {
    background: #f5f5f5;
    border-color: #254c6f;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }
  
  .zoom-btn:active {
    background: #e0e0e0;
    transform: scale(0.95);
  }
  
  .zoom-btn.zoom-in {
    font-size: 1.5rem;
    line-height: 1;
  }
  
  .zoom-btn.zoom-out {
    font-size: 1.8rem;
    line-height: 1;
  }
  
  .zoom-btn.zoom-reset {
    font-size: 1.2rem;
    line-height: 1;
  }
  
  @media (max-width: 767px) {
    .zoom-controls {
      bottom: 0.75rem;
      left: 0.75rem;
      gap: 0.5rem;
    }
    
    .zoom-btn {
      width: 44px;
      height: 44px;
      font-size: 1.3rem;
      min-height: 44px; /* Ensure minimum touch target size */
      box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);
    }
    
    .zoom-btn.zoom-in {
      font-size: 1.8rem;
    }
    
    .zoom-btn.zoom-out {
      font-size: 2rem;
    }
    
    .zoom-btn.zoom-reset {
      font-size: 1.5rem;
    }
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

  /* Map Tooltip */
  .map-tooltip {
    position: absolute;
    z-index: 1000;
    pointer-events: none;
    /* transform is set inline to handle edge cases */
  }

  .map-tooltip-content {
    background: white;
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 0.35rem 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    white-space: nowrap;
    text-align: center;
  }

  .map-tooltip-title {
    font-weight: 600;
    color: #222;
    font-size: 0.85rem;
    line-height: 1.2;
  }

  .map-tooltip-state {
    color: #666;
    font-size: 0.8rem;
    line-height: 1.2;
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
    font-family: 'Lyon Display Web', 'Georgia', serif;
  }

  .methodology-content h4 {
    font-size: 1.3rem;
    color: #254c6f;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    font-weight: 700;
    font-family: 'Lyon Display Web', 'Georgia', serif;
  }

  .methodology-content h5 {
    font-size: 1.1rem;
    color: #444;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    font-weight: 600;
    font-family: 'Lyon Display Web', 'Georgia', serif;
  }

  .methodology-content p {
    font-family: 'Lyon Text Web', 'Georgia', serif;
    font-size: 20px;
    line-height: 28px;
    color: #222222;
    margin-bottom: 1.5rem;
    margin-top: 0;
    font-weight: 400;
  }

  .methodology-content ul {
    margin: 0.75rem 0 1.5rem 1.5rem;
    line-height: 1.7;
    font-family: 'Lyon Text Web', 'Georgia', serif;
    font-weight: 400;
  }

  .methodology-content li {
    font-family: 'Lyon Text Web', 'Georgia', serif;
    font-size: 20px;
    line-height: 28px;
    color: #222222;
    margin-bottom: 0.75rem;
    font-weight: 400;
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

  @media (max-width: 767px) {
    .methodology-wrapper {
      margin: 0 1rem;
      width: calc(100% - 2rem);
      max-width: calc(100% - 2rem);
      box-sizing: border-box;
    }

    .container {
      padding: 0 1rem;
      margin: 0 1rem;
      width: calc(100% - 2rem);
      max-width: calc(100% - 2rem);
      box-sizing: border-box;
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

    .map-embed {
      margin: 1.5rem 0;
    }

    .map-section {
      padding: 1rem;
      margin: 1.5rem 0;
    }

    .methodology-content {
      margin-top: 1.5rem;
    }

    .methodology-content h3 {
      font-size: 1.6rem;
      margin-top: 1.5rem;
      margin-bottom: 1.25rem;
    }
    
    .methodology-content h4 {
      font-size: 1.25rem;
      margin-top: 1.5rem;
      margin-bottom: 1rem;
    }
    
    .methodology-content h5 {
      font-size: 1.1rem;
    }
    
    .methodology-content p {
      font-size: 18px;
      line-height: 1.65;
      margin-bottom: 1.25rem;
    }
    
    .methodology-content li {
      font-size: 18px;
      line-height: 1.65;
      margin-bottom: 0.75rem;
    }
  }

  @media (min-width: 768px) and (max-width: 1024px) {
    .methodology-wrapper {
      margin: 0 1.5rem;
      width: calc(100% - 3rem);
      max-width: calc(100% - 3rem);
      box-sizing: border-box;
    }

    .container {
      padding: 0 1.5rem;
      margin: 0 1.5rem;
      width: calc(100% - 3rem);
      max-width: calc(100% - 3rem);
      box-sizing: border-box;
    }

    .map-embed {
      margin: 2rem 0;
    }

    .map-container {
      height: 0;
      padding-bottom: 62.5%; /* Maintains 960:600 aspect ratio */
      min-height: 0;
    }

    .map-legend {
      flex-direction: column;
      align-items: center;
      gap: 1rem;
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
    font-family: 'Lyon Display Web', 'Georgia', serif;
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
    font-family: 'Lyon Display Web', 'Georgia', serif;
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
    font-family: 'Lyon Text Web', 'Georgia', serif;
    font-size: 20px;
    line-height: 28px;
    color: #222222;
    margin: 0 0 1rem 0;
    font-weight: 400;
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
