<script>
  export let activeIds = [];  // Filtered article IDs
  export let monthIndex = {};

  let hoveredBar = null;
  let tooltipX = 0;
  let tooltipY = 0;

  $: monthlyData = processMonthlyData(activeIds, monthIndex);

  function processMonthlyData(activeIds, monthIndex) {
    if (!monthIndex || Object.keys(monthIndex).length === 0) return [];

    // Create set of active IDs for fast lookup
    const activeIdSet = activeIds.length > 0 ? new Set(activeIds) : null;

    const monthData = [];

    Object.keys(monthIndex).forEach(key => {
      if (key === '_no_date') return;

      const [year, month] = key.split('-');
      const yearNum = parseInt(year);
      const monthNum = parseInt(month);

      // Only include January 2025 onwards
      if (yearNum < 2025 || (yearNum === 2025 && monthNum < 1)) {
        return;
      }

      // Filter month IDs to only include active (filtered) IDs
      const monthIds = monthIndex[key];
      const filteredIds = activeIdSet
        ? monthIds.filter(id => activeIdSet.has(id))
        : monthIds;

      const count = filteredIds.length;

      // Skip months with no articles after filtering
      if (count === 0) return;

      const date = new Date(yearNum, monthNum - 1, 1);
      const monthName = date.toLocaleString('en-US', { month: 'short' });
      const label = `${monthName} ${yearNum}`;

      monthData.push({
        key,
        year: yearNum,
        month: monthNum,
        count,
        label,
        timestamp: date.getTime()
      });
    });

    // Sort by timestamp
    return monthData.sort((a, b) => a.timestamp - b.timestamp);
  }

  function handleMouseMove(event, bar) {
    hoveredBar = bar;
    tooltipX = event.clientX;
    tooltipY = event.clientY;
  }

  function handleMouseLeave() {
    hoveredBar = null;
  }
</script>

{#if monthlyData.length > 0}
  {@const maxCount = Math.max(...monthlyData.map(m => m.count), 1)}
  {@const chartHeight = 180}
  {@const chartWidth = 800}
  {@const leftMargin = 50}
  {@const bottomMargin = 30}
  {@const chartAreaWidth = chartWidth - leftMargin}
  {@const chartAreaHeight = chartHeight - bottomMargin}
  {@const yAxisMax = Math.ceil(maxCount * 1.1 / 100) * 100}
  {@const yAxisSteps = 5}
  {@const yAxisValues = Array.from({ length: yAxisSteps }, (_, i) =>
    Math.round((yAxisMax / (yAxisSteps - 1)) * i)
  )}
  {@const barWidth = Math.max(1, (chartAreaWidth / monthlyData.length) * 0.7)}
  {@const minTimestamp = monthlyData[0].timestamp}
  {@const maxTimestamp = monthlyData[monthlyData.length - 1].timestamp}
  {@const timeRange = maxTimestamp - minTimestamp || 1}

  <div class="monthly-chart-section">
    <h4>Monthly Article Distribution</h4>
    <p class="chart-description">Article count by month for current filters ({monthlyData.reduce((sum, m) => sum + m.count, 0).toLocaleString()} total articles)</p>

    <div class="bar-chart-wrapper">
      <svg viewBox="0 0 {chartWidth} {chartHeight}" class="bar-chart-svg">
        <!-- Y-axis labels -->
        <g class="y-axis-labels">
          {#each [...yAxisValues].reverse() as value, i}
            {@const y = (chartAreaHeight - 10) * (i / (yAxisSteps - 1)) + 5}
            <text
              x="5"
              y={y}
              text-anchor="start"
              dominant-baseline="middle"
              class="axis-label"
            >
              {value.toLocaleString()}
            </text>
          {/each}
        </g>

        <!-- Grid lines -->
        <g class="grid-lines">
          {#each [...yAxisValues].reverse() as value, i}
            {@const y = (chartAreaHeight - 10) * (i / (yAxisSteps - 1)) + 5}
            <line
              x1={leftMargin}
              y1={y}
              x2={chartWidth}
              y2={y}
              stroke="#f0f0f0"
              stroke-width="0.5"
            />
          {/each}
        </g>

        <!-- Bars -->
        <g class="bars">
          {#each monthlyData as monthData, i}
            {@const x = leftMargin + (i / monthlyData.length) * chartAreaWidth + (chartAreaWidth / monthlyData.length - barWidth) / 2}
            {@const barHeight = (monthData.count / yAxisMax) * (chartAreaHeight - 10)}
            {@const y = chartAreaHeight - 5 - barHeight}
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={hoveredBar?.key === monthData.key ? "#1a3547" : "#254c6f"}
              class="bar"
              role="button"
              tabindex="0"
              aria-label="{monthData.label}: {monthData.count} articles"
              onmouseenter={(e) => handleMouseMove(e, monthData)}
              onmousemove={(e) => handleMouseMove(e, monthData)}
              onmouseleave={handleMouseLeave}
            />
          {/each}
        </g>

        <!-- X-axis labels -->
        <g class="x-axis-labels">
          {#each monthlyData as monthData, i}
            {@const x = leftMargin + (i / monthlyData.length) * chartAreaWidth + (chartAreaWidth / monthlyData.length) / 2}
            <text
              x={x}
              y={chartHeight - 10}
              text-anchor="middle"
              class="axis-label"
            >
              {monthData.label}
            </text>
          {/each}
        </g>

        <!-- Zero line -->
        <line
          x1={leftMargin}
          y1={chartAreaHeight - 5}
          x2={chartWidth}
          y2={chartAreaHeight - 5}
          stroke="#888"
          stroke-width="1.5"
        />
      </svg>
    </div>
  </div>

  <!-- Tooltip -->
  {#if hoveredBar}
    <div
      class="chart-tooltip"
      style="left: {tooltipX + 10}px; top: {tooltipY - 40}px;"
    >
      <div class="tooltip-content">
        <strong>{hoveredBar.label}</strong>
        <div>{hoveredBar.count.toLocaleString()} articles</div>
      </div>
    </div>
  {/if}
{/if}

<style>
  .monthly-chart-section {
    margin: 1.5rem 0 2rem;
    padding: 0;
    background: transparent;
  }

  h4 {
    font-size: 1.1rem;
    color: #254c6f;
    margin: 0 0 0.5rem;
    font-family: "Lyon Display Web", serif;
    font-weight: 700;
  }

  .chart-description {
    font-size: 0.95rem;
    color: #666;
    margin: 0 0 1rem;
    font-family: "Graphik Web", sans-serif;
  }

  .bar-chart-wrapper {
    width: 100%;
    background: transparent;
    padding: 0;
  }

  .bar-chart-svg {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .axis-label {
    font-family: "Graphik Web", sans-serif;
    font-size: 11px;
    fill: #888;
  }

  .bar {
    cursor: pointer;
    transition: fill 0.2s;
  }

  .bar:hover {
    fill: #1a3547;
  }

  .chart-tooltip {
    position: fixed;
    pointer-events: none;
    z-index: 1000;
    background: white;
    border: 1px solid #dee2e6;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border-radius: 4px;
  }

  .tooltip-content {
    padding: 0.5rem 0.75rem;
    font-family: "Graphik Web", sans-serif;
    font-size: 0.85rem;
    color: #333;
  }

  .tooltip-content strong {
    display: block;
    margin-bottom: 0.25rem;
    color: #254c6f;
  }

  .tooltip-content div {
    font-size: 0.8rem;
    color: #666;
  }
</style>
