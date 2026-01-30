export const createIndexManager = ({ fetchJson, urls, minYear = 2025, state, getMonthIndexYears, getInstitutionShards }) => {
	const mergeMonthData = (data) => {
		let updated = false;
		if (data && typeof data === 'object') {
			for (const [key, ids] of Object.entries(data)) {
				if (!Array.isArray(ids)) continue;
				if (state.monthIndex[key]) {
					state.monthIndex[key] = [...state.monthIndex[key], ...ids];
				} else {
					state.monthIndex[key] = ids;
				}
				updated = true;
			}
		}
		return updated;
	};

	const finalizeMonthIndex = () => {
		const manifestKeys = Array.from(state.manifestMonthCounts.keys());
		const allKeys = Array.from(new Set([...Object.keys(state.monthIndex), ...manifestKeys]));

		state.months = allKeys
			.filter((k) => {
				if (k === '_no_date') return false;
				const year = Number((k || '').split('-')[0]);
				return Number.isFinite(year) && year >= minYear;
			})
			.sort()
			.reverse();

		state.globalIds = [];
		for (const month of state.months) {
			const ids = state.monthIndex[month];
			if (Array.isArray(ids)) {
				state.globalIds.push(...ids);
			}
		}
		state.noDateIds = [];
	};

	const loadMonthIndexFile = (year) => fetchJson(urls.monthIndex(year));

	const ensureMonthIndexesForSelection = async (monthsToLoad) => {
		if (!Array.isArray(monthsToLoad) || monthsToLoad.length === 0) return;
		const yearsToLoad = new Set(
			monthsToLoad
				.map((monthKey) => String(monthKey || '').split('-')[0])
				.filter((year) => /^\d{4}$/.test(year))
		);

		let updated = false;
		for (const year of yearsToLoad) {
			if (state.loadedMonthFiles.has(year)) continue;
			const data = await loadMonthIndexFile(year);
			state.loadedMonthFiles.add(year);
			updated = mergeMonthData(data) || updated;
		}

		if (updated) {
			finalizeMonthIndex();
		}
	};

	const ensureAllMonthIndexes = async () => {
		const baseMonths = Array.isArray(state.months) && state.months.length > 0 ? state.months : [];
		const yearsToLoad = new Set(
			(baseMonths.length > 0 ? baseMonths : [])
				.map((monthKey) => String(monthKey || '').split('-')[0])
				.filter((year) => /^\d{4}$/.test(year))
		);

		if (yearsToLoad.size === 0) {
			const { years } = await getMonthIndexYears();
			years.forEach((year) => yearsToLoad.add(year));
		}

		let updated = false;
		for (const year of yearsToLoad) {
			if (state.loadedMonthFiles.has(year)) continue;
			const data = await loadMonthIndexFile(year);
			state.loadedMonthFiles.add(year);
			updated = mergeMonthData(data) || updated;
		}

		if (updated) {
			finalizeMonthIndex();
		}
	};

	const ensureMonthIndexesForStats = async () => {
		if (state.selectedMonths.length > 0) {
			await ensureMonthIndexesForSelection(state.selectedMonths);
			return;
		}
		await ensureAllMonthIndexes();
	};

	const loadInstitutionShard = (shard) => fetchJson(urls.institutionShard(shard));

	const ensureInstitutionShardsForSelection = async (selected) => {
		if (!Array.isArray(selected) || selected.length === 0) return;
		if (!Array.isArray(state.institutionShards) || state.institutionShards.length === 0) {
			await getInstitutionShards();
		}
		const shardsToLoad = new Set();
		for (const inst of selected) {
			if (!inst || typeof inst !== 'string') continue;
			const shardKey = inst.trim().charAt(0).toLowerCase();
			if (shardKey && state.institutionShards?.includes(shardKey)) {
				shardsToLoad.add(shardKey);
			}
		}

		if (shardsToLoad.size === 0) return;

		const results = await Promise.allSettled(
			[...shardsToLoad].map((shard) =>
				loadInstitutionShard(shard).then((data) => ({ shard, data }))
			)
		);

		for (const result of results) {
			if (result.status !== 'fulfilled') continue;
			const { shard, data } = result.value;
			if (state.loadedInstitutionShards.has(shard)) continue;
			if (data && typeof data === 'object') {
				Object.assign(state.institutionIndex, data);
				state.loadedInstitutionShards.add(shard);
			}
		}
	};

	const ensureAllInstitutionShards = async () => {
		const shards = await getInstitutionShards();
		const shardsToLoad = shards.filter((shard) => !state.loadedInstitutionShards.has(shard));
		if (shardsToLoad.length === 0) return;

		const results = await Promise.allSettled(
			shardsToLoad.map((shard) => loadInstitutionShard(shard).then((data) => ({ shard, data })))
		);

		for (const result of results) {
			if (result.status !== 'fulfilled') continue;
			const { shard, data } = result.value;
			if (state.loadedInstitutionShards.has(shard)) continue;
			if (data && typeof data === 'object') {
				Object.assign(state.institutionIndex, data);
				state.loadedInstitutionShards.add(shard);
			}
		}
	};

	const ensureInstitutionIndexesForStats = async () => {
		if (state.selectedInstitutions.length > 0) {
			await ensureInstitutionShardsForSelection(state.selectedInstitutions);
			return;
		}
		await ensureAllInstitutionShards();
	};

	return {
		mergeMonthData,
		finalizeMonthIndex,
		loadMonthIndexFile,
		ensureMonthIndexesForSelection,
		ensureAllMonthIndexes,
		ensureMonthIndexesForStats,
		loadInstitutionShard,
		ensureInstitutionShardsForSelection,
		ensureAllInstitutionShards,
		ensureInstitutionIndexesForStats
	};
};
