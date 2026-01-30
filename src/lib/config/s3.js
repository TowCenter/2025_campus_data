export const S3_BASE = 'https://2025-campus-data.s3.us-east-2.amazonaws.com';

export const URLS = {
	fullData: `${S3_BASE}/data.json`,
	metadata: `${S3_BASE}/metadata.json`,
	monthManifest: `${S3_BASE}/month_index/manifest.json`,
	institutionManifest: `${S3_BASE}/institution_index/manifest.json`,
	monthIndex: (year) => `${S3_BASE}/month_index/${year}.json`,
	institutionShard: (letter) => `${S3_BASE}/institution_index/${letter}.json`,
	monthIndexNoDate: `${S3_BASE}/month_index/_no_date.json`,
	article: (id) => `${S3_BASE}/articles/${id}.json`,
	searchTerm: (token) => `${S3_BASE}/search_term/${token}.json`
};

export const parseTolerantJson = (text) => JSON.parse(text.replace(/,\s*([}\]])/g, '$1'));

export const fetchTolerantJson = async (url, { fetch: fetchFn = fetch, cache = 'no-cache' } = {}) => {
	const response = await fetchFn(url, { cache });
	if (!response.ok) {
		throw new Error(`Fetch failed ${response.status}: ${url}`);
	}
	const text = await response.text();
	return parseTolerantJson(text);
};
