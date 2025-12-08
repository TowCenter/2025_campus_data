/**
 * Hierarchy tree building utilities
 */

// Cache for hierarchy trees
const hierarchyTreeCache = new Map();

/**
 * Memoization helper for functions with primitive parameters
 */
function memoizePrimitive(fn, cache, maxSize = 1000) {
	return function(...args) {
		const key = JSON.stringify(args);
		if (cache.has(key)) {
			return cache.get(key);
		}
		const result = fn.apply(this, args);
		cache.set(key, result);
		// Limit cache size to prevent memory issues
		if (cache.size > maxSize) {
			const firstKey = cache.keys().next().value;
			cache.delete(firstKey);
		}
		return result;
	};
}

/**
 * Build hierarchical tree from parent_child_matches using lineage
 * This ensures all organizations at the same depth appear at the same level (proper org chart)
 */
function buildHierarchyTreeImpl(matches, newsOrgs = []) {
	if (!Array.isArray(matches) || matches.length === 0) return {};

	const tree = {};
	
	// First pass: determine if we have any 3+ level lineages
	const hasMultiLevelLineages = matches.some(match => 
		match.lineage && Array.isArray(match.lineage) && match.lineage.length > 2
	);
	
	// Second pass: build the tree structure
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
				const orgAtPos1 = lineage[1];
				if (!current[orgAtPos1]) {
					current[orgAtPos1] = {};
				}
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
				const normalizedParent = parentName ? String(parentName).trim() : null;
				node[key] = node[key].filter(pub => {
					if (!pub || pub === null || pub === undefined) return false;
					const normalizedPub = String(pub).trim();
					return normalizedPub !== normalizedParent && normalizedPub !== '';
				});
				if (node[key].length === 0) {
					delete node[key];
				}
			} else if (typeof node[key] === 'object' && node[key] !== null) {
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

export const buildHierarchyTree = memoizePrimitive(buildHierarchyTreeImpl, hierarchyTreeCache, 200);

