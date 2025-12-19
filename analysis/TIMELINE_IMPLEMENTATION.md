# Timeline Sidebar Implementation Guide
**Feature:** Year/Month timeline with clickable navigation + infinite scroll

---

## 📊 Data Structure

Your timeline data has been generated in `timeline_data.json`:

```json
[
  {
    "year": 2025,
    "total": 17285,
    "months": [
      {
        "month": 10,
        "monthName": "November",
        "count": 1128,
        "articleIds": [0, 45, 123, ...]
      },
      {
        "month": 9,
        "monthName": "October",
        "count": 2748,
        "articleIds": [...]
      }
    ]
  },
  {
    "year": 2024,
    "total": 10077,
    "months": [...]
  }
]
```

---

## 🎨 Timeline Sidebar Component

### Visual Structure (Similar to your screenshot)

```
┌─────────────────┐
│ 2025        17k │ ← Year (clickable)
│   Nov      1.1k │ ← Month (clickable)
│   Oct      2.7k │
│   Sep      3.4k │
│   Aug      1.2k │
│                 │
│ 2024        10k │
│   Dec      1.1k │
│   Nov       843 │
│   Oct      1.0k │
│   ...           │
└─────────────────┘
```

---

## 💻 Implementation Options

### Option 1: Svelte Component (Recommended for your stack)

```svelte
<!-- TimelineSidebar.svelte -->
<script>
  import { onMount } from 'svelte';
  import timelineData from './timeline_data.json';

  export let currentPeriod = null;
  export let onPeriodClick = () => {};

  let expandedYears = new Set([2025]); // Start with current year expanded

  function toggleYear(year) {
    if (expandedYears.has(year)) {
      expandedYears.delete(year);
    } else {
      expandedYears.add(year);
    }
    expandedYears = expandedYears; // Trigger reactivity
  }

  function handleMonthClick(year, month) {
    onPeriodClick({ year, month });
  }

  function formatCount(count) {
    if (count >= 1000) {
      return (count / 1000).toFixed(1) + 'k';
    }
    return count;
  }
</script>

<aside class="timeline-sidebar">
  <h3>Timeline</h3>

  {#each timelineData as yearData}
    <div class="year-section">
      <!-- Year Header -->
      <button
        class="year-header"
        class:expanded={expandedYears.has(yearData.year)}
        on:click={() => toggleYear(yearData.year)}
      >
        <span class="year">{yearData.year}</span>
        <span class="count">{formatCount(yearData.total)}</span>
      </button>

      <!-- Month List (collapsible) -->
      {#if expandedYears.has(yearData.year)}
        <div class="months">
          {#each yearData.months as monthData}
            <button
              class="month-item"
              class:active={currentPeriod?.year === yearData.year &&
                           currentPeriod?.month === monthData.month}
              on:click={() => handleMonthClick(yearData.year, monthData.month)}
            >
              <span class="month-name">{monthData.monthName}</span>
              <span class="count">{formatCount(monthData.count)}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/each}
</aside>

<style>
  .timeline-sidebar {
    width: 200px;
    height: 100vh;
    overflow-y: auto;
    padding: 20px;
    background: #f8f9fa;
    border-left: 1px solid #dee2e6;
  }

  .year-section {
    margin-bottom: 12px;
  }

  .year-header {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
    transition: all 0.2s;
  }

  .year-header:hover {
    background: #e9ecef;
  }

  .year-header.expanded {
    background: #007bff;
    color: white;
    border-color: #007bff;
  }

  .months {
    margin-top: 4px;
    padding-left: 12px;
  }

  .month-item {
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 6px 12px;
    background: white;
    border: none;
    border-left: 2px solid #dee2e6;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    margin-bottom: 2px;
  }

  .month-item:hover {
    background: #f8f9fa;
    border-left-color: #007bff;
  }

  .month-item.active {
    background: #e7f3ff;
    border-left-color: #007bff;
    font-weight: 600;
  }

  .count {
    color: #6c757d;
    font-size: 12px;
  }
</style>
```

---

## 🔄 Infinite Scroll Implementation

### Main Article List Component

```svelte
<!-- ArticleList.svelte -->
<script>
  import { onMount } from 'svelte';
  import IntersectionObserver from 'svelte-intersection-observer';

  export let articles = [];
  export let currentFilter = null;

  let displayedArticles = [];
  let currentIndex = 0;
  const BATCH_SIZE = 50; // Load 50 articles at a time

  // Group articles by year/month for virtual scrolling
  let articlesByPeriod = {};
  let periodKeys = []; // Array of "YYYY-MM" keys in chronological order

  onMount(() => {
    groupArticlesByPeriod();
    loadMoreArticles();
  });

  function groupArticlesByPeriod() {
    articlesByPeriod = {};

    articles.forEach((article, index) => {
      const date = new Date(article.date.$date);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!articlesByPeriod[key]) {
        articlesByPeriod[key] = {
          year: date.getFullYear(),
          month: date.getMonth(),
          monthName: date.toLocaleString('en-US', { month: 'long' }),
          articles: [],
          startIndex: index
        };
      }

      articlesByPeriod[key].articles.push(article);
    });

    // Sort period keys (newest first)
    periodKeys = Object.keys(articlesByPeriod).sort().reverse();
  }

  function loadMoreArticles() {
    const nextBatch = articles.slice(currentIndex, currentIndex + BATCH_SIZE);
    displayedArticles = [...displayedArticles, ...nextBatch];
    currentIndex += BATCH_SIZE;
  }

  function scrollToPeriod(year, month) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    const periodData = articlesByPeriod[key];

    if (periodData) {
      // Find the first article element for this period
      const element = document.getElementById(`period-${key}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  // Expose scroll function for parent component
  export { scrollToPeriod };
</script>

<div class="article-list">
  {#each periodKeys as periodKey}
    {@const period = articlesByPeriod[periodKey]}

    <!-- Period Header -->
    <div
      id="period-{periodKey}"
      class="period-header"
      data-year={period.year}
      data-month={period.month}
    >
      <h2>{period.monthName} {period.year}</h2>
      <span class="period-count">{period.articles.length} articles</span>
    </div>

    <!-- Articles in this period -->
    <div class="articles">
      {#each period.articles as article}
        <article class="article-card">
          <h3>{article.title}</h3>
          <div class="meta">
            <span class="org">{article.org}</span>
            <span class="date">{new Date(article.date.$date).toLocaleDateString()}</span>
          </div>
          <p class="excerpt">
            {article.content.substring(0, 200)}...
          </p>
          <a href={article.url} target="_blank" class="read-more">Read more →</a>
        </article>
      {/each}
    </div>
  {/each}

  <!-- Infinite scroll trigger -->
  <IntersectionObserver
    once={false}
    on:intersect={loadMoreArticles}
  >
    <div class="loading-trigger">
      {#if currentIndex < articles.length}
        <p>Loading more...</p>
      {:else}
        <p>End of results</p>
      {/if}
    </div>
  </IntersectionObserver>
</div>

<style>
  .article-list {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }

  .period-header {
    position: sticky;
    top: 0;
    background: white;
    padding: 12px 0;
    margin-bottom: 16px;
    border-bottom: 2px solid #dee2e6;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 10;
  }

  .period-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }

  .period-count {
    color: #6c757d;
    font-size: 14px;
  }

  .articles {
    display: grid;
    gap: 16px;
    margin-bottom: 32px;
  }

  .article-card {
    background: white;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    padding: 16px;
    transition: box-shadow 0.2s;
  }

  .article-card:hover {
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .loading-trigger {
    padding: 20px;
    text-align: center;
    color: #6c757d;
  }
</style>
```

---

## 🔗 Connecting Timeline to Article List

### Parent Component

```svelte
<!-- App.svelte -->
<script>
  import TimelineSidebar from './TimelineSidebar.svelte';
  import ArticleList from './ArticleList.svelte';
  import articlesData from './campus_data.articles.json';

  let articleListComponent;
  let currentPeriod = null;

  function handlePeriodClick(period) {
    currentPeriod = period;

    // Scroll to the selected period
    if (articleListComponent) {
      articleListComponent.scrollToPeriod(period.year, period.month);
    }
  }
</script>

<div class="app-layout">
  <main class="content">
    <ArticleList
      bind:this={articleListComponent}
      articles={articlesData}
    />
  </main>

  <TimelineSidebar
    {currentPeriod}
    onPeriodClick={handlePeriodClick}
  />
</div>

<style>
  .app-layout {
    display: flex;
    height: 100vh;
    width: 100%;
  }

  .content {
    flex: 1;
    overflow: hidden;
  }
</style>
```

---

## 📈 Timeline Data Summary

**Total Coverage:** 73,909 articles

**Top Months:**
- 2025 September: 3,423 articles
- 2025 October: 2,748 articles
- 2025 November: 1,128 articles
- 2024 December: 1,164 articles

**Years:**
- 2025: 17,285 articles
- 2024: 10,077 articles
- 2023: 8,423 articles
- 2022: 6,944 articles
- 2021: 5,882 articles

---

## 🚀 Implementation Steps

1. **Load timeline data:**
   ```javascript
   import timelineData from './timeline_data.json';
   ```

2. **Render timeline sidebar** with years/months

3. **Implement article grouping** by period (year-month)

4. **Add period headers** as scroll anchors (with IDs)

5. **Connect click handlers** to scroll functionality

6. **Optional: Add intersection observer** to highlight current visible period in timeline

---

## 📁 Files Generated

1. **timeline_data.json** - Pre-computed timeline with counts
2. **generate_timeline.js** - Script to regenerate timeline
3. **TIMELINE_IMPLEMENTATION.md** - This guide (Svelte examples)

---

## 💡 Performance Tips

1. **Virtual scrolling:** Only render visible months (use svelte-virtual-list)
2. **Lazy loading:** Load article content on demand
3. **Debounce scroll:** Update timeline highlight with debounce
4. **Index by ID:** Keep article ID index for fast lookups
5. **Sticky headers:** Use sticky positioning for month headers

Your timeline is ready to implement! 🎉
