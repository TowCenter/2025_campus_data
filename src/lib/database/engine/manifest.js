const sortYearsDesc = (years) =>
	Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));

export const createManifestManager = ({ fetchJson, urls, minYear = 2025, state }) => {
	const getMonthIndexYears = async () => {
		const manifestData = await fetchJson(urls.monthManifest);
		const years = Object.keys(manifestData || {}).filter(
			(key) => /^\d{4}$/.test(key) && Number(key) >= minYear
		);
		if (years.length === 0) {
			throw new Error('Month index manifest is empty');
		}
		return { years: sortYearsDesc(years), manifest: manifestData };
	};

	const loadMonthManifestOptions = async () => {
		const { manifest } = await getMonthIndexYears();

		state.manifestMonthCounts = new Map();
		if (manifest) {
			for (const [yearKey, yearData] of Object.entries(manifest)) {
				if (!/^\d{4}$/.test(yearKey) || Number(yearKey) < minYear) continue;
				if (yearData && typeof yearData === 'object') {
					for (const [key, count] of Object.entries(yearData)) {
						const year = Number((key || '').split('-')[0]);
						if (Number.isFinite(year) && year >= minYear) {
							state.manifestMonthCounts.set(key, count);
						}
					}
				}
			}
		}

		const manifestKeys = Array.from(state.manifestMonthCounts.keys());
		state.months = manifestKeys
			.filter((k) => {
				if (k === '_no_date') return false;
				const year = Number((k || '').split('-')[0]);
				return Number.isFinite(year) && year >= minYear;
			})
			.sort()
			.reverse();

		state.monthFiltersReady = true;
	};

	const loadInstitutionManifestOptions = async () => {
		const manifest = await fetchJson(urls.institutionManifest);
		const shards = Object.keys(manifest || {}).filter(
			(key) => manifest[key] && typeof manifest[key] === 'object'
		);
		if (shards.length === 0) {
			throw new Error('Institution manifest is empty');
		}
		state.institutionManifest = manifest;
		state.institutionShards = shards;
		state.institutions = shards
			.flatMap((shard) => Object.keys(manifest[shard] || {}))
			.filter(Boolean)
			.sort((a, b) => a.localeCompare(b));
	};

	const getInstitutionShards = async () => {
		if (Array.isArray(state.institutionShards) && state.institutionShards.length > 0) {
			return state.institutionShards;
		}
		const manifest = await fetchJson(urls.institutionManifest);
		state.institutionManifest = manifest;
		const shards = Object.keys(manifest || {}).filter(
			(key) => manifest[key] && typeof manifest[key] === 'object'
		);
		if (shards.length === 0) {
			throw new Error('Institution manifest is empty');
		}
		state.institutionShards = shards;
		return state.institutionShards;
	};

	return {
		getMonthIndexYears,
		loadMonthManifestOptions,
		loadInstitutionManifestOptions,
		getInstitutionShards
	};
};
