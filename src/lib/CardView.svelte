<script>
	import { getColumnKey, parseArray, formatDate, parseUrls, formatCitations } from './utils.js';

	/**
	 * @typedef {Object} Props
	 * @property {Array<Object>} [data=[]] - Card data rows
	 * @property {string[]} [columns=[]] - Column names (for filtering/search compatibility)
	 * @property {string} [searchQuery=''] - Search query string
	 * @property {string[]} [filterInteraction=[]] - Filter by interactions
	 * @property {string[]} [filterType=[]] - Filter by types
	 * @property {string[]} [filterPlatform=[]] - Filter by platforms
	 * @property {string[]} [filterPublishers=[]] - Filter by publishers
	 * @property {(data: Array<Object>) => void} [onFilteredDataChange=() => {}] - Callback when filtered data changes
	 */

	/** @type {Props} */
	let { 
		data = [], 
		columns = [],
		searchQuery = '',
		filterInteraction = [],
		filterType = [],
		filterPlatform = [],
		filterPublishers = [],
		onFilteredDataChange = () => {}
	} = $props();

	let expandedCards = $state(new Set());

	function toggleExpandCard(cardIndex) {
		const newSet = new Set(expandedCards);
		if (newSet.has(cardIndex)) {
			newSet.delete(cardIndex);
		} else {
			newSet.add(cardIndex);
		}
		expandedCards = newSet;
	}

	function parseDate(dateStr) {
		if (!dateStr) return new Date(0);
		const str = String(dateStr).trim();
		const [year, month, day] = str.split('-');
		if (year && month && day) {
			return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
		}
		return new Date(str);
	}

	function groupByMonth(items) {
		const groups = {};
		items.forEach((item) => {
			if (!item.date) return; // Skip items without dates
			const dateObj = parseDate(item.date);
			// Check if date is valid
			if (isNaN(dateObj.getTime())) return;
			const key = `${dateObj.toLocaleString('default', {
				month: 'long'
			})} ${dateObj.getFullYear()}`;
			groups[key] = groups[key] || [];
			groups[key].push(item);
		});

		// Sort items within each group by date descending
		Object.keys(groups).forEach(key => {
			groups[key].sort((a, b) => {
				const aDate = parseDate(a.date);
				const bDate = parseDate(b.date);
				return bDate.getTime() - aDate.getTime();
			});
		});

		// Sort groups by date descending (newest first)
		// Sort by the date of the first item in each group
		const sortedGroups = {};
		Object.keys(groups)
			.sort((a, b) => {
				const firstItemA = groups[a][0];
				const firstItemB = groups[b][0];
				if (!firstItemA || !firstItemB) return 0;
				const dateA = parseDate(firstItemA.date);
				const dateB = parseDate(firstItemB.date);
				return dateB.getTime() - dateA.getTime();
			})
			.forEach((key) => {
				sortedGroups[key] = groups[key];
			});

		return sortedGroups;
	}

	/**
	 * Normalizes a value to an array for filtering
	 * @param {any} value - Value to normalize
	 * @returns {any[]} Array of values
	 */
	function normalizeToArray(value) {
		if (Array.isArray(value)) return value;
		return value != null ? [value] : [];
	}

	/**
	 * Checks if any value in array matches any filter value
	 * @param {any[]} values - Values to check
	 * @param {any[]} filters - Filter values
	 * @returns {boolean}
	 */
	function matchesFilter(values, filters) {
		if (!filters?.length) return true;
		return filters.some(filter => values.includes(filter));
	}

	/**
	 * Extracts all organizations from parent_child_matches hierarchy
	 * @param {any[]} parentChildMatches - Parent-child matches array
	 * @returns {string[]} Array of organization names
	 */
	function extractHierarchyOrgs(parentChildMatches) {
		if (!Array.isArray(parentChildMatches)) return [];
		
		const orgs = [];
		parentChildMatches.forEach(match => {
			if (match?.lineage && Array.isArray(match.lineage)) {
				match.lineage.forEach(org => {
					const trimmed = String(org).trim();
					if (trimmed) orgs.push(trimmed);
				});
			}
		});
		return orgs;
	}

	/**
	 * Gets all publishers for a row (including hierarchy)
	 * @param {Object} row - Data row
	 * @returns {string[]} Array of publisher names
	 */
	function getAllPublishers(row) {
		const orgPublishers = normalizeToArray(row.organization_publisher_named_in_deal_suit);
		const affectedPubs = normalizeToArray(row.affected_publications);
		const hierarchyOrgs = extractHierarchyOrgs(row.parent_child_matches);
		return [...orgPublishers, ...affectedPubs, ...hierarchyOrgs];
	}

	/**
	 * Checks if row matches search query
	 * @param {Object} row - Data row
	 * @param {string} query - Search query
	 * @returns {boolean}
	 */
	function matchesSearch(row, query) {
		if (!query?.trim()) return true;
		
		const queryLower = query.toLowerCase();
				const searchableFields = [
					row.date,
					row.interaction,
					row.platform,
					row.organization_publisher_named_in_deal_suit,
					row.type,
					row.reported_details,
			row.status,
			row.case_number,
			row.defendant,
			row.plaintiff,
			row.location,
			row.affected_publications
				];
				
				const searchableText = searchableFields
					.filter(f => f)
					.map(f => {
						if (Array.isArray(f)) {
							return f.map(v => String(v).toLowerCase()).join(' ');
						}
						return String(f).toLowerCase();
					})
					.join(' ');
				
		return searchableText.includes(queryLower);
	}

	/**
	 * Filters and sorts data based on current filters
	 * @returns {Object[]} Filtered and sorted data
	 */
	function getFilteredAndSorted() {
		const filtered = data.filter(row => {
			// Filter by interaction
			if (filterInteraction?.length > 0) {
				const rowInteractions = normalizeToArray(row.interaction);
				if (!matchesFilter(rowInteractions, filterInteraction)) return false;
			}

			// Filter by type
			if (filterType?.length > 0) {
				const rowTypes = normalizeToArray(row.type);
				if (!matchesFilter(rowTypes, filterType)) return false;
			}

			// Filter by platform
			if (filterPlatform?.length > 0) {
				const platforms = parseArray(row.platform);
				if (!matchesFilter(platforms, filterPlatform)) return false;
			}

			// Filter by publishers (News Org)
			if (filterPublishers?.length > 0) {
				const allPublishers = getAllPublishers(row);
				if (!matchesFilter(allPublishers, filterPublishers)) return false;
			}

			// Search query filter
			if (!matchesSearch(row, searchQuery)) return false;

			return true;
		});

		// Sort by date descending (newest first)
		filtered.sort((a, b) => {
			const aDate = parseDate(a.date);
			const bDate = parseDate(b.date);
			return bDate.getTime() - aDate.getTime();
		});

		return filtered;
	}

	let filteredData = $derived(getFilteredAndSorted());
	let groupedData = $derived(groupByMonth(filteredData));

	$effect(() => {
		onFilteredDataChange(filteredData);
	});

	// Auto-expand/collapse cards based on filters/search
	// Note: Excludes AI Company (filterPlatform) and Interaction Type (filterInteraction) from auto-expand
	$effect(() => {
		const hasActiveFilters = 
			(searchQuery && searchQuery.trim().length > 0) ||
			(filterType && filterType.length > 0) ||
			(filterPublishers && filterPublishers.length > 0);

		if (hasActiveFilters) {
			// Expand all filtered cards
			const filteredCardIds = new Set();
			Object.entries(groupedData).forEach(([monthYear, items]) => {
				items.forEach((row, rowIndex) => {
					const cardId = `${monthYear}-${rowIndex}-${row.date || ''}`;
					filteredCardIds.add(cardId);
				});
			});
			expandedCards = filteredCardIds;
		} else {
			// Collapse all cards
			expandedCards = new Set();
		}
	});

	/**
	 * Escapes HTML to prevent XSS attacks
	 * @param {string} text - Text to escape
	 * @returns {string} Escaped HTML
	 */
	function escapeHtml(text) {
		return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	/**
	 * Highlights matching text in search results (only for search query and News Org filter)
	 * @param {any} text - Text to highlight
	 * @param {string[]} searchTerms - Additional search terms
	 * @returns {string} HTML string with highlighted matches
	 */
	function highlightText(text, searchTerms = []) {
		if (!text) return '';

		// Build search patterns
		const searchPatterns = [];
		if (searchQuery?.trim()) {
			searchPatterns.push(searchQuery.trim());
		}
		if (filterPublishers?.length > 0) {
			searchPatterns.push(...filterPublishers);
		}
		if (searchTerms.length > 0) {
			searchPatterns.push(...searchTerms);
		}

		// If no patterns, just escape and return
		if (searchPatterns.length === 0) {
			return escapeHtml(text);
		}

		// Escape HTML first to prevent XSS
		const escapedText = escapeHtml(text);
		
		// Escape special regex characters and create pattern
		const escapedPatterns = searchPatterns
			.filter(p => p && String(p).trim())
			.map(p => String(p).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
		
		if (escapedPatterns.length === 0) {
			return escapedText;
		}

		const pattern = new RegExp(`(${escapedPatterns.join('|')})`, 'gi');
		const parts = escapedText.split(pattern);
		
		return parts.map(part => {
			if (escapedPatterns.some(p => new RegExp(`^${p}$`, 'i').test(part))) {
				return `<mark class="highlight">${part}</mark>`;
			}
			return part;
		}).join('');
	}

	// Interaction type constants
	const INTERACTION_TYPES = {
		LAWSUIT: 'lawsuit',
		GRANT: 'grant',
		DEAL: 'deal'
	};

	/**
	 * Gets the interaction type from a row
	 * @param {any} interaction - Interaction value
	 * @returns {string} Normalized interaction type
	 */
	function getInteractionType(interaction) {
		const interactionStr = String(interaction || '').trim().toLowerCase();
		if (interactionStr === INTERACTION_TYPES.LAWSUIT) return INTERACTION_TYPES.LAWSUIT;
		if (interactionStr === INTERACTION_TYPES.GRANT) return INTERACTION_TYPES.GRANT;
		return INTERACTION_TYPES.DEAL;
	}

	// Removed unused formatPlatforms, formatPublishers, formatTypes functions
	// Use parseArray(value).join(', ') directly if needed

	function getHostname(url) {
		try {
			return new URL(url).hostname.replace('www.', '');
		} catch (e) {
			return url;
		}
	}

	// Build hierarchical tree from parent_child_matches using lineage
	// This ensures all organizations at the same depth appear at the same level (proper org chart)
	function buildHierarchyTree(matches, newsOrgs = []) {
		if (!Array.isArray(matches) || matches.length === 0) return {};

		const tree = {};
		
		// First pass: determine if we have any 3+ level lineages
		// If yes, ALL organizations at position 1 should be shown as intermediate nodes
		const hasMultiLevelLineages = matches.some(match => 
			match.lineage && Array.isArray(match.lineage) && match.lineage.length > 2
		);
		
		// Second pass: build the tree structure
		// Key rule: If ANY org at position 1 is intermediate (in a 3+ level lineage),
		// then ALL orgs at position 1 should be shown as intermediate nodes at the same level
		matches.forEach(match => {
			if (!match.lineage || !Array.isArray(match.lineage) || match.lineage.length < 2) {
				return;
			}

			const lineage = match.lineage;
			const topLevel = lineage[0];
			const publication = lineage[lineage.length - 1];

			if (!tree[topLevel]) {
				tree[topLevel] = {};
			}

			let current = tree[topLevel];

			if (lineage.length > 2) {
				// 3+ level lineage: build all intermediate nodes at their proper depth
				for (let i = 1; i < lineage.length - 1; i++) {
					const level = lineage[i];
					if (!current[level]) {
						current[level] = {};
					}
					current = current[level];
				}
				// Add the publication as a leaf
				if (!current.publications) {
					current.publications = [];
				}
				if (!current.publications.includes(publication)) {
					current.publications.push(publication);
				}
			} else if (lineage.length === 2) {
				// 2-level lineage: if we have multi-level lineages, treat position 1 as intermediate
				if (hasMultiLevelLineages) {
					// Show as intermediate node (same level as other depth-1 orgs)
					const orgAtPos1 = lineage[1];
					if (!current[orgAtPos1]) {
						current[orgAtPos1] = {};
					}
					// Only add publication if it's different from the org name (trim and normalize)
					const normalizedPublication = String(publication).trim();
					const normalizedOrgName = String(orgAtPos1).trim();
					if (normalizedPublication !== normalizedOrgName && normalizedPublication !== '') {
						if (!current[orgAtPos1].publications) {
							current[orgAtPos1].publications = [];
						}
						if (!current[orgAtPos1].publications.includes(publication)) {
							current[orgAtPos1].publications.push(publication);
						}
					}
				} else {
					// No multi-level lineages: treat as direct publication
					if (!current.publications) {
						current.publications = [];
					}
					if (!current.publications.includes(publication)) {
						current.publications.push(publication);
					}
				}
			}
		});

		// Cleanup: Remove any publications that match their parent organization name
		function cleanupTree(node, parentName = null) {
			if (typeof node !== 'object' || node === null) return;
			
			Object.keys(node).forEach(key => {
				if (key === 'publications' && Array.isArray(node[key])) {
					// Filter out publications that match the parent name (normalized comparison)
					const normalizedParent = parentName ? String(parentName).trim() : null;
					node[key] = node[key].filter(pub => {
						if (!pub || pub === null || pub === undefined) return false;
						const normalizedPub = String(pub).trim();
						return normalizedPub !== normalizedParent && normalizedPub !== '';
					});
					// Remove publications array if empty
					if (node[key].length === 0) {
						delete node[key];
					}
				} else if (typeof node[key] === 'object' && node[key] !== null) {
					// Recursively clean child nodes, passing the key as the new parent name
					cleanupTree(node[key], key);
				}
			});
		}

		// Apply cleanup to all top-level trees
		Object.keys(tree).forEach(topLevel => {
			cleanupTree(tree[topLevel]);
		});

		return tree;
	}

	// Removed unused renderHierarchyNode function

	function normalizeSources(value) {
		if (!value) return [];
		if (Array.isArray(value)) {
			return value
				.filter(s => s && String(s).trim())
				.map(s => cleanUrl(String(s).trim()));
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			const results = [];
			
			// Step 1: Extract URLs from array format (complete or incomplete)
			// Pattern 1: Complete array format: ['https://...'] or ["https://..."]
			let match;
			const completeArrayPattern = /\[['"](https?:\/\/[^'"]+)['"]/g;
			while ((match = completeArrayPattern.exec(trimmed)) !== null) {
				const url = match[1].trim();
				if (url) {
					const cleaned = cleanUrl(url);
					if (cleaned && !results.includes(cleaned)) {
						results.push(cleaned);
					}
				}
			}
			
			// Pattern 2: Incomplete array format: ['https://... (missing closing quote/bracket)
			// This handles cases like ['https://www.lemonde.fr/... at the end of string
			// Try multiple patterns to catch different cases
			const incompleteArrayPattern1 = /\[['"](https?:\/\/[^\s,]+)/g;
			while ((match = incompleteArrayPattern1.exec(trimmed)) !== null) {
				let url = match[1].trim();
				// Remove any trailing quotes or brackets
				url = url.replace(/['"]+$/, '').replace(/\]$/, '').trim();
				if (url) {
					const cleaned = cleanUrl(url);
					if (cleaned && !results.includes(cleaned)) {
						results.push(cleaned);
					}
				}
			}
			
			// Pattern 2b: More aggressive - match ['https:// and capture everything to end of string
			// This handles cases where the URL is at the very end
			if (trimmed.includes("['https://") || trimmed.includes('["https://')) {
				const aggressivePattern = /\[['"](https?:\/\/.+?)(?=['"]\]|$)/;
				const aggressiveMatch = trimmed.match(aggressivePattern);
				if (aggressiveMatch) {
					let url = aggressiveMatch[1].trim();
					url = url.replace(/['"]+$/, '').replace(/\]$/, '').trim();
					if (url && !results.some(r => r.includes(url.replace(/^https?:\/\//, '')))) {
						const cleaned = cleanUrl(url);
						if (cleaned && !results.includes(cleaned)) {
							results.push(cleaned);
						}
					}
				}
			}
			
			// Pattern 3: Just the URL in quotes: 'https://...' or "https://..."
			const quotedUrlPattern = /['"](https?:\/\/[^'"]+)['"]/g;
			while ((match = quotedUrlPattern.exec(trimmed)) !== null) {
				const url = match[1].trim();
				if (url) {
					const cleaned = cleanUrl(url);
					if (cleaned && !results.includes(cleaned)) {
						results.push(cleaned);
					}
				}
			}
			
			// Pattern 4: Plain URL starting with http (not in quotes)
			const plainUrlPattern = /(https?:\/\/[^\s,]+)/g;
			while ((match = plainUrlPattern.exec(trimmed)) !== null) {
				const url = match[1] ? match[1].trim() : match[0].trim();
				if (url && url.startsWith('http')) {
					const cleaned = cleanUrl(url);
					if (cleaned && !results.includes(cleaned)) {
						results.push(cleaned);
					}
				}
			}
			
			// Step 2: Process the remaining string for plain domains
			// First, remove all array-formatted URLs we found
			let remaining = trimmed;
			// Remove array patterns we've already processed
			remaining = remaining.replace(/\[['"](https?:\/\/[^\s,]+)/g, '');
			remaining = remaining.replace(/\[['"](https?:\/\/[^'"]+)['"]/g, '');
			// Remove any remaining array markers and quotes
			remaining = remaining.replace(/\[['"]?/g, '').replace(/['"]?\]?/g, '');
			
			// Split by comma and process each part for plain domains
			const parts = remaining.split(',');
			for (const part of parts) {
				const cleaned = part.trim();
				if (!cleaned) continue;
				
				// Skip if it's just array markers, quotes, or too short
				if (cleaned === '[' || cleaned === ']' || cleaned === "'" || cleaned === '"' || cleaned.length < 3) {
					continue;
				}
				
				// Skip if it looks like part of a URL we already processed
				if (cleaned.includes('://') || cleaned.startsWith('www.')) {
					continue;
				}
				
				// Check if it's already a full URL
				if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
					const url = cleanUrl(cleaned);
					if (url && !results.includes(url)) {
						results.push(url);
					}
				} else if (cleaned.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/)) {
					// It's a domain name, add https://
					const url = `https://${cleaned}`;
					if (!results.includes(url)) {
						results.push(url);
					}
				}
			}
			
			// If we found results, return them
			if (results.length > 0) {
				return results;
			}
			
			// Try to parse as complete JSON array string (Python-style with single quotes)
			if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
				try {
					// Remove trailing comma before closing bracket
					let cleaned = trimmed.replace(/,\s*\]$/, ']');
					// Replace single quotes with double quotes for JSON parsing
					const jsonStr = cleaned.replace(/'/g, '"');
					const parsed = JSON.parse(jsonStr);
					return Array.isArray(parsed) 
						? parsed.filter(s => s && String(s).trim()).map(s => cleanUrl(String(s).trim()))
						: [];
				} catch (e) {
					// Already handled above with regex extraction
				}
			}
			
			// Single string value - check if it's a URL or domain
			const cleaned = cleanUrl(trimmed);
			if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
				return [cleaned];
			} else if (cleaned.match(/^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\.[a-zA-Z]{2,}/)) {
				return [`https://${cleaned}`];
			}
			
			return [];
		}
		return [];
	}

	function cleanUrl(url) {
		if (!url) return url;
		// Remove leading slash if present before http/https
		url = url.replace(/^\/+(https?:\/\/)/, '$1');
		// Remove any trailing slashes or whitespace
		url = url.trim();
		return url;
	}
</script>

<div class="card-view">
	<div class="timeline-container">
		{#each Object.entries(groupedData) as [monthYear, items]}
			<div class="timeline-row">
				<div class="month-label">
					<span>{monthYear.split(' ')[0]}</span>
					<span class="year-label">{monthYear.split(' ')[1]}</span>
				</div>
				<div class="timeline-divider"></div>
				<div class="month-group">
					{#each items as row, rowIndex (row)}
			{@const interactionType = getInteractionType(row.interaction)}
						{@const allPublishers = Array.isArray(row.organization_publisher_named_in_deal_suit) ? row.organization_publisher_named_in_deal_suit : []}
						{@const publisher = interactionType === 'lawsuit' ? allPublishers.join(', ') : (allPublishers[0] || '—')}
						{@const cardId = `${monthYear}-${rowIndex}-${row.date || ''}`}
						{@const allSources = normalizeSources(row.sources)}
						{@const aiCompany = Array.isArray(row.platform) && row.platform.length > 0 ? row.platform[0] : '—'}
						{@const parentChildMatches = Array.isArray(row.parent_child_matches) ? row.parent_child_matches : []}
						{@const orgsToDisplay = interactionType === 'lawsuit' && Array.isArray(row.plaintiff) && row.plaintiff.length > 0 ? row.plaintiff : allPublishers}
						{@const hierarchyTree = buildHierarchyTree(parentChildMatches, orgsToDisplay)}
						<div class="card-wrapper">
			<div class="card {interactionType}">
								<!-- Colored Header -->
								{#if !expandedCards.has(cardId)}
								<div 
									class="card-header {interactionType}"
									onclick={() => toggleExpandCard(cardId)}
									role="button"
									tabindex="0"
									onkeydown={(e) => e.key === 'Enter' && toggleExpandCard(cardId)}
								>
									<div class="header-content">
										{#if interactionType === 'lawsuit'}
											{#if Array.isArray(row.defendant) && row.defendant.length > 0 && Array.isArray(row.plaintiff) && row.plaintiff.length > 0}
												<div class="header-item">{@html highlightText(row.defendant.join(', '))}</div>
												<span class="header-pipe">|</span>
												<div class="header-item">{@html highlightText(row.plaintiff.join(', '))}</div>
											{:else if Array.isArray(row.defendant) && row.defendant.length > 0}
												<div class="header-item">{@html highlightText(row.defendant.join(', '))}</div>
											{/if}
										{:else}
											<div class="header-left">
												{#if Array.isArray(row.platform) && row.platform.length > 0}
													{#each row.platform as platform}
														<div class="header-item">{@html highlightText(platform)}</div>
													{/each}
												{/if}
					</div>
											<div class="header-separator"></div>
											<div class="header-right-content">
												{#if Array.isArray(allPublishers) && allPublishers.length > 0}
													{#each allPublishers as pub}
														<div class="header-item">{@html highlightText(pub)}</div>
													{/each}
												{/if}
								</div>
							{/if}
								</div>
									<div class="header-right">
										{#if row.date}
											<div class="header-date">{formatDate(row.date)}</div>
							{/if}
										<span class="expand-icon">{expandedCards.has(cardId) ? '−' : '+'}</span>
						</div>
						</div>
					{/if}
					
								<!-- Two Column Layout -->
								{#if expandedCards.has(cardId)}
									<div class="card-content">
										<div class="collapse-button" onclick={() => toggleExpandCard(cardId)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && toggleExpandCard(cardId)}>
											<span class="expand-icon">−</span>
										</div>
									<!-- Column 1 -->
									<div class="card-column column-1">
					<div class="card-field">
						<div class="field-label">{interactionType === 'lawsuit' ? 'Defendant(s)' : 'AI Company'}</div>
						<div class="field-value">
							{#if interactionType === 'lawsuit' && Array.isArray(row.defendant) && row.defendant.length > 0}
								{#each row.defendant as defendant}
									<div class="field-item">{@html highlightText(defendant)}</div>
								{/each}
							{:else if Array.isArray(row.platform) && row.platform.length > 0}
								{#each row.platform as platform}
									<div class="field-item">{@html highlightText(platform)}</div>
								{/each}
					{/if}
								</div>
				</div>

					<div class="card-field news-org-field">
						<div class="field-label">{interactionType === 'lawsuit' ? 'Plaintiff(s)' : 'News Org'}</div>
						<div class="field-value">
							{#each (interactionType === 'lawsuit' && Array.isArray(row.plaintiff) && row.plaintiff.length > 0 ? row.plaintiff : allPublishers) as org}
								{@const orgTree = hierarchyTree[org] || {}}
								{@const hasMatches = Object.keys(orgTree).length > 0 || (orgTree.publications && orgTree.publications.length > 0)}
								<div class="publisher-item">
									<div class="field-item">{@html highlightText(org)}</div>
									{#if hasMatches}
										<div class="affected-publications">
											{#snippet renderNode(node, parentName = null)}
												{#each Object.keys(node) as key}
													{@const child = node[key]}
													{#if key === 'publications'}
														{#each child as publication}
															{@const normalizedPub = String(publication || '').trim()}
															{@const normalizedParent = parentName ? String(parentName).trim() : ''}
															{#if normalizedPub !== normalizedParent && normalizedPub !== ''}
																<div class="affected-title">
																	{#if interactionType === 'grant'}
																		<span class="hierarchy-label">Grantee: </span>
																	{/if}
																	{@html highlightText(publication)}
																</div>
							{/if}
							{/each}
													{:else}
														<div class="hierarchy-intermediate">
															<span class="hierarchy-intermediate-name">
																{#if interactionType === 'grant'}
																	<span class="hierarchy-label">Grant Administrator: </span>
																{/if}
																{@html highlightText(key)}
															</span>
															<div class="hierarchy-intermediate-children">
																{@render renderNode(child, key)}
						</div>
					</div>
				{/if}
												{/each}
											{/snippet}
											{@render renderNode(orgTree, org)}
											{#if interactionType !== 'grant'}
												<div class="affected-note">
													* Affected publications as named in {interactionType === 'lawsuit' ? 'suit' : 'announcements'}
												</div>
							{/if}
						</div>
					{/if}
				</div>
							{/each}
						</div>
					</div>

					<div class="card-field">
						<div class="field-label">{interactionType === 'lawsuit' ? 'Complaint' : 'Type'}</div>
						<div class="field-value">
							{#if Array.isArray(row.type) && row.type.length > 0}
								{#each row.type as type}
									<div class="field-item">{@html highlightText(type)}</div>
								{/each}
							{/if}
						</div>
					</div>

										{#if interactionType === 'lawsuit'}
											{#if row.status}
												{@const status = String(row.status).toLowerCase().trim()}
												{@const statusClass = status.includes('progress') || status.includes('pending') || status.includes('ongoing') ? 'in-progress' : status.includes('settled') || status.includes('resolved') || status.includes('closed') || status.includes('summary judgement') ? 'settled' : status.includes('dismissed') || status.includes('dropped') ? 'dismissed' : 'default'}
					<div class="card-field">
													<div class="field-label">Status:</div>
													<div class="field-value">
														<span class="status-badge {statusClass}">
															<span class="status-indicator"></span>
															<span class="status-text">{@html highlightText(row.status)}</span>
														</span>
					</div>
												</div>
											{/if}
											{#if row.location}
					<div class="card-field">
													<div class="field-label">Location:</div>
													<div class="field-value">{@html highlightText(row.location)}</div>
												</div>
											{/if}
										{/if}
					</div>

									<!-- Column 2 -->
									<div class="card-column column-2">
					<div class="card-field reported-details">
						<div class="field-label">Reported Details</div>
						<div class="field-value">
							<span class="reported-text">
							{@html highlightText(row.reported_details || '—')}
							</span>
										</div>
									</div>

										{#if interactionType === 'lawsuit' && row.case_number && row.case_number}
											{@const caseNumber = String(row.case_number).trim()}
											{@const isUnknown = caseNumber.toLowerCase() === '(unknown)' || caseNumber.toLowerCase() === 'unknown' || caseNumber === '—' || caseNumber === 'nan'}
											{#if !isUnknown}
												<div class="card-field case-details-field">
													<div class="field-label">Case Details:</div>
													<div class="field-value">
														{#if row.case_filing && row.case_filing}
															<a href={row.case_filing} target="_blank" rel="noopener noreferrer" class="source-link">
																{@html highlightText(caseNumber)}
															</a>
														{:else}
															{@html highlightText(caseNumber)}
							{/if}
						</div>
					</div>
											{/if}
										{/if}

							{#if allSources.length > 0}
								<div class="citations-section">
									<div class="citations-label">Sources:</div>
									<div class="citations">
										{#each allSources as source, index}
											<a href={source} target="_blank" rel="noopener noreferrer" class="citation-link">{@html highlightText(getHostname(source))}</a>{#if index < allSources.length - 1}<span class="citation-separator">, </span>{/if}
							{/each}
						</div>
					</div>
				{/if}
						</div>
					</div>
				{/if}
							</div>
						</div>
					{/each}
					</div>
			</div>
		{/each}
		{#if filteredData.length === 0}
			<div class="no-results">
				No results found
			</div>
		{/if}
	</div>
</div>

<style>
	.card-view {
		width: 100%;
		margin-top: 1rem;
	}

	.timeline-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 3rem 4rem;
		overflow: visible;
		position: relative;
	}

	.timeline-row {
		display: grid;
		grid-template-columns: 100px 2px 1fr;
		gap: 2rem;
		align-items: flex-start;
		margin-bottom: 4rem;
		overflow: visible;
		overflow-x: visible;
	}

	.timeline-divider {
		background: #e0e0e0;
		width: 1.5px;
		height: 100%;
		opacity: 1;
	}

	.month-label {
		font-family: inherit;
		font-size: 1.5rem;
		font-weight: 600;
		color: #1a1a1a;
		text-transform: capitalize;
		position: sticky;
		top: calc(200px + 1rem);
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		padding-right: 0.5rem;
		margin-right: -1rem;
		z-index: 900;
		padding-top: 0.5rem;
		line-height: 1.2;
	}

	.year-label {
		font-size: 1rem;
		color: #666;
		margin-top: 0.25rem;
		font-weight: 400;
	}

	.month-group {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow: visible;
		overflow-x: visible;
		min-width: 0;
		width: 100%;
	}

	.card-wrapper {
		width: 100%;
		overflow: visible;
		position: relative;
		min-width: 0;
		margin-left: 0;
		padding-left: 0;
	}

	@media screen and (max-width: 768px) {
		.timeline-container {
			padding: 0 1rem 2rem;
		}

		.timeline-row {
		display: flex;
		flex-direction: column;
			margin-bottom: 2.5rem;
			gap: 0;
		}

		.timeline-divider {
			display: none;
		}

		.month-label {
			flex-direction: row;
			justify-content: flex-start;
			align-items: baseline;
			font-size: 1.25rem;
			position: static;
			padding: 0;
			padding-bottom: 1rem;
			margin-bottom: 1rem;
			border-bottom: 2px solid #DE5A35;
		}

		.year-label {
			font-size: 0.875rem;
			margin-top: 0;
			margin-left: 0.5rem;
			color: #666;
		}

		.month-group {
			gap: 1.25rem;
		}

		.card-content {
			display: flex !important;
			flex-direction: column !important;
			grid-template-columns: none !important;
			padding: 1rem;
		}

		.card-column.column-1 {
			padding: 0 !important;
			margin: 0 !important;
			padding-bottom: 1rem !important;
			border-right: none !important;
		border-bottom: 1px solid #e0e0e0;
			width: 100%;
		}

		.card-column.column-2 {
			padding: 0 !important;
			margin: 0 !important;
			padding-left: 0 !important;
			padding-right: 0 !important;
			padding-top: 1rem !important;
			width: 100%;
		}

		.card-column {
			align-items: flex-start;
		}

		.card-column.column-2 .card-field {
			margin-left: 0;
			padding-left: 0;
	}

	.card-header {
			padding: 0.5rem 1rem;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

		.header-content {
		gap: 0.75rem;
		}

		.header-item {
			font-size: 0.85rem;
		}

		.header-separator {
			margin: 0.15rem 0;
		}

		.header-right {
		flex-direction: column;
			align-items: flex-end;
			gap: 0.5rem;
		}

		.header-date {
			font-size: 0.65rem;
		}

		.header-type-tags {
			display: none !important;
		}

		.type-tag {
			font-size: 0.7rem;
			padding: 0.15rem 0.4rem;
		}

		.card-field {
			gap: 0.25rem;
		display: flex;
		flex-direction: column;
			align-items: flex-start;
		}

		.field-label {
			font-size: 0.65rem;
			width: 100%;
			text-align: left;
		}

		.field-value {
		font-size: 0.85rem;
			width: 100%;
			text-align: left;
		}

		.publisher-hierarchy {
		gap: 0.5rem;
			width: 100%;
			align-items: flex-start;
			margin-left: 1rem;
			padding-left: 0.5rem;
	}

		.publisher-tag {
		font-size: 0.75rem;
			padding: 0.2rem 0.5rem;
		}

		.hierarchy-item-text {
			font-size: 0.75rem;
		}

		.affected-publications {
			margin-left: 1.25rem;
			padding-left: 0.75rem;
		}

		.affected-title {
			font-size: 0.75rem;
			padding-left: 0.75rem;
		}

		.affected-title::before {
			left: -0.75rem;
			width: 0.75rem;
		}

		.affected-title:not(:last-child)::after {
			left: -0.75rem;
		}

		.affected-note {
			font-size: 0.65rem;
			padding-left: 0.75rem;
		}

		.affected-note::before {
			left: -0.75rem;
			width: 0.75rem;
		}

		.hierarchy-intermediate {
			padding-left: 0.75rem;
		}

		.hierarchy-intermediate::before {
			left: -0.75rem;
			width: 0.75rem;
		}

		.hierarchy-intermediate-children {
			margin-left: 0.75rem;
			padding-left: 0.75rem;
		}

		.tag {
			font-size: 0.75rem;
			padding: 0.2rem 0.5rem;
		}

		.source-link {
		font-size: 0.85rem;
			word-break: break-word;
		}

		.expand-icon {
			font-size: 1rem;
		}
	}

	.card {
		width: 100%;
		min-width: 0;
		background-color: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 0;
		box-shadow: none;
		transition: background-color 0.2s ease;
		display: flex;
		flex-direction: column;
		margin-bottom: 0;
		margin-left: 0;
		box-sizing: border-box;
		position: relative;
		overflow: hidden;
	}

	.card:hover {
		background-color: #fafafa;
	}

	/* Colored Header */
	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem 1.2rem;
		background-color: white;
		color: #333;
		font-weight: 600;
		font-size: 0.85rem;
		letter-spacing: 0.5px;
		border-radius: 0;
		border-bottom: 1px solid #e0e0e0;
		cursor: pointer;
		user-select: none;
		transition: background-color 0.2s ease;
	}

	.card-header:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.card-header.grant:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.card-header.lawsuit:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.card-header.deal:hover {
		background-color: rgba(0, 0, 0, 0.02);
	}

	.card.lawsuit {
		border-left: 3px solid #e57373;
	}

	.card.grant {
		border-left: 3px solid #64b5f6;
	}

	.card.deal {
		border-left: 3px solid #81c784;
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex: 1;
		min-width: 0;
		flex-wrap: wrap;
	}

	.header-left {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex-shrink: 0;
	}

	.header-separator {
		width: 1px;
		background-color: #d0d0d0;
		align-self: stretch;
		margin: 0.2rem 0;
		flex-shrink: 0;
	}

	.header-right-content {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 0;
	}

	.header-item {
		font-weight: 600;
		font-size: 0.7rem;
		line-height: 1.4;
		color: #333;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.header-pipe {
		font-weight: 400;
		font-size: 0.85rem;
		color: #999;
		margin: 0 0.5rem;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-shrink: 0;
		flex-direction: row;
	}

	.header-date {
		font-size: 0.65rem;
		color: #666;
		font-weight: 500;
		white-space: nowrap;
	}

	.header-type-tags {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		align-items: flex-end;
	}

	.type-tag {
		display: inline-block;
		background-color: rgba(255, 255, 255, 0.7);
		color: #333;
		padding: 0.15rem 0.5rem;
		border-radius: 3px;
		font-size: 0.65rem;
		font-weight: 500;
		line-height: 1.3;
		white-space: nowrap;
	}

	.expand-icon {
		font-size: 1.2rem;
		font-weight: 300;
		line-height: 1;
		width: 1.5rem;
		text-align: center;
		transition: transform 0.2s ease;
		flex-shrink: 0;
	}

	/* Two Column Content Layout */
	.card-content {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
		padding: 1.5rem;
		position: relative;
	}

	.collapse-button {
		position: absolute;
		top: 0.5rem;
		right: 1rem;
		cursor: pointer;
		user-select: none;
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.collapse-button:hover {
		background-color: #f5f5f5;
	}

	.collapse-button .expand-icon {
		font-size: 1rem;
		color: #666;
	}

	.card-column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0;
		overflow-wrap: break-word;
		word-wrap: break-word;
	}

	.card-column.column-1 {
		padding-right: 1.5rem;
		border-right: 1px solid #e0e0e0;
	}

	.card-column.column-2 {
		padding-left: 1.5rem;
	}

	.links-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.25rem;
	}

	.source-link {
		color: #254c6f;
		text-decoration: none;
		font-size: 0.9rem;
		transition: color 0.2s ease;
	}

	.source-link:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.card-field {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}

	.field-label {
		font-size: 0.65rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #999;
		margin-bottom: 0.05rem;
	}

	.field-value {
		font-size: 0.9rem;
		line-height: 1.5;
		color: #1a1a1a;
		font-weight: 500;
		word-wrap: break-word;
		overflow-wrap: break-word;
		word-break: break-word;
		min-width: 0;
	}

	/* Field items - display items in flex layout */
	.field-value:has(.field-item):not(:has(.publisher-item)) {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: flex-start;
	}
	
	.field-item {
		font-size: 0.9rem;
		color: #1a1a1a;
		font-weight: 500;
		line-height: 1.5;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	.field-value:has(.publisher-item) {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		align-items: flex-start;
	}

	.tag {
		display: inline-block;
		background-color: #f5f5f5;
		color: #2c3e50;
		padding: 0.35rem 0.75rem;
		border-radius: 4px;
		font-size: 0.85rem;
		font-weight: 500;
		line-height: 1.4;
		width: fit-content;
		max-width: 100%;
		word-wrap: break-word;
		overflow-wrap: break-word;
		border: 1px solid #e8e8e8;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
		position: relative;
	}

	/* Publisher Hierarchy Styles */
	.publisher-hierarchy {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		position: relative;
		margin-left: 1.25rem;
		padding-left: 0.75rem;
	}

	/* Vertical line from field-label to all children */
	.publisher-hierarchy::before {
		content: '';
		position: absolute;
		left: 0;
		top: -0.4rem;
		bottom: 0;
		width: 1.5px;
		background-color: #e0e0e0;
	}

	.publisher-item {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		position: relative;
		width: fit-content;
		align-items: flex-start;
		margin-bottom: 0;
	}
	
	/* Add margin only when publisher-item has children */
	.publisher-item:has(.affected-publications) {
		margin-bottom: 0.3rem;
	}
	
	/* Reduce margin when publisher-item has hierarchy-intermediate (grandchildren) */
	.publisher-item:has(.hierarchy-intermediate) {
		margin-bottom: 0.2rem;
	}

	/* Vertical line from tag down to connect with children */
	.publisher-item:has(.affected-publications) .tag::after {
		content: '';
		position: absolute;
		left: 0.5rem;
		bottom: -0.15rem;
		width: 1px;
		height: 0.15rem;
		background-color: #e5e5e5;
	}


	.publisher-tag {
		display: inline-block;
		background-color: #f0f0f0;
		color: #333;
		padding: 0.25rem 0.6rem;
		border-radius: 3px;
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1.4;
		white-space: nowrap;
		align-self: flex-start;
		position: relative;
	}

	.hierarchy-item-text {
		display: inline-block;
		color: #333;
		font-size: 0.8rem;
		font-weight: 500;
		line-height: 1.4;
		white-space: nowrap;
		align-self: flex-start;
		position: relative;
	}

	.affected-publications {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		margin-left: 0.5rem;
		padding-left: 0.5rem;
		position: relative;
		margin-top: 0.15rem;
		padding-top: 0.15rem;
		border-left: 1.5px solid #e5e5e5;
	}
	
	/* Reduce gap when affected-publications contains hierarchy-intermediate (grandchildren) */
	.affected-publications:has(.hierarchy-intermediate) {
		gap: 0.1rem;
	}

	.affected-note {
		font-size: 0.65rem;
		color: #999;
		font-style: italic;
		margin-top: 0.5rem;
		position: relative;
		padding-left: 0;
	}

	.hierarchy-intermediate {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-left: 0;
		padding-left: 0.5rem;
		position: relative;
		margin-top: 0.1rem;
		margin-bottom: 0.1rem;
	}

	/* Horizontal dash connecting from vertical line to this child */
	.hierarchy-intermediate::before {
		content: '';
		position: absolute;
		left: -0.5rem;
		top: 0.75rem;
		width: 0.5rem;
		height: 1.5px;
		background-color: #e5e5e5;
	}


	.hierarchy-intermediate-name {
		font-size: 0.8rem;
		color: #333;
		font-weight: 400;
		line-height: 1.5;
		position: relative;
		padding-left: 0;
		margin-bottom: 0;
	}

	.hierarchy-label {
		font-weight: 600;
		color: #666;
		font-size: 0.75rem;
	}

	.hierarchy-intermediate-children {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		margin-left: 1.25rem;
		padding-left: 0.5rem;
		position: relative;
		margin-top: 0.15rem;
		border-left: 1.5px solid #e5e5e5;
		padding-top: 0.15rem;
	}

	/* Horizontal dash connecting from vertical line to each publication */
	.affected-title::before {
		content: '';
		position: absolute;
		left: -0.5rem;
		top: 0.75rem;
		width: 0.5rem;
		height: 1.5px;
		background-color: #e5e5e5;
	}

	.affected-title {
		font-size: 0.8rem;
		color: #555;
		font-weight: 400;
		line-height: 1.5;
		font-style: italic;
		position: relative;
		padding-left: 0.75rem;
		margin: 0;
	}

	.card-field.reported-details .field-value {
		line-height: 1.6;
		font-weight: 400;
	}

	.card-field.case-details-field {
		padding-bottom: 0;
		margin-bottom: 0;
	}

	.citations-section {
		margin-top: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.citations-label {
		font-size: 0.65rem;
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #999;
		margin-bottom: 0.3rem;
	}

	.citations {
		display: block;
		line-height: 1.6;
		word-wrap: break-word;
		overflow-wrap: break-word;
		word-break: break-all;
	}

	.citation-link {
		color: #254c6f;
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 400;
		transition: color 0.2s ease;
		word-break: break-all;
	}

	.citation-link:hover {
		color: #1a3a52;
		text-decoration: underline;
	}

	.citation-separator {
		color: #666;
		margin: 0 0.15rem;
	}

	.status-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.6rem;
		border-radius: 4px;
		background-color: #f5f5f5;
		font-size: 0.85rem;
	}

	.status-indicator {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.status-badge.in-progress .status-indicator {
		background-color: #ffb300;
		box-shadow: 0 0 0 2px rgba(255, 179, 0, 0.2);
	}

	.status-badge.settled .status-indicator {
		background-color: #4caf50;
		box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
	}

	.status-badge.dismissed .status-indicator {
		background-color: #9e9e9e;
		box-shadow: 0 0 0 2px rgba(158, 158, 158, 0.2);
	}

	.status-badge.default .status-indicator {
		background-color: #666;
		box-shadow: 0 0 0 2px rgba(102, 102, 102, 0.2);
	}

	.status-text {
		color: #333;
		font-weight: 400;
	}

	.status-badge.header-status {
		padding: 0.15rem 0.4rem;
		background-color: transparent;
	}

	.status-badge.header-status .status-indicator {
		width: 10px;
		height: 10px;
	}

	.expand-btn {
		display: inline-block;
		margin-top: 0.5rem;
		background: none;
		border: none;
		color: #254c6f;
		cursor: pointer;
		font-size: 0.75rem;
		padding: 0;
		text-decoration: underline;
		font-weight: 500;
	}

	.expand-btn:hover {
		color: #1a3a52;
	}

	.titles-section {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #eee;
	}

	.titles-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}

	.title-tag {
		display: inline-block;
		background-color: #f0f0f0;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
		font-size: 0.75rem;
		color: #333;
	}

	.no-results {
		grid-column: 1 / -1;
		text-align: center;
		color: #999;
		padding: 3rem;
		font-style: italic;
		background-color: #fff;
		border: 1px solid #e0e0e0;
		border-radius: 8px;
	}

	.highlight {
		background-color: #ffeb3b;
		padding: 0;
		border-radius: 2px;
		font-weight: 600;
		color: #1a1a1a;
	}
</style>

