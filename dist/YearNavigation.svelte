<script>
	import { onMount, onDestroy } from 'svelte';

	/**
	 * @typedef {Object} Props
	 * @property {Record<string, any[]>} [groupedData={}] - Filtered data grouped by date key
	 * @property {any[]} [allData=[]] - All data (unfiltered) to show all years/months
	 * @property {(year: number) => void} [onYearClick=() => {}] - Callback when year is clicked
	 */
	/** @type {Props} */
	let { groupedData = {}, allData = [], onYearClick = () => {} } = $props();

	// ============================================================================
	// CONSTANTS
	// ============================================================================
	const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 
		'July', 'August', 'September', 'October', 'November', 'December'];
	const ITEM_HEIGHT_PX = 24;
	const SCROLL_OFFSET = 200;
	const MAX_SCROLL_RETRIES = 15;
	const SCROLL_RETRY_DELAY = 150;
	const FALLBACK_SCROLL_THRESHOLD = 400;

	// ============================================================================
	// STATE
	// ============================================================================
	let isVisible = $state(false);
	let viewportHeight = $state(800);
	/** @type {number | null} */
	let activeYear = $state(null);
	/** @type {string | null} */
	let activeMonth = $state(null);
	/** @type {Set<number>} */
	let expandedYears = $state(new Set());
	/** @type {Set<number>} */
	let manuallyCollapsedYears = $state(new Set());
	let isPastLastCard = $state(false);
	/** @type {number | null} */
	let absoluteTop = $state(null);
	let filterBarHeight = $state(0);

	// ============================================================================
	// MEMORY MANAGEMENT
	// ============================================================================
	const dateKeyFormatCache = new Map();
	const activeTimers = new Set();
	/** @type {(() => void) | null} */
	let scrollCleanup = null;

	// ============================================================================
	// HELPER FUNCTIONS
	// ============================================================================
	/**
	 * @param {string} monthName
	 * @returns {number}
	 */
	function getMonthIndex(monthName) {
		return MONTHS.indexOf(monthName);
	}

	/**
	 * @param {Date} dateObj
	 * @returns {string}
	 */
	function formatDateKey(dateObj) {
		const time = dateObj.getTime();
		if (dateKeyFormatCache.has(time)) {
			return dateKeyFormatCache.get(time);
		}
		const key = dateObj.toLocaleString('default', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
		dateKeyFormatCache.set(time, key);
		return key;
	}

	// ============================================================================
	// DERIVED DATA
	// ============================================================================
	/**
	 * Parse date from item to get month-year key
	 * @param {any} item
	 * @returns {{year: number, month: string, dateObj: Date} | null}
	 */
	function parseItemDate(item) {
		if (!item?.date) return null;
		const dateStr = item.date;
		if (!dateStr || typeof dateStr !== 'string') return null;
		
		let dateObj;
		if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
			const [year, month, day] = dateStr.split('-').map(Number);
			dateObj = new Date(year, month - 1, day);
		} else {
			dateObj = new Date(dateStr);
		}
		if (isNaN(dateObj.getTime())) return null;
		
		const year = dateObj.getFullYear();
		if (year < 1900 || year > 2100) return null;
		
		const monthName = dateObj.toLocaleString('default', { month: 'long' });
		return { year, month: monthName, dateObj };
	}

	/**
	 * Group all data by month-year to show all available months/years
	 * @type {Array<{date: Date, month: string, year: number, count: number, lastDate: Date}>}
	 */
	const monthYearData = $derived.by(() => {
		const monthYearMap = new Map();
		
		try {
			// First, get all months/years from allData (unfiltered)
			for (const item of allData) {
				const parsed = parseItemDate(item);
				if (!parsed) continue;
				
				const { year, month, dateObj } = parsed;
				const monthYearKey = `${month} ${year}`;
				const monthIndex = getMonthIndex(month);
				if (monthIndex < 0) continue;
				
				if (!monthYearMap.has(monthYearKey)) {
					const lastDay = new Date(year, monthIndex + 1, 0).getDate();
					monthYearMap.set(monthYearKey, {
						date: dateObj,
						month,
						year,
						count: 0,
						lastDate: new Date(year, monthIndex, lastDay)
					});
				}
			}
			
			// Then, add filtered counts from groupedData
			for (const [dateKey, items] of Object.entries(groupedData)) {
				if (!items || items.length === 0) continue;
				
				const dateMatch = dateKey.match(/(\w+)\s+(\d+),\s+(\d{4})/);
				if (!dateMatch) continue;
				
				const [, month, , year] = dateMatch;
				const monthYearKey = `${month} ${year}`;
				const yearNum = parseInt(year, 10);
				if (isNaN(yearNum)) continue;
				
				const entry = monthYearMap.get(monthYearKey);
				if (entry) {
					entry.count += items.length;
				}
			}
			
			return Array.from(monthYearMap.values())
				.filter(entry => entry && entry.lastDate && !isNaN(entry.lastDate.getTime()))
				.sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());
		} catch (error) {
			console.error('Error in monthYearData:', error);
			return [];
		}
	});

	/**
	 * Get all unique years from monthYearData (more efficient than parsing allData)
	 * @type {Set<number>}
	 */
	const allYearsSet = $derived.by(() => {
		const years = new Set();
		if (!Array.isArray(monthYearData)) return years;
		
		for (const item of monthYearData) {
			if (item?.year && item.year >= 1900 && item.year <= 2100) {
				years.add(item.year);
			}
		}
		return years;
	});

	/**
	 * Calculate date range for scrubber
	 */
	const dateRange = $derived.by(() => {
		if (!Array.isArray(monthYearData) || monthYearData.length === 0) {
			return { min: null, max: null, totalDays: 0 };
		}
		
		const dates = monthYearData.map(item => item.lastDate.getTime());
		const minTime = Math.min(...dates);
		const maxTime = Math.max(...dates);
		const totalDays = Math.ceil((maxTime - minTime) / (1000 * 60 * 60 * 24));
		
		return {
			min: new Date(minTime),
			max: new Date(maxTime),
			totalDays
		};
	});

	/**
	 * Get all unique years sorted for scrubber labels
	 */
	const sortedYears = $derived.by(() => {
		return Array.from(allYearsSet).sort((a, b) => b - a);
	});

	/**
	 * Calculate year counts with proportional spacing
	 * @type {Array<{year: number, count: number, hasData: boolean, gap: string}>}
	 */
	const yearCounts = $derived.by(() => {
		try {
			const counts = new Map();
			
			if (!Array.isArray(monthYearData)) return [];
			
			for (const item of monthYearData) {
				if (!item || typeof item.year !== 'number' || typeof item.count !== 'number') continue;
				const existing = counts.get(item.year) || 0;
				counts.set(item.year, existing + item.count);
			}
			
			const sortedYearsList = Array.from(allYearsSet)
				.filter(y => !isNaN(y))
				.sort((a, b) => b - a);
			
			const numYears = sortedYearsList.length;
			if (numYears === 0) return [];
			
			const availableHeightPx = (viewportHeight * 0.8) - 40;
			const totalItemHeight = ITEM_HEIGHT_PX * numYears;
			const remainingSpace = Math.max(0, availableHeightPx - totalItemHeight);
			const gapSizePx = numYears > 1 ? remainingSpace / (numYears - 1) : 0;
			const gapSizeRem = Math.max(0.15, gapSizePx / 16);
			
			return sortedYearsList.map((year, index) => {
				const filteredCount = counts.get(year) || 0;
				return {
				year,
					count: filteredCount,
					hasData: filteredCount > 0,
				gap: index < sortedYearsList.length - 1 ? `${gapSizeRem}rem` : '0'
				};
			});
		} catch (error) {
			console.error('Error in yearCounts:', error);
			return [];
		}
	});

	/**
	 * Memoized months by year for efficient lookups
	 * @type {Map<number, Array<{month: string, count: number}>>}
	 */
	const monthsByYear = $derived.by(() => {
		const map = new Map();
		if (!Array.isArray(monthYearData)) return map;
		
		for (const item of monthYearData) {
			if (!item?.year) continue;
			if (!map.has(item.year)) {
				map.set(item.year, []);
			}
			map.get(item.year).push({ month: item.month, count: item.count });
		}
		
		// Sort months for each year
		for (const [year, months] of map.entries()) {
			months.sort((/** @type {{month: string, count: number}} */ a, /** @type {{month: string, count: number}} */ b) => {
				const monthA = getMonthIndex(a.month);
				const monthB = getMonthIndex(b.month);
				return monthB - monthA;
			});
		}
		
		return map;
	});

	/**
	 * Get months for a specific year (uses memoized data)
	 * @param {number} year
	 * @returns {Array<{month: string, count: number}>}
	 */
	function getMonthsForYear(year) {
		if (!year) return [];
		return monthsByYear.get(year) || [];
	}

	/**
	 * Check if filters are currently active
	 * @returns {boolean}
	 */
	function hasActiveFilters() {
		// Simple heuristic: if groupedData exists and has items,
		// and monthsByYear has months but some have count 0,
		// then filters are likely active
		const groupedKeysCount = Object.keys(groupedData).length;
		const allDataCount = Array.isArray(allData) ? allData.length : 0;
		
		// If we have allData but groupedData has significantly fewer date keys,
		// filters are likely active
		if (allDataCount > 0 && groupedKeysCount > 0) {
			// If groupedData has fewer unique dates than allData has items,
			// and the ratio is low, filters are likely active
			// (typically there's less than 1 item per date, so this is approximate)
			return groupedKeysCount < allDataCount * 0.9;
		}
		
		return false;
	}

	// ============================================================================
	// EVENT HANDLERS
	// ============================================================================
	/**
	 * @param {number} year
	 */
	function handleYearClick(year) {
		if (typeof year !== 'number' || isNaN(year)) return;
		onYearClick(year);
	}

	/**
	 * @param {number} year
	 * @param {Event} event
	 */
	function toggleYearExpansion(year, event) {
		if (event) {
			event.stopPropagation();
		}
		const newExpanded = new Set(expandedYears);
		const newManuallyCollapsed = new Set(manuallyCollapsedYears);
		
		if (newExpanded.has(year)) {
			// Collapsing - mark as manually collapsed
			newExpanded.delete(year);
			newManuallyCollapsed.add(year);
		} else {
			// Expanding - remove from manually collapsed set
			// Collapse all other years first
			newExpanded.clear();
			newExpanded.add(year);
			newManuallyCollapsed.clear();
			
			// Scroll to this year
			handleYearClick(year);
		}
		expandedYears = newExpanded;
		manuallyCollapsedYears = newManuallyCollapsed;
	}

	// Automatically expand the active year when it changes and collapse all others
	$effect(() => {
		const currentActiveYear = activeYear;
		
		if (currentActiveYear !== null) {
			// Only expand the active year, collapse all others
			const newExpanded = new Set([currentActiveYear]);
			const newManuallyCollapsed = new Set();
			
			expandedYears = newExpanded;
			manuallyCollapsedYears = newManuallyCollapsed;
		}
	});

/**
	 * @param {number} year
	 * @param {string} monthName
	 */
	function handleMonthClick(year, monthName) {
		if (typeof window === 'undefined') return;
		
		const yearStr = String(year);
		const allDateKeys = [];
		
		// First, try to find dates in filtered data
		for (const dateKey of Object.keys(groupedData)) {
			if (!dateKey.includes(yearStr)) continue;
			const monthMatch = dateKey.match(/^(\w+)/);
			if (monthMatch && monthMatch[1] === monthName) {
				allDateKeys.push(dateKey);
			}
		}
		
		// If no filtered data, fall back to allData to find dates for that month/year
		if (allDateKeys.length === 0) {
			const monthIndex = getMonthIndex(monthName);
			if (monthIndex >= 0) {
				for (const item of allData) {
					const parsed = parseItemDate(item);
					if (!parsed || parsed.year !== year || parsed.month !== monthName) continue;
					
					const dateKey = formatDateKey(parsed.dateObj);
					if (!allDateKeys.includes(dateKey)) {
						allDateKeys.push(dateKey);
					}
				}
			}
		}
		
		if (allDateKeys.length === 0) {
			console.log(`No data found for ${monthName} ${year}`);
			return;
		}
		
		allDateKeys.sort((a, b) => {
			const dateA = new Date(a);
			const dateB = new Date(b);
			if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
			return dateB.getTime() - dateA.getTime();
		});
		
		const targetDateKey = allDateKeys[0];
		
		// Try to find the target date in filtered data first
		let itemIndex = 0;
		let targetIndex = -1;
		
		for (const items of Object.values(groupedData)) {
			if (!Array.isArray(items)) continue;
			for (const item of items) {
				if (!item?.date) continue;
				
				let dateObj;
				if (typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
					const [y, m, d] = item.date.split('-').map(Number);
					dateObj = new Date(y, m - 1, d);
				} else {
					dateObj = new Date(item.date);
				}
				if (isNaN(dateObj.getTime())) continue;
				
				const itemDateKey = formatDateKey(dateObj);
				if (itemDateKey === targetDateKey) {
					targetIndex = itemIndex;
					break;
				}
				itemIndex++;
			}
			if (targetIndex >= 0) break;
		}
		
		// If not found in filtered data, we'll just scroll to the date directly
		if (targetIndex >= 0) {
			const loadEvent = new CustomEvent('loadItemsForIndex', {
				detail: { targetIndex, targetDateKey }
			});
			window.dispatchEvent(loadEvent);
		}
		
		let retryCount = 0;
		let isCancelled = false;
		
		const attemptScroll = () => {
			if (isCancelled) return;
			
			const timelineRows = document.querySelectorAll('.timeline-row');
			let foundRow = null;
			
			for (const row of timelineRows) {
				const dateTag = row.querySelector('.date-tag');
				if (!dateTag) continue;
				
				const monthDayText = dateTag.querySelector('.date-month-day')?.textContent?.trim();
				const yearText = dateTag.querySelector('.date-year')?.textContent?.trim();
				if (monthDayText && yearText) {
					const reconstructedKey = `${monthDayText}, ${yearText}`;
					if (reconstructedKey === targetDateKey) {
						foundRow = row;
						break;
					}
				}
			}
			
			if (foundRow) {
				const elementTop = foundRow.getBoundingClientRect().top + window.scrollY;
				window.scrollTo({
					top: elementTop - SCROLL_OFFSET,
					behavior: 'smooth'
				});
			} else if (retryCount < MAX_SCROLL_RETRIES && !isCancelled) {
				retryCount++;
				const timerId = setTimeout(attemptScroll, SCROLL_RETRY_DELAY);
				activeTimers.add(timerId);
			} else if (!isCancelled) {
				console.log(`Could not find timeline row for ${targetDateKey} after ${MAX_SCROLL_RETRIES} attempts`);
			}
		};
		
		const initialTimer = setTimeout(attemptScroll, 100);
		activeTimers.add(initialTimer);
		// Note: Cleanup is handled by onDestroy clearing all timers
	}

	// ============================================================================
	// SCROLL & RESIZE HANDLERS
	// ============================================================================
	onMount(() => {
		if (typeof window === 'undefined') return;
		
		/** @type {HTMLElement | null} */
		let filterBarWrapper = null;
		/** @type {HTMLElement | null} */
		let timelineContainer = null;
		let timelineContainerBottom = 0;
		let ticking = false;
		
		// Track intersecting rows for active year/month detection
		/** @type {Map<HTMLElement, {year: number, month: string | null, top: number}>} */
		const intersectingRows = new Map();
		
		const initFilterBar = () => {
			if (!filterBarWrapper) {
				filterBarWrapper = document.querySelector('.filter-bar-wrapper');
				if (filterBarWrapper) {
					const rect = filterBarWrapper.getBoundingClientRect();
					const isSticky = filterBarWrapper.classList.contains('sticky');
					if (isSticky || rect.bottom <= 0) {
						isVisible = true;
					}
					if (filterBarHeight !== rect.height) {
						filterBarHeight = rect.height;
					}
				}
			}
		};
		
		const initTimelineContainer = () => {
			if (!timelineContainer) {
				timelineContainer = document.querySelector('.timeline-container');
				if (timelineContainer) {
					const rect = timelineContainer.getBoundingClientRect();
					const scrollY = window.scrollY || window.pageYOffset;
					timelineContainerBottom = rect.bottom + scrollY;
				}
			}
		};
		
		// Extract year and month from a timeline row element
		/**
		 * @param {HTMLElement} row
		 * @returns {{year: number | null, month: string | null}}
		 */
		const extractYearMonth = (row) => {
			const dateTag = row.querySelector('.date-tag');
			if (!dateTag) return { year: null, month: null };
			
			const yearText = dateTag.querySelector('.date-year');
			const monthDayText = dateTag.querySelector('.date-month-day');
			
			let year = null;
			let month = null;
			
			if (yearText) {
				year = parseInt(yearText.textContent?.trim() || '', 10);
				if (isNaN(year)) year = null;
			}
			
			if (monthDayText) {
				const monthDay = monthDayText.textContent?.trim() || '';
				const monthMatch = monthDay.match(/^(\w+)/);
				if (monthMatch) {
					month = monthMatch[1];
				}
			}
			
			return { year, month };
		};
		
		// Update active year/month based on intersecting rows
		const updateActiveYearMonth = () => {
			if (!isVisible || intersectingRows.size === 0) return;
			
			// Find the row closest to the scroll offset
			let closestRow = null;
			let closestDistance = Infinity;
			
			for (const [row, data] of intersectingRows.entries()) {
				const rect = row.getBoundingClientRect();
				const distance = Math.abs(rect.top - SCROLL_OFFSET);
				if (distance < closestDistance) {
					closestDistance = distance;
					closestRow = data;
				}
			}
			
			if (closestRow) {
				if (activeYear !== closestRow.year) {
					activeYear = closestRow.year;
				}
				if (activeMonth !== closestRow.month) {
					activeMonth = closestRow.month;
				}
			}
		};
		
		// Intersection Observer for timeline rows
		/** @type {IntersectionObserver | null} */
		let rowObserver = null;
		
		const setupRowObserver = () => {
			if (rowObserver) {
				rowObserver.disconnect();
			}
			
			rowObserver = new IntersectionObserver((entries) => {
				for (const entry of entries) {
					const row = entry.target;
					if (!(row instanceof HTMLElement)) continue;
					
					if (entry.isIntersecting) {
						const { year, month } = extractYearMonth(row);
						if (year !== null) {
							const rect = row.getBoundingClientRect();
							intersectingRows.set(row, { year, month, top: rect.top });
						}
					} else {
						intersectingRows.delete(row);
					}
				}
				
				updateActiveYearMonth();
			}, {
				root: null,
				rootMargin: `-${SCROLL_OFFSET}px 0px -50% 0px`,
				threshold: [0, 0.1, 0.5, 1]
			});
			
			// Observe all timeline rows
			const timelineRows = document.querySelectorAll('.timeline-row');
			for (const row of timelineRows) {
				if (row instanceof HTMLElement) {
					rowObserver.observe(row);
				}
			}
		};
		
		// Re-observe rows when DOM changes (e.g., new items loaded)
		const observeNewRows = () => {
			if (!rowObserver) return;
			
			const allRows = document.querySelectorAll('.timeline-row');
			for (const row of allRows) {
				if (row instanceof HTMLElement && !intersectingRows.has(row)) {
					rowObserver.observe(row);
				}
			}
		};
		
		const handleScroll = () => {
			if (ticking) return;
			
			ticking = true;
			requestAnimationFrame(() => {
				const scrollY = window.scrollY || window.pageYOffset;
				
				if (timelineContainer) {
					const rect = timelineContainer.getBoundingClientRect();
					timelineContainerBottom = rect.bottom + scrollY;
				} else {
					initTimelineContainer();
				}
				
				const pastLastCard = timelineContainerBottom > 0 && scrollY >= timelineContainerBottom - window.innerHeight;
				if (isPastLastCard !== pastLastCard) {
					isPastLastCard = pastLastCard;
				}
				
				if (filterBarWrapper) {
					const rect = filterBarWrapper.getBoundingClientRect();
					const isSticky = filterBarWrapper.classList.contains('sticky');
					if (isSticky && filterBarHeight !== rect.height) {
						filterBarHeight = rect.height;
					}
				}
				
				let shouldShow = false;
				if (filterBarWrapper) {
					const rect = filterBarWrapper.getBoundingClientRect();
					const isSticky = filterBarWrapper.classList.contains('sticky');
					shouldShow = isSticky || rect.bottom <= 0;
				} else {
					shouldShow = scrollY > FALLBACK_SCROLL_THRESHOLD;
				}
				
				if (shouldShow !== isVisible) {
					isVisible = shouldShow;
				}
				
				if (pastLastCard && timelineContainer) {
					const rect = timelineContainer.getBoundingClientRect();
					const scrollY = window.scrollY || window.pageYOffset;
					const timelineBottomDoc = rect.bottom + scrollY;
					const newAbsoluteTop = timelineBottomDoc - (window.innerHeight / 2);
					if (absoluteTop !== newAbsoluteTop) {
						absoluteTop = newAbsoluteTop;
					}
				} else if (absoluteTop !== null) {
					absoluteTop = null;
				}
				
				// Update active year/month from intersecting rows
				updateActiveYearMonth();
				
				// Check for new rows that might have been added
				observeNewRows();
				
				ticking = false;
			});
		};
		
		const handleResize = () => {
			viewportHeight = window.innerHeight;
			filterBarWrapper = null;
			filterBarHeight = 0;
			timelineContainer = null;
			intersectingRows.clear();
			initFilterBar();
			initTimelineContainer();
			setupRowObserver();
			handleScroll();
		};
		
		viewportHeight = window.innerHeight;
		initFilterBar();
		initTimelineContainer();
		
		// Setup Intersection Observer after a short delay to ensure DOM is ready
		setTimeout(() => {
			setupRowObserver();
		}, 100);
		
		// Also check periodically for new rows (in case of infinite scroll)
		const observeInterval = setInterval(observeNewRows, 500);
		
		window.addEventListener('scroll', handleScroll, { passive: true });
		window.addEventListener('resize', handleResize, { passive: true });
		handleScroll();
		
		scrollCleanup = () => {
			window.removeEventListener('scroll', handleScroll);
			window.removeEventListener('resize', handleResize);
			if (rowObserver) {
				rowObserver.disconnect();
				rowObserver = null;
			}
			clearInterval(observeInterval);
			intersectingRows.clear();
		};
	});

	onDestroy(() => {
		// Clear all timers
		for (const timerId of activeTimers) {
			clearTimeout(timerId);
		}
		activeTimers.clear();
		
		// Clear caches
		dateKeyFormatCache.clear();
		
		// Clean up event listeners
		if (scrollCleanup) {
			scrollCleanup();
			scrollCleanup = null;
		}
	});
</script>

{#if yearCounts.length > 0 && isVisible}
	<div 
		class="year-navigation" 
		class:past-last-card={isPastLastCard}
		style={isPastLastCard && absoluteTop !== null 
			? `top: ${absoluteTop}px; transform: translateY(-50%); position: absolute;` 
			: filterBarHeight > 0 
				? `top: ${filterBarHeight}px; transform: translateY(0); position: fixed; height: calc(100vh - ${filterBarHeight}px - 2rem);` 
				: 'position: fixed; height: calc(100vh - 2rem);'}
	>
		<div class="year-list">
			<div class="year-divider"></div>
			{#each yearCounts as { year, count, hasData, gap }}
				{@const isExpanded = expandedYears.has(year)}
				{@const months = getMonthsForYear(year)}
				{@const isActiveYear = activeYear === year}
				<div class="year-wrapper">
					<div class="year-item-container">
						<button
							class="year-circle"
							class:active={isActiveYear}
							class:has-data={hasData}
							onclick={(e) => toggleYearExpansion(year, e)}
							type="button"
							aria-label={isExpanded ? `Collapse ${year}` : `Expand ${year}`}
							title={isExpanded ? 'Collapse' : 'Expand'}
						></button>
						<button
							class="year-item"
							class:active={isActiveYear}
							class:has-data={hasData}
							class:no-data={!hasData}
							onclick={() => handleYearClick(year)}
							type="button"
						>
							<span class="year-text">{year}</span>
						</button>
					</div>
					{#if isExpanded && months.length > 0}
						<div class="months-list">
							{#each months as { month, count: monthCount }}
								{@const isActiveMonth = activeYear === year && activeMonth === month}
								{@const hasData = monthCount > 0}
								{@const isFiltered = hasActiveFilters()}
								<div class="month-item-container">
									<div class="month-tick"></div>
									<button
										class="month-circle"
										class:active={isActiveMonth}
										class:has-data={hasData}
										class:no-data={isFiltered && !hasData}
										disabled={isFiltered && !hasData}
										onclick={() => hasData && handleMonthClick(year, month)}
										type="button"
										aria-label={`Go to ${month} ${year}`}
										title={isFiltered && !hasData ? `No data for ${month} ${year}` : `Go to ${month} ${year}`}
									></button>
									<button
										class="month-item"
										class:active={isActiveMonth}
										class:has-data={hasData}
										class:no-data={isFiltered && !hasData}
										disabled={isFiltered && !hasData}
										onclick={() => hasData && handleMonthClick(year, month)}
										type="button"
									>
										<span class="month-text">{month}</span>
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.year-navigation {
		position: fixed;
		left: 2rem;
		top: 0;
		transform: translateY(0);
		z-index: 100;
		display: flex;
		align-items: center;
		/* gap: 0.75rem; */
		animation: fadeIn 0.3s ease;
		height: 100vh;
		max-height: 100vh;
		overflow: visible;
		padding: 0.5rem 0;
		margin-right: 2rem;
		transition: top 0.3s ease, transform 0.3s ease;
		will-change: top, transform, position;
		max-width: calc(100vw - 4rem);
	}
	
	.year-navigation.past-last-card {
		position: absolute;
		left: 2rem;
		transition: top 0.3s ease, transform 0.3s ease;
		z-index: 100;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.year-list {
		display: flex;
		flex-direction: column;
		gap: 0;
		align-items: flex-start;
		padding-left: 0.75rem;
		position: relative;
		height: 100%;
		overflow-y: auto;
		overflow-x: visible;
		justify-content: flex-start;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.year-list::-webkit-scrollbar {
		display: none;
	}

	.year-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.15rem 0.3rem;
		font-family: inherit;
		transition: all 0.2s ease;
		position: relative;
		border-radius: 4px;
		justify-content: flex-start;
		box-sizing: border-box;
		white-space: nowrap;
		width: 100%;
	}



	.year-item.no-data {
		opacity: 0.4;
		cursor: default;
	}

	.year-item.no-data:hover {
		transform: none;
		background-color: transparent;
	}

	.year-item.active {
		padding: 0.1rem 0;
	}

	.year-item.active .year-text {
		color: #254c6f;
		font-weight: 500;
	}

	.year-item:hover:not(.active) {
		z-index: 10;
		overflow: visible;
	}

	.year-item:hover:not(.active) .year-text {
		color: #254c6fb2;
	}

	.year-wrapper {
		position: relative;
	}

	.year-list {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0;
		align-items: flex-start;
		padding-left: 1.5rem;
		height: 100%;
		overflow-y: auto;
		overflow-x: visible;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}

	.year-list::-webkit-scrollbar {
		display: none;
	}

	.year-divider {
		position: absolute;
		left: 1.5rem;
		top: 0;
		bottom: 0;
		width: 1px;
		background: #e0e0e0;
		z-index: 0;
		transform: translateX(5px);
	}

	.year-wrapper {
		position: relative;
		z-index: 1;
		width: 100%;
		margin-bottom: 0.2rem;
	}

	.year-item-container {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		position: relative;
	}

	.year-circle {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		border: 1.5px solid #e0e0e0;
		background: white;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		position: relative;
		z-index: 2;
		transition: all 0.2s ease;
	}

	.year-circle.active {
		background: #254c6f;
		border-color: #254c6f;
	}

	.year-circle.has-data:not(.active) {
		border-color: #254c6fb2;
	}

	.year-circle:not(.has-data):not(.active) {
		border-color: #ccc;
	}

	.year-item {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.1rem 0;
		font-family: inherit;
		display: flex;
		align-items: center;
		transition: all 0.2s ease;
	}

	.year-item.no-data {
		opacity: 0.4;
		cursor: default;
	}

	.year-text {
		font-size: 0.65rem;
		color: #ccc;
		font-weight: 400;
		white-space: nowrap;
		line-height: 1.1;
		transition: all 0.2s ease;
	}

	.year-item.has-data .year-text {
		color: #254c6fb2;
	}

	.year-item.active .year-text {
		color: #254c6f;
		font-weight: 500;
	}

	.year-item:hover:not(.no-data) .year-text {
		color: #254c6fb2;
	}

	.months-list {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-left: 1.75rem;
		margin-top: 0.5rem;
		margin-bottom: 0.75rem;
	}

	.month-item-container {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		position: relative;
	}

	.month-tick {
		position: absolute;
		left: -0.7rem;
		top: 50%;
		transform: translateY(-50%);
		width: 0.75rem;
		height: 0.05rem;
		background: #e0e0e0;
		z-index: 1;
		pointer-events: none;
	}

	.month-circle {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		border: 1.5px solid #ccc;
		background: white;
		cursor: pointer;
		padding: 0;
		flex-shrink: 0;
		position: relative;
		z-index: 2;
		transition: all 0.2s ease;
	}

	.month-circle.has-data:not(.active) {
		border-color: #254c6fb2;
	}

	.month-circle:not(.has-data):not(.active) {
		border-color: #ccc;
	}

	.month-circle.active {
		background: #254c6f;
		border-color: #254c6f;
		z-index: 10;
	}

	.month-circle.no-data,
	.month-circle:disabled {
		opacity: 0.3;
		cursor: not-allowed;
		pointer-events: none;
	}

	.month-circle.no-data:hover,
	.month-circle:disabled:hover {
		border-color: #e0e0e0;
	}

	.month-item.no-data,
	.month-item:disabled {
		opacity: 0.3;
		cursor: not-allowed;
		pointer-events: none;
	}

	.month-item.no-data .month-text,
	.month-item:disabled .month-text {
		color: #999;
		cursor: not-allowed;
	}

	.month-item.no-data:hover .month-text,
	.month-item:disabled:hover .month-text {
		color: #999;
	}

	.month-item {
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.15rem 0;
		font-family: inherit;
		display: flex;
		align-items: center;
		transition: all 0.2s ease;
	}

	.month-text {
		font-size: 0.6rem;
		color: #ccc;
		font-weight: 400;
		white-space: nowrap;
		line-height: 1.2;
		transition: all 0.2s ease;
	}

	.month-item.has-data .month-text {
		color: #254c6fb2;
	}

	.month-item.active .month-text {
		color: #254c6f;
		font-weight: 500;
	}

	.month-item:hover:not(.no-data) .month-text {
		color: #254c6fb2;
	}


	.months-list {
		display: flex;
		flex-direction: column;
		gap: 0.05rem;
		margin-left:  1rem;
		/* margin-top: 0.25rem; */
		margin-bottom: 0.5rem;
	}

	.month-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		background: none;
		border: none;
		cursor: pointer;
		padding: 0.2rem 0.4rem;
		font-family: inherit;
		transition: all 0.2s ease;
		border-radius: 4px;
		white-space: nowrap;
	}

	.month-item:hover {
		background-color: rgba(38, 76, 111, 0.05);
	}

	.month-item:hover .month-text {
		color: #254c6fb2;
		font-weight: 500;
	}

	.month-item.active {
		background-color: rgba(38, 76, 111, 0.1);
	}

	.month-item.active .month-text {
		color: #254c6f;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.year-navigation {
			display: none;
		}
	}
</style>


