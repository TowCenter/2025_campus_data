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
    openFaqIndex = openFaqIndex === index ? null : index;
  }

  // AWS S3 configuration
  const S3_LIST_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/list.json';
  const S3_BUCKET_URL = 'https://2025-campus-data.s3.us-east-2.amazonaws.com/data.json';
  let schoolsList = [];
  let allArticles = [];
  let articlesByDate = {};
  let loadingArticles = false;

  // Your pre-geocoded school data
  let schoolData = [
    { name: "Grand Valley State University", lat: 42.9641221, lng: -85.8890404, state: "Michigan" },
    { name: "University of Rhode Island", lat: 41.4862328, lng: -71.5306788, state: "Rhode Island" },
    { name: "University of California Berkeley", lat: 37.8712141, lng: -122.255463, state: "California" },
    { name: "Whitman College", lat: 46.0708191, lng: -118.3295895, state: "Washington" },
    { name: "Johns Hopkins University", lat: 39.3299013, lng: -76.6205177, state: "Maryland" },
    { name: "University of Kentucky", lat: 38.0306511, lng: -84.5039697, state: "Kentucky" },
    { name: "Yale University", lat: 41.3163244, lng: -72.9223431, state: "Connecticut" },
    { name: "Fashion Institute of Technology", lat: 40.7472624, lng: -73.9950292, state: "New York" },
    { name: "Ithaca College", lat: 42.4199229, lng: -76.4969344, state: "New York" },
    { name: "State University of New York Rockland", lat: 41.1489458, lng: -73.9830029, state: "New York" },
    { name: "University of Michigan", lat: 42.277145, lng: -83.7382071, state: "Michigan" },
    { name: "Binghamton University", lat: 42.0971204, lng: -75.9116546, state: "New York" },
    { name: "SUNY binghamton", lat: 42.1128178, lng: -75.9542403, state: "New York" },
    { name: "University of Hawaii at Manoa", lat: 21.2968676, lng: -157.8174491, state: "Hawaii" },
    { name: "Santa Monica College", lat: 34.0167898, lng: -118.4709157, state: "California" },
    { name: "American University", lat: 38.9380155, lng: -77.088922, state: "Washington DC" },
    { name: "University of Kansas", lat: 38.9543439, lng: -95.2557961, state: "Kansas" },
    { name: "University of Delaware", lat: 39.6809151, lng: -75.7523313, state: "Delaware" },
    { name: "Pomona College", lat: 34.0977461, lng: -117.711806, state: "California" },
    { name: "University of Miami", lat: 25.7169568, lng: -80.2798198, state: "Florida" },
    { name: "Illinois Wesleyan University", lat: 40.4908891, lng: -88.9906541, state: "Illinois" },
    { name: "University of Southern Florida", lat: 28.0622334, lng: -82.4135057, state: "Florida" },
    { name: "University of South Florida", lat: 28.0622334, lng: -82.4135057, state: "Florida" },
    { name: "University of Oregon", lat: 44.0448302, lng: -123.0726055, state: "Oregon" },
    { name: "University of North Dakota", lat: 47.922891, lng: -97.0768014, state: "North Dakota" },
    { name: "University of Pennsylvania", lat: 39.9515013, lng: -75.1910161, state: "Pennsylvania" },
    { name: "Emory University", lat: 33.7973735, lng: -84.3252791, state: "Georgia" },
    { name: "Duke University", lat: 36.0014258, lng: -78.9382286, state: "North Carolina" },
    { name: "University of California Davis", lat: 38.5382322, lng: -121.7617125, state: "California" },
    { name: "Sarah Lawrence College", lat: 40.93459, lng: -73.8455821, state: "New York" },
    { name: "Cal Poly Humboldt", lat: 40.7450055, lng: -123.8695086, state: "California" },
    { name: "Georgetown University", lat: 38.9076089, lng: -77.0722585, state: "Washington DC" },
    { name: "California State University Sacramento", lat: 38.560824, lng: -121.423993, state: "California" },
    { name: "Montana State University", lat: 45.6673524, lng: -111.0546211, state: "Montana" },
    { name: "Massachusetts Institute of Technology", lat: 42.360091, lng: -71.09416, state: "Massachusetts" },
    { name: "University of Notre Dame", lat: 41.7051917, lng: -86.2351655, state: "Indiana" },
    { name: "Rice University", lat: 29.7168363, lng: -95.4035531, state: "Texas" },
    { name: "University of North Carolina", lat: 35.9049122, lng: -79.0469134, state: "North Carolina" },
    { name: "Tulane University", lat: 29.9407282, lng: -90.1203167, state: "Louisiana" },
    { name: "George Mason University", lat: 38.8314578, lng: -77.3117471, state: "Virginia" },
    { name: "San Jose State University", lat: 37.3351874, lng: -121.8810715, state: "California" },
    { name: "University of California", lat: 36.778261, lng: -119.4179324, state: "California" },
    { name: "Drexel University", lat: 39.9566127, lng: -75.1899441, state: "Pennsylvania" },
    { name: "New York University", lat: 40.7295134, lng: -73.9964609, state: "New York" },
    { name: "University of Virginia", lat: 38.0335529, lng: -78.5079772, state: "Virginia" },
    { name: "Scripps College", lat: 34.1039624, lng: -117.7101787, state: "California" },
    { name: "Tufts University", lat: 42.4085371, lng: -71.1182729, state: "Massachusetts" },
    { name: "Middlebury College", lat: 44.0081076, lng: -73.1760412, state: "Vermont" },
    { name: "University of Washington", lat: 47.6567171, lng: -122.3066181, state: "Washington" },
    { name: "Western Carolina University", lat: 35.3090108, lng: -83.1863612, state: "North Carolina" },
    { name: "University of Wyoming", lat: 41.3147175, lng: -105.5690288, state: "Wyoming" },
    { name: "UNC Chapel Hill", lat: 35.9049122, lng: -79.0469134, state: "North Carolina" },
    { name: "Purchase College", lat: 41.0400135, lng: -73.7144477, state: "New York" },
    { name: "Northwestern University", lat: 42.0564594, lng: -87.675267, state: "Illinois" },
    { name: "Brown University", lat: 41.8267718, lng: -71.4025482, state: "Rhode Island" },
    { name: "West Michigan University", lat: 42.2837337, lng: -85.6102506, state: "Michigan" },
    { name: "University of New Mexico", lat: 35.0907712, lng: -106.6210407, state: "New Mexico" },
    { name: "Emerson College", lat: 42.352123, lng: -71.065877, state: "Massachusetts" },
    { name: "Lehigh University", lat: 40.6054003, lng: -75.3771764, state: "Pennsylvania" },
    { name: "Washington State University", lat: 46.7328316, lng: -117.1500266, state: "Washington" },
    { name: "Portland State University", lat: 45.5111153, lng: -122.6833385, state: "Oregon" },
    { name: "University of Minnesota, Twin Cities", lat: 44.9753541, lng: -93.2330739, state: "Minnesota" },
    { name: "University of Massachusetts", lat: 42.3865581, lng: -72.5314278, state: "Massachusetts" },
    { name: "University of Chicago", lat: 41.7904484, lng: -87.6003953, state: "Illinois" },
    { name: "Lafayette College", lat: 40.6984713, lng: -75.2101079, state: "Pennsylvania" },
    { name: "University of Oklahoma", lat: 35.1987162, lng: -97.4448963, state: "Oklahoma" },
    { name: "Union College", lat: 42.8179321, lng: -73.9294347, state: "New York" },
    { name: "Haverford College", lat: 40.0074423, lng: -75.3051299, state: "Pennsylvania" },
    { name: "University of Arkansas", lat: 36.0686895, lng: -94.1748471, state: "Arkansas" },
    { name: "Stanford University", lat: 37.42766, lng: -122.17006, state: "California" },
    { name: "Arizona State University", lat: 33.4229975, lng: -111.9278306, state: "Arizona" },
    { name: "Wellesley College", lat: 42.2935733, lng: -71.3059277, state: "Massachusetts" },
    { name: "Vanderbilt University", lat: 36.1447034, lng: -86.8026551, state: "Tennessee" },
    { name: "Indiana University", lat: 39.1682449, lng: -86.5230073, state: "Indiana" },
    { name: "University of Southern California", lat: 34.0223519, lng: -118.285117, state: "California" },
    { name: "Temple University", lat: 39.9811911, lng: -75.1553563, state: "Pennsylvania" },
    { name: "University of Alabama", lat: 33.2114385, lng: -87.5401002, state: "Alabama" },
    { name: "Harvard University", lat: 42.3744368, lng: -71.1182488, state: "Massachusetts" },
    { name: "Muhlenberg College", lat: 40.5981933, lng: -75.5081076, state: "Pennsylvania" },
    { name: "Chapman University", lat: 33.7943211, lng: -117.8518422, state: "California" },
    { name: "Eastern Washington University", lat: 47.4906616, lng: -117.5847877, state: "Washington" },
    { name: "University of Louisville", lat: 38.2157954, lng: -85.7614322, state: "Kentucky" },
    { name: "Georgia Institute of Technology", lat: 33.7779791, lng: -84.3979638, state: "Georgia" },
    { name: "Cornell University", lat: 42.4534492, lng: -76.4735027, state: "New York" },
    { name: "Swarthmore College", lat: 39.903833, lng: -75.3526567, state: "Pennsylvania" },
    { name: "The Ohio State University", lat: 40.0060889, lng: -83.0282624, state: "Ohio" },
    { name: "University of Denver", lat: 39.6766174, lng: -104.9618965, state: "Colorado" },
    { name: "Washington University in St. Louis", lat: 38.6487895, lng: -90.3107962, state: "Missouri" },
    { name: "University of North Texas", lat: 33.2090389, lng: -97.153439, state: "Texas" },
    { name: "University of Utah", lat: 40.7649368, lng: -111.8421021, state: "Utah" },
    { name: "Wagner College", lat: 40.6149557, lng: -74.0943823, state: "New York" },
    { name: "University of Texas Arlington", lat: 32.7292117, lng: -97.1151971, state: "Texas" },
    { name: "Carnegie Mellon University", lat: 40.4432027, lng: -79.9428499, state: "Pennsylvania" },
    { name: "Columbia University", lat: 40.8075355, lng: -73.9625727, state: "New York" },
    { name: "University of Wisconsin Madison", lat: 43.0755143, lng: -89.4154526, state: "Wisconsin" },
    { name: "Rutgers University", lat: 40.5017645, lng: -74.4479342, state: "New Jersey" },
    { name: "University of Tampa", lat: 27.9468757, lng: -82.4672266, state: "Florida" },
    { name: "Towson University", lat: 39.3919027, lng: -76.6124675, state: "Maryland" },
    { name: "Boston University", lat: 42.3504997, lng: -71.1053991, state: "Massachusetts" },
    { name: "University of Colorado", lat: 40.0073499, lng: -105.2659871, state: "Colorado" },
    { name: "University of Cincinnati", lat: 39.1329219, lng: -84.5149504, state: "Ohio" },
    { name: "Princeton University", lat: 40.3430942, lng: -74.6550739, state: "New Jersey" },
    { name: "The New School", lat: 40.7354925, lng: -73.9971361, state: "New York" },
    { name: "Western Michigan University", lat: 42.2837337, lng: -85.6102506, state: "Michigan" },
    { name: "Clemson University", lat: 34.6749926, lng: -82.8406184, state: "South Carolina" },
    { name: "Boise State University", lat: 43.6023364, lng: -116.2009765, state: "Idaho" },
    { name: "Pacific Lutheran University", lat: 47.1451931, lng: -122.4436669, state: "Washington" },
    { name: "University of California Santa Barbara", lat: 34.4139629, lng: -119.848947, state: "California" },
    { name: "University of Tennessee", lat: 35.9544013, lng: -83.9294564, state: "Tennessee" },
    { name: "New England College of Optometry", lat: 42.3519, lng: -71.0868, state: "Massachusetts" }
  ];
  
  // Calculate statistics
  $: totalSchools = schoolData.length;
  $: stateGroups = schoolData.reduce((acc, school) => {
    if (school.state) {
      acc[school.state] = (acc[school.state] || 0) + 1;
    }
    return acc;
  }, {});
  $: totalStates = Object.keys(stateGroups).length;
  $: totalRecords = allArticles.length;

  // Group schools by proximity and calculate offset positions
  function getSchoolPositions(schools) {
    const positions = new Map();
    const proximityThreshold = 15; // pixels - schools within this distance are considered overlapping

    schools.forEach(school => {
      const coords = projectCoordinates(school.lat, school.lng);

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
        // Arrange schools in a circle around the centroid
        const radius = 8; // offset distance
        group.forEach((school, i) => {
          const angle = (i / group.length) * 2 * Math.PI;
          const offsetX = Math.cos(angle) * radius;
          const offsetY = Math.sin(angle) * radius;
          result.push({
            ...school,
            displayCoords: {
              x: school.baseCoords.x + offsetX,
              y: school.baseCoords.y + offsetY
            }
          });
        });
      }
    }

    return result;
  }

  $: schoolPositions = getSchoolPositions(schoolData);

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

  // Convert article data to weekly bar chart data
  function processWeeklyData(dateMap) {
    // Get all dates sorted, only from Jan 1, 2025 onwards
    const allDates = Object.keys(dateMap)
      .filter(dateStr => {
        return dateStr >= '2025-01-01';
      })
      .sort();

    if (allDates.length === 0) return [];

    // Group by ISO week (week starting Monday)
    const weekMap = {};

    allDates.forEach(dateStr => {
      const date = new Date(dateStr + 'T00:00:00Z');

      // Get Monday of this week (ISO week)
      const dayOfWeek = date.getUTCDay();
      const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek; // Monday is day 1
      const monday = new Date(date);
      monday.setUTCDate(date.getUTCDate() + diff);

      const weekKey = monday.toISOString().split('T')[0];
      weekMap[weekKey] = (weekMap[weekKey] || 0) + (dateMap[dateStr] || 0);
    });

    // Return weekly counts sorted by week start date, only weeks starting in 2025
    return Object.keys(weekMap)
      .filter(weekKey => weekKey >= '2025-01-01')
      .sort()
      .map(weekKey => [weekKey, { count: weekMap[weekKey] }]);
  }

  $: dailyBarData = processWeeklyData(articlesByDate);

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

  // Load S3 data for record count and US states map
  onMount(async () => {
    try {
      // Load S3 data
      const response = await fetch(S3_LIST_URL);
      if (response.ok) {
        schoolsList = await response.json();
      }

      // Load US states TopoJSON data
      const topoResponse = await fetch('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json');
      if (topoResponse.ok) {
        const topology = await topoResponse.json();
        statesGeoJSON = topojson.feature(topology, topology.objects.states);
      }

      // Load article data for charts
      loadingArticles = true;
      const articlesResponse = await fetch(S3_BUCKET_URL);
      if (articlesResponse.ok) {
        allArticles = await articlesResponse.json();
        articlesByDate = processArticleData(allArticles);
      }
      loadingArticles = false;
    } catch (err) {
      console.warn('Could not load data:', err);
      loadingArticles = false;
    }
  });
</script>

<div class="methodology-container">
  <div class="container">
    <div class="content-wrapper">
      <!-- Statistics Header -->
      <section class="stats-header">
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-number">{totalSchools}</div>
            <div class="stat-label">Universities</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">{totalStates}</div>
            <div class="stat-label">States</div>
          </div>
          <div class="stat-card">
            <div class="stat-number">
              {#if loadingArticles}
                <span class="loading-text">Loading...</span>
              {:else}
                {totalRecords.toLocaleString()}
              {/if}
            </div>
            <div class="stat-label">Total Records</div>
          </div>
        </div>
        <div class="header-text">
          <h2>Mapping University Responses</h2>
          <p class="subhead">
            Comprehensive tracking of institutional responses to campus protests and federal actions 
            across major universities nationwide.
          </p>
        </div>
      </section>

      <!-- Interactive Map -->
      <section class="map-section">
        <div 
          class="map-container" 
          bind:this={mapContainer} 
          on:mousemove={handleMouseMove}
          role="img" 
          aria-label="Interactive map of universities"
        >
          <!-- US States Map -->
          <svg viewBox="0 0 960 600" class="map-svg">
            <!-- Render US States -->
            {#if statesGeoJSON}
              <g id="us-states">
                {#each statesGeoJSON.features as state}
                  <path
                    class="state-path"
                    d={geoJSONToPath(state)}
                    fill="#f9f9f9"
                    stroke="#c0c0c0"
                    stroke-width="1"
                  />
                {/each}
              </g>
            {:else}
              <!-- Loading placeholder -->
              <text x="480" y="300" text-anchor="middle" fill="#ccc" font-size="14">Loading map...</text>
            {/if}

            <!-- School Dots -->
            {#each schoolPositions as school, i}
              <circle
                cx={school.displayCoords.x}
                cy={school.displayCoords.y}
                r="5"
                class="school-dot"
                class:hovered={hoveredSchool === school}
                on:mouseenter={(event) => handleDotHover(school, event)}
                on:mouseleave={handleDotLeave}
                style="--delay: {i * 0.01}s"
                role="button"
                tabindex="0"
                aria-label="View details for {school.name}"
              />
            {/each}
          </svg>
          
          <!-- Tooltip -->
          {#if showTooltip && hoveredSchool}
            <div 
              class="tooltip" 
              style="left: {tooltipX}px; top: {tooltipY}px;"
            >
              <div class="tooltip-content">
                <div class="tooltip-title">{hoveredSchool.name}</div>
                <div class="tooltip-state">{hoveredSchool.state}</div>
              </div>
            </div>
          {/if}
        </div>
        
        <!-- Map Legend -->
        <div class="map-legend">
          <div class="legend-item">
            <div class="legend-dot single"></div>
            <span>Each dot represents a university</span>
          </div>
        </div>
      </section>

      <!-- Charts Section -->
      {#if !loadingArticles && Object.keys(articlesByDate).length > 0}
        <section class="charts-section">
          <h3>Article Frequency Over Time</h3>

          <!-- Bar Chart -->
          <div class="chart-container">
            <h4>Weekly Article Count</h4>
            <p class="chart-dek">Number of articles published each week (Total articles: {allArticles.length.toLocaleString()}, Weekly data points: {dailyBarData.length}, Date range: {dailyBarData.length > 0 ? `${dailyBarData[0][0]} to ${dailyBarData[dailyBarData.length - 1][0]}` : 'N/A'})</p>
            <div class="bar-chart-wrapper">
                {#if dailyBarData.length > 0}
                  {@const maxCount = Math.max(...dailyBarData.map(m => m[1].count), 1)}
                  {@const chartHeight = 400}
                  {@const chartWidth = 800}
                  {@const leftMargin = 50}
                  {@const bottomMargin = 40}
                  {@const chartAreaWidth = chartWidth - leftMargin}
                  {@const chartAreaHeight = chartHeight - bottomMargin}
                  {@const yAxisMax = (() => {
                    const max = maxCount * 1.1;
                    if (max <= 1000) return 1000;
                    if (max <= 1500) return 1500;
                    if (max <= 2000) return 2000;
                    return Math.ceil(max / 500) * 500;
                  })()}
                  {@const yAxisSteps = 5}
                  {@const yAxisValues = Array.from({length: yAxisSteps + 1}, (_, i) => (yAxisMax / yAxisSteps) * i)}
                  {@const formatNumber = (num) => {
                    if (num >= 1000) {
                      return (num / 1000).toFixed(0) + 'k';
                    }
                    return num.toString();
                  }}
                  {@const dateToTimestamp = (dateKey) => {
                    const [year, month, day] = dateKey.split('-').map(Number);
                    return Date.UTC(year, month - 1, day);
                  }}
                  {@const minTimestamp = dateToTimestamp(dailyBarData[0][0])}
                  {@const maxTimestamp = dateToTimestamp(dailyBarData[dailyBarData.length - 1][0])}
                  {@const timeRange = maxTimestamp - minTimestamp || 1}
                  {@const barWidth = Math.max(1, chartAreaWidth / dailyBarData.length * 0.8)}
                  {@const bars = dailyBarData.map(([key, data]) => {
                    const timestamp = dateToTimestamp(key);
                    const x = leftMargin + ((timestamp - minTimestamp) / timeRange) * chartAreaWidth;
                    const barHeight = (data.count / yAxisMax) * (chartAreaHeight - 10);
                    const zeroY = (chartAreaHeight - 10) * ((yAxisValues.length - 1) / (yAxisValues.length - 1)) + 5;
                    const y = zeroY - barHeight;
                    return { x, y, height: barHeight, count: data.count, date: key };
                  })}
                  {@const monthLabels = (() => {
                    const labels = [];
                    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                    // Parse start and end dates using UTC to avoid timezone issues
                    const [startYear, startMonth] = dailyBarData[0][0].split('-').map(Number);
                    const [endYear, endMonth] = dailyBarData[dailyBarData.length - 1][0].split('-').map(Number);

                    let year = startYear;
                    let month = startMonth;

                    while (year < endYear || (year === endYear && month <= endMonth)) {
                      // Position label at the middle of the month (day 15) for better visual alignment
                      const timestamp = Date.UTC(year, month - 1, 15);
                      // Calculate x position in SVG coordinates (same as bars)
                      const relativePosition = (timestamp - minTimestamp) / timeRange;
                      const x = leftMargin + (relativePosition * chartAreaWidth);
                      const monthIndex = month - 1;
                      const label = month === 1 ? `${monthNames[monthIndex]} ${year}` : monthNames[monthIndex];
                      labels.push({ x, label });

                      month++;
                      if (month > 12) {
                        month = 1;
                        year++;
                      }
                    }
                    return labels;
                  })()}

                  {@const reversedYAxisValues = [...yAxisValues].reverse()}
                  {@const zeroLineY = chartAreaHeight - 5}

                  <div class="bar-chart-container">
                    <!-- Chart SVG -->
                    <div class="bar-chart-svg-container">
                      <svg viewBox="0 0 {chartWidth} {chartHeight}" class="bar-chart-svg">
                        <!-- Y-axis labels -->
                        <g class="y-axis-labels">
                          {#each reversedYAxisValues as value, i}
                            {@const y = (chartAreaHeight - 10) * (i / (yAxisValues.length - 1)) + 5}
                            <text
                              x="5"
                              y={y}
                              text-anchor="start"
                              dominant-baseline="middle"
                              class="y-axis-label"
                            >
                              {formatNumber(value)}
                            </text>
                          {/each}
                        </g>

                        <!-- Grid lines (only show horizontal lines, very subtle) -->
                        <g class="grid-lines">
                          {#each reversedYAxisValues as value, i}
                            {@const y = (chartAreaHeight - 10) * (i / (yAxisValues.length - 1)) + 5}
                            {@const isZeroLine = value === 0}
                            {#if !isZeroLine}
                              <line
                                x1={leftMargin}
                                y1={y}
                                x2={chartWidth}
                                y2={y}
                                stroke="#f0f0f0"
                                stroke-width="0.5"
                              />
                            {/if}
                          {/each}
                        </g>

                        <!-- Bars -->
                        <g class="bars">
                          {#each bars as bar}
                            <rect
                              x={bar.x - barWidth / 2}
                              y={bar.y}
                              width={barWidth}
                              height={bar.height}
                              fill="#254c6f"
                              opacity="0.9"
                              class="bar"
                            >
                              <title>{bar.date}: {bar.count.toLocaleString()} articles</title>
                            </rect>
                          {/each}
                        </g>

                        <!-- Zero baseline (drawn after bars to appear on top) -->
                        <line
                          x1="0"
                          y1={zeroLineY}
                          x2={chartWidth}
                          y2={zeroLineY}
                          stroke="#888"
                          stroke-width="1.5"
                        />

                        <!-- X-axis tick marks -->
                        <g class="x-axis-ticks">
                          {#each monthLabels as monthLabel}
                            <line
                              x1={monthLabel.x}
                              y1={zeroLineY}
                              x2={monthLabel.x}
                              y2={zeroLineY + 5}
                              stroke="#888"
                              stroke-width="1"
                            />
                          {/each}
                        </g>

                        <!-- X-axis labels -->
                        <g class="x-axis-labels">
                          {#each monthLabels as monthLabel}
                            <text
                              x={monthLabel.x}
                              y={chartAreaHeight + 20}
                              text-anchor="middle"
                              class="bar-label"
                            >
                              {monthLabel.label}
                            </text>
                          {/each}
                        </g>
                      </svg>
                    </div>
                  </div>
                {:else}
                  <p class="loading-text">No daily bar data available. Raw data keys: {Object.keys(articlesByDate).length}</p>
                {/if}
              </div>
            </div>
        </section>
      {:else if loadingArticles}
        <section class="charts-section">
          <p class="loading-text">Loading article data...</p>
        </section>
      {:else}
        <section class="charts-section">
          <p class="loading-text">No article data loaded. Articles: {allArticles.length}, Date keys: {Object.keys(articlesByDate).length}</p>
        </section>
      {/if}

      <!-- Methodology Content -->
      <section class="methodology-content">
        <h3>Dataset Methodology</h3>

        <h4>Overview</h4>
        <p>
          This database tracks public communications from 100+ universities during a period of heightened federal oversight,
          capturing how higher education institutions respond to regulatory pressure through their official announcements and statements.
        </p>

        <h4>Collection</h4>
        <p>
          This dataset was created using the Tow Center's scraper factory, a framework for bulk creating and managing web scrapers.
          To select the universities in this dataset, we identified any higher education institution that the Department of Education
          announced investigations into since Donald Trump came into office. We cross-referenced this with universities flagged for
          federal oversight in the <a href="https://hechingerreport.org/which-schools-and-colleges-are-being-investigated-by-the-trump-administration/" target="_blank" rel="noopener noreferrer">Hechinger Report's investigation tracker</a>, which follows a similar collection method.
        </p>
        <p>
          In order to select the websites from each school to scrape, we identified links to each institution's main news announcements,
          press releases, provost office, president or chancellor office, board of trustees, international student office, and financial
          office pages where article-style information was posted. Not all institutions maintain all of these page types, so when possible
          we identified their equivalent offices. This approach resulted in a minimum of three web scrapers per institution and in some
          cases up to seven.
        </p>
        <p>
          We use a multi-step process to manually and automatically verify the data within each university's dataset to ensure it is
          complete and not missing any links, texts or information prior to publication.
        </p>
        <p>
          Currently the data is from Jan. 1, 2025 onwards, and is updated weekly. We plan on releasing more data with previous years
          in the near future.
        </p>

        <h4>Sourcing</h4>

        <h5>Available Content Types</h5>
        <ul>
          <li>Official university press releases</li>
          <li>University news pages and portals</li>
          <li>Public announcement pages for campus communities</li>
          <li>Policy statements from university leadership</li>
          <li>Operational updates and campus communications</li>
        </ul>

        <h4>Limitations & Exclusions</h4>

        <h5>Not Included</h5>
        <ul>
          <li>Private or internal communications</li>
          <li>Information published in non latin characters</li>
          <li>Social media posts</li>
          <li>Routine academic announcements (course schedules, calendars)</li>
          <li>Individual department or faculty pages</li>
          <li>Password-protected or login-protected content</li>
        </ul>

        <h5>Data Gaps</h5>
        <ul>
          <li>Some universities may block automated access to certain pages</li>
          <li>Announcements without clear publication dates are marked as undated, but we manually verify dates when possible. Original publication dates are preserved when available.</li>
          <li>Historical communications prior to January 2025 (collection in progress)</li>
        </ul>

        <h4>Privacy & Ethics</h4>
        <p>
          All data collection focuses exclusively on publicly available content that universities have chosen to share openly.
          No private communications or restricted-access materials are included in the database.
        </p>

        <h4>Access & Updates</h4>
        <p>
          This dataset is open-source and updated regularly as new university communications are published. For technical
          questions about data collection methods or to report data quality issues, please contact our team.
        </p>

        <p class="last-updated">
          <strong>Last Updated:</strong> November 26, 2025
        </p>
      </section>

      <!-- FAQ Section -->
      <section class="faq-section">
        <h3>Frequently Asked Questions</h3>

        <div class="faq-item">
          <button class="faq-question" on:click={() => toggleFaq(0)}>
            <span>What is available for any given school?</span>
            <span class="faq-icon">{openFaqIndex === 0 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 0}
            <div class="faq-answer">
              <p>The headline, date published, full text and link to any given article.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" on:click={() => toggleFaq(1)}>
            <span>Why not farther back?</span>
            <span class="faq-icon">{openFaqIndex === 1 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 1}
            <div class="faq-answer">
              <p>We aim to publish more data soon that goes farther back.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" on:click={() => toggleFaq(2)}>
            <span>What types of schools are included?</span>
            <span class="faq-icon">{openFaqIndex === 2 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 2}
            <div class="faq-answer">
              <p>Post-secondary education institutions with degree-granting programs above the high school level that lead to a certificate or degree, including community colleges, technical or trade schools, universities, graduate programs, and vocational schools.</p>
            </div>
          {/if}
        </div>

        <div class="faq-item">
          <button class="faq-question" on:click={() => toggleFaq(3)}>
            <span>What is not available?</span>
            <span class="faq-icon">{openFaqIndex === 3 ? '−' : '+'}</span>
          </button>
          {#if openFaqIndex === 3}
            <div class="faq-answer">
              <p>Fill in answer here</p>
            </div>
          {/if}
        </div>
      </section>
    </div>
  </div>
</div>

<style>
  .methodology-container {
    background: white;
    min-height: 60vh;
  }

  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 3rem;
  }

  .content-wrapper {
    padding: 2rem 0 4rem;
  }

  /* Statistics Header */
  .stats-header {
    margin-bottom: 3rem;
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
    font-family: "Lyon Display Web", serif;
    line-height: 1;
    margin-bottom: 0.25rem;
  }

  .stat-label {
    font-size: 0.85rem;
    color: #666;
    font-family: "Graphik Web", sans-serif;
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
    font-family: "Lyon Display Web", serif;
  }

  .subhead {
    font-size: 1.1rem;
    line-height: 1.7;
    color: #444;
    margin: 0;
  }

  /* Map Section */
  .map-section {
    margin: 4rem 0;
    background: white;
  }

  .map-container {
    position: relative;
    width: 100%;
    height: 600px;
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
    stroke-width: 2;
    cursor: pointer;
    opacity: 1;
    transition: all 0.3s ease;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  .school-dot:hover,
  .school-dot.hovered {
    r: 8;
    fill: #1e3d57;
    stroke: #254c6f;
    stroke-width: 3;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.3));
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
    font-family: "Graphik Web", sans-serif;
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
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid #f5f5f5;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.9rem;
    color: #666;
    font-family: "Graphik Web", sans-serif;
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

  /* Charts Section */
  .charts-section {
    margin: 3rem 0;
    padding: 0;
    background: transparent;
  }

  .charts-section h3 {
    font-size: 2rem;
    color: #254c6f;
    margin-bottom: 2rem;
    font-family: "Lyon Display Web", serif;
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
    font-family: "Lyon Display Web", serif;
    font-weight: 700;
  }

  .chart-dek {
    font-size: 0.95rem;
    color: #666;
    margin-bottom: 1.5rem;
    font-family: "Graphik Web", sans-serif;
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
    fill: #888;
    font-family: "Graphik Web", sans-serif;
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
    fill: #666;
    font-family: "Graphik Web", sans-serif;
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
    font-family: "Graphik Web", sans-serif;
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
    font-family: "Graphik Web", sans-serif;
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
    margin-top: 4rem;
    padding: 2rem;
    background: #fafafa;
    border-radius: 8px;
  }

  .methodology-content h3 {
    font-size: 1.8rem;
    color: #254c6f;
    margin-bottom: 1.5rem;
    margin-top: 0;
    font-family: "Lyon Display Web", serif;
    font-weight: 700;
  }

  .methodology-content h4 {
    font-size: 1.3rem;
    color: #254c6f;
    margin-top: 2rem;
    margin-bottom: 0.75rem;
    font-family: "Lyon Display Web", serif;
    font-weight: 700;
  }

  .methodology-content h5 {
    font-size: 1.1rem;
    color: #444;
    margin-top: 1.5rem;
    margin-bottom: 0.5rem;
    font-family: "Graphik Web", sans-serif;
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
      height: 300px;
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
    font-family: "Lyon Display Web", serif;
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
    font-family: "Graphik Web", sans-serif;
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