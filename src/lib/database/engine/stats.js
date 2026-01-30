export const createStatsManager = ({ state, ensureMonthIndexesForStats, ensureInstitutionIndexesForStats, getActiveIds, getTotalCount }) => {
	const getActiveMonthlyCounts = async ({ includeEmpty = false } = {}) => {
		const activeIds = getActiveIds();
		if (!activeIds || activeIds.length === 0) return {};
		await ensureMonthIndexesForStats();
		const activeSet = new Set(activeIds);
		const counts = {};

		for (const monthKey of state.months) {
			if (monthKey === '_no_date') continue;
			const ids = state.monthIndex[monthKey];
			if (!Array.isArray(ids) || ids.length === 0) {
				if (includeEmpty) counts[monthKey] = 0;
				continue;
			}
			let count = 0;
			for (const id of ids) {
				if (activeSet.has(id)) count += 1;
			}
			if (count > 0 || includeEmpty) counts[monthKey] = count;
		}

		return counts;
	};

	const getActiveInstitutionCounts = async ({ includeEmpty = false } = {}) => {
		const activeIds = getActiveIds();
		if (!activeIds || activeIds.length === 0) return {};
		await ensureInstitutionIndexesForStats();
		const activeSet = new Set(activeIds);
		const counts = {};

		for (const [institution, ids] of Object.entries(state.institutionIndex)) {
			if (!Array.isArray(ids) || ids.length === 0) {
				if (includeEmpty) counts[institution] = 0;
				continue;
			}
			let count = 0;
			for (const id of ids) {
				if (activeSet.has(id)) count += 1;
			}
			if (count > 0 || includeEmpty) counts[institution] = count;
		}

		return counts;
	};

	const getActiveStats = async ({ topN = 5 } = {}) => {
		const [monthlyCounts, institutionCounts] = await Promise.all([
			getActiveMonthlyCounts(),
			getActiveInstitutionCounts()
		]);

		const topInstitutions = Object.entries(institutionCounts)
			.filter(([, count]) => count > 0)
			.sort((a, b) => b[1] - a[1])
			.slice(0, topN)
			.map(([org, count]) => ({ org, count }));

		const totalSchools = Object.values(institutionCounts).filter((count) => count > 0).length;

		return {
			monthlyCounts,
			institutionCounts,
			topInstitutions,
			totalRecords: getTotalCount(),
			totalSchools
		};
	};

	return {
		getActiveMonthlyCounts,
		getActiveInstitutionCounts,
		getActiveStats
	};
};
